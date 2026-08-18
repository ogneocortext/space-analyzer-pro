"""SQLite-backed store for UX analysis reports.

This module is the persistence layer that replaces ad-hoc on-disk JSON/HTML
scanning for retrieving analysis reports (including the ones produced by the
self-improvement loop across many iterations).  The filesystem artifacts
(``ux_analysis_*.json`` / ``*.html``) remain as a portable backup, but the
database is now the canonical, queryable source of truth.

Design mirrors ``ux_pipeline._sqlite_store``: stdlib ``sqlite3`` only, WAL
journaling for concurrent server/analyzer access, ``row_factory`` rows, and an
indexed ``reports`` table with metadata columns so reports can be listed and
filtered (by model, screenshot set, status) without deserializing the full JSON.

The full report JSON and rendered HTML are stored verbatim so a report can be
re-served or re-analyzed directly from the database.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Sequence

DEFAULT_DB_NAME = "ux_reports.db"

CREATE_TABLE = """\
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_key TEXT UNIQUE NOT NULL,
    screenshot_set TEXT,
    model TEXT,
    status TEXT,
    timestamp TEXT,
    report_json TEXT,
    html TEXT,
    summary_text TEXT,
    code_recs TEXT,
    severity_counts TEXT,
    num_issues INTEGER,
    num_recommendations INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
);
"""

CREATE_INDEX_KEY = "CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_key ON reports(report_key);"
CREATE_INDEX_TS = "CREATE INDEX IF NOT EXISTS idx_reports_ts ON reports(timestamp);"
CREATE_INDEX_SET = "CREATE INDEX IF NOT EXISTS idx_reports_set ON reports(screenshot_set);"
CREATE_INDEX_MODEL = "CREATE INDEX IF NOT EXISTS idx_reports_model ON reports(model);"
CREATE_INDEX_STATUS = "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);"

SCHEMA_STMTS = [
    CREATE_TABLE,
    CREATE_INDEX_KEY,
    CREATE_INDEX_TS,
    CREATE_INDEX_SET,
    CREATE_INDEX_MODEL,
    CREATE_INDEX_STATUS,
]


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _maybe_parse(value: Any) -> Any | None:
    """Parse a JSON string into Python, passing dicts/lists through untouched."""
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def _count_issues(report: dict[str, Any]) -> tuple[dict[str, int], int, int]:
    """Derive severity tallies, total issues, and recommendation count.

    Supports both the current report shape (``ux_recommendations.per_shot_data``
    plus a ``deduped`` grouping) and the legacy shape (``per_screenshot`` holds
    raw JSON strings).  Returns ``(severity_counts, num_issues,
    num_recommendations)``.
    """
    ux = report.get("ux_recommendations") or {}
    per_shot_data = ux.get("per_shot_data") or {}
    per_screenshot = ux.get("per_screenshot") or {}
    deduped = ux.get("deduped")

    issues: list[dict[str, Any]] = []
    if isinstance(per_shot_data, dict) and per_shot_data:
        for value in per_shot_data.values():
            if isinstance(value, dict):
                issues.extend(value.get("issues") or [])
    elif isinstance(per_screenshot, dict):
        # Legacy reports stored the per-shot analysis as raw JSON strings.
        for value in per_screenshot.values():
            parsed = _maybe_parse(value)
            if isinstance(parsed, dict):
                issues.extend(parsed.get("issues") or [])

    num_recs = 0
    if isinstance(deduped, list):
        for group in deduped:
            if isinstance(group, dict):
                issues.extend(group.get("issues") or [])
        num_recs = len(deduped)
    else:
        num_recs = len([v for v in per_screenshot.values() if v])

    sev = {"high": 0, "medium": 0, "low": 0}
    for item in issues:
        if not isinstance(item, dict):
            continue
        s = str(item.get("severity", "low")).lower()
        if s in sev:
            sev[s] += 1

    return sev, len(issues), num_recs


class ReportsStore:
    """SQLite persistence for UX analysis reports.

    Parameters
    ----------
    db_path:
        Path to the ``.db`` file.  Defaults to ``<shots_root>/ux_reports.db``
        (``macro_logs/ux_reports.db`` when using the default shots root).
    """

    def __init__(self, db_path: str | Path = DEFAULT_DB_NAME) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._init_schema()

    # ------------------------------------------------------------------ #
    # Schema
    # ------------------------------------------------------------------ #
    def _init_schema(self) -> None:
        cur = self._conn.cursor()
        for stmt in SCHEMA_STMTS:
            cur.execute(stmt)
        # Backward-compatible migration: add updated_at to databases created
        # before this column existed.
        existing = {r[1] for r in cur.execute("PRAGMA table_info(reports)").fetchall()}
        if "updated_at" not in existing:
            cur.execute("ALTER TABLE reports ADD COLUMN updated_at TEXT")
        self._conn.commit()

    # ------------------------------------------------------------------ #
    # Writes
    # ------------------------------------------------------------------ #
    def upsert_from_report(
        self,
        report: dict[str, Any],
        *,
        html: str | None = None,
        report_key: str | None = None,
        screenshot_set: str | None = None,
    ) -> str:
        """Persist a full report dict (plus optional rendered HTML).

        ``report_key`` defaults to the report's ``timestamp``-derived key when
        present, else the ``model`` + ``timestamp``.  Returns the report key.
        """
        if not report_key:
            report_key = self._derive_key(report)
        model = report.get("model") or report.get("combined_model") or "—"
        status = report.get("status") or "complete"
        timestamp = report.get("timestamp") or ""

        sev, num_issues, num_recs = _count_issues(report)
        summary = (report.get("ux_recommendations") or {}).get("summary")
        code_recs = report.get("code_recommendations")

        if screenshot_set is None:
            screenshot_set = self._derive_set(report_key, model)

        cur = self._conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO reports
            (report_key, screenshot_set, model, status, timestamp,
             report_json, html, summary_text, code_recs,
             severity_counts, num_issues, num_recommendations, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (
                report_key,
                screenshot_set,
                model,
                status,
                timestamp,
                json.dumps(report, ensure_ascii=False),
                html,
                _coerce_text(summary),
                _coerce_text(code_recs),
                json.dumps(sev, ensure_ascii=False),
                num_issues,
                num_recs,
            ),
        )
        self._conn.commit()
        return report_key

    def upsert_raw(
        self,
        report_key: str,
        *,
        screenshot_set: str | None = None,
        model: str | None = None,
        status: str | None = None,
        timestamp: str | None = None,
        report_json: str | None = None,
        html: str | None = None,
        summary_text: str | None = None,
        code_recs: str | None = None,
        severity_counts: str | None = None,
        num_issues: int | None = None,
        num_recommendations: int | None = None,
    ) -> None:
        """Low-level upsert used by the file migration helper."""
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM reports WHERE report_key = ?", (report_key,))
        row = cur.fetchone()
        if row is None:
            cur.execute(
                """INSERT INTO reports
                (report_key, screenshot_set, model, status, timestamp,
                 report_json, html, summary_text, code_recs,
                 severity_counts, num_issues, num_recommendations, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                (
                    report_key,
                    screenshot_set,
                    model,
                    status or "complete",
                    timestamp,
                    report_json,
                    html,
                    summary_text,
                    code_recs,
                    severity_counts,
                    num_issues,
                    num_recommendations,
                ),
            )
        else:
            updates: list[str] = []
            params: list[Any] = []
            mapping = {
                "screenshot_set": screenshot_set,
                "model": model,
                "status": status,
                "timestamp": timestamp,
                "report_json": report_json,
                "html": html,
                "summary_text": summary_text,
                "code_recs": code_recs,
                "severity_counts": severity_counts,
                "num_issues": num_issues,
                "num_recommendations": num_recommendations,
            }
            for col, val in mapping.items():
                if val is not None:
                    updates.append(f"{col} = ?")
                    params.append(val)
            # Always refresh the import timestamp on an existing row.
            updates.append("updated_at = datetime('now')")
            if updates:
                params.append(report_key)
                cur.execute(
                    f"UPDATE reports SET {', '.join(updates)} WHERE report_key = ?",
                    params,
                )
        self._conn.commit()

    # ------------------------------------------------------------------ #
    # Reads
    # ------------------------------------------------------------------ #
    def get(self, report_key: str) -> dict[str, Any] | None:
        """Return a single report (with full JSON + HTML) or ``None``."""
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM reports WHERE report_key = ?", (report_key,))
        row = cur.fetchone()
        return self._row_to_dict(row) if row else None

    def get_latest(
        self, *, model: str | None = None, screenshot_set: str | None = None
    ) -> dict[str, Any] | None:
        """Return the most recent report, optionally filtered."""
        clauses: list[str] = []
        params: list[Any] = []
        if model:
            clauses.append("model = ?")
            params.append(model)
        if screenshot_set:
            clauses.append("screenshot_set = ?")
            params.append(screenshot_set)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        cur = self._conn.cursor()
        cur.execute(
            f"SELECT * FROM reports {where} ORDER BY timestamp DESC, created_at DESC LIMIT 1",
            params,
        )
        row = cur.fetchone()
        return self._row_to_dict(row) if row else None

    def list_reports(
        self,
        *,
        limit: int = 50,
        model: str | None = None,
        screenshot_set: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        """List report metadata (no large JSON/HTML columns)."""
        clauses: list[str] = []
        params: list[Any] = []
        if model:
            clauses.append("model = ?")
            params.append(model)
        if screenshot_set:
            clauses.append("screenshot_set = ?")
            params.append(screenshot_set)
        if status:
            clauses.append("status = ?")
            params.append(status)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        cur = self._conn.cursor()
        cur.execute(
            f"""SELECT id, report_key, screenshot_set, model, status, timestamp,
                       severity_counts, num_issues, num_recommendations, created_at
                FROM reports {where}
                ORDER BY timestamp DESC, created_at DESC
                LIMIT {int(limit)}""",
            params,
        )
        return [self._row_to_dict(r, include_payload=False) for r in cur.fetchall()]

    def search(self, query: str, *, limit: int = 50) -> list[dict[str, Any]]:
        """Case-insensitive substring search across text + key columns."""
        safe = (query or "").strip()
        if not safe:
            return []
        like = f"%{safe}%"
        cur = self._conn.cursor()
        cur.execute(
            """SELECT id, report_key, screenshot_set, model, status, timestamp,
                      severity_counts, num_issues, num_recommendations, created_at
               FROM reports
               WHERE report_key LIKE ? OR screenshot_set LIKE ? OR model LIKE ?
                  OR summary_text LIKE ? OR code_recs LIKE ?
               ORDER BY timestamp DESC, created_at DESC
               LIMIT ?""",
            (like, like, like, like, like, int(limit)),
        )
        return [self._row_to_dict(r, include_payload=False) for r in cur.fetchall()]

    def delete(self, report_key: str) -> bool:
        """Delete a report by key. Returns ``True`` if a row was removed."""
        cur = self._conn.cursor()
        cur.execute("DELETE FROM reports WHERE report_key = ?", (report_key,))
        self._conn.commit()
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # Migration (files -> DB)
    # ------------------------------------------------------------------ #
    def migrate_files(self, shots_root: str | Path, *, verbose: bool = False) -> int:
        """Import existing ``ux_analysis_*.json`` (+ companion ``.html``) files.

        Idempotent: each file is keyed by its report key, so re-running only
        fills in reports the DB does not yet have (or refreshes changed ones via
        ``INSERT OR REPLACE`` on the raw payload).  Returns the number of reports
        imported/refreshed.
        """
        root = Path(shots_root)
        count = 0
        for json_path in sorted(root.glob("ux_analysis_*.json")):
            report_key = json_path.stem
            if report_key.startswith("ux_analysis_"):
                report_key = report_key[len("ux_analysis_"):]
            html_path = json_path.with_suffix(".html")
            try:
                raw = json_path.read_text(encoding="utf-8")
                report = json.loads(raw)
            except (OSError, json.JSONDecodeError) as exc:
                if verbose:
                    print(f"  skip {json_path.name}: {exc}")
                continue
            html = None
            if html_path.exists():
                try:
                    html = html_path.read_text(encoding="utf-8")
                except OSError:
                    html = None
            sev, num_issues, num_recs = _count_issues(report)
            summary = (report.get("ux_recommendations") or {}).get("summary")
            code_recs = report.get("code_recommendations")
            self.upsert_raw(
                report_key,
                screenshot_set=self._derive_set(report_key),
                model=report.get("model") or report.get("combined_model"),
                status=report.get("status") or "complete",
                timestamp=report.get("timestamp"),
                report_json=raw,
                html=html,
                summary_text=_coerce_text(summary),
                code_recs=_coerce_text(code_recs),
                severity_counts=json.dumps(sev, ensure_ascii=False),
                num_issues=num_issues,
                num_recommendations=num_recs,
            )
            count += 1
            if verbose:
                print(f"  imported {report_key}")
        return count

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _derive_key(report: dict[str, Any]) -> str:
        ts = report.get("timestamp") or ""
        model = report.get("model") or report.get("combined_model") or "unknown"
        return f"{ts}__{model}" if ts else model

    @staticmethod
    def _sanitize_model(model: str) -> str:
        # Keys use a filesystem-safe slug (e.g. "qwen3-vl-4b"); the report JSON
        # stores the model with a colon ("qwen3-vl:4b").  Normalize to the slug
        # form so the trailing key segment can be matched against the model.
        return model.replace(":", "-")

    @staticmethod
    def _derive_set(report_key: str, model: str | None = None) -> str:
        # report_key is "<screenshot_set>__<model>".  The set name may itself
        # contain "__" (e.g. "2026-08-17__winui3-capture__ui-pages"), so we only
        # strip a trailing model segment when it actually matches the report's
        # model.  Otherwise the whole key is the set (covers legacy reports that
        # carry no model suffix and would otherwise lose their last set segment).
        if model:
            suffix = "__" + ReportsStore._sanitize_model(model)
            if report_key.endswith(suffix):
                return report_key[: -len(suffix)]
        if "__" in report_key:
            head, tail = report_key.rsplit("__", 1)
            # Heuristic fallback (only when the model is unknown): a trailing
            # segment is a model id if it carries a colon, or a token with a
            # digit (e.g. "qwen3-vl-4b").  Plain set-name tails like "ui-pages"
            # have no digit and are kept.
            if ":" in tail or (("-" in tail or "_" in tail) and any(ch.isdigit() for ch in tail)):
                return head
        return report_key

    def _row_to_dict(self, row: sqlite3.Row, include_payload: bool = True) -> dict[str, Any]:
        out = dict(row)
        sev = out.get("severity_counts")
        try:
            out["severity_counts"] = json.loads(sev) if isinstance(sev, str) else (sev or {})
        except (json.JSONDecodeError, TypeError):
            out["severity_counts"] = {}
        if include_payload:
            rj = out.get("report_json")
            try:
                out["report"] = json.loads(rj) if isinstance(rj, str) else (rj or {})
            except (json.JSONDecodeError, TypeError):
                out["report"] = {}
        else:
            out.pop("report_json", None)
            out.pop("html", None)
            out.pop("summary_text", None)
            out.pop("code_recs", None)
        return out

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "ReportsStore":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

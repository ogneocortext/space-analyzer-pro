"""SQLite-backed issue store for fast querying and indexing.

This module provides an optional acceleration layer for ``IssueTracker``.
The JSON file remains the source of truth; this store is rebuilt/updated
whenever the tracker is saved.  It is designed to work as a cross-project
library component, so it uses only stdlib (sqlite3) and discovers the
database path relative to the tracker file on disk.

Features
--------
* Primary key index on ``issue_id`` (O(log n) lookups)
* Category / severity / status indexes (fast filtering without full scan)
* FTS5 virtual table for full-text search across ``title`` + ``notes``
* Tag inversion index for ``suggest_related(tags, limit)``
* Occurrence counter for reopening tracking
* Auto-migration: schema bumps are applied in-place
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Sequence

CREATE_TABLE = """\
CREATE TABLE IF NOT EXISTS issues (
    issue_id TEXT PRIMARY KEY,
    title TEXT,
    category TEXT,
    severity TEXT,
    status TEXT,
    screenshot TEXT,
    first_seen TEXT,
    last_seen TEXT,
    occurrences INTEGER,
    notes TEXT,
    tags TEXT,
    extra_json TEXT
);
"""

CREATE_INDEX_CATEGORY = "CREATE INDEX IF NOT EXISTS idx_category ON issues(category);"
CREATE_INDEX_SEVERITY = "CREATE INDEX IF NOT EXISTS idx_severity ON issues(severity);"
CREATE_INDEX_STATUS = "CREATE INDEX IF NOT EXISTS idx_status ON issues(status);"
CREATE_INDEX_LAST_SEEN = "CREATE INDEX IF NOT EXISTS idx_last_seen ON issues(last_seen);"

CREATE_FTS = """\
CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts USING fts5(
    title, notes, content='issues', content_rowid='rowid'
);
"""

CREATE_FTS_TRIGGER_INSERT = """\
CREATE TRIGGER IF NOT EXISTS issues_ai AFTER INSERT ON issues BEGIN
    INSERT INTO issues_fts(rowid, title, notes)
    VALUES (NEW.rowid, NEW.title, NEW.notes);
END;
"""

CREATE_FTS_TRIGGER_DELETE = """\
CREATE TRIGGER IF NOT EXISTS issues_ad AFTER DELETE ON issues BEGIN
    INSERT INTO issues_fts(issues_fts, rowid, title, notes)
    VALUES('delete', OLD.rowid, OLD.title, OLD.notes);
END;
"""

CREATE_FTS_TRIGGER_UPDATE = """\
CREATE TRIGGER IF NOT EXISTS issues_au AFTER UPDATE ON issues BEGIN
    INSERT INTO issues_fts(issues_fts, rowid, title, notes)
    VALUES('delete', OLD.rowid, OLD.title, OLD.notes);
    INSERT INTO issues_fts(rowid, title, notes)
    VALUES (NEW.rowid, NEW.title, NEW.notes);
END;
"""

SCHEMA_STMTS = [
    CREATE_TABLE,
    CREATE_INDEX_CATEGORY,
    CREATE_INDEX_SEVERITY,
    CREATE_INDEX_STATUS,
    CREATE_INDEX_LAST_SEEN,
    CREATE_FTS,
    CREATE_FTS_TRIGGER_INSERT,
    CREATE_FTS_TRIGGER_DELETE,
    CREATE_FTS_TRIGGER_UPDATE,
]


def _flatten_tags(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(t) for t in value)
    if isinstance(value, str):
        return value
    return ""


class SqliteIssueStore:
    """SQLite acceleration layer for a JSON-backed issue tracker.

    Parameters
    ----------
    tracker_json_path:
        Path to the source-of-truth JSON file.  The SQLite database lives
        at ``<stem>.db`` next to the JSON (e.g. ``ux_issues.json`` ->
        ``ux_issues.db``).  When the JSON file does not exist yet the store
        is created empty; it is populated on the first :meth:`sync_from_json`
        or :meth:`upsert` call.
    """

    def __init__(self, tracker_json_path: str | Path) -> None:
        self.json_path = Path(tracker_json_path)
        self.db_path = self.json_path.with_suffix(".db")
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._init_schema()

    # ------------------------------------------------------------------ #
    # Schema management
    # ------------------------------------------------------------------ #
    def _init_schema(self) -> None:
        cur = self._conn.cursor()
        for stmt in SCHEMA_STMTS:
            cur.execute(stmt)
        self._conn.commit()

    def _migrate(self) -> None:
        """Idempotent schema migrations (add columns, indexes, etc.)."""
        cur = self._conn.cursor()
        cols = {r[1] for r in cur.execute("PRAGMA table_info(issues)")}
        if "extra_json" not in cols:
            cur.execute("ALTER TABLE issues ADD COLUMN extra_json TEXT DEFAULT '{}'")
            self._conn.commit()

    # ------------------------------------------------------------------ #
    # Sync from JSON
    # ------------------------------------------------------------------ #
    def sync_from_json(self, issues: Sequence[dict[str, Any]]) -> int:
        """Rebuild the SQLite store from a sequence of issue dicts."""
        cur = self._conn.cursor()
        cur.execute("BEGIN")
        try:
            cur.execute("DELETE FROM issues")
            for issue in issues:
                cur.execute(
                    """INSERT OR REPLACE INTO issues
                    (issue_id, title, category, severity, status, screenshot,
                     first_seen, last_seen, occurrences, notes, tags, extra_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        issue.get("issue_id"),
                        issue.get("title"),
                        issue.get("category"),
                        issue.get("severity"),
                        issue.get("status"),
                        issue.get("screenshot"),
                        issue.get("first_seen"),
                        issue.get("last_seen"),
                        issue.get("occurrences", 1),
                        issue.get("notes"),
                        _flatten_tags(issue.get("tags")),
                        json.dumps(issue.get("extra", {}), ensure_ascii=False),
                    ),
                )
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise
        return len(issues)

    # ------------------------------------------------------------------ #
    # CRUD
    # ------------------------------------------------------------------ #
    def upsert(self, issue: dict[str, Any]) -> None:
        """Insert or replace a single issue row."""
        cur = self._conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO issues
            (issue_id, title, category, severity, status, screenshot,
             first_seen, last_seen, occurrences, notes, tags, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                issue.get("issue_id"),
                issue.get("title"),
                issue.get("category"),
                issue.get("severity"),
                issue.get("status"),
                issue.get("screenshot"),
                issue.get("first_seen"),
                issue.get("last_seen"),
                issue.get("occurrences", 1),
                issue.get("notes"),
                _flatten_tags(issue.get("tags")),
                json.dumps(issue.get("extra", {}), ensure_ascii=False),
            ),
        )
        self._conn.commit()

    def get(self, issue_id: str) -> dict[str, Any] | None:
        """Return a single issue by id, or ``None``."""
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM issues WHERE issue_id = ?", (issue_id,))
        row = cur.fetchone()
        return self._row_to_dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Filtering  (fast, uses indexes)
    # ------------------------------------------------------------------ #
    def filter(
        self,
        *,
        status: str | None = None,
        category: str | None = None,
        severity: str | None = None,
        min_occurrences: int | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return issues matching the supplied filters (AND semantics)."""
        clauses: list[str] = []
        params: list[Any] = []
        if status:
            clauses.append("status = ?")
            params.append(status)
        if category:
            clauses.append("category = ?")
            params.append(category)
        if severity:
            clauses.append("severity = ?")
            params.append(severity)
        if min_occurrences is not None:
            clauses.append("occurrences >= ?")
            params.append(min_occurrences)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = f"SELECT * FROM issues {where} ORDER BY last_seen DESC"
        if limit:
            sql += f" LIMIT {int(limit)}"
        cur = self._conn.cursor()
        cur.execute(sql, params)
        return [self._row_to_dict(r) for r in cur.fetchall()]

    def search(self, query: str, *, limit: int = 50) -> list[dict[str, Any]]:
        """Full-text search across title and notes using FTS5."""
        safe = query.replace('"', '""').strip()
        if not safe:
            return []
        cur = self._conn.cursor()
        cur.execute(
            """SELECT i.* FROM issues i
            JOIN issues_fts fts ON i.rowid = fts.rowid
            WHERE issues_fts MATCH ?
            ORDER BY bm25(issues_fts)
            LIMIT ?""",
            (safe, limit),
        )
        return [self._row_to_dict(r) for r in cur.fetchall()]

    def suggest_related(self, query_tags: Sequence[str], *, limit: int = 10) -> list[dict[str, Any]]:
        """Find open issues whose tags overlap with the supplied list.

        Uses the stored ``tags`` column (flattened ``str``) so lookups are
        simple substring/word matches without unpacking JSON.
        """
        if not query_tags:
            return []
        query_set = {t.lower().strip() for t in query_tags}
        cur = self._conn.cursor()
        cur.execute(
            "SELECT issue_id, title, status, category, tags, extra_json FROM issues WHERE status = 'open'"
        )
        scored: list[tuple[int, dict[str, Any]]] = []
        for row in cur.fetchall():
            row_tags_val = row["tags"] or ""
            row_tags = {t.lower().strip() for t in row_tags_val.split(",") if t.strip()}
            overlap = len(query_set & row_tags)
            if overlap:
                full = self._row_to_dict(row)
                scored.append((overlap, full))
        scored.sort(key=lambda x: (-x[0], x[1].get("last_seen", "")))
        return [s[1] for s in scored[:limit]]

    # ------------------------------------------------------------------ #
    # Housekeeping
    # ------------------------------------------------------------------ #
    def rebuild(self, issues: Sequence[dict[str, Any]]) -> None:
        """Drop and recreate all tables, then bulk-insert."""
        cur = self._conn.cursor()
        cur.execute("DROP TABLE IF EXISTS issues")
        cur.execute("DROP TABLE IF EXISTS issues_fts")
        cur.execute("DROP TRIGGER IF EXISTS issues_ai")
        cur.execute("DROP TRIGGER IF EXISTS issues_ad")
        cur.execute("DROP TRIGGER IF EXISTS issues_au")
        self._conn.commit()
        self._init_schema()
        self.sync_from_json(issues)

    def close(self) -> None:
        """Close the underlying connection."""
        self._conn.close()

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        out = dict(row)
        try:
            out["extra"] = json.loads(out.pop("extra_json", "{}") or "{}")
        except json.JSONDecodeError:
            out["extra"] = {}
        raw_tags = out.get("tags", "")
        if isinstance(raw_tags, str):
            out["tags"] = [t.strip() for t in raw_tags.split(",") if t.strip()]
        else:
            out["tags"] = []
        return out

    def __enter__(self) -> SqliteIssueStore:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

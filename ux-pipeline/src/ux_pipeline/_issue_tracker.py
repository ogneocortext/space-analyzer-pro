"""Consolidated issue tracker for UX pipeline findings.

A single JSON file holds all issues discovered across runs. Each row is keyed
by a stable ``issue_id`` (a deterministic hash of the issue signature, so that
the same finding across two runs updates the same row instead of creating a
duplicate). Writes are atomic: we serialize to a temp file in the same
directory and ``os.replace`` it into place so concurrent readers never see a
half-written file.

An optional :class:`SqliteIssueStore` accelerates filtering and full-text
search without changing the JSON source of truth.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Iterable, Iterator

logger = logging.getLogger("ux_pipeline.issue_tracker")

SCHEMA_VERSION: int = 1
DEFAULT_TRACKER_PATH: Path = Path("ux_issues.json")


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def make_issue_id(category: str, title: str, screenshot: str | None = None) -> str:
    """Compute a stable, short hash-based issue id."""
    parts = [category.strip().lower(), title.strip().lower()]
    if screenshot:
        parts.append(screenshot.strip().lower())
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]
    safe_cat = "".join(c for c in category.strip().lower() if c.isalnum() or c in "-_") or "issue"
    return f"{safe_cat}:{digest}"


class IssueStatus(str, Enum):
    """Lifecycle states for an issue row."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    WONTFIX = "wontfix"
    BLOCKED = "blocked"
    PENDING = "pending"

    @classmethod
    def parse(cls, value: str | "IssueStatus") -> "IssueStatus":
        """Coerce strings (case-insensitive) into an :class:`IssueStatus`."""
        if isinstance(value, IssueStatus):
            return value
        key = str(value).strip().lower()
        for member in cls:
            if member.value == key:
                return member
        # Friendly aliases.
        aliases = {
            "completed": cls.DONE,
            "closed": cls.DONE,
            "resolved": cls.DONE,
            "fix": cls.IN_PROGRESS,
            "working": cls.IN_PROGRESS,
            "skip": cls.WONTFIX,
            "ignore": cls.WONTFIX,
        }
        if key in aliases:
            return aliases[key]
        return cls.OPEN


@dataclass
class IssueRow:
    """One consolidated issue entry.

    Attributes:
        issue_id: Stable hash identifying the issue.
        title: Short human-readable title.
        category: Coarse bucket (e.g. ``"ui"``, ``"ux"``, ``"a11y"``).
        severity: ``"low"``, ``"medium"``, ``"high"``, ``"critical"``.
        status: One of :class:`IssueStatus`.
        screenshot: Filename (basename) of the linked screenshot, if any.
        first_seen: ISO-8601 timestamp of first detection.
        last_seen: ISO-8601 timestamp of most recent detection.
        occurrences: How many runs have observed this issue.
        notes: Free-form description / remediation hint.
        extra: Any additional structured data the caller wants to persist.
    """

    issue_id: str
    title: str
    category: str = "ui"
    severity: str = "medium"
    status: IssueStatus = IssueStatus.OPEN
    screenshot: str | None = None
    first_seen: str = ""
    last_seen: str = ""
    occurrences: int = 1
    notes: str = ""
    priority_rank: int = 0
    priority_note: str = ""
    tags: list[str] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict representation."""
        data = asdict(self)
        data["status"] = (
            self.status.value if isinstance(self.status, IssueStatus) else str(self.status)
        )
        return data

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "IssueRow":
        """Build an :class:`IssueRow` from a dict, tolerating missing keys."""
        known = set(cls.__dataclass_fields__)  # type: ignore[attr-defined]
        kwargs: dict[str, Any] = {}
        for key in known:
            if key in data:
                kwargs[key] = data[key]
        if "status" in kwargs:
            kwargs["status"] = IssueStatus.parse(kwargs["status"])
        if "tags" in kwargs:
            raw = kwargs["tags"]
            if isinstance(raw, str):
                kwargs["tags"] = [t.strip() for t in raw.split(",") if t.strip()]
            elif isinstance(raw, list):
                kwargs["tags"] = [str(t) for t in raw]
            else:
                kwargs["tags"] = []
        if "extra" not in kwargs or not isinstance(kwargs.get("extra"), dict):
            kwargs["extra"] = {}
        return cls(**kwargs)

    def touch(self, *, when: str | None = None) -> None:
        """Bump ``last_seen`` (and ``occurrences``) to mark a re-detection."""
        self.last_seen = when or _now_iso()
        self.occurrences = max(1, int(self.occurrences) + 1)


class IssueTracker:
    """CRUD facade over the JSON issue store.

    The JSON file remains the source of truth.  An optional
    :class:`SqliteIssueStore` can be attached to accelerate filtering and
    full-text search; it is kept in sync on every :meth:`save`.

    Args:
        path: Where the JSON file lives. Created on first write.
        store: Optional SQLite acceleration layer.
    """

    def __init__(
        self,
        path: Path | str = DEFAULT_TRACKER_PATH,
        store: Any | None = None,
    ) -> None:
        self.path: Path = Path(path)
        self._store = store
        self._issues: dict[str, IssueRow] = {}
        self._loaded: bool = False

    # ------------------------------------------------------------------ #
    # Loading / persistence
    # ------------------------------------------------------------------ #
    def load(self) -> None:
        """Read the tracker file from disk. Missing files are not an error."""
        self._loaded = True
        if not self.path.exists():
            self._issues = {}
            return
        try:
            with self.path.open(encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read tracker %s: %s", self.path, exc)
            self._issues = {}
            return
        issues = data.get("issues", [])
        out: dict[str, IssueRow] = {}
        for entry in issues:
            if not isinstance(entry, dict):
                continue
            try:
                row = IssueRow.from_dict(entry)
            except (TypeError, ValueError) as exc:
                logger.debug("Skipping malformed issue entry: %s", exc)
                continue
            out[row.issue_id] = row
        self._issues = out
        self._sync_store()

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self.load()

    def _sync_store(self) -> None:
        """Push current in-memory state to the SQLite store if attached."""
        if self._store is None:
            return
        try:
            self._store.rebuild([row.to_dict() for row in self._issues.values()])
        except Exception as exc:
            logger.debug("SQLite store sync failed: %s", exc)

    def save(self) -> None:
        """Atomically write the current state to ``self.path``."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": SCHEMA_VERSION,
            "updated_at": _now_iso(),
            "issues": [row.to_dict() for row in self._issues.values()],
        }
        # Atomic write: dump to a temp file in the same directory, fsync,
        # then os.replace() onto the target path.
        fd, tmp_path = tempfile.mkstemp(
            prefix=self.path.name + ".",
            suffix=".tmp",
            dir=str(self.path.parent),
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2, sort_keys=True)
                fh.flush()
                try:
                    os.fsync(fh.fileno())
                except OSError:
                    # Some filesystems (e.g. Windows network shares) reject fsync.
                    pass
            os.replace(tmp_path, self.path)
        except Exception:
            # Best-effort cleanup of the orphan temp file.
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
        self._sync_store()
        logger.debug("Saved %d issues to %s", len(self._issues), self.path)


    # ------------------------------------------------------------------ #
    # CRUD
    # ------------------------------------------------------------------ #
    def upsert(self, row: IssueRow) -> IssueRow:
        """Insert or update a row, preserving history on duplicates.

        If a row with the same ``issue_id`` already exists we keep the
        original ``first_seen`` and bump ``last_seen`` / ``occurrences``;
        title and notes are only overwritten when the caller actually
        supplied a non-empty value.
        """
        self._ensure_loaded()
        existing = self._issues.get(row.issue_id)
        now = _now_iso()
        if existing is None:
            row.first_seen = row.first_seen or now
            row.last_seen = row.last_seen or now
            row.occurrences = max(1, int(row.occurrences))
            self._issues[row.issue_id] = row
            self._sync_store()
            return row
        # Merge with existing.
        existing.last_seen = now
        existing.occurrences = max(1, int(existing.occurrences) + 1)
        if row.title and not existing.title:
            existing.title = row.title
        if row.notes and not existing.notes:
            existing.notes = row.notes
        if row.screenshot and not existing.screenshot:
            existing.screenshot = row.screenshot
        if row.severity and row.severity != existing.severity:
            existing.severity = row.severity
        if row.category and not existing.category:
            existing.category = row.category
        if row.extra:
            merged = dict(existing.extra)
            merged.update(row.extra)
            existing.extra = merged
        self._sync_store()
        return existing

    def get(self, issue_id: str) -> IssueRow | None:
        """Return the row for ``issue_id`` or ``None``."""
        self._ensure_loaded()
        return self._issues.get(issue_id)

    def remove(self, issue_id: str) -> bool:
        """Delete a row. Returns ``True`` if something was removed."""
        self._ensure_loaded()
        return self._issues.pop(issue_id, None) is not None

    def all(self) -> list[IssueRow]:
        """Return a list of all rows in insertion order."""
        self._ensure_loaded()
        return list(self._issues.values())

    def filter(self, *, status: IssueStatus | str | None = None,
               category: str | None = None) -> list[IssueRow]:
        """Return rows matching the given filters (AND semantics)."""
        self._ensure_loaded()
        target_status = IssueStatus.parse(status) if status is not None else None
        out: list[IssueRow] = []
        for row in self._issues.values():
            if target_status is not None and row.status != target_status:
                continue
            if category and row.category != category:
                continue
            out.append(row)
        return out

    def mark_done(self, issue_id: str) -> bool:
        """Set the row status to :attr:`IssueStatus.DONE`."""
        return self._set_status(issue_id, IssueStatus.DONE)

    def mark_status(self, issue_id: str, status: IssueStatus | str) -> bool:
        """Set the row status to ``status``."""
        return self._set_status(issue_id, IssueStatus.parse(status))

    def _set_status(self, issue_id: str, status: IssueStatus) -> bool:
        self._ensure_loaded()
        row = self._issues.get(issue_id)
        if row is None:
            return False
        row.status = status
        self._sync_store()
        return True

    def __iter__(self) -> Iterator[IssueRow]:
        self._ensure_loaded()
        return iter(list(self._issues.values()))

    def __len__(self) -> int:
        self._ensure_loaded()
        return len(self._issues)

    def set_priority(self, issue_id: str, priority_rank: int, priority_note: str = "") -> bool:
        """Set priority fields for an issue."""
        self._ensure_loaded()
        row = self._issues.get(issue_id)
        if row is None:
            return False
        row.priority_rank = max(0, int(priority_rank))
        row.priority_note = priority_note or ""
        self._sync_store()
        return True

    def list_priority(self) -> list[dict[str, Any]]:
        """Return open/in-progress/blocked/pending issues ordered by priority rank."""
        self._ensure_loaded()
        allowed = {
            IssueStatus.OPEN.value,
            IssueStatus.IN_PROGRESS.value,
            IssueStatus.BLOCKED.value,
            IssueStatus.PENDING.value,
        }
        rows = [row for row in self._issues.values() if row.status.value in allowed]
        rows.sort(key=lambda r: (r.priority_rank, (r.last_seen or "").lower()), reverse=True)
        return [row.to_dict() for row in rows]

    def bulk_import(self, rows: Iterable[IssueRow | dict[str, Any]]) -> int:
        """Upsert many rows at once. Returns the number imported."""
        self._ensure_loaded()
        count = 0
        for entry in rows:
            if isinstance(entry, dict):
                try:
                    row = IssueRow.from_dict(entry)
                except (TypeError, ValueError) as exc:
                    logger.debug("Skipping bad import entry: %s", exc)
                    continue
            elif isinstance(entry, IssueRow):
                row = entry
            else:
                continue
            self.upsert(row)
            count += 1
        return count

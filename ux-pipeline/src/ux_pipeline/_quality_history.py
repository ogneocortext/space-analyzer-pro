"""Per-run 0-100 quality score history.

Each pipeline run produces a single :class:`QualityRecord`; the records are
appended to a JSON-Lines file (``analysis_history/quality.jsonl`` by
default). The :class:`QualityHistory` helper is a tiny read/write facade
that never rewrites the whole file: it only appends, so concurrent
processes can both write safely.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

logger = logging.getLogger("ux_pipeline.quality_history")

DEFAULT_HISTORY_PATH: Path = Path("analysis_history") / "quality.jsonl"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class QualityRecord:
    """One pipeline run's quality assessment.

    Attributes:
        run_id: Stable identifier for the run (e.g. screenshots timestamp).
        score: Aggregate 0-100 quality score for the run.
        timestamp: ISO-8601 string; defaults to "now" on construction.
        per_screenshot: Mapping of screenshot stem to individual score.
        notes: Optional free-form notes (e.g. regressions, model version).
        extra: Any additional structured data to persist alongside the run.
    """

    run_id: str
    score: int
    timestamp: str = field(default_factory=_now_iso)
    per_screenshot: dict[str, int] = field(default_factory=dict)
    notes: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dict representation."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "QualityRecord":
        """Build a :class:`QualityRecord` from a dict, tolerating missing keys."""
        known = set(cls.__dataclass_fields__)  # type: ignore[attr-defined]
        kwargs: dict[str, Any] = {k: v for k, v in data.items() if k in known}
        for list_field in ("per_screenshot", "extra"):
            if list_field in kwargs and not isinstance(kwargs[list_field], dict):
                kwargs[list_field] = {}
        return cls(**kwargs)


class QualityHistory:
    """Append-only history of :class:`QualityRecord` entries.

    Args:
        path: JSON-Lines file used for persistence.
    """

    def __init__(self, path: Path | str = DEFAULT_HISTORY_PATH) -> None:
        self.path: Path = Path(path)

    def append(self, record: QualityRecord) -> None:
        """Append ``record`` to the history file, creating it if needed.

        The write is atomic for a single record (temp file in the same
        directory, then ``os.replace``).
        """
        self.path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(record.to_dict(), ensure_ascii=False) + "\n"
        fd, tmp_path = tempfile.mkstemp(
            prefix=self.path.name + ".",
            suffix=".tmp",
            dir=str(self.path.parent),
        )
        try:
            existing = self.path.read_text(encoding="utf-8") if self.path.exists() else ""
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(existing)
                fh.write(line)
                fh.flush()
                try:
                    os.fsync(fh.fileno())
                except OSError:
                    pass
            os.replace(tmp_path, self.path)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
        logger.debug("Appended quality record %s to %s", record.run_id, self.path)

    def all(self) -> list[QualityRecord]:
        """Return all records sorted by timestamp (ascending)."""
        return sorted(self._iter(), key=lambda r: r.timestamp)

    def latest(self) -> QualityRecord | None:
        """Return the most recent record or ``None`` if empty."""
        items = self.all()
        return items[-1] if items else None

    def iter(self) -> Iterator[QualityRecord]:
        """Yield records in file order."""
        yield from self._iter()

    def _iter(self) -> Iterable[QualityRecord]:
        if not self.path.exists():
            return []
        out: list[QualityRecord] = []
        try:
            with self.path.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError as exc:
                        logger.debug("Skipping bad history line: %s", exc)
                        continue
                    if not isinstance(data, dict):
                        continue
                    try:
                        out.append(QualityRecord.from_dict(data))
                    except (TypeError, ValueError) as exc:
                        logger.debug("Skipping malformed record: %s", exc)
        except OSError as exc:
            logger.warning("Could not read history %s: %s", self.path, exc)
        return out

    def summary(self) -> dict[str, Any]:
        """Return a small dict with count, latest, average and trend stats."""
        records = self.all()
        if not records:
            return {
                "count": 0,
                "latest": None,
                "average": None,
                "best": None,
                "worst": None,
                "trend": None,
            }
        scores = [r.score for r in records]
        latest = records[-1]
        previous = records[-2] if len(records) >= 2 else None
        trend: int | None = None
        if previous is not None:
            trend = latest.score - previous.score
        return {
            "count": len(records),
            "latest": latest.to_dict(),
            "average": round(sum(scores) / len(scores), 1),
            "best": max(scores),
            "worst": min(scores),
            "trend": trend,
        }

    def __len__(self) -> int:
        return sum(1 for _ in self._iter())

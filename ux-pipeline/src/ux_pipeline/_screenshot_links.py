"""Sidecar store mapping issues to the screenshots that evidence them.

Stored as a small JSON document (``ux_screenshot_links.json`` by default)
next to the tracker. The shape is intentionally simple::

    {
        "issue_id": {
            "screenshots": ["02_dashboard_initial.png", ...],
            "first_linked": "...",
            "last_linked": "..."
        }
    }
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

logger = logging.getLogger("ux_pipeline.screenshot_links")

DEFAULT_PATH: Path = Path("ux_screenshot_links.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ScreenshotLinkStore:
    """Track which screenshots evidence which issues.

    Args:
        path: Where the sidecar JSON lives.
    """

    def __init__(self, path: Path | str = DEFAULT_PATH) -> None:
        self.path: Path = Path(path)
        self._data: dict[str, dict[str, Any]] = {}
        self._loaded: bool = False

    # ------------------------------------------------------------------ #
    # Persistence
    # ------------------------------------------------------------------ #
    def load(self) -> None:
        """Read the store from disk; missing file is OK."""
        self._loaded = True
        if not self.path.exists():
            self._data = {}
            return
        try:
            with self.path.open(encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read screenshot links %s: %s", self.path, exc)
            self._data = {}
            return
        if not isinstance(data, dict):
            self._data = {}
            return
        self._data = {str(k): v for k, v in data.items() if isinstance(v, dict)}

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self.load()

    def save(self) -> None:
        """Atomically write the current state to ``self.path``."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(
            prefix=self.path.name + ".",
            suffix=".tmp",
            dir=str(self.path.parent),
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(self._data, fh, indent=2, sort_keys=True)
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

    # ------------------------------------------------------------------ #
    # CRUD
    # ------------------------------------------------------------------ #
    def link(self, issue_id: str, screenshot: str) -> None:
        """Record that ``screenshot`` evidences ``issue_id``.

        Idempotent: linking the same pair twice does not create duplicates.
        """
        self._ensure_loaded()
        if not issue_id or not screenshot:
            return
        entry = self._data.setdefault(
            issue_id,
            {"screenshots": [], "first_linked": _now_iso(), "last_linked": _now_iso()},
        )
        shots = entry.setdefault("screenshots", [])
        if not isinstance(shots, list):
            shots = []
            entry["screenshots"] = shots
        if screenshot not in shots:
            shots.append(screenshot)
        entry["last_linked"] = _now_iso()

    def unlink(self, issue_id: str, screenshot: str) -> bool:
        """Remove ``screenshot`` from the issue's link list. Returns whether anything changed."""
        self._ensure_loaded()
        entry = self._data.get(issue_id)
        if not isinstance(entry, dict):
            return False
        shots = entry.get("screenshots", [])
        if not isinstance(shots, list) or screenshot not in shots:
            return False
        shots.remove(screenshot)
        return True

    def screenshots_for(self, issue_id: str) -> list[str]:
        """Return the list of screenshots linked to ``issue_id`` (possibly empty)."""
        self._ensure_loaded()
        entry = self._data.get(issue_id)
        if not isinstance(entry, dict):
            return []
        shots = entry.get("screenshots", [])
        return list(shots) if isinstance(shots, list) else []

    def issues_for(self, screenshot: str) -> list[str]:
        """Return the list of issue ids that link to ``screenshot``."""
        self._ensure_loaded()
        out: list[str] = []
        for issue_id, entry in self._data.items():
            if not isinstance(entry, dict):
                continue
            shots = entry.get("screenshots", [])
            if isinstance(shots, list) and screenshot in shots:
                out.append(issue_id)
        return out

    def all(self) -> dict[str, dict[str, Any]]:
        """Return a shallow copy of the entire store."""
        self._ensure_loaded()
        return {k: dict(v) for k, v in self._data.items()}

    def bulk_link(self, issue_id: str, screenshots: Iterable[str]) -> int:
        """Link several screenshots at once; returns the number actually added."""
        added = 0
        for s in screenshots:
            before = set(self.screenshots_for(issue_id))
            self.link(issue_id, s)
            after = set(self.screenshots_for(issue_id))
            if after != before:
                added += 1
        return added

    def __len__(self) -> int:
        self._ensure_loaded()
        return len(self._data)

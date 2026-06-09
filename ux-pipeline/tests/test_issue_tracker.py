"""Tests for the consolidated :class:`IssueTracker`."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ux_pipeline._issue_tracker import (
    IssueRow,
    IssueStatus,
    IssueTracker,
    make_issue_id,
)


def _row(
    issue_id: str = "ui:abc123",
    title: str = "Low contrast",
    severity: str = "medium",
    screenshot: str | None = "01.png",
) -> IssueRow:
    return IssueRow(
        issue_id=issue_id,
        title=title,
        severity=severity,
        screenshot=screenshot,
        notes="",
    )


def test_make_issue_id_is_stable_and_short() -> None:
    a = make_issue_id("ui", "Low contrast", "01.png")
    b = make_issue_id("ui", "low CONTRAST", "01.png")
    assert a == b
    assert a.startswith("ui:")
    assert len(a.split(":")[1]) == 12


def test_make_issue_id_ignores_missing_screenshot() -> None:
    a = make_issue_id("ui", "x", None)
    b = make_issue_id("ui", "x")
    assert a == b


def test_issue_status_parse_aliases() -> None:
    assert IssueStatus.parse("closed") is IssueStatus.DONE
    assert IssueStatus.parse("Resolved") is IssueStatus.DONE
    assert IssueStatus.parse("fix") is IssueStatus.IN_PROGRESS
    assert IssueStatus.parse("SKIP") is IssueStatus.WONTFIX
    assert IssueStatus.parse("unknown") is IssueStatus.OPEN


def test_upsert_creates_new_row(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    tracker.upsert(_row())
    assert len(tracker) == 1
    row = tracker.get("ui:abc123")
    assert row is not None
    assert row.first_seen
    assert row.last_seen
    assert row.occurrences == 1


def test_upsert_bumps_occurrences_and_preserves_first_seen(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    first = tracker.upsert(_row())
    first_seen = first.first_seen
    tracker.upsert(_row())  # duplicate detection
    row = tracker.get("ui:abc123")
    assert row is not None
    assert row.first_seen == first_seen
    assert row.occurrences == 2
    assert row.last_seen >= first_seen


def test_upsert_promotes_severity(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    tracker.upsert(_row(severity="low"))
    tracker.upsert(_row(severity="critical"))
    row = tracker.get("ui:abc123")
    assert row is not None
    assert row.severity == "critical"


def test_save_is_atomic_and_readable(tmp_path: Path) -> None:
    path = tmp_path / "issues.json"
    tracker = IssueTracker(path)
    tracker.upsert(_row())
    tracker.upsert(_row(issue_id="ui:def456", title="Other"))
    tracker.save()
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert raw["schema_version"] == 1
    assert {r["issue_id"] for r in raw["issues"]} == {"ui:abc123", "ui:def456"}


def test_save_writes_to_temp_then_renames(tmp_path: Path) -> None:
    """The atomic-write path should never leave a ``.tmp`` file behind."""
    path = tmp_path / "issues.json"
    tracker = IssueTracker(path)
    tracker.upsert(_row())
    tracker.save()
    leftovers = [p for p in tmp_path.iterdir() if p.suffix == ".tmp"]
    assert not leftovers, f"orphan temp files: {leftovers}"
    fresh = IssueTracker(path)
    fresh.load()
    assert fresh.get("ui:abc123") is not None


def test_filter_by_status_and_category(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    tracker.upsert(_row(issue_id="ui:111", title="A"))
    tracker.upsert(_row(issue_id="ui:222", title="B", severity="high"))
    tracker.upsert(IssueRow(issue_id="a11y:333", title="Alt text", category="a11y"))
    open_rows = tracker.filter(status=IssueStatus.OPEN)
    assert {r.issue_id for r in open_rows} == {"ui:111", "ui:222", "a11y:333"}
    a11y = tracker.filter(category="a11y")
    assert {r.issue_id for r in a11y} == {"a11y:333"}


def test_mark_done_and_status_transitions(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    tracker.upsert(_row())
    assert tracker.mark_done("ui:abc123") is True
    assert tracker.get("ui:abc123").status is IssueStatus.DONE
    assert tracker.mark_status("ui:abc123", "wontfix") is True
    assert tracker.get("ui:abc123").status is IssueStatus.WONTFIX
    assert tracker.mark_done("nonexistent") is False


def test_remove(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    tracker.upsert(_row())
    assert tracker.remove("ui:abc123") is True
    assert tracker.get("ui:abc123") is None
    assert tracker.remove("ui:abc123") is False


def test_load_handles_missing_file(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "nope.json")
    tracker.load()
    assert len(tracker) == 0


def test_load_handles_corrupt_file(tmp_path: Path) -> None:
    path = tmp_path / "issues.json"
    path.write_text("{not valid json", encoding="utf-8")
    tracker = IssueTracker(path)
    tracker.load()
    assert len(tracker) == 0


def test_load_tolerates_unknown_keys_and_bad_entries(tmp_path: Path) -> None:
    path = tmp_path / "issues.json"
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "issues": [
                    {"issue_id": "ui:ok", "title": "good", "future_field": "ignored"},
                    "not-a-dict",
                ],
            }
        ),
        encoding="utf-8",
    )
    tracker = IssueTracker(path)
    tracker.load()
    assert tracker.get("ui:ok") is not None
    assert len(tracker) == 1


def test_bulk_import_accepts_dicts_and_rows(tmp_path: Path) -> None:
    tracker = IssueTracker(tmp_path / "issues.json")
    n = tracker.bulk_import(
        [
            _row(issue_id="ui:1", title="A"),
            {"issue_id": "ui:2", "title": "B"},
            "garbage",
        ]
    )
    assert n == 2
    assert {r.issue_id for r in tracker.all()} == {"ui:1", "ui:2"}


def test_round_trip_via_to_dict_from_dict() -> None:
    row = _row()
    row.extra = {"confidence": 0.9}
    cloned = IssueRow.from_dict(row.to_dict())
    assert cloned.issue_id == row.issue_id
    assert cloned.extra == row.extra
    assert cloned.status is IssueStatus.OPEN

"""Tests for the vision-finding → tracker-row mapping helpers."""

from __future__ import annotations

from ux_pipeline._issue_tracker import IssueRow
from ux_pipeline._vision_to_issues import (
    VisionFinding,
    findings_to_rows,
    parse_model_findings,
    row_from_finding,
)


def test_normalized_falls_back_to_defaults() -> None:
    f = VisionFinding(title="  Weird category  ", category="???", severity="WAT")
    n = f.normalized()
    assert n.category == "other"
    assert n.severity == "medium"
    assert n.title == "Weird category"


def test_row_from_finding_assigns_stable_id() -> None:
    a = row_from_finding(VisionFinding(title="Low contrast", category="ui", screenshot="01.png"))
    b = row_from_finding(VisionFinding(title="low CONTRAST", category="UI", screenshot="01.png"))
    assert a.issue_id == b.issue_id
    assert isinstance(a, IssueRow)
    assert a.screenshot == "01.png"


def test_row_from_finding_includes_extra_metadata() -> None:
    row = row_from_finding(
        VisionFinding(
            title="x",
            confidence=0.7,
            bbox=(10, 20, 30, 40),
        )
    )
    assert row.extra.get("confidence") == 0.7
    assert row.extra.get("bbox") == [10, 20, 30, 40]


def test_findings_to_rows_dedupes_and_promotes_severity() -> None:
    rows = findings_to_rows(
        [
            VisionFinding(title="Same", category="ui", severity="low"),
            VisionFinding(title="Same", category="ui", severity="critical", notes="more info"),
            VisionFinding(title="Different", category="ux"),
        ]
    )
    assert len(rows) == 2
    by_id = {r.issue_id: r for r in rows}
    same = next(r for r in rows if r.title == "Same")
    assert same.severity == "critical"
    assert same.notes == "more info"


def test_parse_model_findings_handles_json_array() -> None:
    raw = (
        '[{"title": "A", "category": "ui", "severity": "high", "notes": "n1"},'
        ' {"title": "B", "category": "a11y", "severity": "low"}]'
    )
    findings = parse_model_findings(raw, screenshot="s.png")
    assert len(findings) == 2
    assert findings[0].title == "A"
    assert findings[0].severity == "high"
    assert findings[0].screenshot == "s.png"
    assert findings[1].category == "a11y"


def test_parse_model_findings_handles_markdown_fence() -> None:
    raw = (
        "```json\n"
        '[{"title": "Fenced", "category": "ui", "severity": "medium", "notes": ""}]\n'
        "```"
    )
    findings = parse_model_findings(raw)
    assert len(findings) == 1
    assert findings[0].title == "Fenced"


def test_parse_model_findings_handles_dict_with_issues_key() -> None:
    raw = '{"issues": [{"title": "A", "category": "ui", "severity": "low"}]}'
    findings = parse_model_findings(raw)
    assert len(findings) == 1
    assert findings[0].title == "A"


def test_parse_model_findings_falls_back_to_bullets() -> None:
    raw = "- First issue: contrast is too low\n* Second issue - spacing is uneven\n"
    findings = parse_model_findings(raw, screenshot="s.png")
    assert len(findings) == 2
    assert findings[0].title == "First issue"
    assert findings[0].notes
    assert findings[1].title == "Second issue"
    assert findings[0].screenshot == "s.png"


def test_parse_model_findings_empty_input() -> None:
    assert parse_model_findings("") == []
    assert parse_model_findings("   \n  \n") == []

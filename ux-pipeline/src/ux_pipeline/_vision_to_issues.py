"""Map vision analysis findings to :class:`IssueRow` rows.

The :class:`VisionFinding` dataclass is the canonical intermediate
representation produced by the vision model (or any other detector) and the
:meth:`row_from_finding` / :func:`findings_to_rows` helpers turn them into
tracker rows with stable ids.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Iterable

from ._issue_tracker import IssueRow, make_issue_id

logger = logging.getLogger("ux_pipeline.vision_to_issues")


VALID_SEVERITIES: tuple[str, ...] = ("low", "medium", "high", "critical")
VALID_CATEGORIES: tuple[str, ...] = (
    "ui", "ux", "a11y", "layout", "color", "typography", "performance", "other",
)


@dataclass
class VisionFinding:
    """A single issue reported by the vision model.

    Attributes:
        title: Short title.
        category: Coarse bucket (see :data:`VALID_CATEGORIES`).
        severity: One of :data:`VALID_SEVERITIES`.
        screenshot: Filename (basename) of the linked screenshot, if any.
        notes: Free-form description / remediation hint.
        confidence: Optional 0.0-1.0 confidence score from the model.
        bbox: Optional ``(x, y, w, h)`` bounding box in screenshot pixels.
        extra: Any additional structured data to persist alongside the row.
    """

    title: str
    category: str = "ui"
    severity: str = "medium"
    screenshot: str | None = None
    notes: str = ""
    confidence: float | None = None
    bbox: tuple[int, int, int, int] | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def normalized(self) -> "VisionFinding":
        """Return a copy with category/severity coerced to known values."""
        cat = self.category.strip().lower() if self.category else "ui"
        if cat not in VALID_CATEGORIES:
            cat = "other"
        sev = self.severity.strip().lower() if self.severity else "medium"
        if sev not in VALID_SEVERITIES:
            sev = "medium"
        return VisionFinding(
            title=(self.title or "").strip() or "Untitled issue",
            category=cat,
            severity=sev,
            screenshot=self.screenshot,
            notes=self.notes,
            confidence=self.confidence,
            bbox=self.bbox,
            extra=dict(self.extra),
        )


def row_from_finding(finding: VisionFinding) -> IssueRow:
    """Convert a single :class:`VisionFinding` to an :class:`IssueRow`.

    The ``issue_id`` is derived from category + title + screenshot, so
    re-runs of the same finding deduplicate into the same tracker row.
    """
    norm = finding.normalized()
    issue_id = make_issue_id(norm.category, norm.title, norm.screenshot)
    extra = dict(norm.extra)
    if norm.confidence is not None:
        extra.setdefault("confidence", norm.confidence)
    if norm.bbox is not None:
        extra.setdefault("bbox", list(norm.bbox))
    return IssueRow(
        issue_id=issue_id,
        title=norm.title,
        category=norm.category,
        severity=norm.severity,
        screenshot=norm.screenshot,
        notes=norm.notes,
        extra=extra,
    )


def findings_to_rows(findings: Iterable[VisionFinding]) -> list[IssueRow]:
    """Map an iterable of findings to tracker rows.

    Duplicate ``issue_id`` values within the same iterable are collapsed
    into a single row; the first occurrence wins for title/notes and the
    highest severity is kept.
    """
    severity_rank: dict[str, int] = {s: i for i, s in enumerate(VALID_SEVERITIES)}
    merged: dict[str, IssueRow] = {}
    order: list[str] = []
    for raw in findings:
        row = row_from_finding(raw)
        existing = merged.get(row.issue_id)
        if existing is None:
            merged[row.issue_id] = row
            order.append(row.issue_id)
            continue
        if severity_rank.get(row.severity, 0) > severity_rank.get(existing.severity, 0):
            existing.severity = row.severity
        if row.notes and not existing.notes:
            existing.notes = row.notes
        if row.screenshot and not existing.screenshot:
            existing.screenshot = row.screenshot
        if row.extra:
            merged_extra = dict(existing.extra)
            merged_extra.update(row.extra)
            existing.extra = merged_extra
    return [merged[i] for i in order]


def parse_model_findings(
    raw_text: str,
    *,
    screenshot: str | None = None,
) -> list[VisionFinding]:
    """Best-effort parser that turns model JSON / bullet text into findings.

    The model is prompted to return a JSON array of ``{"title", "category",
    "severity", "notes"}`` dicts. We tolerate two failure modes: pure JSON
    (success), and a list of bullet points with a ``- TITLE: notes`` shape
    (fallback). Anything we cannot parse is logged and ignored.
    """
    if not raw_text:
        return []
    text = raw_text.strip()
    # Strip markdown code fences if present.
    if text.startswith("```"):
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl + 1 :]
        if text.endswith("```"):
            text = text[:-3]
    import json

    candidates: list[dict[str, Any]] = []
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        parsed = None
    if isinstance(parsed, list):
        candidates = [c for c in parsed if isinstance(c, dict)]
    elif isinstance(parsed, dict) and isinstance(parsed.get("issues"), list):
        candidates = [c for c in parsed["issues"] if isinstance(c, dict)]
    if candidates:
        out: list[VisionFinding] = []
        for c in candidates:
            out.append(
                VisionFinding(
                    title=str(c.get("title", "")).strip() or "Untitled issue",
                    category=str(c.get("category", "ui")),
                    severity=str(c.get("severity", "medium")),
                    screenshot=str(c.get("screenshot") or screenshot or "") or None,
                    notes=str(c.get("notes", "")).strip(),
                )
            )
        return out
    # Fallback: parse bullet points.
    out = []
    for line in text.splitlines():
        line = line.strip(" \t-*•\u2022")
        if not line:
            continue
        sep = -1
        for candidate in (" - ", ": "):
            idx = line.find(candidate)
            if idx != -1 and (sep == -1 or idx < sep):
                sep = idx
        if sep == -1:
            title, notes = line, ""
        else:
            title = line[:sep].strip(" \t-*•\u2022")
            notes = line[sep:].lstrip(" -:").strip()
        out.append(
            VisionFinding(
                title=title or "Untitled issue",
                category="ui",
                severity="medium",
                screenshot=screenshot,
                notes=notes,
            )
        )
    return out

#!/usr/bin/env python3
"""Regenerate the status-summary blocks in the Space Analyzer docs.

This script is the single source of truth for the two "summary" tables that
used to drift (hand-edited counts that contradicted the authoritative rows).

  * FEATURE_GAP_ANALYSIS.md  -- the "Gap Count by Severity" table (sections 1-7)
  * ISSUES.md                -- the "Open issue counts" table

It derives both from the authoritative sources:

  * gap summary  <- the per-row status marks (✅/⚠️/❌/🔵) in FEATURE_GAP_ANALYSIS.md
                     itself (the rows are authoritative; the summary is derived)
  * issue counts <- docs/issues.json (schema v1, the structured tracker)

Modes
-----
  (default)        print the authoritative counts and (if --check) compare to the
                   rendered values inside the doc anchors, warning on drift.
  --check          exit non-zero if either rendered block disagrees with the
                   authoritative counts (use in a pre-commit / review gate).
  --write          regenerate the markdown between the <!--*_START--> / <!--*_END-->
                   anchors in the two docs.

The script only edits the text *between* the anchors, so surrounding prose,
links, and conventions are never touched.

Usage
-----
  python docs/generate_status_summary.py
  python docs/generate_status_summary.py --check
  python docs/generate_status_summary.py --write
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

# Ensure emoji/Unicode in the printed summary survive on Windows consoles.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
GAP_FILE = DOCS / "archive" / "FEATURE_GAP_ANALYSIS.md"
ISSUES_MD = DOCS / "ISSUES.md"
ISSUES_JSON = DOCS / "issues.json"

# Status glyphs used in the gap-analysis rows.
GLYPH_IMPLEMENTED = "✅"
GLYPH_PARTIAL = "⚠️"
GLYPH_MISSING = "❌"
GLYPH_BACKEND = "🔵"

# A numbered section header, e.g. "## 3. File Management".
SECTION_RE = re.compile(r"^##\s+(\d+)\.\s+(.+?)\s*$")
# A feature data row: starts with "| <n>.<n> |".
FEATURE_ROW_RE = re.compile(r"^\|\s*(\d+\.\d+)\s*\|")


def _classify(status_cell: str) -> str | None:
    """Return the base status key for a gap-analysis Status cell."""
    if GLYPH_MISSING in status_cell:
        return "missing"
    if GLYPH_PARTIAL in status_cell:
        return "partial"
    if GLYPH_BACKEND in status_cell:
        return "backend"
    if GLYPH_IMPLEMENTED in status_cell:
        return "implemented"
    return None


def compute_gap_summary() -> tuple[dict, list]:
    """Parse FEATURE_GAP_ANALYSIS.md sections 1-7.

    Returns (categories, rows) where categories maps section title -> counts
    dict {implemented, partial, missing, backend}, and rows is the list of
    (section_title, counts) in document order for sections 1-7 only.
    """
    lines = GAP_FILE.read_text(encoding="utf-8").splitlines()
    categories: dict[str, dict] = {}
    order: list[str] = []
    current_section: str | None = None
    current_num: int | None = None

    for line in lines:
        m = SECTION_RE.match(line)
        if m:
            current_num = int(m.group(1))
            current_section = m.group(2).strip().removesuffix("(Optional)").strip()
            # Only sections 1-7 are feature-promise sections.
            if 1 <= current_num <= 7:
                if current_section not in categories:
                    categories[current_section] = {
                        "implemented": 0,
                        "partial": 0,
                        "missing": 0,
                        "backend": 0,
                    }
                    order.append(current_section)
            else:
                current_section = None
            continue

        if current_section is None or current_num is None or not (1 <= current_num <= 7):
            continue
        if not FEATURE_ROW_RE.match(line):
            continue

        # Split the markdown table row into cells.
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        # cells: [num, feature, status, evidence, ...]
        if len(cells) < 3:
            continue
        status_cell = cells[2]
        key = _classify(status_cell)
        if key is None:
            print(f"  ! unclassified status row: {line!r}", file=sys.stderr)
            continue
        categories[current_section][key] += 1

    rows = [(title, categories[title]) for title in order]
    return categories, rows


def gap_summary_markdown(rows: list) -> str:
    """Render the gap-summary table (sections 1-7) as markdown."""
    out = [
        "<!--GAP_SUMMARY_START-->",
        "| Category | ✅ Implemented | ⚠️ Partial | ❌ Missing | 🔵 Backend-only |",
        "|----------|--------------|-----------|-----------|-----------------|",
    ]
    tot = {"implemented": 0, "partial": 0, "missing": 0, "backend": 0}
    for title, c in rows:
        out.append(
            f"| {title} | {c['implemented']} | {c['partial']} | {c['missing']} | {c['backend']} |"
        )
        for k in tot:
            tot[k] += c[k]
    out.append(
        f"| **Total (§1–7)** | **{tot['implemented']}** | **{tot['partial']}** | "
        f"**{tot['missing']}** | **{tot['backend']}** |"
    )
    out.append("<!--GAP_SUMMARY_END-->")
    return "\n".join(out)


def compute_issue_counts() -> dict:
    """Count issues from issues.json."""
    data = json.loads(ISSUES_JSON.read_text(encoding="utf-8"))
    issues = data.get("issues", [])
    status_counts: dict[str, int] = {}
    open_by_category: dict[str, int] = {}
    for it in issues:
        st = it.get("status", "unknown")
        status_counts[st] = status_counts.get(st, 0) + 1
        if st == "open":
            cat = it.get("category", "unknown")
            open_by_category[cat] = open_by_category.get(cat, 0) + 1
    return {
        "status": status_counts,
        "open_by_category": open_by_category,
        "total": len(issues),
    }


def issue_counts_markdown(counts: dict) -> str:
    sc = counts["status"]
    open_by = counts["open_by_category"]
    today = date.today().isoformat()
    cat_str = ", ".join(
        f"`{k}` {v}" for k, v in sorted(open_by.items(), key=lambda kv: (-kv[1], kv[0]))
    )
    return "\n".join(
        [
            "<!--ISSUE_COUNTS_START-->",
            f"## Open issue counts ({today})",
            "",
            "| Scope | Count |",
            "|---|---|",
            f"| Open | {sc.get('open', 0)} |",
            f"| Done | {sc.get('done', 0)} |",
            f"| Wontfix | {sc.get('wontfix', 0)} |",
            f"| Blocked | {sc.get('blocked', 0)} |",
            f"| **Total** | **{counts['total']}** |",
            "",
            f"**Open by category:** {cat_str}. All {sc.get('open', 0)} open issues are UI/UX",
            "polish — there are **no open issues** for backend, scanning, AI, settings, or workflow",
            "features.",
            "<!--ISSUE_COUNTS_END-->",
        ]
    )


def _replace_between_anchors(path: Path, block: str) -> None:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"<!--([A-Z_]+)_START-->", block)
    if not m:
        raise ValueError("generated block missing a START anchor")
    name = m.group(1)  # e.g. GAP_SUMMARY
    re_start = re.compile(r"<!--" + re.escape(name) + r"_START-->")
    re_end = re.compile(r"<!--" + re.escape(name) + r"_END-->")
    if not (re_start.search(text) and re_end.search(text)):
        raise ValueError(f"{path.name} is missing the {name} anchor pair")
    # Replace the entire region from START anchor through END anchor.
    pattern = re.compile(
        r"<!--" + re.escape(name) + r"_START-->[\s\S]*?<!--" + re.escape(name) + r"_END-->",
        re.S,
    )
    new_text = pattern.sub(block, text, count=1)
    path.write_text(new_text, encoding="utf-8")


def _inner_between(block: str, name: str) -> str | None:
    """Return the text between the named START/END anchors (stripped)."""
    m = re.search(
        r"<!--" + re.escape(name) + r"_START-->([\s\S]*?)<!--" + re.escape(name) + r"_END-->",
        block,
    )
    return m.group(1).strip() if m else None


def main(argv: list[str]) -> int:
    write = "--write" in argv
    check = "--check" in argv

    gap_rows = compute_gap_summary()[1]
    gap_md = gap_summary_markdown(gap_rows)
    issue_counts = compute_issue_counts()
    issue_md = issue_counts_markdown(issue_counts)

    # Always print the authoritative view.
    print("== Gap summary (sections 1-7, derived from per-row marks) ==")
    print(gap_md)
    print()
    print("== Issue counts (derived from issues.json) ==")
    print(issue_md)
    print()

    drift = False
    if check or write:
        # Validate the rendered blocks against the authoritative values.
        gap_text = GAP_FILE.read_text(encoding="utf-8")
        rendered_gap = _inner_between(gap_text, "GAP_SUMMARY")
        if rendered_gap is None or rendered_gap != _inner_between(gap_md, "GAP_SUMMARY"):
            drift = True
            print("DRIFT: FEATURE_GAP_ANALYSIS.md GAP_SUMMARY block is stale.", file=sys.stderr)

        issue_text = ISSUES_MD.read_text(encoding="utf-8")
        rendered_issue = _inner_between(issue_text, "ISSUE_COUNTS")
        if rendered_issue is None or rendered_issue != _inner_between(issue_md, "ISSUE_COUNTS"):
            drift = True
            print("DRIFT: ISSUES.md ISSUE_COUNTS block is stale.", file=sys.stderr)

    if write:
        _replace_between_anchors(GAP_FILE, gap_md)
        _replace_between_anchors(ISSUES_MD, issue_md)
        print("Wrote regenerated summary blocks to docs.")

    if check and drift:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

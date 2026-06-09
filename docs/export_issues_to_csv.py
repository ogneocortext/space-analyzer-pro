"""Export issues.json to CSV for spreadsheet viewing.

Usage:
    python docs/export_issues_to_csv.py
    python docs/export_issues_to_csv.py --filter open
    python docs/export_issues_to_csv.py --category architecture
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

JSON_PATH = Path(__file__).parent / "issues.json"
CSV_PATH = Path(__file__).parent / "issues_export.csv"

HEADER = [
    "Issue_ID",
    "Status",
    "Priority",
    "Category",
    "Subcategory",
    "Title",
    "Description",
    "Component",
    "File",
    "Resolution",
    "Date_Updated",
    "Date_Resolved",
    "Reporter",
    "Assignee",
    "Tags",
    "Test_Coverage",
    "Estimated_Hours",
    "Impact_Area",
    "First_Seen",
    "Last_Seen",
    "Occurrences",
]


def flatten(issue: dict) -> list:
    ex = issue.get("extra", {})
    return [
        issue.get("issue_id", ""),
        issue.get("status", ""),
        issue.get("severity", ""),
        issue.get("category", ""),
        ex.get("subcategory", ""),
        issue.get("title", ""),
        issue.get("notes", ""),
        ex.get("component", ""),
        ex.get("file", ""),
        ex.get("resolution", ""),
        issue.get("first_seen", ""),
        ex.get("date_resolved", ""),
        ex.get("reporter", ""),
        ex.get("assignee", ""),
        ", ".join(issue.get("tags", [])),
        ex.get("test_coverage", ""),
        ex.get("estimated_hours", ""),
        ex.get("impact_area", ""),
        issue.get("first_seen", ""),
        issue.get("last_seen", ""),
        issue.get("occurrences", 1),
    ]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--filter", choices=["open", "in_progress", "done", "wontfix"])
    ap.add_argument("--category")
    ap.add_argument("--severity", choices=["critical", "high", "medium", "low"])
    ap.add_argument("--output", type=Path, default=CSV_PATH)
    args = ap.parse_args()

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    issues = data.get("issues", [])

    rows = issues
    if args.filter:
        rows = [i for i in rows if i.get("status") == args.filter]
    if args.category:
        rows = [i for i in rows if i.get("category") == args.category.lower().replace(" ", "-")]
    if args.severity:
        rows = [i for i in rows if i.get("severity") == args.severity]

    with args.output.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for issue in rows:
            w.writerow(flatten(issue))

    print(f"Exported {len(rows)} issues to {args.output}")
    if args.filter or args.category or args.severity:
        print(f"  (filtered from {len(issues)} total)")


if __name__ == "__main__":
    main()

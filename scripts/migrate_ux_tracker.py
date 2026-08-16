"""One-shot migration: import ux_issues.json findings into docs/issues.json.

Usage:
    python docs/migrate_ux_tracker.py                          # merge ux_issues.json -> docs/issues.json
    python docs/migrate_ux_tracker.py --dry-run                # preview only
    python docs/migrate_ux_tracker.py --source legacy.json     # custom source
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def make_id(category: str, title: str) -> str:
    parts = [category.strip().lower(), title.strip().lower()]
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]
    safe_cat = "".join(c for c in category.strip().lower() if c.isalnum() or c == "-") or "issue"
    return f"{safe_cat}:{digest}"


def migrate(source: Path, target: Path, *, dry_run: bool = False) -> int:
    source_data = json.loads(source.read_text(encoding="utf-8"))
    source_issues = source_data.get("issues", [])
    if not source_issues:
        print(f"No issues in {source}")
        return 0

    target_data = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {"schema_version": 1, "issues": []}
    target_index = {i["issue_id"]: i for i in target_data.get("issues", [])}

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    migrated = 0

    for entry in source_issues:
        raw_id = entry.get("issue_id", make_id(entry.get("category", "ui"), entry.get("title", "")))
        key = f"migrated-ux:{raw_id.split(':', 1)[-1]}"
        existing = target_index.get(key)
        if existing:
            existing["last_seen"] = now
            existing["occurrences"] = int(existing.get("occurrences", 0)) + 1
            if entry.get("screenshot") and not existing.get("screenshot"):
                existing["screenshot"] = entry["screenshot"]
            ex_extra = existing.setdefault("extra", {})
            if entry.get("screenshot"):
                ex_extra["screenshot"] = entry["screenshot"]
            if entry.get("notes") and not existing.get("notes"):
                existing["notes"] = entry["notes"]
            if entry.get("severity") and existing.get("severity") == "medium":
                existing["severity"] = entry["severity"]
            ex_extra.setdefault("legacy_source", str(source))
        else:
            new_entry = {
                "issue_id": key,
                "title": entry.get("title", ""),
                "category": entry.get("category", "ui"),
                "severity": entry.get("severity", "medium"),
                "status": entry.get("status", "open").lower().replace("resolved", "done").replace("completed", "done"),
                "screenshot": entry.get("screenshot"),
                "first_seen": entry.get("first_seen", now[:10]),
                "last_seen": now,
                "occurrences": 1,
                "notes": entry.get("notes", ""),
                "tags": [f"tracker:ux-pipeline", f"source:{source.name}", *(entry.get("tags", [])[:5] if isinstance(entry.get("tags"), list) else [])],
                "extra": {
                    "legacy_source": str(source),
                    "original_issue_id": raw_id,
                    **(entry.get("extra", {}) if isinstance(entry.get("extra"), dict) else {}),
                },
            }
            target_index[key] = new_entry
            migrated += 1

    if dry_run:
        print(f"Would migrate {migrated} new issues (touch {len(source_issues) - migrated} existing)")
        return migrated

    target_data["issues"] = list(target_index.values())
    target_data["updated_at"] = now
    target.write_text(json.dumps(target_data, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Migrated {migrated} issues into {target} (total {len(target_index)})")
    return migrated


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge ux_issues.json into docs/issues.json")
    ap.add_argument("--source", type=Path, default=Path("ux_issues.json"), help="Source JSON (default: ux_issues.json)")
    ap.add_argument("--target", type=Path, default=Path("docs/issues.json"), help="Target JSON (default: docs/issues.json)")
    ap.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = ap.parse_args()

    if not args.source.exists():
        print(f"Source not found: {args.source}")
        sys.exit(1)

    migrate(args.source, args.target, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

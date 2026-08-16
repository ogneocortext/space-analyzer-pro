#!/usr/bin/env python3
"""Prune macro_logs so screenshot output doesn't grow without bound.

A "session" is any timestamped top-level folder under ``macro_logs`` — the
capture buckets this repo writes (``YYYY-MM-DD__<origin>__<representation>``),
the legacy capture folders (``screenshots_YYYYMMDD_HHMMSS``), or the run/agent
folders produced by the macro harness (``YYYYMMDD_HHMMSS``).

Two retention modes:

  * default        — keep the most recent ``--keep`` full sessions, delete older
                     session folders wholesale. Best for normal use: each kept
                     session retains its complete page-set.
  * --newest-per-session
                   — keep only the single newest image inside every session
                     folder (the most aggressive de-clutter). Use when you only
                     need one representative shot per session.

Folder names are timestamp-encoded, so a lexicographic sort equals chronological
order and works without touching file mtimes.

Usage:
  python scripts/prune_macro_logs.py                 # keep last 6 full sessions
  python scripts/prune_macro_logs.py --keep 3
  python scripts/prune_macro_logs.py --newest-per-session
  python scripts/prune_macro_logs.py --dry-run      # report only, no deletes
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

MACRO_LOGS = Path(__file__).resolve().parent.parent / "macro_logs"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_KEEP = 6

# Thematic capture buckets: "YYYY-MM-DD__<origin>__<representation>".
CAPTURE_BUCKET_RE = re.compile(r"^\d{4}-\d{2}-\d{2}__.+__.+$")


def _is_session(folder: Path) -> bool:
    name = folder.name
    return folder.is_dir() and (
        (name[:8].isdigit() and name[8:9] == "_")            # YYYYMMDD_HHMMSS...
        or name.startswith("screenshots_")
        or CAPTURE_BUCKET_RE.match(name)                      # YYYY-MM-DD__origin__representation
    )


def _session_key(folder: Path) -> str:
    """Return a chronological sort key for the folder name.

    Handles three shapes: ``YYYYMMDD_HHMMSS...`` run folders,
    ``screenshots_YYYYMMDD_HHMMSS`` capture folders, and
    ``YYYY-MM-DD__<origin>__<representation>`` thematic buckets. The leading
    date (digits only) drives the sort so all three interleave by real capture
    time rather than by their differing leading characters.
    """
    name = folder.name
    if CAPTURE_BUCKET_RE.match(name):
        return name[:10].replace("-", "")          # YYYYMMDD
    if name.startswith("screenshots_"):
        name = name[len("screenshots_"):]
    token = name.replace("_", "")[:14]
    return token if token.isdigit() else name


def _session_folders(root: Path):
    return sorted(
        (p for p in root.iterdir() if _is_session(p)),
        key=_session_key,
        reverse=True,
    )


def _images_in(folder: Path):
    return [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS]


def prune_keep_recent(root: Path, keep: int, dry_run: bool) -> tuple[int, int]:
    """Keep the most recent `keep` full sessions; delete older folders."""
    sessions = _session_folders(root)
    removed_dirs = 0
    removed_files = 0
    for old in sessions[keep:]:
        imgs = _images_in(old)
        if dry_run:
            print(f"  would delete session {old.name} ({len(imgs)} images)")
        else:
            shutil.rmtree(old)
        removed_dirs += 1
        removed_files += len(imgs)
    return removed_dirs, removed_files


def prune_newest_per_session(root: Path, dry_run: bool) -> tuple[int, int]:
    """Keep only the single newest image in each session folder."""
    removed = 0
    kept = 0
    for sess in _session_folders(root):
        imgs = sorted(_images_in(sess), key=lambda p: p.stat().st_mtime, reverse=True)
        if not imgs:
            continue
        kept += 1
        for stale in imgs[1:]:
            if dry_run:
                print(f"  would delete {stale.relative_to(root)}")
            else:
                stale.unlink()
            removed += 1
    return kept, removed


def main() -> int:
    ap = argparse.ArgumentParser(description="Prune macro_logs screenshot sessions.")
    ap.add_argument("--root", type=Path, default=MACRO_LOGS, help="macro_logs directory")
    ap.add_argument("--keep", type=int, default=DEFAULT_KEEP,
                    help=f"Most-recent sessions to retain in default mode (default {DEFAULT_KEEP}).")
    ap.add_argument("--newest-per-session", action="store_true",
                    help="Keep only the single newest image in each session folder.")
    ap.add_argument("--dry-run", action="store_true", help="Report what would be removed.")
    args = ap.parse_args()

    if not args.root.exists():
        print(f"ERROR: {args.root} does not exist", file=sys.stderr)
        return 1

    if args.newest_per_session:
        kept, removed = prune_newest_per_session(args.root, args.dry_run)
        mode = "newest-per-session"
    else:
        kept, removed = prune_keep_recent(args.root, args.keep, args.dry_run)
        mode = f"keep-recent({args.keep})"

    verb = "Would remove" if args.dry_run else "Removed"
    print(f"[{mode}] {verb} {removed} image file(s)"
          + (f" across {kept} retained session(s)" if args.newest_per_session else
             f"; kept {args.keep} most recent session(s)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

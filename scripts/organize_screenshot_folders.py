#!/usr/bin/env python3
"""Reorganize macro_logs into human-friendly thematic buckets.

The old layout scattered screenshots across dozens of timestamped folders
(``screenshots_YYYYMMDD_HHMMSS`` and ``YYYYMMDD_HHMMSS``), each holding one or two
images with no thematic grouping — exactly the "individual images in individual
folders" mess called out by the user.

This script moves every image into a bucket named:

    <date>__<origin>__<representation>

e.g. ``2026-08-13__winui3-capture__ui-pages``. The date is first so a plain
alphabetical sort is also chronological, and the origin/representation segments
record *what led to the capture* and *what it shows*.

Non-image leftovers (console.log, report.json, design_feedback*.md, ux_analysis*.json,
etc.) are relocated — never deleted — into ``_legacy_artifacts/`` mirroring their
old relative path, so nothing is lost. A per-image note is written to
``_gallery_meta.json`` so the gallery can show capture context.

Run with --dry-run first to preview. Safe to re-run (already-bucketed images are
skipped).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "macro_logs"
META_FILE = "_gallery_meta.json"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
BUCKET_RE = re.compile(r"^\d{4}-\d{2}-\d{2}__.+__.+$")
SKIP_DIRS = {"_legacy_artifacts"}
PRESERVE_NAMES = {META_FILE, "_gallery.html"}

# Slugs we recognize as WinUI3 app pages.
KNOWN_TABS = {
    "dashboard", "scan", "history", "smart-search", "workflows", "ai-chat",
    "dedup", "system", "cleanup", "settings", "rapid-switching",
}
TAB_TITLE = {
    "dashboard": "Dashboard", "scan": "Scan", "history": "History",
    "smart-search": "Advanced Search", "workflows": "Automation Workflows",
    "ai-chat": "AI Assistant", "dedup": "Duplicates", "system": "System",
    "cleanup": "Cleanup", "settings": "Settings", "rapid-switching": "Rapid Tab Switching",
    "raw-verify": "Raw Verification Capture", "tmp-vision": "Vision Analysis Input",
    "pre-click-scan-stop": "Pre-click Scan Stop", "scan-03-results": "Scan Results",
    "exp-settings": "Settings (Expanded)", "cur-settings": "Settings (Collapsed)",
    "launched": "App Launch",
}

# Slugs that map to a non-default origin/representation (what produced the shot).
ORIGIN_REP = {
    "raw-verify": ("verification", "capture-test"),
    "tmp-vision": ("vision", "gpu-analysis"),
}


def date_token(path: Path) -> str | None:
    """Return an embedded ``YYYYMMDD`` token from any path component, else None."""
    for part in path.parts:
        m = re.search(r"(\d{8})_\d{6}", part)
        if m:
            return m.group(1)
    return None


def label_from_name(fname: str) -> str:
    stem = Path(fname).stem
    stem = re.sub(r"^\d+_tab_", "", stem)
    stem = re.sub(r"^\d+_", "", stem)
    stem = re.sub(r"^[-_]+", "", stem)  # drop stray leading separators
    return stem or "image"


def derive(path: Path) -> tuple[str, str, str, str]:
    """Return (date YYYY-MM-DD, origin, representation, slug)."""
    slug = label_from_name(path.name).replace("_", "-")
    date8 = date_token(path) or datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y%m%d")
    date = f"{date8[:4]}-{date8[4:6]}-{date8[6:8]}"
    if slug in ORIGIN_REP:
        origin, rep = ORIGIN_REP[slug]
    else:
        origin, rep = "winui3-capture", "ui-pages"
    return date, origin, rep, slug


def load_meta() -> dict:
    f = ROOT / META_FILE
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_meta(meta: dict) -> None:
    (ROOT / META_FILE).write_text(json.dumps(meta, indent=2), encoding="utf-8")


def unique_name(dest: Path) -> Path:
    if not dest.exists():
        return dest
    stem, suffix = dest.stem, dest.suffix
    i = 1
    while True:
        cand = dest.parent / f"{stem} ({i}){suffix}"
        if not cand.exists():
            return cand
        i += 1


def human_label(slug: str) -> str:
    return TAB_TITLE.get(slug, slug.replace("-", " ").title())


def build_note(slug: str, date: str, origin: str, rep: str) -> str:
    return (f"Migrated legacy capture — {human_label(slug)}. "
            f"Originally captured {date} (origin inferred: {origin}, "
            f"representation: {rep}). Reorganized into a thematic bucket during cleanup.")


def collect_plan():
    images = [p for p in ROOT.rglob("*")
              if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
    # Skip images already inside a bucket or legacy dir.
    plan = []
    for p in images:
        rel = p.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS:
            continue
        if BUCKET_RE.match(rel.parts[0]):
            continue
        date, origin, rep, slug = derive(p)
        hhmmss = datetime.fromtimestamp(p.stat().st_mtime).strftime("%H%M%S")
        bucket = ROOT / f"{date}__{origin}__{rep}"
        dest = bucket / f"{hhmmss}__{slug}{p.suffix.lower()}"
        plan.append((p, dest, date, origin, rep, slug))
    return plan


def relocate_leftovers(dry_run: bool) -> list[tuple[Path, Path]]:
    """Move non-image, non-preserved files (mirroring relative path) into
    ``_legacy_artifacts/``. Returns the (src, dst) pairs that would/were moved."""
    moved: list[tuple[Path, Path]] = []
    legacy = ROOT / "_legacy_artifacts"
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() in IMAGE_EXTS:
            continue
        rel = p.relative_to(ROOT)
        if rel.parts[0] in SKIP_DIRS:
            continue
        if BUCKET_RE.match(rel.parts[0]):
            continue
        if rel.name in PRESERVE_NAMES:
            continue
        dst = legacy / rel
        moved.append((p, dst))
    if not dry_run:
        for src, dst in moved:
            dst.parent.mkdir(parents=True, exist_ok=True)
            # Avoid clobbering; the legacy tree is fresh so collisions are unlikely.
            dst = unique_name(dst)
            shutil.move(str(src), str(dst))
        # Remove now-empty leftover dirs (excluding roots we keep).
        for d in sorted([x for x in ROOT.rglob("*") if x.is_dir()],
                        key=lambda x: len(x.parts), reverse=True):
            if d in (ROOT, legacy):
                continue
            if BUCKET_RE.match(d.name):
                continue
            if d.name in SKIP_DIRS:
                continue
            try:
                if not any(d.iterdir()):
                    d.rmdir()
            except OSError:
                pass
    return moved


def main() -> int:
    global ROOT
    ap = argparse.ArgumentParser(description="Reorganize macro_logs into thematic buckets.")
    ap.add_argument("--root", type=Path, default=ROOT, help="macro_logs directory")
    ap.add_argument("--dry-run", action="store_true", help="Preview only; make no changes")
    args = ap.parse_args()
    ROOT = args.root.resolve()

    plan = collect_plan()
    if not plan:
        print("Nothing to reorganize (no legacy images found).")
        return 0

    print(f"{'DRY-RUN — ' if args.dry_run else ''}Will move {len(plan)} image(s) into buckets:")
    by_bucket: dict[str, list[str]] = {}
    for p, dest, date, origin, rep, slug in plan:
        by_bucket.setdefault(dest.parent.name, []).append(p.name)
    for bucket, names in sorted(by_bucket.items()):
        print(f"  {bucket}/  ({len(names)} image(s))")
        for n in names:
            print(f"      {n}")

    if args.dry_run:
        return 0

    meta = load_meta()
    for p, dest, date, origin, rep, slug in plan:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest = unique_name(dest)
        shutil.move(str(p), str(dest))
        rel = dest.relative_to(ROOT).as_posix()
        entry = meta.setdefault(rel, {})
        entry["note"] = build_note(slug, date, origin, rep)
        entry.setdefault("tags", [])
    save_meta(meta)

    leftovers = relocate_leftovers(dry_run=False)
    print(f"\nRelocated {len(leftovers)} non-image file(s) into _legacy_artifacts/ (nothing deleted).")
    print("Done. Reopen / refresh the gallery to see the new buckets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

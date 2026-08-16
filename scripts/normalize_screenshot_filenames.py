"""Rename capture files inside macro_logs buckets to friendly, human-readable
names and keep _gallery_meta.json keys in sync.

The buckets already encode date/origin/representation, so each file only needs
to say what the shot shows, e.g. `settings.png`, `dashboard.png`, `dedup.png`.
Legacy noise (`09_tab_settings.png`, `074232__settings.png`, `tmp-vision.jpg`)
is cleaned to `settings.png` / `vision.jpg`, with `-2`/`-3` suffixes when the
same view was captured more than once in a bucket.

Nothing is deleted; use --apply to perform the rename (default is a dry run).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "macro_logs"
META_FILE = "_gallery_meta.json"
BUCKET_RE = re.compile(r"^\d{4}-\d{2}-\d{2}__.+__.+$")
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp"}

KNOWN_MAP = {
    "raw-verify": ("verification", "capture-test"),
}


def clean_stem(stem: str) -> str:
    s = re.sub(r"^\d+__?", "", stem)          # drop "09_" index or "074232__" prefix
    s = s.replace("tab_", "").replace("tmp-", "")
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "image"


def next_name(bucket: Path, used: set, s: str, ext: str) -> str:
    name = f"{s}.{ext}"
    if name not in used and not (bucket / name).exists():
        used.add(name)
        return name
    i = 2
    while True:
        name = f"{s}-{i}.{ext}"
        if name not in used and not (bucket / name).exists():
            used.add(name)
            return name
        i += 1


def load_meta(root: Path) -> dict:
    f = root / META_FILE
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def main() -> int:
    apply = "--apply" in sys.argv
    root = ROOT
    if not root.exists():
        print(f"macro_logs not found at {root}", file=sys.stderr)
        return 2
    meta = load_meta(root)
    plan = []  # (old_rel, new_rel)
    for bucket in sorted(p for p in root.iterdir() if p.is_dir() and BUCKET_RE.match(p.name)):
        used: set[str] = set()
        for img in sorted(p for p in bucket.iterdir()
                          if p.is_file() and p.suffix.lower() in IMG_EXT):
            s = clean_stem(img.stem)
            new_name = next_name(bucket, used, s, img.suffix.lstrip(".").lower())
            if new_name != img.name:
                plan.append((img.relative_to(root).as_posix(),
                             (bucket / new_name).relative_to(root).as_posix()))
    if not plan:
        print("Nothing to rename — file names are already friendly.")
        return 0
    print(("APPLY: would rename" if apply else "DRY-RUN: would rename") +
          f" {len(plan)} file(s):")
    for old, new in plan:
        print(f"  {old}\n    -> {new}")
    if not apply:
        return 0
    # Perform renames (collect new metas first to avoid clobbering keys).
    new_meta = {}
    for old, new in plan:
        src = root / old
        dst = root / new
        src.replace(dst)
        if old in meta:
            new_meta[new] = meta[old]
    # rebuild meta preserving untouched entries + renamed ones
    merged = {k: v for k, v in meta.items() if k not in {o for o, _ in plan}}
    merged.update(new_meta)
    (root / META_FILE).write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(f"Renamed {len(plan)} file(s) and updated {META_FILE}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Generate a standalone HTML gallery of every screenshot under a root folder
(default: macro_logs) so they can be previewed in a browser before pruning.

The page groups images by their top-level session folder, sorts newest-first, and
lets you tick individual images or whole sessions, then copy ready-to-run
PowerShell delete commands for the selection.

Run:
  python scripts/gallery_macro_logs.py
  python scripts/gallery_macro_logs.py --root macro_logs --out macro_logs/_gallery.html
  python scripts/gallery_macro_logs.py --root assets        # preview a different tree
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from datetime import datetime

ROOT_DEFAULT = Path(__file__).resolve().parent.parent / "macro_logs"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def iter_images(root: Path):
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            yield p


def dims(path: Path):
    try:
        from PIL import Image

        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def human_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def build(root: Path, out: Path) -> tuple[int, int]:
    root = root.resolve()
    images = list(iter_images(root))
    meta_path = root / "_gallery_meta.json"
    meta = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            meta = {}
    groups: dict[str, list[Path]] = {}
    for p in images:
        rel = p.relative_to(root)
        top = rel.parts[0] if len(rel.parts) > 1 else "(root)"
        groups.setdefault(top, []).append(p)

    # Sort groups by newest image (desc), sessions with no images dropped.
    group_order = sorted(
        groups,
        key=lambda g: max((p.stat().st_mtime for p in groups[g]), default=0),
        reverse=True,
    )

    total_bytes = 0
    cards: list[str] = []
    sections: list[str] = []

    for gi, g in enumerate(group_order):
        files = sorted(groups[g], key=lambda p: p.stat().st_mtime, reverse=True)
        items: list[str] = []
        for p in files:
            st = p.stat()
            total_bytes += st.st_size
            rel = p.relative_to(root).as_posix()
            d = dims(p)
            dim = f"{d[0]}&times;{d[1]}" if d else "?"
            mtime = datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M")
            esc_name = html.escape(p.name)
            note = (meta.get(rel, {}) or {}).get("note", "")
            note_html = f'<span class="note">{html.escape(note)}</span>' if note else ''
            items.append(
                f'<figure class="card">'
                f'<label class="chk"><input type="checkbox" class="img" data-path="{html.escape(str(p))}">'
                f'<img loading="lazy" src="{html.escape(rel)}" alt="{esc_name}"></label>'
                f'<figcaption><span class="name" title="{esc_name}">{esc_name}</span>'
                f'<span class="meta">{dim} &middot; {human_bytes(st.st_size)} &middot; {mtime}</span>'
                f'{note_html}</figcaption>'
                f"</figure>"
            )
        sid = f"s{gi}"
        sections.append(
            f'<section class="sess">'
            f'<header class="sess-h"><label class="chk"><input type="checkbox" class="sess-all" data-sid="{sid}">'
            f'<b>{html.escape(g.replace("__", "  ·  "))}</b></label><span class="count">{len(files)} images</span></header>'
            f'<div class="grid" id="{sid}">{"".join(items)}</div></section>'
        )

    total_kb = human_bytes(total_bytes)
    gen = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshot Gallery &mdash; {html.escape(str(root.name))}</title>
<style>
* {{ box-sizing: border-box; }}
body {{ font: 14px/1.4 system-ui, Segoe UI, Roboto, sans-serif; margin: 0; color: #e6e6e6;
  background: #1e1e22; }}
.toolbar {{ position: sticky; top: 0; z-index: 5; display: flex; gap: 10px; flex-wrap: wrap;
  align-items: center; padding: 10px 16px; background: #2a2a30; border-bottom: 1px solid #3a3a42; }}
.toolbar h1 {{ font-size: 15px; margin: 0 12px 0 0; }}
.toolbar button, .toolbar label {{ font-size: 13px; }}
button {{ background: #3a6df0; color: #fff; border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer; }}
button.ghost {{ background: #3a3a42; }}
.stats {{ margin-left: auto; color: #aaa; font-size: 12px; }}
main {{ padding: 16px; }}
.sess {{ margin-bottom: 26px; border: 1px solid #33333b; border-radius: 10px; overflow: hidden; }}
.sess-h {{ display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #26262c; }}
.sess-h .count {{ color: #999; font-size: 12px; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 12px; }}
.card {{ margin: 0; border: 1px solid #33333b; border-radius: 8px; background: #202026; overflow: hidden; }}
.card img {{ display: block; width: 100%; height: auto; background: #111; }}
.chk {{ display: flex; gap: 6px; align-items: flex-start; cursor: pointer; }}
figcaption {{ padding: 6px 8px; }}
.name {{ display: block; font-size: 12px; color: #cfcfd6; word-break: break-all; }}
.meta {{ display: block; font-size: 11px; color: #888; margin-top: 2px; }}
.note {{ display: block; font-size: 11px; color: #b9c4d6; margin-top: 5px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; }}
pre#cmd {{ margin: 0; padding: 10px; background: #111; color: #9fe89f; max-height: 200px; overflow: auto;
  font: 12px/1.4 Consolas, monospace; white-space: pre-wrap; }}
.hint {{ color: #888; font-size: 12px; }}
</style></head>
<body>
<div class="toolbar">
  <h1>Screenshot Gallery</h1>
  <button id="all">Select all</button>
  <button id="none" class="ghost">Clear</button>
  <button id="copy">Copy delete commands</button>
  <span class="hint">tick images/sessions &rarr; copy commands &rarr; paste into PowerShell</span>
  <span class="stats">{len(images)} images &middot; {total_kb} &middot; generated {gen}</span>
</div>
<main>
{''.join(sections)}
</main>
<h2 style="padding:0 16px">Delete commands (for selected)</h2>
<pre id="cmd"># Select images above; commands appear here.</pre>
<script>
const imgBoxes = document.querySelectorAll('input.img');
const cmd = document.getElementById('cmd');
function refresh() {{
  const sel = [...document.querySelectorAll('input.img:checked')].map(b => b.dataset.path);
  cmd.textContent = sel.length
    ? sel.map(p => `Remove-Item -LiteralPath '${{p}}' -Force`).join('\\n')
    : '# Select images above; commands appear here.';
}}
document.querySelectorAll('input.sess-all').forEach(cb => {{
  cb.addEventListener('change', () => {{
    const sec = document.getElementById(cb.dataset.sid);
    sec.querySelectorAll('input.img').forEach(b => b.checked = cb.checked);
    refresh();
  }});
}});
imgBoxes.forEach(b => b.addEventListener('change', refresh));
document.getElementById('all').onclick = () => {{ imgBoxes.forEach(b => b.checked = true); refresh(); }};
document.getElementById('none').onclick = () => {{ imgBoxes.forEach(b => b.checked = false); refresh(); }};
document.getElementById('copy').onclick = async () => {{
  const sel = [...document.querySelectorAll('input.img:checked')].map(b => b.dataset.path);
  if (!sel.length) {{ alert('Nothing selected.'); return; }}
  const text = sel.map(p => `Remove-Item -LiteralPath '${{p}}' -Force`).join('\\n');
  try {{ await navigator.clipboard.writeText(text); }} catch (e) {{
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); t.remove();
  }}
  alert('Copied ' + sel.length + ' delete command(s) to clipboard.');
}};
</script>
</body></html>"""
    out.write_text(page, encoding="utf-8")
    return len(images), total_bytes


def main() -> int:
    ap = argparse.ArgumentParser(description="Build an HTML screenshot gallery.")
    ap.add_argument("--root", type=Path, default=ROOT_DEFAULT, help="Folder to scan for images.")
    ap.add_argument("--out", type=Path, default=None, help="Output HTML path (default <root>/_gallery.html).")
    args = ap.parse_args()

    if not args.root.exists():
        print(f"ERROR: {args.root} does not exist", file=sys.stderr)
        return 1
    out = args.out or (args.root / "_gallery.html")
    count, total = build(args.root, out)
    print(f"Wrote {out}")
    print(f"  {count} images, {human_bytes(total)}")
    print(f"  open: file:///{out.as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

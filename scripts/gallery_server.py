#!/usr/bin/env python3
"""Local screenshot gallery + organizer with a tiny HTTP server.

All organization changes (delete, create category folders, move between folders,
rename, tag) happen through REST calls and are reflected immediately on disk under
the chosen --root (default: macro_logs). The server only ever touches files inside
--root. Tags are stored in a sidecar <root>/_gallery_meta.json.

Run:
  python scripts/gallery_server.py
  python scripts/gallery_server.py --root macro_logs --port 8137

Then open the printed URL (http://localhost:8137/).
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import shutil
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime

ROOT_DEFAULT = Path(__file__).resolve().parent.parent / "macro_logs"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
META_FILE = "_gallery_meta.json"


# ── helpers ────────────────────────────────────────────────────────────────

def image_dims(path: Path):
    try:
        from PIL import Image

        with Image.open(path) as im:
            return list(im.size)
    except Exception:
        return None


def human_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def with_root(p_str: str, root: Path) -> Path:
    """Resolve and ensure a path stays within root. Raises ValueError otherwise."""
    p = Path(p_str).resolve()
    if p != root and root not in p.parents:
        raise ValueError("path is outside the gallery root")
    return p


def list_images(root: Path):
    """All images keyed by their immediate parent folder name (Uncategorized = root)."""
    by_folder: dict[str, list[dict]] = {}
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in IMAGE_EXTS:
            continue
        rel_parts = p.relative_to(root).parts
        folder = rel_parts[0] if len(rel_parts) > 1 else "Uncategorized"
        st = p.stat()
        d = image_dims(p)
        by_folder.setdefault(folder, []).append({
            "path": str(p),
            "name": p.name,
            "rel": p.relative_to(root).as_posix(),
            "size": st.st_size,
            "size_h": human_bytes(st.st_size),
            "dims": f"{d[0]}×{d[1]}" if d else "?",
            "mtime": st.st_mtime,
            "mtime_h": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
        })
    for f in by_folder:
        by_folder[f].sort(key=lambda x: x["name"])
    return by_folder


def load_meta(root: Path) -> dict:
    f = root / META_FILE
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_meta(root: Path, meta: dict) -> None:
    (root / META_FILE).write_text(json.dumps(meta, indent=2), encoding="utf-8")


def unique_name(dest_dir: Path, name: str) -> Path:
    target = dest_dir / name
    if not target.exists():
        return target
    stem, suffix = Path(name).stem, Path(name).suffix
    i = 1
    while True:
        cand = dest_dir / f"{stem} ({i}){suffix}"
        if not cand.exists():
            return cand
        i += 1


# ── HTTP handler ───────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    server_version = "GalleryServer/1.0"

    def log_message(self, *args):
        pass

    def _send(self, code: int, body: bytes, ctype: str = "application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        # Prevent the browser from caching the page/CSS: a stale cached copy
        # would keep showing the pre-fix (broken) layout on reload.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code: int, obj):
        self._send(code, json.dumps(obj).encode("utf-8"))

    def _body_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    # ----- GET -----
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            return self._send(200, PAGE_HTML.encode("utf-8"), "text/html; charset=utf-8")
        if parsed.path == "/api/state":
            root = self.server.root
            by_folder = list_images(root)
            names = [f for f in by_folder if f != "Uncategorized"]
            names.sort()
            if "Uncategorized" in by_folder:
                names.append("Uncategorized")
            meta = load_meta(root)
            tags_map = {rel: meta.get(rel, {}).get("tags", []) for rel in meta}
            notes_map = {rel: meta.get(rel, {}).get("note", "") for rel in meta}
            # Inject per-image notes so the gallery can show context below each shot.
            for folder in by_folder.values():
                for im in folder:
                    im["note"] = notes_map.get(im["rel"], "")
            all_tags: dict[str, int] = {}
            for tags in meta.values():
                for t in tags.get("tags", []):
                    all_tags[t] = all_tags.get(t, 0) + 1
            return self._send_json(200, {
                "root_name": root.name,
                "folders": names,
                "counts": {f: len(by_folder[f]) for f in names},
                "images": by_folder,
                "tags": tags_map,
                "allTags": [{"tag": t, "count": c} for t, c in sorted(all_tags.items(), key=lambda x: -x[1])],
                "total": sum(len(v) for v in by_folder.values()),
            })
        if parsed.path.startswith("/file"):
            qs = urllib.parse.parse_qs(parsed.query)
            rel = qs.get("rel", [""])[0]
            if not rel:
                return self._send(400, b"missing rel")
            try:
                p = with_root(str(self.server.root / rel), self.server.root)
            except ValueError:
                return self._send(403, b"forbidden")
            if not p.exists():
                return self._send(404, b"not found")
            ctype, _ = mimetypes.guess_type(p.name)
            self.send_response(200)
            self.send_header("Content-Type", ctype or "application/octet-stream")
            self.send_header("Content-Length", str(p.stat().st_size))
            self.end_headers()
            with open(p, "rb") as fh:
                shutil.copyfileobj(fh, self.wfile)
            return
        self._send(404, b"not found")

    # ----- POST -----
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self._send(404, b"not found")
        try:
            data = self._body_json()
            root = self.server.root

            if parsed.path == "/api/mkdir":
                name = (data.get("name") or "").strip()
                if not name or "/" in name or "\\" in name:
                    return self._send_json(400, {"error": "invalid folder name"})
                d = with_root(str(root / name), root)
                d.mkdir(parents=True, exist_ok=True)
                return self._send_json(200, {"ok": True, "folder": d.name})

            if parsed.path == "/api/delete":
                p = with_root(data["path"], root)
                if p.is_dir():
                    shutil.rmtree(p)
                else:
                    p.unlink()
                return self._send_json(200, {"ok": True, "deleted": str(p)})

            if parsed.path == "/api/move":
                p = with_root(data["path"], root)
                dest_name = (data.get("dest") or "").strip()
                if dest_name in ("", "Uncategorized", "."):
                    dest_dir = root
                else:
                    dest_dir = with_root(str(root / dest_name), root)
                    dest_dir.mkdir(parents=True, exist_ok=True)
                target = unique_name(dest_dir, p.name)
                shutil.move(str(p), str(target))
                return self._send_json(200, {"ok": True, "moved": str(target)})

            if parsed.path == "/api/rename":
                p = with_root(data["path"], root)
                new_name = (data.get("name") or "").strip()
                if not new_name or "/" in new_name or "\\" in new_name:
                    return self._send_json(400, {"error": "invalid name"})
                target = unique_name(p.parent, new_name)
                shutil.move(str(p), str(target))
                return self._send_json(200, {"ok": True, "renamed": str(target)})

            if parsed.path in ("/api/tag", "/api/untag"):
                p = with_root(data["path"], root)
                tag = (data.get("tag") or "").strip()
                if not tag:
                    return self._send_json(400, {"error": "invalid tag"})
                rel = p.relative_to(root).as_posix()
                meta = load_meta(root)
                entry = meta.setdefault(rel, {"tags": []})
                if parsed.path == "/api/tag":
                    if tag not in entry["tags"]:
                        entry["tags"].append(tag)
                else:
                    entry["tags"] = [t for t in entry["tags"] if t != tag]
                if not entry["tags"]:
                    meta.pop(rel, None)
                save_meta(root, meta)
                return self._send_json(200, {"ok": True, "tags": entry["tags"]})

            if parsed.path == "/api/note":
                p = with_root(data["path"], root)
                note = (data.get("note") or "").strip()
                rel = p.relative_to(root).as_posix()
                meta = load_meta(root)
                entry = meta.setdefault(rel, {})
                if note:
                    entry["note"] = note
                else:
                    entry.pop("note", None)
                entry.setdefault("tags", [])
                if not entry.get("tags") and "note" not in entry:
                    meta.pop(rel, None)
                save_meta(root, meta)
                return self._send_json(200, {"ok": True, "note": note})

            return self._send_json(404, {"error": "unknown endpoint"})
        except (ValueError, KeyError, FileNotFoundError, PermissionError) as exc:
            return self._send_json(400, {"error": str(exc)})


# ── SPA page ───────────────────────────────────────────────────────────────

PAGE_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshot Gallery &amp; Organizer</title>
<style>
* { box-sizing: border-box; }
html, body { overflow-x: clip; }
body { font: 14px/1.4 system-ui, Segoe UI, Roboto, sans-serif; margin: 0; color: #e6e6e6; background: #161619; }
a { color: #7aa2ff; }
.topbar { position: sticky; top: 0; z-index: 20; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  padding: 10px 14px; background: #212128; border-bottom: 1px solid #33333b; }
.topbar h1 { font-size: 15px; margin: 0 10px 0 0; white-space: nowrap; }
.topbar input.search { flex: 1; min-width: 160px; padding: 7px 10px; background: #161619; color: #eee;
  border: 1px solid #3a3a42; border-radius: 7px; }
.topbar select { padding: 7px 8px; background: #161619; color: #eee; border: 1px solid #3a3a42; border-radius: 7px; }
button { background: #3a6df0; color: #fff; border: 0; border-radius: 7px; padding: 7px 12px; cursor: pointer; font-size: 13px; }
button.ghost { background: #3a3a42; }
button.danger { background: #c0392b; }
.layout { display: flex; align-items: flex-start; min-width: 0; }
.sidebar { width: 210px; flex: 0 0 210px; position: sticky; top: 49px; align-self: flex-start;
  height: calc(100vh - 49px); overflow: auto; padding: 12px; background: #1c1c22; border-right: 1px solid #2c2c34; }
.layout.collapsed .sidebar { display: none; }
.sidebar h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #888; margin: 14px 0 6px; }
.cat { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 6px; cursor: pointer; color: #cfcfd6; min-width: 0; }
.cat:hover { background: #26262e; }
.cat.active { background: #2f4a86; color: #fff; }
.cat .n { color: #888; font-size: 12px; flex: 0 0 auto; }
.cat > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.tagchip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; margin: 3px 4px 0 0; border-radius: 999px;
  background: #2a2a33; color: #cdd; font-size: 12px; cursor: pointer; border: 1px solid #3a3a44; }
.tagchip.active { background: #3a6df0; color: #fff; border-color: #3a6df0; }
.tagchip .x { opacity: .6; }
.main { flex: 1 1 0; min-width: 0; padding: 20px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 20px;
  row-gap: 26px;
}
@media (max-width: 760px) {
  .layout { flex-direction: column; }
  .sidebar { width: auto; flex: none; height: auto; position: static; max-height: 42vh; overflow-y: auto;
    border-right: 0; border-bottom: 1px solid #2c2c34; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
}
/* Portrait / vertical displays (e.g. 1080x1920): don't waste width on a side
   column — stack the folder list on top as a bounded, scrollable section so the
   grid keeps the full width of the tall screen. */
@media (orientation: portrait) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; flex: none; height: auto; position: static; max-height: 38vh; overflow-y: auto;
    border-right: 0; border-bottom: 1px solid #2c2c34; }
  .main { padding: 16px; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
}
/* Large landscape (1080p horizontal = 1920x1080 and up): give cards more room
   and a bit more gutter so they don't blow up huge on wide monitors. */
@media (min-width: 1600px) and (orientation: landscape) {
  .main { padding: 24px; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 22px; row-gap: 28px; }
}
.card { position: relative; border: 1px solid #2c2c34; border-radius: 9px; overflow: hidden; background: #1c1c22; }
.card.sel { outline: 2px solid #3a6df0; }
.thumb { position: relative; aspect-ratio: 4/3; background: #000; cursor: zoom-in; }
.thumb img { width: 100%; height: 100%; object-fit: contain; display: block; }
.thumb .chk { position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; z-index: 3; cursor: pointer; }
.thumb .acts { position: absolute; top: 4px; right: 4px; display: none; gap: 4px; z-index: 3; }
.card:hover .acts, .card.sel .acts { display: flex; }
.acts button { padding: 3px 7px; font-size: 11px; }
.chips { position: absolute; left: 6px; bottom: 6px; display: flex; flex-wrap: wrap; gap: 3px; max-width: 90%; z-index: 2; }
.minichip { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: rgba(58,109,240,.85); color: #fff; }
.cap { padding: 6px 8px; }
.cap .name { font-size: 12px; font-weight: 600; color: #e6e6ee; word-break: break-all; }
.cap .meta { font-size: 11px; color: #888; margin-top: 2px; }
.cap .note { display: block; font-size: 11px; color: #c7d2e0; margin-top: 6px; line-height: 1.4; white-space: pre-wrap; word-break: break-word;
  background: #23232b; border-left: 2px solid #3a6df0; padding: 5px 7px; border-radius: 4px; }
.cap .note.empty { background: transparent; border-left-color: #3a3a44; color: #6b7280; font-style: italic; }
.empty-state { grid-column: 1/-1; text-align: center; color: #8a8a94; padding: 48px 16px; font-size: 14px; }
.empty-state b { color: #c7c7d0; }
.sstats { margin-top: 16px; padding-top: 12px; border-top: 1px solid #2c2c34; display: flex; flex-direction: column; gap: 6px; }
.sstat { display: flex; justify-content: space-between; font-size: 11px; color: #888; }
.sstat b { color: #d4d4dc; }
.bulk { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 40;
  display: none; align-items: center; gap: 8px; padding: 10px 14px; background: #2a2a33; border: 1px solid #444; border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,.5); }
.bulk.show { display: flex; }
.bulk .cnt { font-size: 13px; color: #fff; margin-right: 4px; }
.bulk select { padding: 6px; background: #161619; color: #eee; border: 1px solid #3a3a42; border-radius: 6px; }
.countbar { color: #999; font-size: 12px; margin: 0 0 10px; }
#toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: #3a6df0; color: #fff;
  padding: 8px 16px; border-radius: 8px; opacity: 0; transition: opacity .2s; pointer-events: none; z-index: 50; }
#toast.show { opacity: 1; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: none; align-items: center; justify-content: center; z-index: 60; }
.modal.show { display: flex; }
.modal .box { background: #26262c; padding: 18px; border-radius: 10px; width: 320px; }
.modal input { width: 100%; padding: 7px; margin-top: 8px; background: #161619; color: #eee; border: 1px solid #3a3a42; border-radius: 6px; }
.modal .row { margin-top: 12px; text-align: right; }
.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: none; align-items: center; justify-content: center; z-index: 70; }
.lightbox.show { display: flex; }
.lightbox img { max-width: 94vw; max-height: 92vh; }
</style></head>
<body>
<div class="topbar">
  <h1>Gallery &amp; Organizer</h1>
  <button id="toggleside" class="ghost" title="Toggle sidebar">☰</button>
  <input class="search" id="search" placeholder="Search filenames…">
  <select id="sort">
    <option value="name">Sort: Name</option>
    <option value="date">Sort: Newest</option>
    <option value="size">Sort: Size</option>
  </select>
  <button id="newcat">New category</button>
  <button id="refresh" class="ghost">Refresh</button>
</div>
<div class="layout collapsed">
  <aside class="sidebar">
    <h3>Folders</h3><div id="cats"></div>
    <h3>Tags</h3><div id="tags"></div>
    <div id="stats" class="sstats"></div>
  </aside>
  <main class="main">
    <div class="countbar" id="countbar"></div>
    <div class="grid" id="grid"></div>
  </main>
</div>
<div class="bulk" id="bulk">
  <span class="cnt" id="bulkcnt">0 selected</span>
  <button id="b-all" class="ghost">All</button>
  <button id="b-clear" class="ghost">Clear</button>
  <select id="b-move"><option value="">Move to…</option></select>
  <button id="b-del" class="danger">Delete</button>
</div>
<div id="toast"></div>
<div class="modal" id="modal"><div class="box"><b id="modal-title">New category</b>
  <input id="modal-input" placeholder="name"><div class="row">
  <button class="ghost" id="modal-cancel">Cancel</button>
  <button id="modal-ok">Create</button></div></div></div>
<div class="lightbox" id="lightbox"><img id="lb-img" src=""></div>
<script>
const $ = s => document.querySelector(s);
let STATE = null, ITEMS = [], SELECTED = new Set();
let F = { cat: 'All', tag: null, q: '' };

async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body||{}) });
  return r.json();
}
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1700); }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function load(){ const r=await fetch('/api/state'); STATE=await r.json(); buildIndex(); render(); }
// Bucket folders are named "YYYY-MM-DD__<origin>__<representation>"; show them as
// a friendlier "date · origin · representation" so the sidebar reads naturally.
function prettyFolder(name){ return name.split('__').join('  ·  '); }
function buildIndex(){
  ITEMS=[]; const tg = STATE.tags||{};
  for (const f of STATE.folders) for (const im of (STATE.images[f]||[]))
    ITEMS.push(Object.assign({folder:f, tags: tg[im.rel]||[]}, im));
}
function filtered(){
  let arr = ITEMS.filter(it => {
    if (F.cat!=='All' && it.folder!==F.cat) return false;
    if (F.tag && !it.tags.includes(F.tag)) return false;
    if (F.q && !it.name.toLowerCase().includes(F.q.toLowerCase())) return false;
    return true;
  });
  const s=$('#sort').value;
  arr.sort((a,b)=> s==='date' ? b.mtime-a.mtime : s==='size' ? b.size-a.size : a.name.localeCompare(b.name));
  return arr;
}
function render(){
  // sidebar
  const cats=$('#cats'); cats.innerHTML='';
  const mk=(name,n,active)=>{const d=document.createElement('div');d.className='cat'+(active?' active':'');d.title=name;d.innerHTML=`<span>${esc(name)}</span><span class="n">${n}</span>`;d.onclick=()=>{F.cat=name;render();};cats.appendChild(d);};
  mk('All', STATE.total, F.cat==='All');
  for (const f of STATE.folders) mk(prettyFolder(f), STATE.counts[f], F.cat===f);
  const tags=$('#tags'); tags.innerHTML='';
  for (const t of STATE.allTags){
    const c=document.createElement('span'); c.className='tagchip'+(F.tag===t.tag?' active':''); c.innerHTML=`${esc(t.tag)} <span class="x">${t.count}</span>`;
    c.onclick=()=>{F.tag=F.tag===t.tag?null:t.tag;render();}; tags.appendChild(c);
  }
  // sidebar stats footer
  $('#stats').innerHTML=`<div class="sstat"><span>Total</span><b>${STATE.total}</b></div>`
    + `<div class="sstat"><span>Folders</span><b>${STATE.folders.length}</b></div>`
    + `<div class="sstat"><span>Tags</span><b>${STATE.allTags.length}</b></div>`;
  // grid
  const arr=filtered();
  $('#countbar').textContent=`${arr.length} of ${STATE.total} shown`+(F.cat!=='All'?` · folder: ${prettyFolder(F.cat)}`:'')+(F.tag?` · tag: ${F.tag}`:'');
  const grid=$('#grid'); grid.innerHTML='';
  if (arr.length===0){
    const fdesc=(F.cat!=='All'?` in <b>${esc(prettyFolder(F.cat))}</b>`:'')+(F.tag?` tagged “${esc(F.tag)}”`:'')+(F.q?` matching “${esc(F.q)}”`:'');
    grid.innerHTML=`<div class="empty-state">No items found${fdesc}.<br><span style="font-size:12px;color:#6b7280">Adjust the folder, tag, or search above.</span></div>`;
    syncBulk(); return;
  }
  for (const it of arr){
    const card=document.createElement('div'); card.className='card'+(SELECTED.has(it.path)?' sel':'');
    const opts=STATE.folders.map(n=>`<option ${n===it.folder?'selected':''}>${esc(n)}</option>`).join('');
    const chips=(it.tags||[]).map(t=>`<span class="minichip" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
    card.innerHTML=`
      <div class="thumb">
        <input type="checkbox" class="chk" ${SELECTED.has(it.path)?'checked':''}>
        <img loading="lazy" src="/file?rel=${encodeURIComponent(it.rel)}" alt="${esc(it.name)}">
        <div class="acts">
          <button class="ghost act-note" title="Edit note">📝</button>
          <button class="ghost act-tag">+tag</button>
          <button class="danger act-del">✕</button>
        </div>
        ${chips?`<div class="chips">${chips}</div>`:''}
      </div>
      <div class="cap">
        <span class="name" title="${esc(it.name)}">${esc(it.name)}</span>
        <span class="meta">${it.dims} · ${it.size_h} · ${it.mtime_h}</span>
        <span class="note ${it.note ? '' : 'empty'}">${it.note ? esc(it.note) : 'No note yet — click 📝 to add context'}</span>
      </div>`;
    card.querySelector('.thumb img').onclick=e=>{ if(e.target.classList.contains('chk'))return; openLB(it.rel); };
    card.querySelector('.chk').onchange=e=>{ toggle(it.path, e.target.checked); };
    card.querySelector('.act-del').onclick=()=>delOne(it);
    card.querySelector('.act-tag').onclick=()=>addTag(it);
    card.querySelector('.act-note').onclick=()=>editNote(it);
    card.querySelectorAll('.minichip').forEach(c=>c.onclick=()=>{F.tag=c.dataset.tag;render();});
    grid.appendChild(card);
  }
  syncBulk();
}
function toggle(path,on){ if(on)SELECTED.add(path); else SELECTED.delete(path); render(); }
function syncBulk(){
  const b=$('#bulk'); if(SELECTED.size){ b.classList.add('show'); $('#bulkcnt').textContent=`${SELECTED.size} selected`; }
  else b.classList.remove('show');
  const mv=$('#b-move'); const cur=mv.innerHTML; mv.innerHTML='<option value="">Move to…</option>'+
    STATE.folders.map(n=>`<option>${esc(n)}</option>`).join('')+'<option value="__new__">+ New category…</option>';
}
async function openLB(rel){ $('#lb-img').src='/file?rel='+encodeURIComponent(rel); $('#lightbox').classList.add('show'); }
$('#lightbox').onclick=()=>$('#lightbox').classList.remove('show');

async function delOne(it){
  if(!confirm('Delete '+it.name+'?')) return;
  await api('/api/delete',{path:it.path}); SELECTED.delete(it.path); toast('deleted'); load();
}
$('#b-del').onclick=async()=>{
  const paths=[...SELECTED]; if(!paths.length) return;
  if(!confirm('Delete '+paths.length+' image(s)?')) return;
  for(const p of paths) await api('/api/delete',{path:p});
  SELECTED.clear(); toast('deleted '+paths.length); load();
};
$('#b-move').onchange=async e=>{
  const dest=e.target.value; if(!dest) return; e.target.value='';
  const paths=[...SELECTED]; if(!paths.length) return;
  let d=dest;
  if(d==='__new__'){ d=prompt('New category name:'); if(!d) return; const r=await api('/api/mkdir',{name:d}); if(r.error) return toast(r.error); }
  for(const p of paths) await api('/api/move',{path:p, dest:d});
  SELECTED.clear(); toast('moved to '+d); load();
};
$('#b-all').onclick=()=>{ filtered().forEach(it=>SELECTED.add(it.path)); render(); };
$('#b-clear').onclick=()=>{ SELECTED.clear(); render(); };
async function addTag(it){
  const t=prompt('Add tag to '+it.name+':',''); if(!t) return;
  const r=await api('/api/tag',{path:it.path, tag:t.trim()}); if(r.error) return toast(r.error);
  toast('tagged'); load();
}
async function editNote(it){
  const curNote = (it.note || '');
  const t=prompt('Context note for '+it.name+' (what led to this capture?):', curNote); if(t===null) return;
  const r=await api('/api/note',{path:it.path, note:t.trim()}); if(r.error) return toast(r.error);
  toast('note saved'); load();
}
$('#toggleside').onclick=()=>document.querySelector('.layout').classList.toggle('collapsed');
$('#search').oninput=e=>{ F.q=e.target.value; render(); };
$('#sort').onchange=render;
$('#refresh').onclick=load;
$('#newcat').onclick=()=>openModal('New category','folder name',async v=>{const r=await api('/api/mkdir',{name:v});if(r.error)return toast(r.error);toast('created '+v);load();});
function openModal(title,ph,onOk){ $('#modal-title').textContent=title; $('#modal-input').value=''; $('#modal-input').placeholder=ph;
  $('#modal').classList.add('show');
  $('#modal-ok').onclick=()=>{const v=$('#modal-input').value.trim(); if(!v)return; $('#modal').classList.remove('show'); onOk(v);};
  $('#modal-cancel').onclick=()=>$('#modal').classList.remove('show'); }
load();
</script>
</body></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Local screenshot gallery + organizer server.")
    ap.add_argument("--root", type=Path, default=ROOT_DEFAULT, help="Folder to manage.")
    ap.add_argument("--port", type=int, default=8137, help="HTTP port (default 8137).")
    ap.add_argument("--host", default="127.0.0.1", help="Bind host (default 127.0.0.1).")
    args = ap.parse_args()

    root = args.root.resolve()
    if not root.exists():
        print(f"ERROR: {root} does not exist", file=sys.stderr)
        return 1

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.root = root
    print(f"Gallery serving: {root}")
    print(f"Open: http://{args.host}:{args.port}/")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

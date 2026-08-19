#!/usr/bin/env python3
"""
Live progress server for analyze_ux_screenshots.py, plus an interactive
screenshot gallery / dedup manager.

Run it while the analyzer is working:

    python scripts/utility/live_progress_server.py

 Then open:
     http://127.0.0.1:8777/        live Ollama analysis dashboard
     http://127.0.0.1:8777/gallery  screenshot gallery + duplicate manager

 The analyzer writes macro_logs/analysis_progress.json as it goes; this server
 just serves that file (plus the finished report) over HTTP. The gallery scans a
 chosen screenshot root, groups images by SHA-256, flags exact duplicates, and
 deletes the ones you select (server-side, restricted to macro_logs). No
 third-party dependencies.

 The dashboard can also LAUNCH a fresh analysis (POST /api/run) as a subprocess,
 so you don't have to run the analyzer from a terminal.

Flags:
    --port N          listen port (default 8777)
    --host H          bind host (default 127.0.0.1)
    --shots-root DIR  where to look for analysis_progress.json / screenshots
"""

import argparse
import hashlib
import html
import io
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

# Subprocess state for "Run New Analysis" launched from the dashboard.
_RUN_STATE = None
_RUN_LOCK = threading.Lock()
MAX_POST_BYTES = 1 * 1024 * 1024

# Subprocess state for the "Self-Improvement Loop" launched from the dashboard.
_LOOP_STATE = None
_LOOP_LOCK = threading.Lock()

try:
    from PIL import Image
    _HAVE_PIL = True
except Exception:  # pragma: no cover - PIL optional for thumbnails/dims
    _HAVE_PIL = False

HERE = Path(__file__).resolve().parent
DEFAULT_SHOTS_ROOT = Path("macro_logs")
HTML_PATH = HERE / "live_progress.html"
GALLERY_HTML_PATH = HERE / "screenshot_gallery.html"
THEME_CSS_PATH = HERE / "theme.css"
LOOP_SCRIPT = HERE.parent / "improvement_loop.py"
LOOP_STATE_FILE = HERE.parent.parent / "docs" / ".loop_state.json"

# Parity: when a run produced JSON without a companion .html, render it with the
# same engine the analyzer uses (deduped grouping, embedded screenshots, quality
# cards, health badges, filter/search/sort toolbar). Falls back to the inline
# renderer below if the analyzer module cannot be imported in this process.
try:
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    from analyze_ux_screenshots import (  # noqa: E402
        _render_html_report as _render_full_report,
        _parse_shot,
    )
    _HAVE_FULL_RENDER = True
    _HAVE_PREVIEW_PARSE = True
except Exception:  # pragma: no cover - analyzer deps unavailable
    _HAVE_FULL_RENDER = False
    _HAVE_PREVIEW_PARSE = False

try:
    from ux_reports_db import ReportsStore as _ReportsStore
    _HAVE_REPORTS_DB = True
except Exception:  # pragma: no cover - sqlite store optional
    _HAVE_REPORTS_DB = False


def _get_store(root_base: Path):
    """Return a ``ReportsStore`` for ``root_base``, or ``None`` if unavailable."""
    if not _HAVE_REPORTS_DB:
        return None
    try:
        return _ReportsStore(root_base / "ux_reports.db")
    except Exception:  # pragma: no cover - db open failure
        return None

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
CTYPE = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp",
}


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _latest_report(shots_root: Path) -> dict | None:
    candidates = sorted(shots_root.glob("ux_analysis_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    for c in candidates:
        data = _read_json(c)
        if data:
            return data
    return None


# --- GUI launcher ---------------------------------------------------------
# The WinUI 3 GUI lives under gui-winui/ and is built to bin/<arch>/<Config>/<tfm>/.
# A "Launch GUI" shortcut on the dashboard opens the newest built SpaceAnalyzer.exe
# directly (the server runs on the same Windows host), so the user can jump from the
# analysis dashboard into the real application without hunting through build output.
REPO_ROOT = HERE.parent.parent
_GUI_GLOB = "gui-winui/**/bin/**/SpaceAnalyzer.exe"


def _latest_gui_exe() -> Path | None:
    """Return the most recently built SpaceAnalyzer.exe, or None if not built."""
    matches = list(REPO_ROOT.glob(_GUI_GLOB))
    if not matches:
        return None
    return max(matches, key=lambda p: p.stat().st_mtime)


def _launch_gui() -> dict:
    exe = _latest_gui_exe()
    if exe is None or not exe.is_file():
        return {
            "ok": False,
            "message": "No SpaceAnalyzer.exe build found. Build the WinUI project first.",
        }
    try:
        flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
            subprocess, "CREATE_NEW_PROCESS_GROUP", 0
        )
        # Redirect the std handles so the GUI does not inherit the server's console
        # pipe, and use a new process group so it survives server restarts.
        subprocess.Popen(
            [str(exe)],
            creationflags=flags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
        return {"ok": True, "path": str(exe), "message": "Launched Space Analyzer GUI."}
    except (OSError, ValueError) as exc:
        return {"ok": False, "path": str(exe), "message": f"Failed to launch: {exc}"}


# --- Issue tracker integration -------------------------------------------
# The canonical, shared issue store is docs/issues.json. Surfacing it here makes
# the dashboard the single hub for every dev tool: the UX analysis pipes findings
# in, the self-improvement loop reads from it, and this panel lets you triage /
# update issues without leaving the dashboard.
TRACKER_PATH = REPO_ROOT / "docs" / "issues.json"


def _read_tracker() -> dict:
    """Read the canonical issue tracker (docs/issues.json). Missing/empty -> empty store."""
    if TRACKER_PATH.exists():
        raw = TRACKER_PATH.read_bytes()
        data = None
        for enc in ("utf-8", "cp1252"):
            try:
                data = json.loads(raw.decode(enc))
                break
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
        if isinstance(data, dict):
            data.setdefault("issues", [])
            return data
    return {"schema_version": 1, "issues": []}


def _write_tracker(data: dict) -> None:
    """Write the issue tracker (same shape as the pipeline store)."""
    TRACKER_PATH.parent.mkdir(parents=True, exist_ok=True)
    TRACKER_PATH.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


_VALID_STATUSES = {"open", "in_progress", "done", "wontfix", "blocked", "pending"}


def _norm_status(value: str) -> str:
    """Coerce a status string (plus friendly aliases) into a valid tracker status."""
    if not value:
        return "open"
    v = str(value).strip().lower()
    aliases = {"completed": "done", "closed": "done", "resolved": "done",
               "working": "in_progress", "skip": "wontfix", "ignore": "wontfix"}
    if v in _VALID_STATUSES:
        return v
    return aliases.get(v, "open")


def _issue_counts(issues: list[dict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for it in issues:
        s = it.get("status") or "open"
        out[s] = out.get(s, 0) + 1
    return out


def _build_issues_payload(status=None, category=None, q=None, severity=None, limit=200) -> dict:
    data = _read_tracker()
    issues = data.get("issues", [])
    out: list[dict] = []
    ql = (q or "").strip().lower()
    for it in issues:
        if status and it.get("status") != status:
            continue
        if category and it.get("category") != category:
            continue
        if severity and it.get("severity") != severity:
            continue
        if ql:
            extra = it.get("extra") or {}
            hay = " ".join([
                str(it.get("title", "")), str(it.get("notes", "")),
                str(it.get("issue_id", "")),
                " ".join(it.get("tags", []) if isinstance(it.get("tags"), list) else []),
                str(extra.get("file", "")), str(extra.get("source_set", "")),
            ]).lower()
            if ql not in hay:
                continue
        out.append(it)
    counts = _issue_counts(issues)
    categories = sorted({it.get("category") for it in issues if it.get("category")})
    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    out.sort(key=lambda i: (
        0 if i.get("status") in ("open", "in_progress") else 1,
        sev_rank.get(i.get("severity"), 9),
        (i.get("last_seen") or ""),
    ))
    if limit:
        out = out[:limit]
    return {"status": "ok", "counts": counts, "categories": categories,
            "total": len(issues), "issues": out}




def _render_summary_block(summary) -> str:
    """Render the consolidated summary (same schema as a per-shot analysis) as
    structured cards instead of a raw JSON dump."""
    esc = lambda value: html.escape(str(value or ""))
    if not isinstance(summary, dict):
        return f"<pre>{esc(summary or 'Not completed')}</pre>"
    sev_counts: dict[str, int] = {}
    parts: list[str] = []
    content = summary.get("main_content")
    if content:
        parts.append(f"<p>{esc(content)}</p>")
    for it in (summary.get("issues") or []):
        category = esc(str(it.get("category", "uncategorized")).replace("_", " "))
        severity = esc(it.get("severity", "low"))
        sev_counts[severity] = sev_counts.get(severity, 0) + 1
        finding = esc(it.get("finding"))
        location = esc(it.get("location"))
        evidence = esc(it.get("evidence"))
        recommendation = esc(it.get("recommendation"))
        parts.append(
            f"<li data-category='{category}' data-severity='{severity}'>"
            f"<span class='category'>{category}</span> "
            f"<span class='severity {severity}'>{severity}</span> <b>{finding}</b>"
            f"<div class='muted'>{location}</div>"
            f"<div><b>Evidence:</b> {evidence}</div>"
            f"<div class='fix'><b>Recommended fix:</b> {recommendation}</div></li>"
        )
    chips = "".join(
        f"<span class='sevchip {s}'>{sev_counts[s]} {s}</span>"
        for s in ("high", "medium", "low") if sev_counts.get(s)
    )
    if chips:
        parts.insert(0, f"<div class='sevchips'>{chips}</div>")
    wins = summary.get("quick_wins") or []
    if wins:
        parts.append("<h3>Quick wins</h3><ul>" + "".join(f"<li>{esc(w)}</li>" for w in wins) + "</ul>")
    conf = summary.get("evidence_confidence")
    if conf:
        parts.append(f"<p class='muted'>Confidence: {esc(conf)}</p>")
    if not parts:
        return "<p class='muted'>No consolidated recommendations yet.</p>"
    return "\n".join(parts)


def _render_report_html(report: dict, source_name: str) -> bytes:
    """Render a useful standalone HTML view for JSON-only/partial reports."""
    esc = lambda value: html.escape(str(value or ""))
    status = esc(report.get("status", "complete"))
    model = esc(report.get("model", "—"))
    timestamp = esc(report.get("timestamp", "—"))
    screenshots = report.get("screenshots") or {}
    ux = report.get("ux_recommendations") or {}
    per_shot = ux.get("per_screenshot") or {}
    cards = []
    for key, raw in per_shot.items():
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, json.JSONDecodeError):
            data = None
        shot = screenshots.get(key) or {}
        if not isinstance(data, dict):
            body = f"<pre>{esc(raw)}</pre>"
        else:
            issues = []
            for fi, issue in enumerate(data.get("issues") or [], 1):
                category = esc(str(issue.get("category", "uncategorized")).replace("_", " "))
                severity = esc(issue.get("severity", "low"))
                finding = esc(issue.get("finding"))
                location = esc(issue.get("location"))
                evidence = esc(issue.get("evidence"))
                recommendation = esc(issue.get("recommendation"))
                issues.append(
                    f"<li id='f{fi}' data-category='{category}' data-severity='{severity}'>"
                    f"<span class='category'>{category}</span> "
                    f"<span class='severity {severity}'>{severity}</span> <b>{finding}</b>"
                    f"<div class='muted'>{location}</div>"
                    f"<div><b>Evidence:</b> {evidence}</div>"
                    f"<div class='fix'><b>Recommended fix:</b> {recommendation}</div></li>"
                )
            body = f"<p>{esc(data.get('main_content'))}</p>"
            if issues:
                body += "<h3>Issues</h3><ul>" + "".join(issues) + "</ul>"
            wins = data.get("quick_wins") or []
            if wins:
                body += "<h3>Quick wins</h3><ul>" + "".join(f"<li>{esc(w)}</li>" for w in wins) + "</ul>"
            body += f"<p class='muted'>Confidence: {esc(data.get('evidence_confidence'))}</p>"
        cards.append(f"<section class='shot'><h2>{esc(shot.get('label', key))}</h2><p class='muted'>{esc(key)}</p>{body}</section>")
    summary = ux.get("summary")
    code = report.get("code_recommendations")
    code_text = json.dumps(code, indent=2) if isinstance(code, (dict, list)) else str(code or "Not completed")
    doc = f"""<!doctype html><html lang='en'><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width, initial-scale=1'><title>UX Analysis Report</title>
<style>body{{font:14px/1.5 system-ui,Segoe UI,sans-serif;background:#15161a;color:#e6e6e6;margin:0}}
header{{padding:24px 30px;background:#23232a;border-bottom:1px solid #3a3a42}}h1{{margin:0 0 8px;font-size:24px}}
main{{max-width:1100px;margin:auto;padding:24px}}.meta{{color:#aab4c2;margin-right:18px}}
.status{{display:inline-block;padding:3px 9px;border-radius:999px;background:#245b3a;color:#b8f0c8}}
.shot{{background:#20242a;border:1px solid #353b45;border-radius:10px;padding:20px;margin:26px 0;box-shadow:0 8px 24px #0003}}
h2{{margin:0 0 6px;color:#8ec7ff;font-size:18px}}h3{{color:#c9d5e3;margin:22px 0 8px}}li{{margin:11px 0}}
.category,.severity{{display:inline-block;padding:2px 7px;border-radius:5px;font-size:11px;text-transform:uppercase;font-weight:700;cursor:pointer}}
.category:hover,.severity:hover{{outline:2px solid #4aa3ff55;outline-offset:1px}}
.category{{background:#303946;color:#b9c8da}}.severity.high{{background:#6b2525;color:#ffd0cc}}.severity.medium{{background:#634d1d;color:#ffe5a3}}.severity.low{{background:#253d58;color:#b9dcff}}
.muted{{color:#94a0ad;font-size:12px}}.fix{{color:#a9e2b2;margin-top:4px}}pre{{white-space:pre-wrap;background:#181a1f;padding:12px;border-radius:6px;overflow:auto}}
 .summary{{background:#1c2820;border-left:4px solid #3fb950;padding:14px;margin:18px 0}}
 .sevchips{{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}}
 .sevchip{{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}}
 .sevchip.high{{background:#6b2525;color:#ffd0cc}}.sevchip.medium{{background:#634d1d;color:#ffe5a3}}.sevchip.low{{background:#253d58;color:#b9dcff}}
.toolbar{{position:sticky;top:0;z-index:5;background:#1c1d22;border:1px solid #3a3f49;border-radius:10px;padding:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:18px}}
.toolbar select,.toolbar button{{background:#30343c;color:#e6e6e6;border:1px solid #4b5360;border-radius:6px;padding:6px 9px}}
.toolbar select{{appearance:none;cursor:pointer;padding-right:28px;background-image:linear-gradient(45deg,transparent 50%,#9da8b5 50%),linear-gradient(135deg,#9da8b5 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat}}
.toolbar select:hover,.toolbar select:focus{{border-color:#4aa3ff;outline:2px solid #4aa3ff55;outline-offset:1px}}.toolbar option{{background:#30343c;color:#e6e6e6}}
.toolbar button{{cursor:pointer}}.toolbar button.active{{background:#4aa3ff;color:#08131d}}
.back{{color:#8ec7ff;text-decoration:none;font-weight:700;margin-left:auto}}.hidden{{display:none!important}}
.shot.collapsed > *:not(h2):not(.muted){{display:none}}</style></head><body>
<header><h1>UX Analysis Report</h1><span class='status'>{status}</span>
<span class='meta'>Model: {model}</span><span class='meta'>Generated: {timestamp}</span>
<span class='meta'>Source: {esc(source_name)}</span><a class='back' href='/'>← Back to dashboard</a></header><main>
<div class='toolbar'><b>Filter findings</b><select id='category-filter'><option value='all'>All categories</option><option>layout</option><option>navigation</option><option>content</option><option>interaction</option><option>accessibility</option><option>visual polish</option><option>reliability</option></select><select id='severity-filter'><option value='all'>All severities</option><option>high</option><option>medium</option><option>low</option></select><button id='collapse'>Collapse all</button><span id='visible-count' class='muted'></span></div>
 <section class='summary'><h2>Consolidated recommendations</h2>{_render_summary_block(summary)}</section>
<h2>Per-screenshot findings</h2>{''.join(cards) or '<p class="muted">No per-screenshot findings completed.</p>'}
<section class='shot'><h2>Implementation recommendations</h2><pre>{esc(code_text)}</pre></section>
</main><script>
const category = document.getElementById('category-filter');
const severity = document.getElementById('severity-filter');
const count = document.getElementById('visible-count');
const cards = [...document.querySelectorAll('.shot')];
function applyFilters() {{
  let visible = 0;
  cards.forEach(card => {{
    const issues = [...card.querySelectorAll('li[data-category]')];
    const matches = issues.filter(issue =>
      (category.value === 'all' || issue.dataset.category === category.value) &&
      (severity.value === 'all' || issue.dataset.severity === severity.value));
    issues.forEach(issue => issue.classList.toggle('hidden', !matches.includes(issue)));
    const hasIssues = issues.length === 0 || matches.length > 0;
    card.classList.toggle('hidden', !hasIssues);
    if (hasIssues) visible++;
  }});
  count.textContent = visible + ' screenshot sections visible';
}}
category.addEventListener('change', applyFilters); severity.addEventListener('change', applyFilters);
document.getElementById('collapse').addEventListener('click', event => {{
  const collapse = event.target.textContent === 'Collapse all';
  cards.forEach(card => card.classList.toggle('collapsed', collapse));
  event.target.textContent = collapse ? 'Expand all' : 'Collapse all';
}});
// Clicking a severity/category chip filters the report to that group and
// scrolls to the first matching screenshot section (jump-to-group).
document.querySelectorAll('.severity,.category').forEach(el => {{
  el.title = 'Click to filter by ' + el.textContent.trim();
  el.addEventListener('click', () => {{
    const sel = el.classList.contains('severity') ? severity : category;
    sel.value = el.textContent.trim().toLowerCase();
    applyFilters();
    const first = document.querySelector('.shot:not(.hidden)');
    if (first) first.scrollIntoView({{behavior: 'smooth', block: 'start'}});
  }});
}});
applyFilters();
</script></body></html>"""
    return doc.encode("utf-8")


def _inject_report_enhancements(html_text):
    """Add a little extra vertical rhythm and make the severity/category badges
    in the analysis report clickable to filter (jump-to-group). Applied to every
    served report (analyzer HTML, full render, or fallback)."""
    if not isinstance(html_text, str):
        html_text = html_text.decode("utf-8", "replace")
    style = (
        "<style id='kb-report-enh'>"
        "section,.shot,.qcard,.issues{margin-top:22px!important;margin-bottom:22px!important}"
        "h2,h3{margin-top:20px!important;margin-bottom:8px!important}"
        ".finding,.issue{margin:12px 0!important}"
        ".sev-badge,.cat-badge{cursor:pointer}"
        ".sev-badge:hover,.cat-badge:hover{outline:2px solid #4aa3ff55;outline-offset:1px}"
        "</style>"
    )
    script = (
        "<script id='kb-report-enh'>"
        "document.querySelectorAll('.sev-badge,.cat-badge').forEach(function(el){"
        "el.title='Click to filter by '+(el.textContent||'').trim();"
        "el.addEventListener('click',function(){"
        "var q=document.getElementById('q');"
        "if(q){q.value=(el.textContent||'').trim().toLowerCase();"
        "q.dispatchEvent(new Event('input',{bubbles:true}));"
        "var first=document.querySelector('.shot,.finding,.issue');"
        "if(first)first.scrollIntoView({behavior:'smooth',block:'start'});}"
        "});});"
        "</script>"
    )
    if "</body>" in html_text:
        return html_text.replace("</body>", style + script + "</body>", 1)
    return html_text + style + script


def _render_vision_preview(raw: str, key: str) -> str:
    """Render one shot's live ``vision_preview`` JSON into a friendly card.

    The vision stage emits a UI-inventory object (headings / buttons /
    input_fields / ...) — a *different* shape than the analysis ``issues``
    schema — so it cannot go through ``_render_findings``. Truncated previews
    (the analyzer stores them capped) are repaired best-effort via
    ``_parse_shot`` so a partial object still reads as cards, not raw JSON.
    """
    def esc(v):
        if not isinstance(v, str):
            v = json.dumps(v, ensure_ascii=False)
        return html.escape(str(v or ""))

    if not raw or not raw.strip():
        return '<p class="vp-note">No vision output for this screen yet.</p>'
    if raw.strip().startswith("ERROR"):
        return f'<p class="vp-err">{esc(raw.strip())}</p>'
    data, status = _parse_shot(raw) if _HAVE_PREVIEW_PARSE else (None, "unparseable")
    if not isinstance(data, dict):
        # Parse failed: still show the (escaped) raw text rather than a blank card.
        return f'<p class="vp-note">Live vision output (raw):</p><pre class="vp-raw">{esc(raw)}</pre>'
    parts: list[str] = []
    if status == "truncated":
        parts.append('<p class="vp-warn">⚠ Live preview is truncated — only part of the vision output is shown.</p>')
    # Lead with the keys the vision inventory usually carries, then any extras.
    order = ["headings", "buttons", "input_fields", "fields", "sliders", "checkboxes",
             "stats", "stat_cards", "lists", "tables", "empty_states", "notes", "summary"]
    keys = [k for k in order if k in data] + [k for k in data if k not in order]

    sec_idx = 0
    def section(title, inner):
        nonlocal sec_idx
        cls = "vp-section" + (" vp-tint" if sec_idx % 2 else "")
        sec_idx += 1
        return f'<div class="{cls}"><div class="vp-title">{esc(title)}</div>{inner}</div>'

    for k in keys:
        val = data[k]
        title = k.replace("_", " ").title()
        if isinstance(val, list):
            if not val:
                continue
            items = [x for x in val if str(x).strip()]
            if not items:
                continue
            if all(isinstance(x, str) for x in items):
                if k in ("headings", "buttons"):
                    chips = "".join(f'<span class="vp-chip">{esc(x)}</span>' for x in items)
                    parts.append(section(title, f'<div class="vp-chips">{chips}</div>'))
                else:
                    lis = "".join(f"<li>{esc(x)}</li>" for x in items)
                    parts.append(section(title, f'<ul class="vp-list">{lis}</ul>'))
            elif all(isinstance(x, dict) for x in items):
                blocks = []
                for item in items:
                    inner = "".join(
                        f'<div class="vp-kv"><span class="vp-k">{esc(kk)}</span>: {esc(vv)}</div>'
                        for kk, vv in item.items()
                    )
                    blocks.append(f'<div class="vp-block">{inner}</div>')
                parts.append(section(title, "".join(blocks)))
            else:
                lis = "".join(f"<li>{esc(x)}</li>" for x in items)
                parts.append(section(title, f'<ul class="vp-list">{lis}</ul>'))
        elif isinstance(val, dict):
            inner = "".join(
                f'<div class="vp-kv"><span class="vp-k">{esc(kk)}</span>: {esc(vv)}</div>'
                for kk, vv in val.items()
            )
            parts.append(section(title, inner))
        else:
            parts.append(section(title, f'<p class="vp-text">{esc(val)}</p>'))
    return "\n".join(parts) if parts else '<p class="vp-note">Vision returned an empty inventory.</p>'


def _render_analysis_preview(raw: str) -> str:
    """Render one shot's live ``analysis_preview`` JSON into a friendly card.

    Shape follows ANALYSIS_SCHEMA: app_title, visible_navigation, main_content,
    issues[] (category / severity / finding / location / evidence /
    recommendation), quick_wins, evidence_confidence. Truncated previews (the
    analyzer stores them capped) are repaired best-effort via ``_parse_shot``.
    """
    def esc(v):
        if not isinstance(v, str):
            v = json.dumps(v, ensure_ascii=False)
        return html.escape(str(v or ""))

    if not raw or not raw.strip():
        return '<p class="ap-note">No analysis output for this screen yet.</p>'
    if raw.strip().startswith("ERROR"):
        return f'<p class="ap-err">{esc(raw.strip())}</p>'
    data, status = _parse_shot(raw) if _HAVE_PREVIEW_PARSE else (None, "unparseable")
    if not isinstance(data, dict):
        return '<p class="ap-note">Analysis summary will appear in the report (preview truncated).</p>'
    parts: list[str] = []
    if status == "truncated":
        parts.append('<p class="ap-warn">⚠ Analysis preview is truncated — full findings are in the report.</p>')
    if data.get("app_title"):
        parts.append(f'<div class="ap-title">{esc(data["app_title"])}</div>')
    issues = data.get("issues") or []
    if isinstance(issues, list) and issues:
        sev_counts = {"high": 0, "medium": 0, "low": 0}
        for it in issues:
            if isinstance(it, dict) and it.get("severity") in sev_counts:
                sev_counts[it["severity"]] += 1
        if any(sev_counts.values()):
            parts.append('<div class="ap-sevbar">' + "".join(
                f'<span class="ap-sev ap-{s}">{s}: {c}</span>' for s, c in sev_counts.items() if c
            ) + '</div>')
        items = []
        for it in issues[:8]:
            if not isinstance(it, dict):
                continue
            cat = esc(it.get("category", "issue"))
            sev = it.get("severity", "")
            finding = esc(it.get("finding", ""))
            loc = esc(it.get("location", ""))
            items.append(
                f'<li class="ap-issue ap-{sev}"><span class="ap-cat">{cat}</span>'
                f'<span class="ap-sev ap-{sev}">{sev}</span>'
                f'<div class="ap-finding">{finding}</div>'
                + (f'<div class="ap-loc">at {loc}</div>' if loc else "")
                + '</li>'
            )
        if items:
            more = len(issues) - len(items)
            parts.append('<ul class="ap-list">' + "".join(items)
                         + (f'<li class="ap-note">+{more} more…</li>' if more > 0 else "") + '</ul>')
    elif data.get("main_content"):
        parts.append(f'<p class="ap-text">{esc(data["main_content"][:240])}</p>')
    return "\n".join(parts) if parts else '<p class="ap-note">Analysis returned no issues.</p>'


def _safe_path(root_base: Path, raw: str) -> Path | None:
    """Resolve and ensure the path stays inside root_base (macro_logs)."""
    try:
        p = Path(raw)
        p = (root_base / p) if not p.is_absolute() else p
        p = p.resolve()
        p.relative_to(root_base)
    except (OSError, ValueError):
        return None
    return p


def _read_log_bytes(path: Path) -> bytes:
    """Read a log file that may be actively held open by a child process.

    On Windows the subprocess keeps the log file open for writing, so a
    concurrent read can transiently raise PermissionError (sharing violation).
    Retry briefly to tolerate that instead of 500-ing the endpoint.
    """
    for _ in range(6):
        try:
            return path.read_bytes()
        except OSError:
            time.sleep(0.05)
    # Last attempt: surface a clear message rather than an opaque 500.
    try:
        return path.read_bytes()
    except OSError as e:
        return ("Log temporarily unavailable: " + str(e)).encode("utf-8", "replace")


def _discover_capture_sets(root_base: Path, direct_only: bool = False) -> list[dict]:
    """Enumerate capture-set directories under ``root_base``.

    A capture set is any top-level subdirectory (excluding names that start
    with ``_``) that contains at least one image file. ``direct_only=True``
    restricts the count to images sitting directly inside the set — used by
    the run picker, which points the analyzer at a directory of PNGs. The
    default scans anywhere beneath the set, so capture sets whose images
    live in a ``screenshots/`` subfolder (e.g. ``20260817_213432``) are still
    browsable in the gallery.

    This single source of truth keeps the dashboard run-set picker and the
    gallery root picker consistent (previously they enumerated different
    directory shapes, so a set browsable in one was invisible in the other).
    """
    roots: list[dict] = []
    for d in sorted(root_base.iterdir()):
        if not d.is_dir() or d.name.startswith("_"):
            continue
        try:
            if direct_only:
                entries = [f for f in d.iterdir() if f.is_file()]
                imgs = [f for f in entries if f.suffix.lower() in IMAGE_EXTS]
            else:
                imgs = [f for f in d.rglob("*")
                        if f.is_file() and f.suffix.lower() in IMAGE_EXTS]
        except OSError:
            continue
        if not imgs:
            continue
        rel = d.relative_to(root_base).as_posix()
        roots.append({
            "rel": rel, "label": rel, "count": len(imgs),
            "mtime": d.stat().st_mtime,
        })
    roots.sort(key=lambda r: r["mtime"], reverse=True)
    return roots


def _discover_roots(root_base: Path) -> list[dict]:
    roots = _discover_capture_sets(root_base, direct_only=False)
    total = sum(1 for f in root_base.rglob("*")
                if f.is_file() and f.suffix.lower() in IMAGE_EXTS)
    roots.append({"rel": "__all__", "label": "<entire macro_logs>", "count": total, "mtime": 0})
    return roots


def _scan_gallery(root_base: Path, root_rel: str) -> dict | None:
    base = root_base if root_rel == "__all__" else _safe_path(root_base, root_rel)
    if base is None or not base.is_dir():
        return None
    files = [f for f in base.rglob("*") if f.is_file() and f.suffix.lower() in IMAGE_EXTS]
    images: list[dict] = []
    groups: dict[str, list[str]] = {}
    for f in files:
        try:
            data = f.read_bytes()
        except OSError:
            continue
        h = hashlib.sha256(data).hexdigest()
        try:
            if _HAVE_PIL:
                with Image.open(io.BytesIO(data)) as im:
                    w, hgt = im.size
            else:
                w = hgt = None
        except Exception:
            w = hgt = None
        rel = f.relative_to(root_base).as_posix()
        groups.setdefault(h, []).append(rel)
        images.append({"rel": rel, "path": str(f.resolve()), "size": f.stat().st_size,
                       "w": w, "h": hgt, "mtime": f.stat().st_mtime, "hash": h})
    for h, rels in groups.items():
        if len(rels) > 1:
            keeper = sorted(rels, key=lambda r: (0 if "screenshots_unique" in r else 1, len(r), r))[0]
            for im in images:
                if im["hash"] == h:
                    im["dup_group"] = h[:10]
                    im["keeper"] = (im["rel"] == keeper)
                    im["is_dup"] = (im["rel"] != keeper)
    dup_images = [im for im in images if im.get("is_dup")]
    summary = {"total": len(images), "unique": len(groups),
               "dup_count": len(dup_images), "reclaimable": sum(im["size"] for im in dup_images)}
    images.sort(key=lambda im: im["rel"])
    return {"summary": summary, "images": images, "root": root_rel}


def _delete_one(root_base: Path, raw: str) -> dict:
    p = _safe_path(root_base, raw)
    if p is None:
        return {"ok": False, "error": "path outside allowed root"}
    if not p.is_file():
        return {"ok": False, "error": "not a file"}
    if p.suffix.lower() not in IMAGE_EXTS:
        return {"ok": False, "error": "not an image file"}
    try:
        size = p.stat().st_size
        p.unlink()
    except OSError as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "freed": size, "path": str(p)}


def _analysis_sets(root_base: Path) -> dict:
    """List capture directories under root_base that hold screenshots directly.

    Reuses ``_discover_capture_sets(direct_only=True)`` so the run picker and
    the gallery agree on which directories are valid capture sets, and empty
    buckets (e.g. a stale ``screenshots_*`` prefix dir with no PNGs) are
    excluded instead of offering a run that would find nothing.
    """
    sets = [r["rel"] for r in _discover_capture_sets(root_base, direct_only=True)]
    return {"sets": sets}


def _run_analysis(root_base: Path, model: str | None = None, set_name: str | None = None) -> dict:
    """Launch analyze_ux_screenshots.py as a subprocess (dashboard "Run" button).

    Returns a status dict. Refuses to start a second concurrent run.
    """
    global _RUN_STATE
    with _RUN_LOCK:
        if _RUN_STATE is not None and _RUN_STATE["proc"].poll() is None:
            return {"ok": False, "status": "already_running", "pid": _RUN_STATE["proc"].pid}

    script = HERE / "analyze_ux_screenshots.py"
    if not script.exists():
        return {"ok": False, "error": f"analyzer script not found: {script}"}
    repo_root = HERE.parent.parent

    cmd = [sys.executable, str(script), "--shots-root", str(root_base)]
    if set_name:
        target = _safe_path(root_base, set_name)
        if target is None or not target.is_dir():
            return {"ok": False, "error": f"unknown screenshot set: {set_name}"}
        cmd += ["--shots-dir", str(target)]

    env = dict(os.environ)
    if model:
        env["VISION_MODEL"] = model

    # Drop any stale progress so the dashboard flips to idle → running cleanly.
    stale = root_base / "analysis_progress.json"
    try:
        if stale.exists():
            stale.unlink()
    except OSError:
        pass

    log_path = root_base / "analyze_run.log"
    try:
        log_f = open(log_path, "w", encoding="utf-8")
    except OSError as exc:
        return {"ok": False, "error": f"cannot open run log: {exc}"}
    try:
        proc = subprocess.Popen(
            cmd, stdout=log_f, stderr=subprocess.STDOUT,
            cwd=str(repo_root), env=env, text=True,
        )
    except Exception as exc:  # pragma: no cover - environment failure
        log_f.close()
        return {"ok": False, "error": str(exc)}
    with _RUN_LOCK:
        # Re-check after the potentially slow setup above. Two simultaneous
        # requests must never leave orphaned analysis processes behind.
        if _RUN_STATE is not None and _RUN_STATE["proc"].poll() is None:
            proc.terminate()
            log_f.close()
            return {"ok": False, "status": "already_running", "pid": _RUN_STATE["proc"].pid}
        _RUN_STATE = {
            "proc": proc, "log_f": log_f, "log": log_path, "cmd": cmd,
            "model": model, "set": set_name, "started": datetime.now(timezone.utc).isoformat(),
        }
    # Persist the PID so the Stop button remains recoverable if the dashboard
    # server is reloaded while the analyzer itself is still running.
    try:
        progress = _read_json(root_base / "analysis_progress.json") or {}
        progress["run_pid"] = proc.pid
        (root_base / "analysis_progress.json").write_text(
            json.dumps(progress, indent=2), encoding="utf-8"
        )
    except OSError:
        pass
    return {"ok": True, "pid": proc.pid, "log": str(log_path)}


def _run_status(root_base: Path) -> dict:
    """Return the current/finished run state plus a tail of the run log."""
    global _RUN_STATE
    if _RUN_STATE is None:
        return {"running": False, "finished": False}
    proc = _RUN_STATE["proc"]
    tail = ""
    log = _RUN_STATE.get("log")
    if log and Path(log).exists():
        try:
            lines = Path(log).read_text(encoding="utf-8", errors="replace").splitlines()
            tail = "\n".join(lines[-20:])
        except OSError:
            tail = ""
    poll = proc.poll()
    if poll is None:
        return {"running": True, "finished": False, "pid": proc.pid,
                "started": _RUN_STATE["started"], "tail": tail}
    # Finished: release the log handle once.
    if _RUN_STATE.get("log_f") and not _RUN_STATE.get("_closed"):
        try:
            _RUN_STATE["log_f"].close()
        except Exception:
            pass
        _RUN_STATE["_closed"] = True
    return {"running": False, "finished": True, "pid": proc.pid,
            "exit_code": poll, "started": _RUN_STATE["started"], "tail": tail}


def _stop_analysis(root_base: Path) -> dict:
    """Stop the active analyzer and its child processes, if any."""
    global _RUN_STATE
    with _RUN_LOCK:
        proc = _RUN_STATE["proc"] if _RUN_STATE is not None else None
        if proc is None or proc.poll() is not None:
            progress = _read_json(root_base / "analysis_progress.json") or {}
            pid = progress.get("run_pid")
            if not pid or progress.get("status") != "running":
                return {"ok": False, "status": "not_running"}
            proc_pid = int(pid)
        else:
            proc_pid = proc.pid
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(proc_pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                if proc is not None:
                    proc.terminate()
            if _RUN_STATE is not None and proc is not None:
                proc.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "error": f"could not stop process: {exc}"}
        if _RUN_STATE is not None and _RUN_STATE.get("log_f") and not _RUN_STATE.get("_closed"):
            try:
                _RUN_STATE["log_f"].close()
            except OSError:
                pass
            _RUN_STATE["_closed"] = True

    progress_path = root_base / "analysis_progress.json"
    progress = _read_json(progress_path) or {}
    progress.update({
        "status": "stopped",
        "phase": "done",
        "message": "Analysis stopped by user",
        "stopped_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        progress_path.write_text(json.dumps(progress, indent=2), encoding="utf-8")
    except OSError:
        pass
    return {"ok": True, "status": "stopped", "pid": proc_pid}


def _run_improvement_loop(root_base: Path, model: str | None = None, max_iterations: int | None = None,
                          category: str | None = None, dry_run: bool = False) -> dict:
    """Launch scripts/improvement_loop.py as a subprocess (dashboard "Run Loop" button).

    Returns a status dict and refuses to start a second concurrent loop.
    """
    global _LOOP_STATE
    with _LOOP_LOCK:
        if _LOOP_STATE is not None and _LOOP_STATE["proc"].poll() is None:
            return {"ok": False, "status": "already_running", "pid": _LOOP_STATE["proc"].pid}
    script = LOOP_SCRIPT
    if not script.exists():
        return {"ok": False, "error": f"improvement loop script not found: {script}"}
    repo_root = HERE.parent.parent
    cmd = [sys.executable, str(script)]
    if model:
        cmd += ["--model", model]
    if max_iterations:
        cmd += ["--max-iterations", str(max_iterations)]
    if category:
        cmd += ["--category", category]
    if dry_run:
        cmd += ["--dry-run"]
    log_path = root_base / "loop_run.log"
    try:
        log_f = open(log_path, "w", encoding="utf-8")
    except OSError as exc:
        return {"ok": False, "error": f"cannot open loop log: {exc}"}
    try:
        proc = subprocess.Popen(
            cmd, stdout=log_f, stderr=subprocess.STDOUT,
            cwd=str(repo_root), text=True,
        )
    except Exception as exc:  # pragma: no cover - environment failure
        log_f.close()
        return {"ok": False, "error": str(exc)}
    with _LOOP_LOCK:
        if _LOOP_STATE is not None and _LOOP_STATE["proc"].poll() is None:
            proc.terminate()
            log_f.close()
            return {"ok": False, "status": "already_running", "pid": _LOOP_STATE["proc"].pid}
        _LOOP_STATE = {
            "proc": proc, "log_f": log_f, "log": log_path, "cmd": cmd,
            "model": model, "max_iterations": max_iterations,
            "category": category, "dry_run": dry_run,
            "started": datetime.now(timezone.utc).isoformat(),
        }
    return {"ok": True, "pid": proc.pid, "log": str(log_path)}


def _loop_status(root_base: Path) -> dict:
    """Return the current/finished loop state plus a tail of the loop log."""
    if _LOOP_STATE is None:
        return {"running": False, "finished": False}
    proc = _LOOP_STATE["proc"]
    tail = ""
    log = _LOOP_STATE.get("log")
    if log and Path(log).exists():
        try:
            lines = Path(log).read_text(encoding="utf-8", errors="replace").splitlines()
            tail = "\n".join(lines[-20:])
        except OSError:
            tail = ""
    poll = proc.poll()
    base = {"started": _LOOP_STATE["started"], "tail": tail}
    if poll is None:
        base.update({"running": True, "finished": False, "pid": proc.pid})
    else:
        if _LOOP_STATE.get("log_f") and not _LOOP_STATE.get("_closed"):
            try:
                _LOOP_STATE["log_f"].close()
            except Exception:
                pass
            _LOOP_STATE["_closed"] = True
        base.update({"running": False, "finished": True, "pid": proc.pid, "exit_code": poll})
    return base


def _read_loop_state_file() -> dict:
    """Read the loop's persisted state (docs/.loop_state.json) for the dashboard."""
    try:
        return _read_json(LOOP_STATE_FILE) or {}
    except Exception:
        return {}


def _stop_improvement_loop(root_base: Path) -> dict:
    """Stop the active improvement loop and its child processes, if any."""
    global _LOOP_STATE
    with _LOOP_LOCK:
        proc = _LOOP_STATE["proc"] if _LOOP_STATE is not None else None
        if proc is None or proc.poll() is not None:
            return {"ok": False, "status": "not_running"}
        proc_pid = proc.pid
        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(proc_pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                proc.terminate()
            proc.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "error": f"could not stop process: {exc}"}
        if _LOOP_STATE.get("log_f") and not _LOOP_STATE.get("_closed"):
            try:
                _LOOP_STATE["log_f"].close()
            except OSError:
                pass
            _LOOP_STATE["_closed"] = True
    return {"ok": True, "status": "stopped", "pid": proc_pid}


# ---------------------------------------------------------------------------
# Shared navigation shell
#
# The dashboard (live_progress.html) carries its own header nav. The sub-pages
# (/gallery, /reports, /report) used to render separately with no shared
# navigation, no active-page indication, and no breadcrumbs — so once a user
# opened the gallery or a report there was no obvious way back. _inject_shared_nav
# wraps any served HTML document with the same header nav (consistent links +
# active state) plus a breadcrumb trail, giving every page one navigation system.
# ---------------------------------------------------------------------------

_SHARED_NAV_CSS = """
<style id="snav-style">
:root{--bg:#0f1419;--panel:#161c23;--panel2:#1d2630;--line:#2a3542;--txt:#e6edf3;--muted:#8b98a5;--accent:#4aa3ff;--ok:#3fb950;--warn:#d29922;--err:#f85149;--busy:#a371f7;}
*{box-sizing:border-box;}
header.snav{position:sticky;top:0;z-index:30;background:linear-gradient(180deg,rgba(22,28,35,.97),rgba(29,38,48,.97));backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:10px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.snav .brand{display:flex;align-items:center;gap:12px;min-width:0;}
.snav .brand-mark{width:30px;height:30px;border-radius:9px;flex:none;background:linear-gradient(135deg,var(--accent),var(--busy));box-shadow:0 0 0 1px rgba(74,163,255,.4),0 4px 12px rgba(74,163,255,.25);}
.snav h1{font-size:15px;margin:0;font-weight:700;letter-spacing:.2px;white-space:nowrap;}
.snav .brand-sub{color:var(--muted);font-weight:500;}
.snav .nav{display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap;}
.snav .nav-sep{width:1px;height:22px;background:var(--line);}
.nav-link{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;line-height:1;font-size:13px;font-weight:600;text-decoration:none;border-radius:999px;border:1px solid var(--accent);background:rgba(74,163,255,.12);color:var(--accent);white-space:nowrap;cursor:pointer;appearance:none;-webkit-appearance:none;transition:background .15s ease,transform .12s ease,box-shadow .15s ease;font-family:inherit;}
.nav-link:hover{background:rgba(74,163,255,.22);transform:translateY(-1px);box-shadow:0 2px 8px rgba(74,163,255,.18);}
.nav-link.active{background:rgba(74,163,255,.30);border-color:#fff;color:#fff;}
.breadcrumb{display:flex;gap:8px;align-items:center;padding:8px 20px;background:var(--panel2);border-bottom:1px solid var(--line);font-size:12px;color:var(--muted);}
.breadcrumb a{color:var(--accent);text-decoration:none;}
.breadcrumb a:hover{text-decoration:underline;}
.breadcrumb .sep{opacity:.6;}
</style>
"""


def _render_shared_nav(active):
    def cls(key):
        return " nav-link active" if active == key else " nav-link"

    return (
        '<header class="snav">'
        '<div class="brand"><span class="brand-mark"></span>'
        '<h1>UX Analysis <span class="brand-sub">— Live Progress</span></h1></div>'
        '<nav class="nav">'
        '<a class="' + cls("dashboard").strip() + '" href="/">Dashboard</a>'
        '<span class="nav-sep"></span>'
        '<a class="' + cls("gallery").strip() + '" href="/gallery">Screenshot Gallery</a>'
        '<a class="' + cls("reports").strip() + '" href="/reports">Reports</a>'
        '<a class="' + cls("report").strip() + '" href="/report">View Report</a>'
        '<a class="nav-link" href="/#issue-tracker">Issue Tracker</a>'
        '<button class="nav-link" id="launch-gui" type="button" title="Open the latest built Space Analyzer GUI">Launch GUI</button>'
        '<button class="nav-link refresh-link" id="refresh-sub" type="button" title="Reload this page">Refresh</button>'
        '</nav></header>'
    )


def _render_breadcrumb(crumbs):
    if not crumbs:
        return ""
    parts = []
    for i, (href, label) in enumerate(crumbs):
        if i:
            parts.append('<span class="sep">›</span>')
        if href:
            parts.append('<a href="' + html.escape(href) + '">' + html.escape(label) + '</a>')
        else:
            parts.append('<span>' + html.escape(label) + '</span>')
    return '<nav class="breadcrumb">' + ''.join(parts) + '</nav>'


def _inject_shared_nav(doc, active, crumbs=None, push_toolbar=False):
    if isinstance(doc, (bytes, bytearray)):
        doc = doc.decode("utf-8", "replace")
    nav = _render_shared_nav(active)
    crumb = _render_breadcrumb(crumbs)
    head = _SHARED_NAV_CSS
    if push_toolbar:
        # Gallery has its own sticky toolbar; push it below the global nav.
        head = head.replace("</style>", ".toolbar{top:52px!important;}\n</style>", 1)
    if "</head>" in doc:
        doc = doc.replace("</head>", head + "</head>", 1)
    else:
        doc = head + doc
    bi = doc.find("<body")
    if bi != -1:
        be = doc.find(">", bi)
        if be != -1:
            doc = doc[:be + 1] + nav + crumb + doc[be + 1:]
    else:
        doc = nav + crumb + doc
    script = (
        '<script>(function(){'
        "var b=document.getElementById('launch-gui');"
        "if(b){b.addEventListener('click',function(){var t=b.textContent;b.disabled=true;b.textContent='Launching…';"
        "fetch('/api/launch-gui',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})"
        ".then(function(r){return r.json();}).then(function(d){if(!d.ok)alert('Could not launch GUI: '+(d.message||'unknown error'));})"
        ".catch(function(e){alert('Launch failed: '+e.message);}).finally(function(){b.disabled=false;b.textContent=t;});});}"
        "var r=document.getElementById('refresh-sub');if(r){r.addEventListener('click',function(){location.reload();});}"
        "})();</script>"
    )
    if "</body>" in doc:
        doc = doc.replace("</body>", script + "</body>", 1)
    else:
        doc = doc + script
    return doc


def _render_reports_list_page(rows: list[dict]) -> str:
    """Render a browsable list of stored reports for easy retrieval.

    The page is built server-side for the initial load and re-queries the
    database via ``/api/reports?q=`` as the user types.  Each row links to the
    stored report at ``/report?id=<report_key>``.
    """
    esc = lambda v: html.escape(str(v if v is not None else ""))
    if not rows:
        body = '<div class="empty">No reports stored yet. Run an analysis to populate the database.</div>'
    else:
        cards = []
        for r in rows:
            sev = r.get("severity_counts") or {}
            high = sev.get("high", 0)
            med = sev.get("medium", 0)
            low = sev.get("low", 0)
            key = esc(r.get("report_key", ""))
            cards.append(
                "<tr>"
                '<td class="set">' + esc(r.get("screenshot_set", "")) + "</td>"
                "<td>" + esc(r.get("model", "")) + "</td>"
                '<td><span class="badge st-' + esc(r.get("status", "")) + '">' + esc(r.get("status", "")) + "</span></td>"
                '<td class="ts">' + esc(r.get("timestamp", "") or r.get("created_at", "")) + "</td>"
                '<td class="sev"><span class="sev-h">' + str(high) + '</span>'
                '<span class="sev-m">' + str(med) + '</span>'
                '<span class="sev-l">' + str(low) + "</span></td>"
                '<td class="num">' + str(r.get("num_issues", 0) or 0) + "</td>"
                '<td class="num">' + str(r.get("num_recommendations", 0) or 0) + "</td>"
                '<td><a class="view" href="/report?id=' + key + '">View &rarr;</a></td>'
                "</tr>"
            )
        body = (
            '<table class="reports"><thead><tr>'
            "<th>Screenshot set</th><th>Model</th><th>Status</th>"
            "<th>Timestamp (UTC)</th><th>Severity (H/M/L)</th><th>Issues</th>"
            "<th>Recs</th><th></th></tr></thead><tbody>"
            + "".join(cards)
            + "</tbody></table>"
        )
    return REPORTS_PAGE_TEMPLATE.replace("{BODY}", body)


REPORTS_PAGE_TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UX Analysis Reports</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, "Segoe UI", sans-serif; color:#e7ecf3;
    background: radial-gradient(1200px 600px at 80% -10%, #1b2a4a 0%, #0c111b 55%) fixed, #0c111b; min-height:100vh; }
  header { padding: 22px 28px; border-bottom:1px solid rgba(255,255,255,.08);
    background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0));
    backdrop-filter: blur(6px); display:flex; align-items:center; gap:14px; }
  .brand { width:34px;height:34px;border-radius:9px;
    background:linear-gradient(135deg,#4f8cff,#9b5cff); box-shadow:0 6px 18px rgba(79,140,255,.35); }
  h1 { font-size:18px; margin:0; letter-spacing:.2px; }
  .sub { color:#9fb0c7; font-size:12.5px; margin-top:2px; }
  .wrap { padding:22px 28px 40px; max-width:1100px; margin:0 auto; }
  .bar { display:flex; gap:10px; align-items:center; margin-bottom:16px; }
  .bar input { flex:1; padding:9px 12px; border-radius:9px; border:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.05); color:#e7ecf3; font-size:13px; }
  table.reports { width:100%; border-collapse:collapse; background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.08); border-radius:12px; overflow:hidden; }
  .reports th, .reports td { text-align:left; padding:11px 14px; font-size:13px; border-bottom:1px solid rgba(255,255,255,.06); }
  .reports th { color:#9fb0c7; font-weight:600; background:rgba(255,255,255,.03); }
  .reports tr:last-child td { border-bottom:none; }
  .set { font-weight:600; }
  .ts { color:#9fb0c7; font-variant-numeric:tabular-nums; }
  .sev span { display:inline-block; min-width:22px; text-align:center; padding:2px 6px; border-radius:6px; margin-right:4px; font-weight:700; }
  .sev-h { background:rgba(255,86,86,.18); color:#ff8a8a; }
  .sev-m { background:rgba(255,184,76,.18); color:#ffcf85; }
  .sev-l { background:rgba(120,200,140,.18); color:#8fe0a4; }
  .num { font-variant-numeric:tabular-nums; }
  .badge { padding:2px 9px; border-radius:999px; font-size:11.5px; font-weight:700; text-transform:capitalize; }
  .st-complete { background:rgba(120,200,140,.18); color:#8fe0a4; }
  .st-running { background:rgba(79,140,255,.18); color:#9bbcff; }
  .st-error { background:rgba(255,86,86,.18); color:#ff8a8a; }
  a.view { color:#9bbcff; text-decoration:none; font-weight:600; }
  a.view:hover { text-decoration:underline; }
  .empty { color:#9fb0c7; padding:24px; text-align:center; }
  .navlink { color:#9bbcff; text-decoration:none; font-size:13px; }
</style></head>
<body>
<header>
  <div class="brand"></div>
  <div>
    <h1>UX Analysis Reports</h1>
    <div class="sub">Stored in SQLite &mdash; queryable by model, screenshot set, and severity. <a class="navlink" href="/">&larr; Dashboard</a></div>
  </div>
</header>
<div class="wrap">
  <div class="bar">
    <input id="q" placeholder="Search reports (set, model, findings)…" oninput="search(this.value)">
  </div>
  <div id="list">{BODY}</div>
</div>
<script>
async function search(q) {
  const url = "/api/reports" + (q ? "?q=" + encodeURIComponent(q) : "");
  try {
    const r = await fetch(url); const j = await r.json();
    document.getElementById("list").innerHTML = render(j.reports || []);
  } catch(e) { document.getElementById("list").textContent = "search failed"; }
}
function esc(s) { return String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }
function render(rows) {
  if (!rows.length) return '<div class="empty">No reports match.</div>';
  let h = '<table class="reports"><thead><tr><th>Screenshot set</th><th>Model</th><th>Status</th><th>Timestamp (UTC)</th><th>Severity (H/M/L)</th><th>Issues</th><th>Recs</th><th></th></tr></thead><tbody>';
  for (const r of rows) {
    const s = r.severity_counts || {};
    h += '<tr><td class="set">'+esc(r.screenshot_set)+'</td><td>'+esc(r.model)+'</td>'
       + '<td><span class="badge st-'+esc(r.status)+'">'+esc(r.status)+'</span></td>'
       + '<td class="ts">'+esc(r.timestamp||r.created_at)+'</td>'
       + '<td class="sev"><span class="sev-h">'+ (s.high||0) +'</span><span class="sev-m">'+ (s.medium||0) +'</span><span class="sev-l">'+ (s.low||0) +'</span></td>'
       + '<td class="num">'+ (r.num_issues||0) +'</td><td class="num">'+ (r.num_recommendations||0) +'</td>'
       + '<td><a class="view" href="/report?id='+encodeURIComponent(r.report_key)+'">View &rarr;</a></td></tr>';
  }
  return h + '</tbody></table>';
}
</script>
</body></html>"""


def build_handler(root_base: Path):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            if not getattr(self, "_head_mode", False):
                self.wfile.write(body)

        def do_HEAD(self) -> None:  # noqa: N802
            # RFC 7231: HEAD MUST return the same headers as GET but no body.
            # Route through the GET handler so Content-Type/Content-Length match
            # the real response, then suppress the body via the _head_mode flag.
            self._head_mode = True
            try:
                self.do_GET()
            finally:
                self._head_mode = False

        def _json(self, payload: dict, code: int = 200) -> None:
            self._send(code, json.dumps(payload).encode("utf-8"), "application/json")

        def _send_img(self, raw: str, thumb: bool) -> None:
            p = _safe_path(root_base, raw)
            if p is None or not p.is_file():
                self._send(404, b"not found", "text/plain")
                return
            ext = p.suffix.lower()
            ctype = CTYPE.get(ext, "application/octet-stream")
            try:
                data = p.read_bytes()
            except OSError:
                self._send(404, b"not found", "text/plain")
                return
            if thumb and _HAVE_PIL:
                try:
                    im = Image.open(io.BytesIO(data))
                    im.thumbnail((480, 480))
                    buf = io.BytesIO()
                    im.save(buf, format="PNG")
                    data, ctype = buf.getvalue(), "image/png"
                except Exception:
                    pass
            self._send(200, data, ctype)

        def do_GET(self):  # noqa: N802
            route = self.path.split("?", 1)[0]
            if route == "/favicon.ico":
                # Avoid a noisy 404 in browsers; this utility intentionally
                # has no bundled icon.
                self._send(204, b"", "image/x-icon")
                return
            if route in ("/", "/index.html"):
                if not HTML_PATH.exists():
                    self._send(404, b"live_progress.html not found", "text/plain")
                    return
                self._send(200, HTML_PATH.read_bytes(), "text/html; charset=utf-8")
                return
            if route == "/gallery":
                if not GALLERY_HTML_PATH.exists():
                    self._send(404, b"screenshot_gallery.html not found", "text/plain")
                    return
                wrapped = _inject_shared_nav(
                    GALLERY_HTML_PATH.read_bytes(), "gallery",
                    crumbs=[("/", "Dashboard"), (None, "Screenshot Gallery")],
                    push_toolbar=True,
                )
                self._send(200, wrapped.encode("utf-8"), "text/html; charset=utf-8")
                return
            if route == "/theme.css":
                if not THEME_CSS_PATH.exists():
                    self._send(404, b"theme.css not found", "text/plain")
                    return
                self._send(200, THEME_CSS_PATH.read_bytes(), "text/css; charset=utf-8")
                return
            if route == "/api/progress":
                progress = _read_json(root_base / "analysis_progress.json")
                if progress is None:
                    self._json({"status": "idle", "message": "No analysis running", "shots": {}})
                else:
                    self._json(progress)
                return
            if route == "/api/run-status":
                self._json(_run_status(root_base))
                return
            if route == "/api/stop":
                self._json({"status": "use POST to stop an analysis"}, code=405)
                return
            if route == "/api/analysis-sets":
                self._json(_analysis_sets(root_base))
                return
            if route == "/api/loop-status":
                st = _loop_status(root_base)
                st["state"] = _read_loop_state_file()
                if _LOOP_STATE is not None:
                    st["config"] = {
                        "model": _LOOP_STATE.get("model"),
                        "category": _LOOP_STATE.get("category"),
                        "dry_run": _LOOP_STATE.get("dry_run", False),
                        "max_iterations": _LOOP_STATE.get("max_iterations"),
                    }
                self._json(st)
                return
            if route == "/api/gui":
                exe = _latest_gui_exe()
                self._json({
                    "available": bool(exe and exe.is_file()),
                    "path": str(exe) if exe else None,
                    "mtime": exe.stat().st_mtime if exe and exe.is_file() else None,
                })
                return
            if route == "/api/issues":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                status = (q.get("status") or [None])[0]
                category = (q.get("category") or [None])[0]
                search = (q.get("q") or [None])[0]
                severity = (q.get("severity") or [None])[0]
                try:
                    limit = int((q.get("limit") or ["300"])[0])
                except ValueError:
                    limit = 300
                self._json(_build_issues_payload(
                    status=status, category=category, q=search,
                    severity=severity, limit=limit))
                return
            if route == "/api/run-log":
                log = root_base / "analyze_run.log"
                if not log.exists():
                    self._send(404, b"No run log yet", "text/plain")
                    return
                self._send(200, _read_log_bytes(log), "text/plain; charset=utf-8")
                return
            if route == "/api/loop-log":
                log = root_base / "loop_run.log"
                if not log.exists():
                    self._send(404, b"No loop log yet", "text/plain")
                    return
                self._send(200, _read_log_bytes(log), "text/plain; charset=utf-8")
                return
            if route == "/api/shot":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                key = (q.get("key") or [""])[0]
                if key:
                    matches = sorted(root_base.rglob(key + ".png"), key=lambda p: p.stat().st_mtime, reverse=True)
                    if matches:
                        self._send_img(str(matches[0]), thumb=False)
                        return
                self._send(404, b"not found", "text/plain")
                return
            if route == "/api/shot-preview":
                # Friendly, rendered view of one shot's live vision_preview JSON.
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                key = (q.get("key") or [""])[0]
                progress = _read_json(root_base / "analysis_progress.json") or {}
                shots = progress.get("shots") or {}
                shot = shots.get(key) or {}
                raw = shot.get("vision_preview") or ""
                self._send(200, _render_vision_preview(raw, key).encode("utf-8"),
                           "text/html; charset=utf-8")
                return
            if route == "/api/shot-previews":
                # Batch-friendly render of every shot's vision + analysis previews,
                # so the dashboard's screenshot list can show cards without one
                # fetch per shot. Returns {key: {vision_html, analysis_html, status}}.
                progress = _read_json(root_base / "analysis_progress.json") or {}
                shots = progress.get("shots") or {}
                out = {}
                for key, shot in shots.items():
                    if not isinstance(shot, dict):
                        continue
                    vp = shot.get("vision_preview") or ""
                    ap = shot.get("analysis_preview") or ""
                    out[key] = {
                        "vision_html": _render_vision_preview(vp, key) if vp else "",
                        "analysis_html": _render_analysis_preview(ap) if ap else "",
                        "status": shot.get("status", ""),
                    }
                self._json(out)
                return
            if route == "/api/reports":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                try:
                    limit = int((q.get("limit") or ["50"])[0])
                except ValueError:
                    limit = 50
                model = (q.get("model") or [None])[0]
                set_name = (q.get("set") or [None])[0]
                search_q = (q.get("q") or [None])[0]
                store = _get_store(root_base)
                if store is None:
                    self._json({"status": "error", "message": "reports database unavailable"}, code=503)
                    return
                rows = (
                    store.search(search_q, limit=limit)
                    if search_q
                    else store.list_reports(limit=limit, model=model, screenshot_set=set_name)
                )
                self._json({"status": "ok", "count": len(rows), "reports": rows})
                return
            if route == "/api/report":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                report_key = (q.get("id") or [None])[0]
                store = _get_store(root_base)
                if store is not None:
                    rep = store.get(report_key) if report_key else store.get_latest()
                    if rep is not None:
                        payload = rep.get("report") or {}
                        payload["_meta"] = {
                            k: rep.get(k)
                            for k in (
                                "id", "report_key", "screenshot_set", "model", "status",
                                "timestamp", "num_issues", "num_recommendations",
                                "severity_counts", "created_at",
                            )
                        }
                        self._json(payload)
                        return
                report = _latest_report(root_base)
                if report is None:
                    self._json({"status": "idle", "message": "No report yet"})
                else:
                    self._json(report)
                return
            if route == "/reports":
                store = _get_store(root_base)
                rows = store.list_reports(limit=200) if store else []
                wrapped = _inject_shared_nav(
                    _render_reports_list_page(rows), "reports",
                    crumbs=[("/", "Dashboard"), (None, "Reports")],
                )
                self._send(200, wrapped.encode("utf-8"), "text/html; charset=utf-8")
                return
            if route == "/report":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                report_key = (q.get("id") or [None])[0]
                store = _get_store(root_base)
                final_html = None
                if store is not None:
                    rep = store.get(report_key) if report_key else store.get_latest()
                    if rep is not None:
                        if rep.get("html"):
                            final_html = _inject_report_enhancements(rep["html"])
                        else:
                            report = rep.get("report") or {}
                            final_html = _inject_report_enhancements(
                                _render_full_report(report) if _HAVE_FULL_RENDER
                                else _render_report_html(report, rep.get("report_key", "report"))
                            )
                if final_html is None:
                    candidates = sorted(
                        root_base.glob("ux_analysis_*.html"),
                        key=lambda p: p.stat().st_mtime, reverse=True,
                    )
                    if candidates:
                        final_html = _inject_report_enhancements(candidates[0].read_bytes())
                if final_html is None:
                    # Older/partial runs may have written JSON without an HTML
                    # companion. Keep the report link useful by rendering a safe
                    # readable fallback instead of returning a confusing 404.
                    json_reports = sorted(
                        root_base.glob("ux_analysis_*.json"),
                        key=lambda p: p.stat().st_mtime, reverse=True,
                    )
                    if json_reports:
                        report = _read_json(json_reports[0]) or {}
                        final_html = _inject_report_enhancements(
                            _render_full_report(report) if _HAVE_FULL_RENDER
                            else _render_report_html(report, json_reports[0].name)
                        )
                if final_html is None:
                    self._send(404, b"No analysis report generated yet", "text/plain")
                    return
                wrapped = _inject_shared_nav(
                    final_html, "report",
                    crumbs=[("/", "Dashboard"), (None, "Report")],
                    push_toolbar=True,
                )
                self._send(200, wrapped.encode("utf-8"), "text/html; charset=utf-8")
                return
            if route == "/api/roots":
                self._json({"roots": _discover_roots(root_base)})
                return
            if route == "/api/gallery":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                root_rel = (q.get("root") or ["__all__"])[0]
                result = _scan_gallery(root_base, root_rel)
                if result is None:
                    self._json({"status": "error", "message": "invalid root"}, code=400)
                else:
                    self._json(result)
                return
            if route == "/api/img":
                q = parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                raw = (q.get("path") or [""])[0]
                thumb = (q.get("thumb") or ["0"])[0] == "1"
                self._send_img(raw, thumb=thumb)
                return
            self._send(404, b"not found", "text/plain")

        def do_POST(self):  # noqa: N802
            route = self.path.split("?", 1)[0]
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length > MAX_POST_BYTES:
                self._json({"status": "error", "message": "request body too large"}, code=413)
                return
            raw_body = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._json({"status": "error", "message": "invalid JSON"}, code=400)
                return
            if not isinstance(body, dict):
                self._json({"status": "error", "message": "JSON object required"}, code=400)
                return
            if route == "/api/delete":
                res = _delete_one(root_base, body.get("path", ""))
                self._json(res, code=200 if res.get("ok") else 400)
                return
            if route == "/api/run":
                res = _run_analysis(
                    root_base,
                    model=(body.get("model") or "").strip() or None,
                    set_name=(body.get("set") or "").strip() or None,
                )
                code = 200 if (res.get("ok") or res.get("status") == "already_running") else 400
                self._json(res, code=code)
                return
            if route == "/api/run-loop":
                res = _run_improvement_loop(
                    root_base,
                    model=(body.get("model") or "").strip() or None,
                    max_iterations=body.get("max_iterations") or None,
                    category=(body.get("category") or "").strip() or None,
                    dry_run=bool(body.get("dry_run")),
                )
                code = 200 if (res.get("ok") or res.get("status") == "already_running") else 400
                self._json(res, code=code)
                return
            if route == "/api/issues/update":
                issue_id = (body.get("issue_id") or "").strip()
                new_status = (body.get("status") or "").strip()
                resolution = (body.get("resolution") or "").strip()
                if not issue_id:
                    self._json({"status": "error", "message": "issue_id required"}, code=400)
                    return
                data = _read_tracker()
                found = None
                for it in data.get("issues", []):
                    if it.get("issue_id") == issue_id:
                        found = it
                        break
                if found is None:
                    self._json({"status": "error", "message": "issue not found"}, code=404)
                    return
                if new_status:
                    found["status"] = _norm_status(new_status)
                found["last_seen"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                if resolution:
                    extra = found.get("extra")
                    if not isinstance(extra, dict):
                        extra = {}
                        found["extra"] = extra
                    extra["resolution"] = resolution
                _write_tracker(data)
                self._json({"status": "ok", "issue": found})
                return
            if route == "/api/launch-gui":
                res = _launch_gui()
                self._json(res, code=200 if res.get("ok") else 409)
                return
            if route == "/api/stop":
                res = _stop_analysis(root_base)
                self._json(res, code=200 if res.get("ok") else 409)
                return
            if route == "/api/stop-loop":
                res = _stop_improvement_loop(root_base)
                self._json(res, code=200 if res.get("ok") else 409)
                return
            if route == "/api/delete-many":
                paths = body.get("paths", []) or []
                if not isinstance(paths, list):
                    self._json({"status": "error", "message": "paths must be an array"}, code=400)
                    return
                results = [_delete_one(root_base, p) for p in paths]
                freed = sum(r.get("freed", 0) for r in results if r.get("ok"))
                self._json({"ok": True, "results": results, "freed": freed, "deleted": sum(1 for r in results if r.get("ok"))})
                return
            self._json({"status": "error", "message": "unknown endpoint"}, code=404)

        def log_message(self, *args):  # silence default stderr logging
            return

    return Handler


def main() -> int:
    parser = argparse.ArgumentParser(description="Live UX analysis progress + screenshot gallery server")
    parser.add_argument("--port", type=int, default=8777)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--shots-root", default=str(DEFAULT_SHOTS_ROOT))
    args = parser.parse_args()

    root_base = Path(args.shots_root).resolve()
    root_base.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), build_handler(root_base))
    url = f"http://{args.host}:{args.port}/"
    print(f"Live progress dashboard: {url}")
    print(f"Screenshot gallery:      {url}gallery")
    print(f"  watching: {root_base / 'analysis_progress.json'}")
    print("  Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

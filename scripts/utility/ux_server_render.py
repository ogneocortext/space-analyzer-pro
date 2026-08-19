"""Pure HTML rendering helpers for the live progress / screenshot dashboard.

No subprocess state, no file writes, no global mutable state. These functions
turn data dicts into HTML strings (or bytes) so they can be unit-tested and
reused by other tools without spinning up the HTTP server.
"""
import html
import json

try:
    from analyze_ux_screenshots import _parse_shot
    _HAVE_PREVIEW_PARSE = True
except Exception:  # pragma: no cover - analyzer deps unavailable
    _HAVE_PREVIEW_PARSE = False


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

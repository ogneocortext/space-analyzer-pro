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
.toolbar select,.toolbar button{{background:#30343c;color:#e6e6e6;border:1px solid #4b5360;border-radius:6px;padding:6px 10px;min-height:38px}}
.toolbar select{{appearance:none;cursor:pointer;padding-right:28px;background-image:linear-gradient(45deg,transparent 50%,#9da8b5 50%),linear-gradient(135deg,#9da8b5 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat}}
.toolbar select:hover,.toolbar select:focus{{border-color:#4aa3ff;outline:2px solid #4aa3ff55;outline-offset:1px}}.toolbar option{{background:#30343c;color:#e6e6e6}}
.toolbar button{{cursor:pointer}}.toolbar button.active{{background:#4aa3ff;color:#08131d}}
.back{{color:#8ec7ff;text-decoration:none;font-weight:700;margin-left:auto}}.hidden{{display:none!important}}
 .summary h2{{display:flex;align-items:center;justify-content:space-between;gap:10px}}.summary h2 button{{background:#30343c;color:#e6e6e6;border:1px solid #4b5360;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;min-height:34px}}.summary.collapsed > *:not(h2){{display:none}}
 @media (max-width:720px){{.toolbar{{gap:10px}}.toolbar select,.toolbar button{{flex:1 1 100%;width:100%;min-height:44px}}.toolbar #visible-count{{flex:1 1 100%}}main{{padding:16px}}.summary{{padding:12px;margin:14px 0}}.shot{{padding:16px;margin:18px 0}}h2{{font-size:16px}}h1{{font-size:20px}}header{{padding:18px 16px}}}}
.shot.collapsed > *:not(h2):not(.muted){{display:none}}</style></head><body>
<header><h1>UX Analysis Report</h1><span class='status'>{status}</span>
<span class='meta'>Model: {model}</span><span class='meta'>Generated: {timestamp}</span>
<span class='meta'>Source: {esc(source_name)}</span><a class='back' href='/'>← Back to dashboard</a></header><main>
<div class='toolbar'><b>Filter findings</b><select id='category-filter'><option value='all'>All categories</option><option>layout</option><option>navigation</option><option>content</option><option>interaction</option><option>accessibility</option><option>visual polish</option><option>reliability</option></select><select id='severity-filter'><option value='all'>All severities</option><option>high</option><option>medium</option><option>low</option></select><button id='collapse'>Collapse all</button><span id='visible-count' class='muted'></span></div>
 <section class='summary' id='summary'><h2>Consolidated recommendations<button id='summary-toggle' type='button'>Hide</button></h2>{_render_summary_block(summary)}</section>
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
const sumToggle = document.getElementById('summary-toggle');
if (sumToggle) sumToggle.addEventListener('click', () => {{
  const s = document.getElementById('summary');
  const collapsed = s.classList.toggle('collapsed');
  sumToggle.textContent = collapsed ? 'Show' : 'Hide';
  sumToggle.setAttribute('aria-expanded', String(!collapsed));
}});
if (window.matchMedia('(max-width: 720px)').matches) document.getElementById('collapse').click();
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
        ".toolbar select,.toolbar input,.toolbar button{min-height:40px!important}"
        ".collapsible-head{display:flex!important;align-items:center!important;gap:8px!important}"
        ".sec-toggle{margin-left:auto!important;background:#30343c!important;color:#e6e6e6!important;border:1px solid #4b5360!important;border-radius:6px!important;padding:4px 12px!important;font-size:12px!important;cursor:pointer!important;min-height:34px!important}"
        ".consolidated.collapsed{display:none!important}"
        "@media (max-width:640px){.toolbar{gap:12px!important}.toolbar select,.toolbar input,.toolbar button{flex:1 1 100%!important}.toolbar input[type=search]{min-width:0!important}.toolbar .spacer{display:none!important}}"
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
        "(function(){var cons=document.querySelector('.consolidated');"
        "if(cons&&!document.getElementById('consolidated-toggle')){cons.id='consolidated';"
        "var h=cons.previousElementSibling;if(h&&h.tagName==='H2'){h.classList.add('collapsible-head');"
        "var btn=document.createElement('button');btn.id='consolidated-toggle';btn.type='button';btn.className='sec-toggle';btn.textContent='Hide';h.appendChild(btn);"
        "btn.addEventListener('click',function(){var c=cons.classList.toggle('collapsed');btn.textContent=c?'Show':'Hide';btn.setAttribute('aria-expanded',String(!c));});}}"
        "if(window.matchMedia('(max-width:640px)').matches){var b=document.getElementById('consolidated-toggle');if(b)b.click();}})();"
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
</style>
<link rel="stylesheet" href="/nav.css">
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
        '<button class="nav-link action" id="launch-gui" type="button" title="Open the latest built Space Analyzer GUI">Launch GUI</button>'
        '<button class="nav-link action refresh-link" id="refresh-sub" type="button" title="Reload this page">Refresh</button>'
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
  .wrap { padding:22px 28px 48px; max-width:1180px; margin:0 auto; }
  .page-head h1 { font-size:22px; margin:0 0 4px; letter-spacing:.2px; }
  .page-head .sub { color:#9fb0c7; font-size:13px; margin:0; }
  .page-head .sub a { color:#9bbcff; text-decoration:none; }
  .page-head .sub a:hover { text-decoration:underline; }
  .stats { display:flex; gap:12px; flex-wrap:wrap; margin:18px 0 16px; }
  .stat { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 16px; min-width:96px; }
  .stat .n { font-size:22px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
  .stat .l { color:#9fb0c7; font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; margin-top:6px; }
  .stat.high .n { color:#ff8a8a; } .stat.medium .n { color:#ffcf85; } .stat.low .n { color:#8fe0a4; }
  .bar { display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
  .bar input { flex:1; min-width:220px; padding:9px 12px; border-radius:9px; border:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.05); color:#e7ecf3; font-size:13px; }
  .bar input:focus { outline:2px solid #4aa3ff55; border-color:#4aa3ff; }
  #count { color:#9fb0c7; font-size:12.5px; white-space:nowrap; }
  .table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(255,255,255,.03); }
  table.reports { width:100%; border-collapse:collapse; table-layout:fixed; }
  .reports th, .reports td { text-align:left; padding:11px 14px; font-size:13px; border-bottom:1px solid rgba(255,255,255,.06); }
  .reports td.sev, .reports td.ts, .reports td.num, .reports th { white-space:nowrap; }
  .reports th:nth-child(1) { width:30%; }
  .reports th:nth-child(2) { width:13%; }
  .reports th:nth-child(3) { width:10%; }
  .reports th:nth-child(4) { width:20%; }
  .reports th:nth-child(5) { width:6%; }
  .reports th:nth-child(6) { width:6%; }
  .reports th:nth-child(7) { width:11%; }
  .reports th:nth-child(8) { width:64px; }
  .reports thead th { color:#9fb0c7; font-weight:600; background:rgba(255,255,255,.04); position:sticky; top:0; }
  .reports th.sortable { cursor:pointer; user-select:none; }
  .reports th.sortable:hover { color:#cfe0f5; }
  .reports th.sortable::after { content:" \u21C5"; opacity:.35; font-size:11px; }
  .reports th.sort-asc::after { content:" \u2191"; opacity:1; color:#4aa3ff; }
  .reports th.sort-desc::after { content:" \u2193"; opacity:1; color:#4aa3ff; }
  .reports tbody tr { transition:background .12s ease; }
  .reports tbody tr:hover { background:rgba(79,140,255,.08); }
  .reports tbody tr:last-child td { border-bottom:none; }
  .reports tbody tr.has-high { box-shadow: inset 3px 0 0 #f85149; }
  .reports tbody tr.is-new { background:rgba(79,140,255,.06); }
  .set { font-weight:600; }
  .ts { color:#9fb0c7; font-variant-numeric:tabular-nums; }
  .sev { display:flex; align-items:center; gap:8px; }
  .sevbar { display:inline-flex; width:84px; height:8px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.08); flex:none; }
  .sevbar i { display:block; height:100%; }
  .sevbar .sh { background:#f85149; } .sevbar .sm { background:#d29922; } .sevbar .sl { background:#3fb950; }
  .sevnum { font-variant-numeric:tabular-nums; color:#9fb0c7; font-size:12px; }
  .sevnum .h { color:#ff8a8a; } .sevnum .m { color:#ffcf85; } .sevnum .l { color:#8fe0a4; }
  .num { font-variant-numeric:tabular-nums; }
  .badge { padding:2px 9px; border-radius:999px; font-size:11.5px; font-weight:700; text-transform:capitalize; }
  .st-complete { background:rgba(120,200,140,.18); color:#8fe0a4; }
  .st-running { background:rgba(79,140,255,.18); color:#9bbcff; }
  .st-error { background:rgba(255,86,86,.18); color:#ff8a8a; }
  .tag-new { display:inline-block; margin-left:6px; padding:1px 7px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; background:#4aa3ff; color:#08131d; }
  a.view { color:#9bbcff; text-decoration:none; font-weight:600; padding:5px 10px; border:1px solid rgba(155,188,255,.3); border-radius:8px; }
  a.view:hover { background:rgba(155,188,255,.14); text-decoration:none; }
  .empty { color:#9fb0c7; padding:24px; text-align:center; }
</style></head>
<body>
<div class="wrap">
  <div class="page-head">
    <h1>UX Analysis Reports</h1>
    <p class="sub">Stored in SQLite &mdash; queryable by model, screenshot set, and severity. <a href="/">&larr; Dashboard</a></p>
  </div>
  <section class="stats" id="stats">{STATS}</section>
  <div class="bar">
    <input id="q" placeholder="Search reports (set, model, findings)…" autocomplete="off">
    <span id="count"></span>
  </div>
  <div class="table-wrap">
    <table class="reports"><thead><tr>
      <th class="sortable" data-sort="set">Screenshot set</th>
      <th class="sortable" data-sort="model">Model</th>
      <th class="sortable" data-sort="status">Status</th>
      <th class="sortable" data-sort="severity">Severity (H/M/L)</th>
      <th class="sortable" data-sort="issues">Issues</th>
      <th class="sortable" data-sort="recs">Recs</th>
      <th class="sortable" data-sort="timestamp">Timestamp (MST)</th>
      <th></th>
    </tr></thead><tbody id="tbody">{TBODY}</tbody></table>
  </div>
</div>
<script>
const SEED = {SEED};
let ALL = Array.isArray(SEED) ? SEED.slice() : [];
let sortKey = "timestamp", sortDir = -1, NEWEST = null;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]); }
function ago(t){ if(!t) return "—"; const d=Date.parse(t); if(!d) return esc(t); let s=(Date.now()-d)/1000; if(s<0) s=0;
  if(s<60) return Math.floor(s)+"s ago"; if(s<3600) return Math.floor(s/60)+"m ago"; if(s<86400) return Math.floor(s/3600)+"h ago";
  if(s<2592000) return Math.floor(s/86400)+"d ago"; return Math.floor(s/2592000)+"mo ago"; }
function mstString(t){ const d=new Date(t); if(isNaN(d.getTime())) return esc(t);
  const m=new Date(d.getTime()-7*3600*1000); const p=n=>String(n).padStart(2,"0");
  return m.getUTCFullYear()+"-"+p(m.getUTCMonth()+1)+"-"+p(m.getUTCDate())+" "+p(m.getUTCHours())+":"+p(m.getUTCMinutes())+" MST"; }
function stat(n,l,cls){ return '<div class="stat'+(cls?' '+cls:'')+'"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>'; }
function updateStats(rows){ let H=0,M=0,L=0,I=0,R=0; rows.forEach(r=>{const s=r.severity_counts||{};H+=s.high||0;M+=s.medium||0;L+=s.low||0;I+=r.num_issues||0;R+=r.num_recommendations||0;});
  document.getElementById("stats").innerHTML = stat(rows.length,"Reports")+stat(H,"High","high")+stat(M,"Medium","medium")+stat(L,"Low","low")+stat(I,"Findings")+stat(R,"Recs"); }
function rowHtml(r){ const s=r.severity_counts||{}; const h=s.high||0,m=s.medium||0,l=s.low||0; const tot=Math.max(h+m+l,1);
  const isNew = (r.timestamp||r.created_at)===NEWEST;
  const cls=(h>0?"has-high ":"")+(isNew?"is-new":"");
  return '<tr class="'+cls.trim()+'">'
   +'<td class="set">'+esc(r.screenshot_set)+(isNew?' <span class="tag-new">new</span>':'')+'</td>'
   +'<td>'+esc(r.model)+'</td>'
   +'<td><span class="badge st-'+esc(r.status)+'">'+esc(r.status)+'</span></td>'
   +'<td class="sev"><span class="sevbar"><i class="sh" style="width:'+(h/tot*100)+'%"></i><i class="sm" style="width:'+(m/tot*100)+'%"></i><i class="sl" style="width:'+(l/tot*100)+'%"></i></span>'
     +'<span class="sevnum"><b class="h">'+h+'</b>/<b class="m">'+m+'</b>/<b class="l">'+l+'</b></span></td>'
   +'<td class="num">'+ (r.num_issues||0) +'</td>'
   +'<td class="num">'+ (r.num_recommendations||0) +'</td>'
    +'<td class="ts" title="'+esc(ago(r.timestamp||r.created_at))+'">'+mstString(r.timestamp||r.created_at)+'</td>'
   +'<td><a class="view" href="/report?id='+encodeURIComponent(r.report_key)+'">View →</a></td></tr>'; }
const SORTERS = {
  set: r => (r.screenshot_set||"").toLowerCase(),
  model: r => (r.model||"").toLowerCase(),
  status: r => (r.status||""),
  severity: r => { const s=r.severity_counts||{}; return (s.high||0)*100000 + (s.medium||0)*1000 + (s.low||0); },
  issues: r => r.num_issues||0,
  recs: r => r.num_recommendations||0,
  timestamp: r => Date.parse(r.timestamp||r.created_at||0)||0,
};
function computeNewest(){ let best=null,bt=-1; ALL.forEach(r=>{ const t=Date.parse(r.timestamp||r.created_at||0)||0; if(t>bt){bt=t;best=r.timestamp||r.created_at;} }); return best; }
function draw(){ NEWEST=computeNewest(); const f=SORTERS[sortKey];
  const rows=ALL.slice().sort((a,b)=>{ const va=f(a),vb=f(b); if(va<vb) return -1*sortDir; if(va>vb) return 1*sortDir; return 0; });
  document.getElementById("tbody").innerHTML = rows.length ? rows.map(rowHtml).join("") : '<tr><td class="empty" colspan="8">No reports match.</td></tr>';
  updateStats(ALL);
  const c=document.getElementById("count"); if(c) c.textContent = ALL.length + " report" + (ALL.length===1?"":"s");
  document.querySelectorAll("th.sortable").forEach(th=>{ th.classList.toggle("sort-asc", th.dataset.sort===sortKey && sortDir===1); th.classList.toggle("sort-desc", th.dataset.sort===sortKey && sortDir===-1); }); }
function setSort(key){ if(sortKey===key){ sortDir*=-1; } else { sortKey=key; sortDir = (key==="timestamp"||key==="issues"||key==="recs"||key==="severity") ? -1 : 1; } draw(); }
async function search(q){ const url="/api/reports"+(q?"?q="+encodeURIComponent(q):""); try{ const r=await fetch(url); const j=await r.json(); ALL=j.reports||[]; draw(); }
  catch(e){ document.getElementById("tbody").innerHTML='<tr><td class="empty" colspan="8">Search failed.</td></tr>'; } }
document.querySelectorAll("th.sortable").forEach(th=>th.addEventListener("click",()=>setSort(th.dataset.sort)));
const qe=document.getElementById("q"); if(qe) qe.addEventListener("input",()=>search(qe.value));
draw();
</script>
</body></html>"""


def _rel_time(ts):
    """Render an ISO timestamp as a compact relative label (e.g. '3h ago')."""
    if not ts:
        return "—"
    try:
        from datetime import datetime, timezone

        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        secs = (datetime.now(timezone.utc) - dt).total_seconds()
    except Exception:
        return str(ts)
    if secs < 0:
        return "just now"
    if secs < 60:
        return f"{int(secs)}s ago"
    if secs < 3600:
        return f"{int(secs // 60)}m ago"
    if secs < 86400:
        return f"{int(secs // 3600)}h ago"
    if secs < 2592000:
        return f"{int(secs // 86400)}d ago"
    return f"{int(secs // 2592000)}mo ago"


def _mst_string(ts):
    """Render an ISO timestamp in Mountain Standard Time (UTC-7, fixed)."""
    if not ts:
        return "—"
    try:
        from datetime import datetime, timedelta, timezone

        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        mst = dt.astimezone(timezone(timedelta(hours=-7)))
        return mst.strftime("%Y-%m-%d %H:%M MST")
    except Exception:
        return str(ts)


def _reports_stats_html(rows: list[dict]) -> str:
    """Aggregate counts shown in the summary strip at the top of the page."""
    h = m = l = issues = recs = 0
    for r in rows:
        sev = r.get("severity_counts") or {}
        h += sev.get("high", 0)
        m += sev.get("medium", 0)
        l += sev.get("low", 0)
        issues += r.get("num_issues", 0) or 0
        recs += r.get("num_recommendations", 0) or 0
    n = len(rows)
    return (
        "<div class='stat'><div class='n'>" + str(n) + "</div><div class='l'>Reports</div></div>"
        + "<div class='stat high'><div class='n'>" + str(h) + "</div><div class='l'>High</div></div>"
        + "<div class='stat medium'><div class='n'>" + str(m) + "</div><div class='l'>Medium</div></div>"
        + "<div class='stat low'><div class='n'>" + str(l) + "</div><div class='l'>Low</div></div>"
        + "<div class='stat'><div class='n'>" + str(issues) + "</div><div class='l'>Findings</div></div>"
        + "<div class='stat'><div class='n'>" + str(recs) + "</div><div class='l'>Recs</div></div>"
    )


def _reports_row_html(r: dict, is_new: bool) -> str:
    """Render one report as a table row (mirrors the client-side ``rowHtml``)."""
    esc = lambda v: html.escape(str(v if v is not None else ""))
    sev = r.get("severity_counts") or {}
    h = sev.get("high", 0)
    m = sev.get("medium", 0)
    l = sev.get("low", 0)
    tot = max(h + m + l, 1)
    sh = f"{(h / tot * 100):.1f}"
    sm = f"{(m / tot * 100):.1f}"
    sl = f"{(l / tot * 100):.1f}"
    key = esc(r.get("report_key", ""))
    new = ' <span class="tag-new">new</span>' if is_new else ""
    cls = ("has-high " if h > 0 else "") + ("is-new" if is_new else "")
    return (
        "<tr class='" + cls.strip() + "'>"
        "<td class='set'>" + esc(r.get("screenshot_set", "")) + new + "</td>"
        "<td>" + esc(r.get("model", "")) + "</td>"
        "<td><span class='badge st-" + esc(r.get("status", "")) + "'>" + esc(r.get("status", "")) + "</span></td>"
        "<td class='sev'><span class='sevbar'>"
        "<i class='sh' style='width:" + sh + "%'></i>"
        "<i class='sm' style='width:" + sm + "%'></i>"
        "<i class='sl' style='width:" + sl + "%'></i></span>"
        "<span class='sevnum'><b class='h'>" + str(h) + "</b>/<b class='m'>" + str(m)
        + "</b>/<b class='l'>" + str(l) + "</b></span></td>"
        "<td class='num'>" + str(r.get("num_issues", 0) or 0) + "</td>"
        "<td class='num'>" + str(r.get("num_recommendations", 0) or 0) + "</td>"
        "<td class='ts' title='" + esc(_rel_time(r.get("timestamp") or r.get("created_at"))) + "'>"
        + esc(_mst_string(r.get("timestamp") or r.get("created_at"))) + "</td>"
        "<td><a class='view' href='/report?id=" + key + "'>View &rarr;</a></td>"
        "</tr>"
    )


def _render_reports_list_page(rows: list[dict]) -> str:
    """Render a browsable list of stored reports for easy retrieval.

    The page is built server-side for the initial load (summary strip, table,
    and a JSON seed) and re-queries the database via ``/api/reports?q=`` as the
    user types or re-sorts.  Each row links to the stored report at
    ``/report?id=<report_key>``.
    """
    stats = _reports_stats_html(rows)
    if not rows:
        tbody = (
            '<tr><td class="empty" colspan="8">'
            "No reports stored yet. Run an analysis to populate the database.</td></tr>"
        )
    else:
        newest = max((r.get("timestamp") or r.get("created_at") or "") for r in rows)
        tbody = "".join(_reports_row_html(r, (r.get("timestamp") or r.get("created_at")) == newest) for r in rows)
    seed = json.dumps(rows, ensure_ascii=False)
    return (
        REPORTS_PAGE_TEMPLATE.replace("{STATS}", stats)
        .replace("{TBODY}", tbody)
        .replace("{SEED}", seed)
    )

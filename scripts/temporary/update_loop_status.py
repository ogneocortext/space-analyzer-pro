import re

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Update the loop section HTML structure to add iteration info and model
old_loop_section = """    <div class="panel loop-section">
      <h2>Loop Status</h2>
      <div id="loop-status" class="loop-state"><span class="empty">Loading...</span></div>
      <div id="loop-history" class="history"></div>
      <div style="margin-top:0.4rem;"><button class="btn btn-sm" id="btn-reset-loop">Reset</button></div>
    </div>"""

new_loop_section = """    <div class="panel loop-section">
      <h2>Loop Status</h2>
      <div id="loop-status" class="loop-state"><span class="empty">Loading...</span></div>
      <div id="loop-meta" class="loop-meta"></div>
      <div id="loop-history" class="history"></div>
      <div style="margin-top:0.4rem;"><button class="btn btn-sm" id="btn-reset-loop">Reset</button></div>
    </div>"""

content = content.replace(old_loop_section, new_loop_section)

# Fix 2: Update the renderLoop function to add model info and better formatting
old_render_loop = """/* === LOOP STATE === */
function renderLoop(state, history) {
  const done = (state.processed || []).length;
  const failed = (state.failed || []).length;
  const iter = state.iteration || 0;
  document.getElementById('loop-status').innerHTML =
    '<span class="pill">Iter: ' + iter + '</span>' +
    '<span class="pill" style="color:var(--ok)">OK: ' + done + '</span>' +
    '<span class="pill" style="color:var(--danger)">Fail: ' + failed + '</span>';
  const el = document.getElementById('loop-history');
  if (!history || !history.length) { el.innerHTML = '<span class="empty">No iterations yet.</span>'; return; }
  el.innerHTML = history.slice(-10).reverse().map(it => {
    const when = new Date((it.ended_at || it.started_at || '')).toLocaleString();
    const cls = it.status === 'completed' ? 'completed' : (it.status === 'failed' ? 'failed' : 'partial');
    const parts = ['Iter ' + it.iteration];
    if (it.model) parts.push(it.model);
    if (it.processed_count) parts.push(it.processed_count + ' fixed');
    if (it.failed_count) parts.push(it.failed_count + ' fail');
    return '<div class="history-item"><span><span class="h-status ' + cls + '">' + esc(it.status) + '</span> ' + esc(parts.join(', ')) + '</span><span class="h-meta">' + esc(when) + '</span></div>';
  }).join('');
}"""

new_render_loop = """/* === LOOP STATE === */
function renderLoop(state, history) {
  const done = (state.processed || []).length;
  const failed = (state.failed || []).length;
  const iter = state.iteration || 0;
  const model = state.model || '';
  document.getElementById('loop-status').innerHTML =
    '<span class="pill">Iteration ' + iter + '</span>' +
    (model ? '<span class="pill" style="color:var(--accent)">' + esc(model) + '</span>' : '') +
    '<span class="pill" style="color:var(--ok)">' + done + ' OK</span>' +
    '<span class="pill" style="color:var(--danger)">' + failed + ' Fail</span>';
  const metaEl = document.getElementById('loop-meta');
  if (iter > 0) {
    const lastHistory = history && history.length ? history[history.length - 1] : null;
    if (lastHistory) {
      const etaLabel = state.eta || '';
      metaEl.innerHTML = '<span style="font-size:0.78rem;color:var(--muted);">' +
        (lastHistory.started_at ? 'Started: ' + esc(new Date(lastHistory.started_at).toLocaleString()) + ' ' : '') +
        (lastHistory.ended_at ? 'Ended: ' + esc(new Date(lastHistory.ended_at).toLocaleString()) : '') +
        (etaLabel ? ' | ETA: ' + esc(etaLabel) : '') +
        '</span>';
    } else {
      metaEl.innerHTML = '';
    }
  } else {
    metaEl.innerHTML = '<span style="font-size:0.78rem;color:var(--muted);">No iterations completed yet.</span>';
  }
  const el = document.getElementById('loop-history');
  if (!history || !history.length) { el.innerHTML = '<span class="empty">No iterations yet.</span>'; return; }
  const items = history.slice(-10).reverse();
  el.innerHTML = items.map(it => {
    const started = it.started_at ? new Date(it.started_at).toLocaleString() : '-';
    const ended = it.ended_at ? new Date(it.ended_at).toLocaleString() : '-';
    const cls = it.status === 'completed' ? 'history-completed' : (it.status === 'failed' ? 'history-failed' : 'history-partial');
    const details = [];
    details.push('Iteration ' + it.iteration);
    if (it.model) details.push('<span class="h-model">' + esc(it.model) + '</span>');
    if (it.processed_count != null) details.push('<span class="h-ok">' + it.processed_count + ' fixed</span>');
    if (it.failed_count != null) details.push('<span class="h-fail">' + it.failed_count + ' failed</span>');
    const failedIds = (it.failed || []).slice(0, 3).map(id => esc(id)).join(', ');
    const failDetail = (it.failed && it.failed.length) ? '<div class="h-ids">' + failedIds + (it.failed.length > 3 ? '...' : '') + '</div>' : '';
    return '<div class="history-item ' + cls + '">' +
      '<div class="h-header">' +
        '<span class="h-status ' + cls + '">' + esc(it.status || 'unknown') + '</span> ' +
        details.join(' | ') +
      '</div>' +
      '<div class="h-times">' + started + ' - ' + ended + '</div>' +
      failDetail +
    '</div>';
  }).join('');
}"""

content = content.replace(old_render_loop, new_render_loop)

# Fix 3: Add CSS for better loop section styling
old_css = """ .loop-state { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.4rem; } """

new_css = """ .loop-state { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
.loop-meta { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.5rem; min-height: 1.1rem; }
.history { max-height: 220px; overflow-y: auto; }
.history-item { margin-bottom: 0.5rem; padding: 0.4rem; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid transparent; }
.history-item.history-completed { border-color: rgba(74,222,128,0.2); }
.history-item.history-failed { border-color: rgba(248,113,113,0.2); background: rgba(248,113,113,0.04); }
.history-item.history-partial { border-color: rgba(251,191,36,0.2); }
.history-item .h-header { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.2rem; font-size: 0.82rem; }
.history-item .h-status { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; padding: 0.1rem 0.3rem; border-radius: 3px; letter-spacing: 0.3px; }
.history-item .h-status.history-completed { color: var(--ok); background: rgba(74,222,128,0.12); }
.history-item .h-status.history-failed { color: var(--danger); background: rgba(248,113,113,0.12); }
.history-item .h-status.history-partial { color: var(--warn); background: rgba(251,191,36,0.12); }
.history-item .h-model { color: var(--accent); font-family: monospace; font-size: 0.78rem; }
.history-item .h-ok { color: var(--ok); font-weight: 600; }
.history-item .h-fail { color: var(--danger); font-weight: 600; }
.history-item .h-times { font-size: 0.72rem; color: var(--muted); }
.history-item .h-ids { font-size: 0.72rem; color: var(--muted); font-family: monospace; margin-top: 0.15rem; word-break: break-all; }"""

content = content.replace(old_css, new_css)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated successfully')

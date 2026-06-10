path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_render_loop_start = """/* === LOOP STATE === */
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
      const etaLabel = state.eta || '';"""

new_render_loop_start = """/* === LOOP STATE === */
function renderLoop(state, history) {
  const done = (state.processed || []).length;
  const failed = (state.failed || []).length;
  const iter = state.iteration || 0;
  const lastHistory = history && history.length ? history[history.length - 1] : null;
  const model = state.model || (lastHistory ? lastHistory.model : '') || '';
  document.getElementById('loop-status').innerHTML =
    '<span class="pill">Iteration ' + iter + '</span>' +
    (model ? '<span class="pill" style="color:var(--accent)">' + esc(model) + '</span>' : '') +
    '<span class="pill" style="color:var(--ok)">' + done + ' OK</span>' +
    '<span class="pill" style="color:var(--danger)">' + failed + ' Fail</span>';
  const metaEl = document.getElementById('loop-meta');
  if (iter > 0) {
    const etaLabel = state.eta || '';"""

if old_render_loop_start in content:
    content = content.replace(old_render_loop_start, new_render_loop_start)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('renderLoop updated successfully')
else:
    print('Old renderLoop not found')

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_buggy = """  if (iter > 0) {
    const etaLabel = state.eta || '';
      metaEl.innerHTML = '<span style=\"font-size:0.78rem;color:var(--muted);\">' +
        (lastHistory.started_at ? 'Started: ' + esc(new Date(lastHistory.started_at).toLocaleString()) + ' ' : '') +
        (lastHistory.ended_at ? 'Ended: ' + esc(new Date(lastHistory.ended_at).toLocaleString()) : '') +
        (etaLabel ? ' | ETA: ' + esc(etaLabel) : '') +
        '</span>';
    } else {
      metaEl.innerHTML = '';
    }
  } else {
    metaEl.innerHTML = '<span style=\"font-size:0.78rem;color:var(--muted);\">No iterations completed yet.</span>';
  }"""

new_fixed = """  if (iter > 0) {
    const etaLabel = state.eta || '';
    if (lastHistory) {
      metaEl.innerHTML = '<span style=\"font-size:0.78rem;color:var(--muted);\">' +
        (lastHistory.started_at ? 'Started: ' + esc(new Date(lastHistory.started_at).toLocaleString()) + ' ' : '') +
        (lastHistory.ended_at ? 'Ended: ' + esc(new Date(lastHistory.ended_at).toLocaleString()) : '') +
        (etaLabel ? ' | ETA: ' + esc(etaLabel) : '') +
        '</span>';
    } else {
      metaEl.innerHTML = '';
    }
  } else {
    metaEl.innerHTML = '<span style=\"font-size:0.78rem;color:var(--muted);\">No iterations completed yet.</span>';
  }"""

if old_buggy in content:
    content = content.replace(old_buggy, new_fixed)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed loop logic successfully')
else:
    print('Buggy code not found')

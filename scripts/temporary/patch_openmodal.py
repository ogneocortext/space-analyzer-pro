path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_modal_sig = """/* === MODAL === */
function openModal(row, linksByIssue, aiResponse) {"""

new_modal_sig = """/* === MODAL === */
function openModal(row, linksByIssue, aiResponse, fixResult) {"""

if old_modal_sig not in content:
    raise SystemExit('Old openModal signature not found')
content = content.replace(old_modal_sig, new_modal_sig)

# Update the AI panel HTML in modal to include verification block
old_ai_panel = """'<div class="ai-panel" id="modal-ai-panel"><div class="ai-header"><h3>&#x1f916; AI Resolution</h3><span class="ai-spinner" id="modal-ai-spinner"></span></div><div class="ai-response" id="modal-ai-response" style="display:none;"></div></div>';"""

new_ai_panel = """'<div class="ai-panel" id="modal-ai-panel"><div class="ai-header"><h3>&#x1f916; AI Resolution</h3><span class="ai-spinner" id="modal-ai-spinner"></span></div><div class="ai-response" id="modal-ai-response" style="display:none;"></div><div id="modal-verify-panel" style="display:none;"></div></div>';"""

if old_ai_panel not in content:
    raise SystemExit('Old AI panel HTML not found')
content = content.replace(old_ai_panel, new_ai_panel)

# Update the part where aiResponse is shown to also handle fixResult
old_ai_response_show = """  if (aiResponse) {
    const aiEl = body.querySelector('#modal-ai-response');
    if (aiEl) { aiEl.textContent = aiResponse; aiEl.style.display = 'block'; aiEl.closest('.ai-panel').classList.add('visible'); }
  }"""

new_ai_response_show = """  if (aiResponse) {
    const aiEl = body.querySelector('#modal-ai-response');
    if (aiEl) { aiEl.textContent = aiResponse; aiEl.style.display = 'block'; aiEl.closest('.ai-panel').classList.add('visible'); }
  }
  if (fixResult && fixResult.resolution && fixResult.resolution.response) {
    const aiPanel = body.querySelector('#modal-ai-panel');
    const aiEl = body.querySelector('#modal-ai-response');
    const verPanel = body.querySelector('#modal-verify-panel');
    const ver = fixResult.verification || {};
    aiEl.textContent = fixResult.resolution.response;
    aiEl.style.display = 'block';
    aiPanel.classList.add('visible');
    verPanel.style.display = 'block';
    verPanel.innerHTML = '<div class="verification-section"><strong>Verification (' + esc(fixResult.resolution.model || fixResult.model || '') + '):</strong>' +
      '<div class="verification-block ' + (ver.exit_code === 0 ? 'ver-ok' : 'ver-fail') + '">' +
        '<div>Tool: ' + esc(ver.tool || 'verify') + ' | Exit: ' + esc(String(ver.exit_code ?? '-')) + '</div>' +
        (ver.stdout ? '<pre class="ver-stdout">' + esc(ver.stdout) + '</pre>' : '') +
        (ver.stderr ? '<pre class="ver-stderr">' + esc(ver.stderr) + '</pre>' : '') +
      '</div></div>';
  }"""

if old_ai_response_show not in content:
    raise SystemExit('Old aiResponse show block not found')
content = content.replace(old_ai_response_show, new_ai_response_show)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('openModal patched')

from pathlib import Path

path = Path(r'ux-pipeline/src/ux_pipeline/web_dashboard.py')
text = path.read_text(encoding='utf-8')

old_select = '''<select id="verify-tool-select" title="Verification tool for AI fixes" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.4rem;font-size:0.72rem;margin-left:0.4rem;">
          <option value="verify">verify</option>
          <option value="test">test</option>
          <option value="clippy">clippy</option>
          <option value="fmt">fmt</option>
        </select>'''

new_select = '''<select id="verify-tool-select" title="Verification tool for AI fixes" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.4rem;font-size:0.72rem;margin-left:0.4rem;">
          <option value="verify">verify</option>
          <option value="test">test</option>
          <option value="clippy">clippy</option>
          <option value="fmt">fmt</option>
        </select>
        <select id="source-scan-scope" title="Source scan scope" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.4rem;font-size:0.72rem;margin-left:0.4rem;">
          <option value="rust">Rust</option>
          <option value="python">Python</option>
          <option value="all">All</option>
        </select>
        <button class="btn btn-sm btn-info" id="btn-source-scan" title="Ask Ollama to scan source and add issues">&#x1f916; Scan Source</button>'''

if old_select not in text:
    raise SystemExit('verify-tool-select not found')
text = text.replace(old_select, new_select, 1)

old_bottom = '''refresh();
loadModels();
setupTestRunner();
setInterval(refresh, 10000);'''

new_bottom = '''refresh();
loadModels();
setupTestRunner();
setupSourceScan();
setInterval(refresh, 10000);'''

if old_bottom not in text:
    raise SystemExit('bottom script block not found')
text = text.replace(old_bottom, new_bottom, 1)

old_test_runner_comment = '/* === TEST RUNNER === */'
insert_after_test_runner = '''/* === TEST RUNNER === */
function setupTestRunner() {'''
new_block = '''/* === SOURCE SCAN === */
function setupSourceScan() {
  const btn = document.getElementById('btn-source-scan');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const modelSel = document.getElementById('model-select');
    const scopeSel = document.getElementById('source-scan-scope');
    const model = (modelSel ? modelSel.value || '' : '').trim();
    const scope = scopeSel ? scopeSel.value : 'rust';
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Scanning...';
    try {
      const res = await fetch(API('/source/scan'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ model, scope }),
      });
      const data = await res.json();
      btn.textContent = orig;
      if (data.created && data.created.length) {
        alert('Source scan created ' + data.created.length + ' issue(s).');
      } else if (data.error) {
        alert('Scan error: ' + data.error);
      } else {
        alert('Source scan completed with no new issues.');
      }
      refresh();
    } catch (e) {
      btn.textContent = orig;
      alert('Scan failed: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });
}

/* === TEST RUNNER === */
function setupTestRunner() {'''

if old_test_runner_comment not in text:
    raise SystemExit('test runner comment not found')
text = text.replace(old_test_runner_comment, new_block, 1)

path.write_text(text, encoding='utf-8')
print('frontend patched')

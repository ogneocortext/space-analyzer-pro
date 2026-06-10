path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace resolveWithAI with fixAndVerify + keep simple resolve fallback
old_resolve_function = '''/* === AI RESOLUTION === */
async function resolveWithAI(issueId, model, btn) {
  const modelSel = document.getElementById('model-select');
  const selectedModel = model || modelSel.value;
  if (!selectedModel) { alert('Please select an Ollama model first.'); return; }
  btn.disabled = true;
  const origText = btn.textContent;
  btn.innerHTML = '<span class="ai-spinner active"></span> Resolving...';
  try {
    const res = await fetch(API('/issues/' + encodeURIComponent(issueId) + '/resolve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = origText;
    return data;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = origText;
    return { error: 'Network error: ' + e.message };
  }
}'''

new_resolve_function = '''/* === AI RESOLUTION === */
async function resolveWithAI(issueId, model, btn) {
  const modelSel = document.getElementById('model-select');
  const selectedModel = model || modelSel.value;
  if (!selectedModel) { alert('Please select an Ollama model first.'); return; }
  btn.disabled = true;
  const origText = btn.textContent;
  btn.innerHTML = '<span class="ai-spinner active"></span> Resolving...';
  try {
    const res = await fetch(API('/issues/' + encodeURIComponent(issueId) + '/resolve'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel }),
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = origText;
    return data;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = origText;
    return { error: 'Network error: ' + e.message };
  }
}

async function fixAndVerify(issueId, model, tool, btn) {
  const modelSel = document.getElementById('model-select');
  const selectedModel = model || modelSel.value;
  if (!selectedModel) { alert('Please select an Ollama model first.'); return; }
  btn.disabled = true;
  const origText = btn.textContent;
  btn.innerHTML = '<span class="ai-spinner active"></span> Working...';
  try {
    const res = await fetch(API('/issues/' + encodeURIComponent(issueId) + '/fix-and-verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, tool }),
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = origText;
    return data;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = origText;
    return { error: 'Network error: ' + e.message };
  }
}'''

if old_resolve_function not in content:
    raise SystemExit('Old resolve function not found')
content = content.replace(old_resolve_function, new_resolve_function)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 3 done: frontend functions added')

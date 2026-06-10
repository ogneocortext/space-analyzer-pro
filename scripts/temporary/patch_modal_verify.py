path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update modal AI button handler to support fix-and-verify
old_ai_handler = '''      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        const aiPanel = body.querySelector('#modal-ai-panel');
        const aiResp = body.querySelector('#modal-ai-response');
        const aiSpin = body.querySelector('#modal-ai-spinner');
        if (aiSpin) aiSpin.classList.remove('active');
        if (result && result.response) {
          aiResp.textContent = result.response;
          aiResp.style.display = 'block';
          aiPanel.classList.add('visible');
        } else if (result && result.error) {
          aiResp.textContent = 'Error: ' + result.error;
          aiResp.style.display = 'block';
          aiResp.classList.add('error');
          aiPanel.classList.add('visible');
        }
        return;
      }'''

new_ai_handler = """      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        const aiPanel = body.querySelector('#modal-ai-panel');
        const aiResp = body.querySelector('#modal-ai-response');
        const aiSpin = body.querySelector('#modal-ai-spinner');
        if (aiSpin) aiSpin.classList.remove('active');
        if (result && result.response) {
          aiResp.innerHTML = '<div class="ai-section"><strong>Response:</strong><div class="ai-response-text">' + esc(result.response) + '</div></div>';
          aiResp.style.display = 'block';
          aiPanel.classList.add('visible');
        } else if (result && result.error) {
          aiResp.textContent = 'Error: ' + result.error;
          aiResp.style.display = 'block';
          aiResp.classList.add('error');
          aiPanel.classList.add('visible');
        }
        return;
      }
      if (action === 'fix-and-verify') {
        const toolSelect = document.getElementById('verify-tool-select');
        const tool = toolSelect ? toolSelect.value : 'verify';
        const result = await fixAndVerify(row.issue_id, null, tool, btn);
        const aiPanel = body.querySelector('#modal-ai-panel');
        const aiResp = body.querySelector('#modal-ai-response');
        const aiSpin = body.querySelector('#modal-ai-spinner');
        if (aiSpin) aiSpin.classList.remove('active');
        if (result && result.resolution && result.resolution.response) {
          const ver = result.verification || {};
          const verHtml = '<div class="verification-section">' +
            '<strong>Verification (' + esc(result.resolution.model || result.model || '') + '):</strong>' +
            '<div class="verification-block ' + (ver.exit_code === 0 ? 'ver-ok' : 'ver-fail') + '">' +
              '<div>Tool: ' + esc(ver.tool || tool) + ' | Exit: ' + esc(String(ver.exit_code ?? '-')) + '</div>' +
              (ver.stdout ? '<pre class="ver-stdout">' + esc(ver.stdout) + '</pre>' : '') +
              (ver.stderr ? '<pre class="ver-stderr">' + esc(ver.stderr) + '</pre>' : '') +
            '</div>' +
          '</div>';
          aiResp.innerHTML = '<div class="ai-section"><strong>AI Fix:</strong><div class="ai-response-text">' + esc(result.resolution.response) + '</div></div>' + verHtml;
          aiResp.style.display = 'block';
          aiResp.classList.remove('error');
          aiPanel.classList.add('visible');
        } else if (result && result.error) {
          aiResp.textContent = 'Error: ' + result.error;
          aiResp.style.display = 'block';
          aiResp.classList.add('error');
          aiPanel.classList.add('visible');
        }
        return;
      }"""

if old_ai_handler not in content:
    raise SystemExit('Old AI handler not found')
content = content.replace(old_ai_handler, new_ai_handler)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 5 done: modal handler updated')

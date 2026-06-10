path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_card_handler = """      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        if (result && result.response) {
          openModal(row, linksByIssue, result.response);
        } else if (result && result.error) {
          alert('AI Error: ' + result.error);
        }
        return;
      }
      btn.disabled = true;
      try {
        await fetch('/api/issues/' + encodeURIComponent(row.issue_id) + '/' + action, { method: 'POST' });
        refresh();
      } catch(err) { console.error(err); btn.disabled = false; }"""

new_card_handler = """      if (action === 'ai-resolve') {
        const result = await resolveWithAI(row.issue_id, null, btn);
        if (result && result.response) {
          openModal(row, linksByIssue, result.response);
        } else if (result && result.error) {
          alert('AI Error: ' + result.error);
        }
        return;
      }
      if (action === 'fix-and-verify') {
        const toolSelect = document.getElementById('verify-tool-select');
        const tool = toolSelect ? toolSelect.value : 'verify';
        const result = await fixAndVerify(row.issue_id, null, tool, btn);
        if (result && !result.error) {
          openModal(row, linksByIssue, null, result);
        } else if (result && result.error) {
          alert('Fix + Verify Error: ' + result.error);
        }
        return;
      }
      btn.disabled = true;
      try {
        await fetch('/api/issues/' + encodeURIComponent(row.issue_id) + '/' + action, { method: 'POST' });
        refresh();
      } catch(err) { console.error(err); btn.disabled = false; }"""

if old_card_handler not in content:
    raise SystemExit('Old card handler not found')
content = content.replace(old_card_handler, new_card_handler)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Card handler patched')

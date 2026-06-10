path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_modal_actions_html = """'<button class="btn btn-accent" data-action="ai-resolve">&#x1f916; AI Fix</button>' : '') +"""

new_modal_actions_html = """'<button class="btn btn-accent" data-action="ai-resolve">&#x1f916; AI Fix</button>' +
        '<button class="btn btn-info" data-action="fix-and-verify" title="AI fix + run tests">Fix + Verify</button>' : '') +"""

if old_modal_actions_html not in content:
    raise SystemExit('Old modal actions HTML not found')
content = content.replace(old_modal_actions_html, new_modal_actions_html)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 6 done: modal HTML updated')

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """'<button class="btn btn-sm btn-accent" data-action="ai-resolve" title="Send to AI for resolution">&#x1f916; AI Fix</button>';"""

new = """'<button class="btn btn-sm btn-accent" data-action="ai-resolve" title="Ask AI for advice">&#x1f916; AI Fix</button>' +
        '<button class="btn btn-sm btn-info" data-action="fix-and-verify" title="AI fix + run tests">&#x1f6e0;&#xfe0f; Fix + Verify</button>';"""

if old not in content:
    raise SystemExit('Old AI Fix button not found')
content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 4 done: Fix+Verify button added')

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_actions = """    let actions = '';
    if (row.status === 'open' || row.status === 'in_progress') {
      actions = '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>' +
        '<button class="btn btn-sm btn-info" data-action="in_progress" title="Set in progress">&#9654; WIP</button>' +
        '<button class="btn btn-sm" data-action="wontfix" title="Won\'t fix">&#10005; Skip</button>' +
        '<button class="btn btn-sm btn-accent" data-action="ai-resolve" title="Send to AI for resolution">&#x1f916; AI Fix</button>';
    } else if (row.status === 'done') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>';
    } else if (row.status === 'wontfix') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>' +
        '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>';
    }"""

new_actions = """    let actions = '';
    if (row.status === 'open' || row.status === 'in_progress') {
      actions = '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>' +
        '<button class="btn btn-sm btn-info" data-action="in_progress" title="Set in progress">&#9654; WIP</button>' +
        '<button class="btn btn-sm" data-action="wontfix" title="Won\'t fix">&#10005; Skip</button>' +
        '<button class="btn btn-sm btn-accent" data-action="ai-resolve" title="Ask AI for advice">&#x1f916; AI Fix</button>' +
        '<button class="btn btn-sm btn-info" data-action="fix-and-verify" title="AI fix + run tests">&#x1f6e0;&#xfe0f; Fix + Verify</button>';
    } else if (row.status === 'done') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>';
    } else if (row.status === 'wontfix') {
      actions = '<button class="btn btn-sm" data-action="open" title="Reopen">&#8634; Reopen</button>' +
        '<button class="btn btn-sm btn-ok" data-action="done" title="Mark done">&#10003; Done</button>';
    }"""

if old_actions not in content:
    raise SystemExit('Old actions block not found')
content = content.replace(old_actions, new_actions)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 4 done: issue cards updated')

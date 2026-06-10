path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_css = """.ai-response.error { border-color: rgba(248,113,113,0.3); color: var(--danger); }"""

new_css = """.ai-response.error { border-color: rgba(248,113,113,0.3); color: var(--danger); }
.ai-section { margin-bottom: 0.6rem; }
.ai-response-text { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem; font-size: 0.8rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow-y: auto; color: #d9dbe0; }
.verification-section { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; margin-top: 0.4rem; }
.verification-block { padding: 0.4rem; border-radius: 6px; font-size: 0.78rem; }
.verification-block.ver-ok { border-left: 3px solid var(--ok); background: rgba(74,222,128,0.04); }
.verification-block.ver-fail { border-left: 3px solid var(--danger); background: rgba(248,113,113,0.04); }
.ver-stdout { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.72rem; max-height: 220px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; margin-top: 0.3rem; color: #c8cad0; }
.ver-stderr { background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.25); border-radius: 6px; padding: 0.4rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-size: 0.72rem; max-height: 220px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; margin-top: 0.3rem; color: #f5a3a3; }"""

if old_css not in content:
    raise SystemExit('Old ai-response CSS not found')
content = content.replace(old_css, new_css)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 8 done: AI CSS added')

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_css = """.loop-state { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
.pill { background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; color: #c9c9d6; }
.history { max-height: 120px; overflow-y: auto; }
.history-item { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; padding: 0.25rem 0; border-bottom: 1px solid var(--border); font-size: 0.78rem; align-items: center; }
.history-item:last-child { border-bottom: none; }
.h-status { font-weight: 600; }
.h-status.completed { color: var(--ok); } .h-status.partial { color: var(--warn); } .h-status.failed { color: var(--danger); }
.h-meta { color: var(--muted); font-size: 0.7rem; }"""

new_css = """.loop-state { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
.loop-meta { font-size: 0.78rem; color: var(--muted); margin-bottom: 0.5rem; min-height: 1.1rem; }
.pill { background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; color: #c9c9d6; }
.history { max-height: 220px; overflow-y: auto; }
.history-item { margin-bottom: 0.5rem; padding: 0.4rem; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid transparent; }
.history-item.history-completed { border-color: rgba(74,222,128,0.2); }
.history-item.history-failed { border-color: rgba(248,113,113,0.2); background: rgba(248,113,113,0.04); }
.history-item.history-partial { border-color: rgba(251,191,36,0.2); }
.history-item .h-header { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.2rem; font-size: 0.82rem; }
.history-item .h-status { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; padding: 0.1rem 0.3rem; border-radius: 3px; letter-spacing: 0.3px; }
.history-item .h-status.history-completed { color: var(--ok); background: rgba(74,222,128,0.12); }
.history-item .h-status.history-failed { color: var(--danger); background: rgba(248,113,113,0.12); }
.history-item .h-status.history-partial { color: var(--warn); background: rgba(251,191,36,0.12); }
.history-item .h-model { color: var(--accent); font-family: monospace; font-size: 0.78rem; }
.history-item .h-ok { color: var(--ok); font-weight: 600; }
.history-item .h-fail { color: var(--danger); font-weight: 600; }
.history-item .h-times { font-size: 0.72rem; color: var(--muted); }
.history-item .h-ids { font-size: 0.72rem; color: var(--muted); font-family: monospace; margin-top: 0.15rem; word-break: break-all; }"""

if old_css in content:
    content = content.replace(old_css, new_css)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('CSS updated successfully')
else:
    print('Old CSS not found, checking what is there...')
    idx = content.find('/* === LOOP SECTION === */')
    if idx >= 0:
        print('Found LOOP SECTION at index', idx)
        print(repr(content[idx:idx+600]))
    else:
        print('LOOP SECTION comment not found')

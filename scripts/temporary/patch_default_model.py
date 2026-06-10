path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\_pipeline_config.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'ollama_model=_env("MODEL", "phi4-mini:latest") or "phi4-mini:latest",'
new = 'ollama_model=_env("MODEL", "qwen2.5-coder:7b") or "qwen2.5-coder:7b",'

if old not in content:
    raise SystemExit('Default model line not found')
content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Default model patched')

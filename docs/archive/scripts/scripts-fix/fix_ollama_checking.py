from pathlib import Path

path = Path('src/gui/mod.rs')
text = path.read_text(encoding='utf-8', errors='replace')

old = '''ollama_checking: false,'''
new = '''ollama_checking: true,'''

if old not in text:
    raise SystemExit('Target string not found')

text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Patched ollama_checking init to true')

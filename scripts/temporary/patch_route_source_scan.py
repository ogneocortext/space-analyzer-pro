path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''            # POST /api/test/run — run code testing tools
            if path == "/api/test/run":'''

new = '''            # POST /api/source/scan — ask Ollama to scan source and suggest issues
            if path == "/api/source/scan":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                model = (data.get("model") or "").strip()
                scope = (data.get("scope") or "rust").strip()
                result = state.scan_source_for_issues(model, scope)
                self._write_json(HTTPStatus.OK, result)
                return
            # POST /api/test/run — run code testing tools
            if path == "/api/test/run":'''

if old not in content:
    raise SystemExit('Old test run block not found')
content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Route patched')

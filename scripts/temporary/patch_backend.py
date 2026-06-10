path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '                result = state.resolve_issue(issue_id, model)\n                if "error" in result:\n                    self._write_json(HTTPStatus.BAD_REQUEST, result)\n                else:\n                    self._write_json(HTTPStatus.OK, result)\n                return\n            # POST /api/test/run'

new = '                result = state.resolve_issue(issue_id, model)\n                if "error" in result:\n                    self._write_json(HTTPStatus.BAD_REQUEST, result)\n                else:\n                    self._write_json(HTTPStatus.OK, result)\n                return\n            if len(parts) >= 4 and parts[0] == "api" and parts[1] == "issues" and parts[3] == "fix-and-verify":\n                issue_id = "/".join(parts[2:-1])\n                try:\n                    body = self._read_body()\n                    data = json.loads(body) if body else {}\n                except (json.JSONDecodeError, ValueError):\n                    data = {}\n                model = (data.get("model") or "llama3").strip()\n                tool = (data.get("tool") or "verify").strip()\n                if tool not in ("test", "clippy", "fmt", "verify"):\n                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": f"Unknown tool: {tool}. Use test, clippy, fmt, or verify."})\n                    return\n                result = state.resolve_and_verify(issue_id, model, tool)\n                self._write_json(HTTPStatus.OK, result)\n                return\n            # POST /api/test/run'

if old not in content:
    raise SystemExit('Old block not found')
content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 1 done')

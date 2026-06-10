import re

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extend backend handler: add POST /api/issues/<id>/fix-and-verify
old_resolve_block = """            # POST /api/issues/<id>/resolve - AI resolution
            if len(parts) >= 4 and parts[0] == "api" and parts[1] == "issues" and parts[3] == "resolve":
                issue_id = "/".join(parts[2:-1])
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                model = (data.get("model") or "llama3").strip()
                result = state.resolve_issue(issue_id, model)
                if "error" in result:
                    self._write_json(HTTPStatus.BAD_REQUEST, result)
                else:
                    self._write_json(HTTPStatus.OK, result)
                return"""

new_resolve_block = """            # POST /api/issues/<id>/resolve - AI resolution
            if len(parts) >= 4 and parts[0] == "api" and parts[1] == "issues" and parts[3] == "resolve":
                issue_id = "/".join(parts[2:-1])
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                model = (data.get("model") or "llama3").strip()
                result = state.resolve_issue(issue_id, model)
                if "error" in result:
                    self._write_json(HTTPStatus.BAD_REQUEST, result)
                else:
                    self._write_json(HTTPStatus.OK, result)
                return
            if len(parts) >= 4 and parts[0] == "api" and parts[1] == "issues" and parts[3] == "fix-and-verify":
                issue_id = "/".join(parts[2:-1])
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                model = (data.get("model") or "llama3").strip()
                tool = (data.get("tool") or "verify").strip()
                if tool not in ("test", "clippy", "fmt", "verify"):
                    self._write_json(HTTPStatus.BAD_REQUEST, {"error": f"Unknown tool: {tool}. Use test, clippy, fmt, or verify."})
                    return
                result = state.resolve_and_verify(issue_id, model, tool)
                self._write_json(HTTPStatus.OK, result)
                return"""

if old_resolve_block not in content:
    raise SystemExit('Old resolve block not found')
content = content.replace(old_resolve_block, new_resolve_block)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 1 done: backend route added')

from pathlib import Path

path = Path(r'ux-pipeline/src/ux_pipeline/web_dashboard.py')
text = path.read_text(encoding='utf-8')

text = text.replace('\u2014', '-')

old_wrong_placement = '''# POST /api/source/scan - ask Ollama to scan source and suggest issues
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
            # POST /api/test/run - run code testing tools
            if path == "/api/test/run":'''

new_correct_placement = '''# POST /api/test/run - run code testing tools
            if path == "/api/test/run":'''

if old_wrong_placement not in text:
    raise SystemExit('wrong placement block not found')
text = text.replace(old_wrong_placement, new_correct_placement, 1)

old_post_tests = '''# POST /api/test/run - run code testing tools
            if path == "/api/test/run":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                tool = (data.get("tool") or "test").strip()'''

new_post_tests = '''# POST /api/source/scan - ask Ollama to scan source and suggest issues
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
            # POST /api/test/run - run code testing tools
            if path == "/api/test/run":
                try:
                    body = self._read_body()
                    data = json.loads(body) if body else {}
                except (json.JSONDecodeError, ValueError):
                    data = {}
                tool = (data.get("tool") or "test").strip()'''

if old_post_tests not in text:
    raise SystemExit('post tests block not found')
text = text.replace(old_post_tests, new_post_tests, 1)

path.write_text(text, encoding='utf-8')
print('route placement fixed')

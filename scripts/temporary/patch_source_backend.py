from pathlib import Path

path = Path(r'ux-pipeline/src/ux_pipeline/web_dashboard.py')
text = path.read_text(encoding='utf-8')

text = text.replace('\u2014', '-')

text = text.replace(
    'ollama_model=_env("MODEL", "phi4-mini:latest") or "phi4-mini:latest"',
    'ollama_model=_env("MODEL", "qwen2.5-coder:7b") or "qwen2.5-coder:7b"'
)

old_route_marker = '# POST /api/test/run - run code testing tools\n            if path == "/api/test/run":'
new_route_marker = '# POST /api/source/scan - ask Ollama to scan source and suggest issues\n            if path == "/api/source/scan":\n                try:\n                    body = self._read_body()\n                    data = json.loads(body) if body else {}\n                except (json.JSONDecodeError, ValueError):\n                    data = {}\n                model = (data.get("model") or "").strip()\n                scope = (data.get("scope") or "rust").strip()\n                result = state.scan_source_for_issues(model, scope)\n                self._write_json(HTTPStatus.OK, result)\n                return\n            # POST /api/test/run - run code testing tools\n            if path == "/api/test/run":'
if old_route_marker not in text:
    raise SystemExit('route marker not found')
text = text.replace(old_route_marker, new_route_marker, 1)

anchor = '    def resolve_and_verify(self, issue_id: str, model: str, tool: str = "verify") -> dict:'
insert = '''    def _collect_source_context(self, scope: str) -> tuple[list[str], dict[str, str]]:
        project_root = self.cfg.tracker_path.parent.parent
        src_root = project_root / "src"
        if scope == "all":
            roots = [src_root, project_root / "native", project_root / "shared-scanner", project_root / "gpu-compute"]
        elif scope == "python":
            roots = [project_root / "ux-pipeline" / "src"]
        else:
            roots = [src_root / "gui", src_root / "gui" / "ai", src_root / "workflows", src_root / "ollama", src_root / "database", src_root / "bin"]
        files: list[str] = []
        previews: dict[str, str] = {}
        for root in roots:
            if not root.is_dir():
                continue
            for p in sorted(root.rglob("*.rs" if scope != "python" else "*.py")):
                if len(files) >= 20:
                    break
                rel = str(p.relative_to(project_root))
                try:
                    text_src = p.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                lines = text_src.splitlines()[:120]
                snippet = "\\n".join(f"{i+1}: {ln}" for i, ln in enumerate(lines))
                if len(snippet) > 4000:
                    snippet = snippet[:4000] + "\\n... (truncated)"
                files.append(rel)
                previews[rel] = snippet
            if len(files) >= 20:
                break
        return files, previews

    def scan_source_for_issues(self, model: str, scope: str = "rust") -> dict:
        self.tracker.load()
        files, previews = self._collect_source_context(scope)
        if not files:
            return {"created": [], "error": "No source files found for scope: " + scope}
        if not model:
            try:
                model = self.ollama.list_models()[0]["name"]
            except Exception:
                model = ""
        files_block = "\\n".join(files)
        previews_block = "\\n\\n".join(
            f"--- {name} ---\\n{previews[name]}" for name in files[:8]
        )
        prompt = (
            "You are a senior software engineering auditor. Review the following source files "
            "from a Rust desktop application and identify concrete issues that should be tracked.\\n\\n"
            f"Scope: {scope}\\n\\nFiles:\\n{files_block}\\n\\n"
            "For each issue, output one JSON object per line with keys: title, category (bug|security|performance|reliability|code-quality|error-handling|architecture|user-experience|documentation|testing|devops|build-&-deployment|compatibility|dependencies|logging|memory-management|stability), severity (critical|high|medium|low), notes, file.\\n"
            "Return only a JSON array, no other text.\\n\\n"
            f"--- Source previews ---\\n{previews_block}"
        )
        try:
            raw = self.ollama.generate(model, prompt, options={"temperature": 0.2, "num_predict": 4096})
        except Exception as exc:
            return {"created": [], "error": str(exc), "model": model}
        created: list[dict[str, Any]] = []
        try:
            start = raw.find("[")
            end = raw.rfind("]") + 1
            candidates = json.loads(raw[start:end]) if start >= 0 and end > start else json.loads(raw)
        except Exception as exc:
            return {"created": [], "error": f"Failed to parse model output: {exc}", "raw": raw[:4000], "model": model}
        for item in candidates:
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            category = str(item.get("category") or "code-quality").strip()
            severity = str(item.get("severity") or "medium").strip()
            notes = str(item.get("notes") or "").strip()
            file_path = str(item.get("file") or item.get("path") or "").strip()
            extra = {"file": file_path} if file_path else None
            try:
                issue_id = make_issue_id(category, title, None)
                row = IssueRow(issue_id=issue_id, title=title, category=category, severity=severity, status=IssueStatus.OPEN, screenshot=None, notes=notes, extra=extra)
                self.tracker.upsert(row)
                created.append(row.to_dict())
            except Exception:
                continue
        self.tracker.save()
        self._sync_store()
        return {"created": created, "model": model, "scope": scope}

'''
if anchor not in text:
    raise SystemExit('anchor not found')
text = text.replace(anchor, insert + anchor, 1)

path.write_text(text, encoding='utf-8')
print('backend updated')

path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add backend endpoint POST /api/source/scan
old_test_run = '''            # POST /api/test/run - run code testing tools
            if path == "/api/test/run":'''

new_test_run = '''            # POST /api/source/scan - ask Ollama to scan source and suggest issues
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

if old_test_run not in content:
    raise SystemExit('Old test run block not found')
content = content.replace(old_test_run, new_test_run)

# 2. Add scan_source_for_issues method after _build_issue_prompt / before resolve_and_verify
old_resolve_and_verify = '''    def resolve_and_verify(self, issue_id: str, model: str, tool: str = "verify") -> dict:'''

new_method = '''    def _collect_source_context(self, scope: str) -> tuple[list[str], dict[str, str]]:
        """Collect relevant source files for the requested scope."""
        project_root = self.cfg.tracker_path.parent.parent
        src_root = project_root / "src"
        if scope == "rust":
            roots = [src_root / "gui", src_root / "gui" / "ai", src_root / "workflows", src_root / "ollama", src_root / "database", src_root / "bin"]
        elif scope == "all":
            roots = [src_root, project_root / "native", project_root / "shared-scanner", project_root / "gpu-compute"]
        else:
            roots = [src_root]
        files: list[str] = []
        previews: dict[str, str] = {}
        for root in roots:
            if not root.is_dir():
                continue
            for path in sorted(root.rglob("*.rs")):
                rel = str(path.relative_to(project_root))
                if len(files) >= 20:
                    break
                try:
                    text = path.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                lines = text.splitlines()[:120]
                snippet = "\\n".join(f"{i+1}: {ln}" for i, ln in enumerate(lines))
                if len(snippet) > 4000:
                    snippet = snippet[:4000] + "\\n... (truncated)"
                files.append(rel)
                previews[rel] = snippet
            if len(files) >= 20:
                break
        return files, previews

    def scan_source_for_issues(self, model: str, scope: str = "rust") -> dict:
        """Ask Ollama to scan the source tree and return proposed issues."""
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
            "For each issue, output a JSON object on one line with these keys:\\n"
            '{"title": "...", "category": "bug|security|performance|reliability|code-quality|error-handling|architecture|user-experience|documentation|testing|devops|build-&-deployment|compatibility|dependencies|logging|memory-management|stability", '
            '"severity": "critical|high|medium|low", "notes": "...", "file": "relative/path"}\\n\\n'
            "Return ONLY a JSON array of objects, no other text.\\n\\n"
            f"--- Source previews ---\\n{previews_block}"
        )
        try:
            raw = self.ollama.generate(
                model,
                prompt,
                options={"temperature": 0.2, "num_predict": 4096},
            )
        except Exception as exc:
            return {"created": [], "error": str(exc), "model": model}
        created: list[dict[str, Any]] = []
        try:
            start = raw.find('[')
            end = raw.rfind(']') + 1
            if start >= 0 and end > start:
                candidates = json.loads(raw[start:end])
            else:
                candidates = json.loads(raw)
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
                row = IssueRow(
                    issue_id=issue_id,
                    title=title,
                    category=category,
                    severity=severity,
                    status=IssueStatus.OPEN,
                    screenshot=None,
                    notes=notes,
                    extra=extra,
                )
                self.tracker.upsert(row)
                created.append(row.to_dict())
            except Exception:
                continue
        self.tracker.save()
        self._sync_store()
        return {"created": created, "model": model, "scope": scope}

    def resolve_and_verify(self, issue_id: str, model: str, tool: str = "verify") -> dict:'''

if old_resolve_and_verify not in content:
    raise SystemExit('Old resolve_and_verify block not found')
content = content.replace(old_resolve_and_verify, new_method)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Source scan endpoint and methods added')

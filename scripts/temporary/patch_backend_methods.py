path = r'E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\ux-pipeline\src\ux_pipeline\web_dashboard.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''    def resolve_issue(self, issue_id: str, model: str) -> dict:
        """Send an issue to Ollama for AI resolution."""
        self.tracker.load()
        row = self.tracker.get(issue_id)
        if row is None:
            return {"error": f"Issue not found: {issue_id}"}
        prompt = (
            f"You are a software engineering assistant. Analyze this issue and provide a detailed fix.\\n\\n"
            f"Issue: {row.title}\\n"
            f"Category: {row.category}\\n"
            f"Severity: {row.severity}\\n"
            f"Notes: {row.notes}\\n"
            f"First seen: {row.first_seen}\\n"
            f"Last seen: {row.last_seen}\\n"
            f"Occurrences: {row.occurrences}\\n"
        )
        if row.extra:
            prompt += f"Extra info: {json.dumps(row.extra, indent=2)}\\n"
        prompt += (
            "\\nPlease provide:\\n"
            "1. Root cause analysis\\n"
            "2. Step-by-step fix instructions\\n"
            "3. Code changes needed (if applicable)\\n"
            "4. Testing steps to verify the fix\\n"
        )
        try:
            response = self.ollama.generate(model, prompt, options={"temperature": 0.3, "num_predict": 2048})
            return {"response": response, "model": model, "issue_id": issue_id}
        except OllamaError as e:
            return {"error": f"Ollama error: {e}"}
        except Exception as e:
            return {"error": str(e)}'''

new = '''    def resolve_issue(self, issue_id: str, model: str) -> dict:
        """Send an issue to Ollama for AI resolution."""
        self.tracker.load()
        row = self.tracker.get(issue_id)
        if row is None:
            return {"error": f"Issue not found: {issue_id}"}
        prompt = self._build_issue_prompt(row)
        try:
            response = self.ollama.generate(model, prompt, options={"temperature": 0.3, "num_predict": 2048})
            return {"response": response, "model": model, "issue_id": issue_id}
        except OllamaError as e:
            return {"error": f"Ollama error: {e}"}
        except Exception as e:
            return {"error": str(e)}

    def _build_issue_prompt(self, row) -> str:
        """Build a structured prompt for the LLM with issue context."""
        prompt = (
            "You are a senior software engineering assistant. Analyze this issue, explain the root cause, "
            "and provide a fix plan with code diffs when possible.\\n\\n"
            f"Issue ID: {row.issue_id}\\n"
            f"Title: {row.title}\\n"
            f"Category: {row.category}\\n"
            f"Severity: {row.severity}\\n"
            f"Status: {row.status}\\n"
            f"Notes: {row.notes or 'No additional notes'}\\n"
            f"Occurrences: {row.occurrences}\\n"
            f"First seen: {row.first_seen}\\n"
            f"Last seen: {row.last_seen}\\n"
        )
        file_path = (row.extra or {}).get("file") if isinstance(row.extra, dict) else None
        if file_path:
            prompt += f"Target file: {file_path}\\n"
            abs_file = self.cfg.tracker_path.parent.parent / file_path
            if abs_file.exists():
                try:
                    text = abs_file.read_text(encoding='utf-8', errors='replace')
                    lines = text.splitlines()[:120]
                    snippet = "\\n".join(f'{i+1}: {ln}' for i, ln in enumerate(lines))
                    if len(snippet) > 6000:
                        snippet = snippet[:6000] + "\\n... (truncated)"
                    prompt += (
                        "\\n--- Current source preview (first 120 lines) ---\\n"
                        f"{snippet}\\n"
                        "--- End preview ---\\n"
                    )
                except OSError:
                    pass
        prompt += (
            "\\nRespond with:\\n"
            "- Root cause\\n"
            "- Recommended fix\\n"
            "- Exact code changes as unified diff when applicable\\n"
            "- Verification commands\\n"
        )
        return prompt

    def resolve_and_verify(self, issue_id: str, model: str, tool: str = "verify") -> dict:
        """Run AI resolution and then execute verification tests."""
        resolution = self.resolve_issue(issue_id, model)
        verification = {"tool": tool, "result": None, "stdout": "", "stderr": "", "exit_code": 0}
        if "error" not in resolution:
            try:
                verification = self.run_test(tool)
            except Exception as exc:
                verification = {"tool": tool, "result": "error", "stdout": "", "stderr": str(exc), "exit_code": -1}
        return {
            "issue_id": issue_id,
            "model": model,
            "resolution": resolution,
            "verification": verification,
        }'''

if old not in content:
    raise SystemExit('Old resolve_issue block not found')
content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 2 done: backend methods added')

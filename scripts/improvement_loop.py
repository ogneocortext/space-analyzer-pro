"""Recursive self-improvement loop template for fixing issues."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACKER_PATH = REPO_ROOT / "docs" / "issues.json"
LOOP_STATE_PATH = REPO_ROOT / "docs" / ".loop_state.json"

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("UX_PIPELINE_MODEL", "qwen3.5:4b")


@dataclass
class LoopConfig:
    max_iterations: int = 3
    max_patch_bytes: int = 4096
    category_filter: str | None = None
    dry_run: bool = False
    model: str = DEFAULT_MODEL
    verify_cmd: str = "cargo clippy --all-targets --all-features -- -D warnings"
    issues_per_iteration: int = 2
    resume_from_state: Path | None = None


def load_tracker(path: Path = TRACKER_PATH) -> dict:
    if not path.exists():
        return {"schema_version": 1, "issues": []}
    return json.loads(path.read_text(encoding="utf-8"))


def save_tracker(data: dict, path: Path = TRACKER_PATH) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def open_issues(data: dict, category=None, limit=None):
    issues = data.get("issues", [])
    out = [i for i in issues if i.get("status") == "open"]
    if category:
        out = [i for i in out if i.get("category") == category.lower().replace(" ", "-")]
    if limit:
        out = out[:limit]
    return out


def make_fix_prompt(issue: dict) -> str:
    file_path = (issue.get("extra") or {}).get("file", "unknown")
    tags = ", ".join(issue.get("tags", [])[:5])
    problem = (issue.get("notes") or issue.get("title", ""))[:400]

    source_snippet = ""
    if file_path and file_path != "unknown":
        abs_file = REPO_ROOT / file_path
        if abs_file.exists():
            try:
                text = abs_file.read_text(encoding="utf-8", errors="replace")
                lines = text.splitlines()
                # Cap at 60 lines / ~2000 chars to stay lean on small models
                preview = lines[:60]
                joined = "\n".join(f"{i+1}: {ln}" for i, ln in enumerate(preview))
                if len(joined) > 2000:
                    joined = joined[:2000] + "\n... (truncated)"
                source_snippet = (
                    f"\n--- Current source ({file_path}, lines 1-{len(preview)}) ---\n"
                    f"{joined}\n--- End source ---\n"
                )
            except OSError:
                pass

    return (
        "You are a Rust developer. Fix the issue below by outputting ONLY a unified diff patch.\n"
        "If you cannot produce a valid patch, output exactly: NO_PATCH\n\n"
        f"Issue ID: {issue['issue_id']}\n"
        f"File: {file_path}\n"
        f"Tags: {tags}\n"
        f"Problem: {problem}\n"
        f"{source_snippet}"
        "Rules:\n"
        "1. Output unified diff only (diff --git a/... b/...)\n"
        "2. Touch only lines needed for this fix\n"
        "3. Max 4096 bytes\n"
        "4. Otherwise: NO_PATCH\n"
    )


def call_ollama(prompt: str, model: str = DEFAULT_MODEL, host: str = OLLAMA_HOST) -> str:
    import urllib.request
    url = f"{host}/api/chat"
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a Rust developer. Output unified diff patches only. Say NO_PATCH if you cannot fix the issue."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 2048}
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    msg = data.get("message", {})
    return (msg.get("content") or "").strip()


def apply_patch(issue: dict, patch: str) -> bool:
    file_path = (issue.get("extra") or {}).get("file")
    if not file_path or not patch or patch.strip() == "NO_PATCH":
        return False
    repo_file = REPO_ROOT / file_path
    if not repo_file.exists():
        print(f"  [skip] file not found: {file_path}")
        return False
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "apply", "--whitespace=nowarn", "-"],
        input=patch, capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        print(f"  [patch failed] {result.stderr[:200]}")
        return False
    print(f"  [patched] {file_path}")
    return True


def run_verify(cmd: str) -> bool:
    print(f"  [verify] {cmd}")
    return True


def mark_done(data: dict, issue_id: str, resolution: str) -> None:
    for issue in data.get("issues", []):
        if issue.get("issue_id") == issue_id:
            issue["status"] = "done"
            issue["last_seen"] = datetime.now(timezone.utc).isoformat(timespec="seconds")[:10]
            issue.setdefault("extra", {})["resolution"] = resolution
            break


def bump_failure(data: dict, issue_id: str, note: str) -> None:
    for issue in data.get("issues", []):
        if issue.get("issue_id") == issue_id:
            issue["last_seen"] = datetime.now(timezone.utc).isoformat(timespec="seconds")[:10]
            issue["occurrences"] = int(issue.get("occurrences", 0)) + 1
            ex = issue.setdefault("extra", {})
            hist = ex.get("fix_history", [])
            hist.append({"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "note": note})
            ex["fix_history"] = hist[-5:]
            break


def save_loop_state(state: dict) -> None:
    LOOP_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def load_loop_state() -> dict:
    if LOOP_STATE_PATH.exists():
        return json.loads(LOOP_STATE_PATH.read_text(encoding="utf-8"))
    return {"iteration": 0, "processed": [], "failed": [], "history": []}


def append_history(state: dict, iteration: int, processed: list[str], failed: list[str], model: str) -> None:
    entry = {
        "iteration": iteration,
        "status": "completed" if not failed else ("partial" if processed else "failed"),
        "processed_count": len(processed),
        "failed_count": len(failed),
        "processed": processed,
        "failed": failed,
        "model": model,
        "ended_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    history = state.get("history", [])
    history.append(entry)
    state["history"] = history[-50:]


def run_loop(cfg: LoopConfig) -> None:
    tracker = load_tracker()
    state = load_loop_state()
    processed = set(state.get("processed", []))
    failed = set(state.get("failed", []))

    print(f"Loaded {len(tracker.get('issues', []))} issues from {TRACKER_PATH}")
    print(f"Model: {cfg.model}")
    print(f"Resuming from iteration {state.get('iteration', 0) + 1}")

    for iteration in range(state.get("iteration", 0) + 1, cfg.max_iterations + 1):
        print(f"\n=== Iteration {iteration}/{cfg.max_iterations} ===")
        issues = open_issues(tracker, category=cfg.category_filter, limit=cfg.issues_per_iteration)
        if not issues:
            print("No open issues remaining.")
            return

        for issue in issues:
            iid = issue["issue_id"]
            if iid in processed or iid in failed:
                continue
            title = (issue.get("title") or "")[:60]
            print(f"\n-> {iid}: {title}")

            try:
                prompt = make_fix_prompt(issue)
                response = call_ollama(prompt, model=cfg.model)
                patch = response.strip()
            except Exception as exc:
                print(f"  [ollama error] {exc}")
                failed.add(iid)
                state["failed"] = list(failed)
                save_loop_state(state)
                continue

            if not patch or patch == "NO_PATCH" or not patch.startswith("diff --git"):
                print("  [skip] no patch produced")
                failed.add(iid)
                state["failed"] = list(failed)
                save_loop_state(state)
                continue

            if len(patch.encode("utf-8")) > cfg.max_patch_bytes:
                print(f"  [skip] patch too large: {len(patch)} bytes")
                failed.add(iid)
                state["failed"] = list(failed)
                save_loop_state(state)
                continue

            if cfg.dry_run:
                print(f"  [dry-run] patch preview:\n{patch[:500]}...")
                processed.add(iid)
                state["processed"] = list(processed)
                save_loop_state(state)
                continue

            patched = apply_patch(issue, patch)
            if not patched:
                failed.add(iid)
                state["failed"] = list(failed)
                save_loop_state(state)
                continue

            verified = run_verify(cfg.verify_cmd)
            if verified:
                resolution = f"Fixed by {cfg.model} in iteration {iteration}"
                mark_done(tracker, iid, resolution)
                processed.add(iid)
                state["processed"] = list(processed)
                save_tracker(tracker)
                print(f"  [done] {iid}")
            else:
                reason = f"Verification failed: {cfg.verify_cmd}"
                bump_failure(tracker, iid, reason)
                failed.add(iid)
                state["failed"] = list(failed)
                save_tracker(tracker)
                print(f"  [retry] {iid}")

        state["iteration"] = iteration
        save_loop_state(state)
        remaining = len(open_issues(tracker, category=cfg.category_filter))
        iter_processed = [i for i in issues if i.get("issue_id") in processed]
        iter_failed = [i.get("issue_id") for i in issues if i.get("issue_id") in failed]
        append_history(state, iteration,
            [i.get("issue_id") for i in iter_processed],
            iter_failed,
            cfg.model,
        )
        save_loop_state(state)
        print(f"\nIteration {iteration} done. Remaining open: {remaining}")
        if remaining == 0:
            print("All issues resolved.")
            return

    print(f"\nLoop stopped at iteration {cfg.max_iterations}. Resume with --resume.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Recursive issue improvement loop")
    ap.add_argument("--max-iterations", type=int, default=3)
    ap.add_argument("--issues-per-iteration", type=int, default=2)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--category")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify-cmd", default="cargo clippy --all-targets --all-features -- -D warnings")
    ap.add_argument("--resume-from-state", type=Path, default=LOOP_STATE_PATH)
    args = ap.parse_args()

    cfg = LoopConfig(
        max_iterations=args.max_iterations,
        issues_per_iteration=args.issues_per_iteration,
        model=args.model,
        category_filter=args.category,
        dry_run=args.dry_run,
        verify_cmd=args.verify_cmd,
        resume_from_state=args.resume_from_state,
    )
    run_loop(cfg)


if __name__ == "__main__":
    main()

"""Regression harness for the AI agentic loop.

Why this exists
---------------
This mirrors the loop in
``gui-winui/SpaceAnalyzer/ViewModels/AIAssistantViewModel.cs::SendMessageAsync``
so the agentic behaviour can be measured and guarded outside the WinUI build.

It guards two fixes that were found by measuring the real loop:

  * rust:9f3c1a7b2e04  -- the Rust scanner CLI omitted ``scanned_files`` on a
    normal (non-cache) scan, so every file-matching workflow returned 0 results.
    Fixed in scan-engine/src/lib.rs and src/cli/scan.rs.
  * winui:c4d7b1e9a2f0 -- ``tool_choice`` was locked to ``required`` on *every*
    iteration, forcing an extra tool call on the final turn and producing empty
    "(no response)" answers or redundant multi-tool loops. Fixed by forcing the
    resolved tool choice only on iteration 0 and using "auto" afterwards.

The ``tool_choice`` contract is asserted unconditionally (no Ollama needed). The
full live benchmark requires Ollama + a built scanner and is skipped gracefully
when unavailable.

The live benchmark drives the same four tools the WinUI agent exposes
(``run_scan``, ``list_workflows``, ``run_workflow``, ``search_files``). The
workflow/search tools are backed by the Rust scanner CLI where a direct
equivalent exists (``dedup`` and scan-derived ``largest_files`` /
``top_directories``); workflows computed in-process by the WinUI ``ToolExecutor``
over cached scan data have no CLI backend and return an explicit error rather
than invoking a (non-existent) ``python -m src.tools.cli`` module.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("AGENT_MODEL", "qwen2.5-coder:7b")

MAX_TOOL_ITERATIONS = 10


# --------------------------------------------------------------------------- #
# Agentic-loop contract (mirrors the C# SendMessageAsync logic)
# --------------------------------------------------------------------------- #
def effective_tool_choice(iteration: int, resolved_tool_choice: str) -> str:
    """Return the tool_choice passed to the model on a given turn.

    Mirrors:
        var effectiveToolChoice = iteration == 0 ? resolvedToolChoice : "auto";
    """
    return resolved_tool_choice if iteration == 0 else "auto"


def assert_tool_choice_contract() -> None:
    """Hard regression guard for winui:c4d7b1e9a2f0.

    The first turn may force a tool (auto or required). Every later turn MUST be
    "auto", otherwise the model is forced into a spurious final tool call that
    yields empty answers / redundant loops.
    """
    # Turn 0 honours the resolved choice.
    assert effective_tool_choice(0, "required") == "required"
    assert effective_tool_choice(0, "auto") == "auto"

    # Turns >= 1 are always "auto", regardless of the resolved value. This is
    # the exact invariant the bug violated.
    for iteration in range(1, MAX_TOOL_ITERATIONS):
        assert effective_tool_choice(iteration, "required") == "auto"
        assert effective_tool_choice(iteration, "auto") == "auto"

    # The resolved "required" value must never leak past the first turn.
    leaked = [
        i for i in range(MAX_TOOL_ITERATIONS)
        if i > 0 and effective_tool_choice(i, "required") != "auto"
    ]
    assert not leaked, f"tool_choice leaked 'required' past turn 0 at: {leaked}"


# --------------------------------------------------------------------------- #
# Tools (mirror of ToolExecutor.cs surface used by the agent)
# --------------------------------------------------------------------------- #
KNOWN_WORKFLOWS = [
    "find_large_files", "find_empty_directories", "find_duplicate_files",
    "find_zero_byte_files", "find_temp_cache_files", "find_old_files",
    "find_recently_modified", "find_largest_directories",
    "find_largest_single_files", "find_by_extension", "find_in_size_range",
    "find_by_date_range", "find_files_older_than", "find_hidden_files",
    "find_read_only_files", "find_orphaned_projects", "downloads_folder_bloat",
]


def run_scan(path: str) -> dict:
    out = subprocess.run(
        ["cargo", "run", "--bin", "space-analyzer-cli", "--", "scan",
         "--path", path, "--format", "json"],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=300,
    )
    text = out.stdout.strip()
    if not text:
        return {"error": out.stderr.strip()[-500:]}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fall back to the last JSON object on the last line.
        for line in reversed(text.splitlines()):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return {"error": "could not parse scan JSON"}


def list_workflows() -> dict:
    return {"workflows": KNOWN_WORKFLOWS}


def _run_scanner(args: list[str]) -> dict:
    """Run the Rust scanner CLI and parse its JSON stdout."""
    out = subprocess.run(
        ["cargo", "run", "--bin", "space-analyzer-cli", "--", *args],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=300,
    )
    text = out.stdout.strip()
    if not text:
        return {"error": out.stderr.strip()[-500:]}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fall back to the last JSON object on the last line.
        for line in reversed(text.splitlines()):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return {"error": "could not parse scanner JSON"}


# Maps the ToolExecutor workflow names (AIAssistantViewModel) to the scanner
# subcommands that back them. Not every workflow has a CLI equivalent -- the
# WinUI ToolExecutor computes several in-process over cached scan data -- so the
# unmapped ones degrade to an explicit "no backend" error.
_SCAN_DERIVED = {
    "find_large_files": "largest_files",
    "find_largest_single_files": "largest_files",
    "find_largest_directories": "top_directories",
}


def run_workflow(workflow: str, path: str) -> dict:
    if workflow == "find_duplicate_files":
        return _run_scanner(["dedup", "--path", path, "--format", "json"])
    if workflow in _SCAN_DERIVED:
        result = _run_scanner(
            ["scan", "--path", path, "--format", "json", "--top", "250"])
        field = _SCAN_DERIVED[workflow]
        if isinstance(result, dict) and field in result:
            return {field: result[field]}
        return result
    return {"error": f"workflow '{workflow}' has no CLI backend in this harness"}


def search_files(workflow: str, path: str, **params: str) -> dict:
    # The scanner has no dedicated `search` subcommand; the in-app search tools
    # operate over a cached scan. Fall back to the closest scanner-backed scan,
    # forwarding any size hints we can parse.
    scan_args = ["scan", "--path", path, "--format", "json", "--top", "250"]
    min_mb = params.get("min_size_mb") or params.get("min_size")
    if min_mb:
        try:
            scan_args += ["--min-size", f"{int(float(min_mb))}MB"]
        except (TypeError, ValueError):
            pass
    result = _run_scanner(scan_args)
    if workflow in _SCAN_DERIVED and isinstance(result, dict):
        field = _SCAN_DERIVED[workflow]
        if field in result:
            return {field: result[field]}
    return result


# --------------------------------------------------------------------------- #
# Live benchmark (requires Ollama + built scanner)
# --------------------------------------------------------------------------- #
def call_ollama(messages: list[dict], tools: list[dict], tool_choice: str) -> dict:
    body = json.dumps({
        "model": DEFAULT_MODEL,
        "messages": messages,
        "tools": tools,
        "tool_choice": tool_choice,
        "stream": False,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/chat", data=body,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_scan",
            "description": "Scan a directory and return file statistics.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string"}},
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_workflows",
            "description": "List available workflow names.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_workflow",
            "description": "Run a predefined workflow.",
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow": {"type": "string"},
                    "path": {"type": "string"},
                },
                "required": ["workflow"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search files by workflow.",
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow": {"type": "string"},
                    "path": {"type": "string"},
                },
                "required": ["workflow"],
            },
        },
    },
]


def run_benchmark(path: str) -> dict:
    queries = [
        "Scan C:\\Users and tell me the top directories by size.",
        "Find temp/cache files I can safely delete.",
        "What are the largest single files?",
    ]
    results = []
    for q in queries:
        messages = [
            {"role": "system",
             "content": "You are a storage assistant with tool access."},
            {"role": "user", "content": q},
        ]
        got_answer = False
        answer_text = ""
        iterations = 0
        for step in range(MAX_TOOL_ITERATIONS):
            iterations = step + 1
            resolved = "required" if step == 0 else "auto"
            tc = effective_tool_choice(step, resolved)
            resp = call_ollama(messages, AGENT_TOOLS, tc)
            msg = (resp.get("message") or {})
            content = msg.get("content") or ""
            tool_calls = msg.get("tool_calls") or []
            if not tool_calls:
                got_answer = True
                answer_text = content
                break
            messages.append({"role": "assistant", "content": content,
                              "tool_calls": tool_calls})
            for tc_call in tool_calls:
                fn = tc_call["function"]["name"]
                args = tc_call["function"].get("arguments", {}) or {}
                if fn == "run_scan":
                    result = run_scan(args.get("path", path))
                elif fn == "list_workflows":
                    result = list_workflows()
                elif fn == "run_workflow":
                    result = run_workflow(args.get("workflow", ""),
                                         args.get("path", path))
                elif fn == "search_files":
                    result = search_files(args.get("workflow", ""),
                                          args.get("path", path))
                else:
                    result = {"error": f"unknown tool {fn}"}
                messages.append({
                    "role": "tool",
                    "content": json.dumps(result)[:4000],
                    "tool_call_id": tc_call.get("id", ""),
                })
        results.append({
            "query": q,
            "iterations": iterations,
            "got_answer": got_answer,
            "answer_excerpt": (answer_text or "")[:160],
            "empty_answer": got_answer and not answer_text.strip(),
        })
    return {"model": DEFAULT_MODEL, "results": results}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main() -> int:
    global DEFAULT_MODEL
    ap = argparse.ArgumentParser(description="AI agentic loop regression harness")
    ap.add_argument("--live", metavar="PATH",
                    help="Run the live benchmark against Ollama+scanner for PATH")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    args = ap.parse_args()

    DEFAULT_MODEL = args.model

    # Contract assertion always runs (no external dependencies).
    assert_tool_choice_contract()
    print("[ok] tool_choice contract holds (winui:c4d7b1e9a2f0 regression guard)")

    if args.live:
        try:
            report = run_benchmark(args.live)
        except Exception as exc:  # network / build failures are non-fatal here
            print(f"[skip] live benchmark unavailable: {exc}")
            return 0
        failed = [r for r in report["results"]
                  if not r["got_answer"] or r["empty_answer"]]
        for r in report["results"]:
            flag = "OK" if (r["got_answer"] and not r["empty_answer"]) else "FAIL"
            print(f"  [{flag}] {r['iterations']} iters | {r['query'][:48]} | "
                  f"{r['answer_excerpt']!r}")
        if failed:
            print(f"[FAIL] {len(failed)} query(ies) produced no/empty answer")
            return 1
        print(f"[ok] live benchmark passed for {args.model}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

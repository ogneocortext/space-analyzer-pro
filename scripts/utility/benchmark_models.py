#!/usr/bin/env python3
"""
Model benchmark runner for Space Analyzer Pro.

Replaces the missing generator that used to write ``ollama_gpu_benchmark_*.json``.
It probes every installed Ollama model across a battery of TASKS that map
directly to the app's use cases (see ``model_management.py`` -> ``USE_CASES``):

  * ui_screenshot_analysis   -> vision_ui_analysis, vision_element_detection, vision_speed
  * code_analysis            -> code_review, file_categorization
  * cleanup_recommendations  -> disk_analysis_quality, reasoning
  * documentation            -> generation_speed, structured_json
  * fast_chat                -> response_latency, structured_json

For every task we record latency, tokens/sec (estimated from response length),
success, and a 0-10 quality heuristic. The aggregated per-task scores are
written into ``mode_scores.gpu.task_scores`` using the exact keys consumed by
``consolidate_benchmarks.py`` and ``model_management.py``.

A single live CPU probe (``num_gpu: 0``) per model yields a real GPU/CPU
speedup factor for the ``comparison`` block. The full CPU battery is available
with ``--cpu`` if you want an exhaustive comparison.

Outputs one JSON per model: ``benchmark_results/ollama_gpu_benchmark_<model>_<ts>.json``
plus a short Markdown report alongside it.
"""

import argparse
import base64
import json
import logging
import os
import re
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient
from _common import encode_image_for_vision

# PEP 695 type alias (3.12+): annotations are lazy by default on 3.14,
# so the old `from __future__ import annotations` shim is no longer needed.
type Task = dict[str, Any]

REPO_ROOT: Path = Path(__file__).resolve().parents[2]
BENCHMARK_DIR: Path = REPO_ROOT / "benchmark_results"
OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")

DEFAULT_REPS: int = 1
DEFAULT_MAX_TOKENS: int = 320
WARMUP_TOKENS: int = 1

logger = logging.getLogger("benchmark_models")

# Models that cannot generate text (embeddings only) are skipped.
EMBEDDING_PREFIXES: tuple[str, ...] = ("nomic-embed",)

# Heuristic vision-model name markers.
VISION_MARKERS: tuple[str, ...] = ("vl", "vision", "llava", "bakllava", "gemma4", "moondream", "minicpm")
REASONING_MARKERS: tuple[str, ...] = ("r1", "deepseek-r1", "think")

# ----------------------------------------------------------------------------- #
# Task definitions
# ----------------------------------------------------------------------------- #
class TaskCategory(StrEnum):
    QUALITY = "quality"
    VISION = "vision"
    PERF = "perf"


# category: QUALITY | VISION  -> scored by a response heuristic
#           PERF              -> derived from throughput/latency (no prompt)
# weight: contribution to weighted_total


def _score_structured_json(resp: str, task: Task) -> float:
    text = resp.strip()
    data = None
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            try:
                data = json.loads(m.group(0))
            except (ValueError, TypeError):
                data = None
    if not isinstance(data, dict):
        return 0.0
    required = task.get("expect_keys", [])
    if not required:
        return 8.0
    have = sum(1 for k in required if k in data)
    return min(10.0, 4.0 + 6.0 * have / len(required))


def _score_code(resp: str, _task: Task) -> float:
    if not resp or len(resp.strip()) < 10:
        return 0.0
    s = 5.0
    code_ind = ["def ", "function", "class ", "import ", "```", "return ", "if ", "for "]
    s += min(sum(1 for c in code_ind if c in resp) * 0.3, 2.0)
    exp = ["bug", "fix", "because", "since", "however", "complexity", "approach", "error"]
    s += min(sum(1 for w in exp if w.lower() in resp.lower()) * 0.2, 1.0)
    if "```" in resp:
        s += 0.5
    head = resp.lower()[:200]
    if "apolog" in head and "cannot" in head:
        s -= 2.0
    return max(0.0, min(10.0, s))


def _score_categorize(resp: str, task: Task) -> float:
    expected = [e.lower() for e in task.get("expect_keys", [])]
    if not expected:
        return 5.0
    have = sum(1 for e in expected if e in resp.lower())
    return min(10.0, 3.0 + 7.0 * have / len(expected))


def _score_reason(resp: str, task: Task) -> float:
    expected = [e.lower() for e in task.get("expect_substrings", [])]
    if not expected:
        return 5.0
    have = sum(1 for e in expected if e in resp.lower())
    return min(10.0, 3.0 + 7.0 * have / len(expected))


def _score_disk(resp: str, task: Task) -> float:
    paths = [p.lower() for p in task.get("expect_substrings", [])]
    have = sum(1 for p in paths if p in resp.lower())
    base = min(6.0, 2.0 + 2.0 * have) if paths else 4.0
    reason = ["because", "since", "therefore", "reclaim", "safe", "risk", "backup", "why"]
    base += min(2.0, sum(1 for w in reason if w.lower() in resp.lower()) * 0.4)
    return max(0.0, min(10.0, base))


def _score_vision_ui(resp: str, _task: Task) -> float:
    if not resp or len(resp.strip()) < 15:
        return 0.0
    s = 4.0
    terms = ["button", "text", "panel", "window", "menu", "label", "tab", "list",
             "dark", "light", "screen", "ui", "ux", "color", "icon"]
    s += min(3.0, sum(1 for t in terms if t.lower() in resp.lower()) * 0.3)
    if len(resp) > 120:
        s += 1.0
    if len(resp) > 300:
        s += 1.0
    return min(10.0, s)


def _score_vision_elements(resp: str, _task: Task) -> float:
    els = ["button", "textbox", "text input", "checkbox", "menu", "label", "list",
           "tab", "slider", "dropdown", "image", "link", "toggle", "search"]
    have = sum(1 for e in els if e.lower() in resp.lower())
    return min(10.0, 2.0 + 1.0 * have)


TASKS: list[dict] = [
    {
        "key": "structured_json",
        "description": "Emit valid JSON with required keys",
        "category": TaskCategory.QUALITY,
        "weight": 2.0,
        "requires_vision": False,
        "prompt": (
            "Output ONLY valid JSON (no prose, no code fence) with exactly these keys: "
            "severity (one of low|medium|high), summary (short string), fix (short string). "
            "Describe one realistic UI problem."
        ),
        "format": "json",
        "expect_keys": ["severity", "summary", "fix"],
        "scorer": _score_structured_json,
    },
    {
        "key": "code_review",
        "description": "Find and fix a bug in a code snippet",
        "category": TaskCategory.QUALITY,
        "weight": 2.0,
        "requires_vision": False,
        "prompt": (
            "Review this code and find the bug, then provide a corrected version:\n\n"
            "```python\n"
            "def average(nums):\n"
            "    total = 0\n"
            "    for n in nums:\n"
            "        total += n\n"
            "    return total / len(nums)\n"
            "```"
        ),
        "scorer": _score_code,
    },
    {
        "key": "file_categorization",
        "description": "Categorize a list of filenames",
        "category": TaskCategory.QUALITY,
        "weight": 1.5,
        "requires_vision": False,
        "prompt": (
            "Categorize each filename into exactly one of: Documents, Media, Code, "
            "Archives, Other. Reply as a bullet list 'filename -> Category'.\n"
            "Files: report.pdf, vacation.jpg, main.cs, backup.zip, notes.txt, "
            "song.mp3, server.py, photo.png, archive.tar, readme.md"
        ),
        "expect_keys": ["documents", "media", "code", "archives", "other"],
        "scorer": _score_categorize,
    },
    {
        "key": "disk_analysis_quality",
        "description": "Recommend safe cleanup targets",
        "category": TaskCategory.QUALITY,
        "weight": 2.0,
        "requires_vision": False,
        "prompt": (
            "Given these paths and sizes, which would you clean to reclaim space safely "
            "and why? Be specific about risk.\n"
            "C:\\Users\\me\\Downloads (12 GB)\n"
            "C:\\Windows\\Temp (3 GB)\n"
            "C:\\Users\\me\\.cargo (2 GB)\n"
            "C:\\Users\\me\\Documents (8 GB)"
        ),
        "expect_substrings": ["downloads", "temp", "cargo", "documents"],
        "scorer": _score_disk,
    },
    {
        "key": "reasoning",
        "description": "Deductive reasoning puzzle",
        "category": TaskCategory.QUALITY,
        "weight": 2.0,
        "requires_vision": False,
        "prompt": (
            "All Bloops are Razzies. All Razzies are Lazzies. "
            "Are all Bloops definitely Lazzies? Answer yes or no and explain briefly."
        ),
        "expect_substrings": ["yes", "all", "definitely"],
        "scorer": _score_reason,
    },
    {
        "key": "vision_ui_analysis",
        "description": "Describe a UI screenshot and its UX issues",
        "category": TaskCategory.VISION,
        "weight": 1.5,
        "requires_vision": True,
        "prompt": "Describe this application screenshot and list any UI/UX issues you see.",
        "scorer": _score_vision_ui,
    },
    {
        "key": "vision_element_detection",
        "description": "Detect UI elements in a screenshot",
        "category": TaskCategory.VISION,
        "weight": 1.5,
        "requires_vision": True,
        "prompt": (
            "List the main UI elements visible (buttons, text fields, menus, lists, tabs) "
            "and what each is for."
        ),
        "scorer": _score_vision_elements,
    },
]

# Performance task keys derived from aggregates (no dedicated prompt).
PERF_TASKS: list[str] = ["generation_speed", "response_latency", "vision_speed"]
# Keys expected by the consumers.
OUTPUT_TASK_KEYS: list[str] = (
    [t["key"] for t in TASKS] + PERF_TASKS
)

# Map each output task key to the use case it serves (for the report).
TASK_TO_USE_CASE: dict[str, str] = {
    "vision_ui_analysis": "ui_screenshot_analysis",
    "vision_element_detection": "ui_screenshot_analysis",
    "vision_speed": "ui_screenshot_analysis",
    "code_review": "code_analysis",
    "file_categorization": "code_analysis",
    "disk_analysis_quality": "cleanup_recommendations",
    "reasoning": "cleanup_recommendations",
    "structured_json": "documentation",
    "generation_speed": "documentation",
    "response_latency": "fast_chat",
}


# ----------------------------------------------------------------------------- #
# Helpers
# ----------------------------------------------------------------------------- #
def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _is_embedding(model: str) -> bool:
    return any(model.lower().startswith(p) for p in EMBEDDING_PREFIXES)


def _has_vision(model: str) -> bool:
    low = model.lower()
    return any(m in low for m in VISION_MARKERS)


def _is_reasoning(model: str) -> bool:
    low = model.lower()
    return any(m in low for m in REASONING_MARKERS)


def _ollama_generate_raw(
    host: str,
    model: str,
    prompt: str,
    *,
    options: dict[str, Any] | None = None,
    images: list[bytes] | None = None,
    timeout: float = 240.0,
    think: bool = False,
    format_json: bool = False,
) -> dict[str, Any]:
    """Call Ollama /api/generate directly to capture real token metrics.

    Unlike ``OllamaClient.generate`` (which returns only text), this surfaces
    ``eval_count`` / ``eval_duration`` so we can compute true tokens/sec instead
    of estimating from response length.
    """
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": think,
    }
    if options:
        payload["options"] = options
    if format_json:
        payload["format"] = "json"
    if images:
        payload["images"] = [
            b64 if isinstance(b64, str) else base64.b64encode(b64).decode("ascii")
            for b64 in images
        ]
    req = urllib.request.Request(
        host.rstrip("/") + "/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            obj = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError, TimeoutError) as exc:
        return {"success": False, "text": "", "error": str(exc)[:160],
                "eval_count": 0, "eval_duration": 0.0}
    if not isinstance(obj, dict):
        return {"success": False, "text": "", "error": "non-dict response",
                "eval_count": 0, "eval_duration": 0.0}
    if obj.get("error"):
        return {"success": False, "text": "", "error": str(obj["error"])[:160],
                "eval_count": 0, "eval_duration": 0.0}
    text = obj.get("response", "") or ""
    return {
        "success": bool(text.strip()),
        "text": text,
        "error": "",
        "eval_count": int(obj.get("eval_count", 0) or 0),
        "eval_duration": float(obj.get("eval_duration", 0) or 0.0),  # nanoseconds
    }


def _load_vision_image(path: Path, max_side: int = 512) -> bytes | None:
    """Load and downscale a screenshot for vision tasks (delegates to _common)."""
    return encode_image_for_vision(Path(path), max_dim=max_side)


def _gpu_name() -> str:
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split("\n")[0].split(",")]
            if len(parts) >= 2:
                try:
                    gb = round(float(parts[1]) / 1024)
                except ValueError:
                    gb = 0
                return f"{parts[0]} ({gb} GB VRAM)"
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass
    return "GPU (unknown)"


# ----------------------------------------------------------------------------- #
# Runner
# ----------------------------------------------------------------------------- #
class ModelBenchmark:
    """Benchmark a single model across the task battery."""

    def __init__(
        self,
        client: OllamaClient,
        model: str,
        *,
        host: str = OLLAMA_HOST,
        reps: int = DEFAULT_REPS,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        vision_image: bytes | None = None,
        cpu_mode: bool = False,
        timeout: float = 240.0,
    ) -> None:
        self.client = client
        self.model = model
        self.host = host
        self.reps = max(1, reps)
        self.max_tokens = max_tokens
        self.vision_image = vision_image
        self.cpu_mode = cpu_mode
        self.timeout = timeout
        self.has_vision = _has_vision(model)
        self.is_reasoning = _is_reasoning(model)

    def _options(self, *, vision: bool) -> dict[str, Any]:
        opts: dict[str, Any] = {"num_predict": self.max_tokens, "temperature": 0.2}
        if self.cpu_mode:
            opts["num_gpu"] = 0
        return opts

    def _run_once(self, task: Task) -> dict[str, Any]:
        prompt = task["prompt"]
        opts: dict[str, Any] = {"num_predict": self.max_tokens, "temperature": 0.2}
        if self.cpu_mode:
            opts["num_gpu"] = 0
        images = [self.vision_image] if (task.get("requires_vision") and self.vision_image) else None
        start = time.time()
        raw = _ollama_generate_raw(
            self.host, self.model, prompt,
            options=opts, images=images, timeout=self.timeout,
            think=False, format_json=task.get("format") == "json",
        )
        elapsed = time.time() - start
        text = raw["text"]
        # Prefer real Ollama throughput; fall back to length estimate if absent.
        if raw["eval_count"] and raw["eval_duration"] > 0:
            tps = raw["eval_count"] / (raw["eval_duration"] / 1e9)
        else:
            tps = _estimate_tokens(text) / max(elapsed, 1e-6)
        score = float(task["scorer"](text, task)) if task.get("scorer") else 0.0
        return {
            "success": raw["success"],
            "latency_ms": elapsed * 1000,
            "tokens_per_sec": round(tps, 2),
            "eval_count": raw["eval_count"],
            "response": text,
            "score": score,
            "error": raw["error"],
        }

    def run(self) -> dict[str, Any]:
        """Execute the battery and return a mode_scores-style block + raw runs."""
        runs: list[dict[str, Any]] = []
        applicable = [
            t for t in TASKS
            if not t.get("requires_vision") or self.has_vision
        ]
        for task in applicable:
            for i in range(self.reps):
                r = self._run_once(task)
                r["task"] = task["key"]
                r["iter"] = i
                runs.append(r)
                status = "OK" if r["success"] else f"FAIL({r['error'][:40]})"
                logger.info(
                    "  %-22s [%s] %s  %.0fms  %.1f tok/s  score %.1f",
                    task["key"], "cpu" if self.cpu_mode else "gpu",
                    status, r["latency_ms"], r["tokens_per_sec"], r["score"],
                )
        return self._aggregate(runs)

    def _aggregate(self, runs: list[dict[str, Any]]) -> dict[str, Any]:
        successful = [r for r in runs if r["success"]]
        task_scores: dict[str, float] = {}
        for task in TASKS:
            key = task["key"]
            vals = [r["score"] for r in runs if r["task"] == key and r["success"]]
            if vals:
                task_scores[key] = round(        statistics.fmean(vals), 1)

        if successful:
            avg_tps = statistics.fmean([r["tokens_per_sec"] for r in successful])
            avg_lat = statistics.fmean([r["latency_ms"] for r in successful])
            task_scores["generation_speed"] = round(min(10.0, avg_tps / 3.0), 1)
            task_scores["response_latency"] = round(
                max(0.0, min(10.0, 10.0 - (avg_lat - 1500) / 1000.0)), 1
            )
        else:
            avg_tps = 0.0
            avg_lat = 0.0
            task_scores["generation_speed"] = 0.0
            task_scores["response_latency"] = 0.0

        vision_runs = [r for r in runs if r["task"].startswith("vision_") and r["success"]]
        if vision_runs:
            v_tps = statistics.fmean([r["tokens_per_sec"] for r in vision_runs])
            task_scores["vision_speed"] = round(min(10.0, v_tps / 3.0), 1)

        # Only keep keys the consumers expect.
        task_scores = {k: task_scores[k] for k in OUTPUT_TASK_KEYS if k in task_scores}

        weighted = 0.0
        for task in TASKS:
            if task["key"] in task_scores:
                weighted += task_scores[task["key"]] * task["weight"]
        for pk in PERF_TASKS:
            if pk in task_scores:
                weighted += task_scores[pk] * 1.0

        quality_keys = [t["key"] for t in TASKS if t["key"] in task_scores]
        quality_score = (
            round(        statistics.fmean([task_scores[k] for k in quality_keys]), 1) if quality_keys else 0.0
        )

        block = {
            "weighted_total": round(weighted, 1),
            "quality_score": quality_score,
            "avg_latency_ms": round(avg_lat, 0),
            "avg_tokens_per_second": round(avg_tps, 1),
            "successful_queries": len(successful),
            "total_queries": len(runs),
            "task_scores": task_scores,
        }
        return {"block": block, "runs": runs}


# ----------------------------------------------------------------------------- #
# Orchestration
# ----------------------------------------------------------------------------- #
def _cpu_probe(client: OllamaClient, model: str, max_tokens: int) -> tuple[float, float]:
    """Return (gpu_tps, cpu_tps) from a tiny generation in each mode."""
    prompt = "Write one short sentence about disk cleanup."
    opts_gpu = {"num_predict": 24, "temperature": 0.2}
    opts_cpu = {"num_predict": 24, "temperature": 0.2, "num_gpu": 0}

    def _probe(opts: dict) -> float:
        start = time.time()
        try:
            text = client.generate(model, prompt, think=False, options=opts)
        except Exception:  # noqa: BLE001
            return 0.0
        return _estimate_tokens(text) / max(time.time() - start, 1e-6)

    gpu_tps = _probe(opts_gpu)
    cpu_tps = _probe(opts_cpu)
    return gpu_tps, cpu_tps


def _build_report(model: str, gpu_block: dict, cpu_block: dict, comparison: dict) -> str:
    lines = [
        f"# Benchmark: `{model}`",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        f"- Vision: {'yes' if _has_vision(model) else 'no'}",
        f"- GPU weighted: {gpu_block['weighted_total']}  quality: {gpu_block['quality_score']}",
        f"- GPU tok/s: {gpu_block['avg_tokens_per_second']}  latency: {gpu_block['avg_latency_ms']:.0f} ms",
        f"- Speedup (GPU/CPU): {comparison['speedup_factor']:.2f}x  winner: {comparison['winner']}",
        "",
        "## Task scores (GPU, 0-10)",
        "",
        "| Task | Score | Use case |",
        "|------|-------|----------|",
    ]
    for key, val in gpu_block["task_scores"].items():
        lines.append(f"| {key} | {val} | {TASK_TO_USE_CASE.get(key, '')} |")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Benchmark Ollama models for Space Analyzer tasks")
    parser.add_argument("--models", default=None,
                        help="Comma-separated models to benchmark (default: all non-embedding)")
    parser.add_argument("--reps", type=int, default=DEFAULT_REPS, help="Iterations per task")
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS, help="Generation cap")
    parser.add_argument("--cpu", action="store_true", help="Run the battery on CPU (num_gpu=0)")
    parser.add_argument("--skip-cpu-probe", action="store_true",
                        help="Do not measure a live GPU/CPU speedup probe")
    parser.add_argument("--vision-image", default=str(REPO_ROOT / "assets" / "screenshots" / "ai-chat.png"),
                        help="Screenshot used for vision tasks")
    parser.add_argument("--bench-dir", default=str(BENCHMARK_DIR), help="Output directory")
    parser.add_argument("--host", default=OLLAMA_HOST, help="Ollama host")
    parser.add_argument("--timeout", type=float, default=240.0, help="Per-call timeout (s)")
    parser.add_argument("--jobs", type=int, default=1,
                        help="Models to benchmark in parallel (default 1; note VRAM is shared)")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S",
    )

    client = OllamaClient(host=args.host, timeout=args.timeout, retries=1)
    installed = client.list_models()
    if not installed:
        logger.error("No Ollama models found at %s", args.host)
        return 1

    if args.models:
        wanted = [m.strip() for m in args.models.split(",") if m.strip()]
    else:
        wanted = [m["name"] for m in installed if not _is_embedding(m["name"])]

    vision_image = None
    if Path(args.vision_image).is_file():
        try:
            vision_image = _load_vision_image(Path(args.vision_image))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load vision image %s: %s", args.vision_image, exc)

    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    gpu_label = "cpu" if args.cpu else "gpu"

    logger.info("Benchmarking %d models in %s mode", len(wanted), gpu_label)
    written: list[Path] = []
    jobs = max(1, args.jobs)
    if jobs > 1:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=jobs) as ex:
            written = list(ex.map(
                lambda m: _benchmark_one(client, m, args, vision_image, ts),
                wanted,
            ))
    else:
        for model in wanted:
            out = _benchmark_one(client, model, args, vision_image, ts)
            if out:
                written.append(out)

    written = [p for p in written if isinstance(p, Path) and p.exists()]
    logger.info("Done. %d result file(s) in %s", len(written), BENCHMARK_DIR)
    return 0


def _benchmark_one(
    client: OllamaClient,
    model: str,
    args: argparse.Namespace,
    vision_image: bytes | None,
    ts: str,
) -> Path | None:
    """Benchmark a single model and write its JSON + MD report. Returns the JSON path."""
    logger.info("=== %s ===", model)
    # Warm up VRAM with a tiny generation so latencies are comparable.
    try:
        client.generate(model, "hi", think=False,
                        options={"num_predict": WARMUP_TOKENS, "num_gpu": 0 if args.cpu else 50})
    except Exception:  # noqa: BLE001
        pass

    runner = ModelBenchmark(
        client, model, host=args.host, reps=args.reps, max_tokens=args.max_tokens,
        vision_image=vision_image, cpu_mode=args.cpu, timeout=args.timeout,
    )
    result = runner.run()
    primary = result["block"]

    # CPU mode: this run IS the cpu block; gpu block empty.
    if args.cpu:
        gpu_block = _empty_block()
        cpu_block = primary
        gpu_tps, cpu_tps = 0.0, primary["avg_tokens_per_second"]
    else:
        gpu_block = primary
        cpu_block = dict(primary)  # mirror for schema completeness
        gpu_tps = cpu_tps = 0.0
        if not args.skip_cpu_probe:
            try:
                gpu_tps, cpu_tps = _cpu_probe(client, model, args.max_tokens)
            except Exception as exc:  # noqa: BLE001
                logger.warning("cpu probe failed for %s: %s", model, exc)

    speedup = (gpu_tps / cpu_tps) if (gpu_tps and cpu_tps) else 1.0
    winner = "gpu" if speedup >= 1.0 else "cpu"
    lat_imp = ((cpu_tps - gpu_tps) / cpu_tps * 100) if cpu_tps else 0.0
    comparison = {
        "speedup_factor": round(speedup, 2),
        "latency_improvement_pct": round(lat_imp, 1),
        "quality_difference": 0.0,
        "winner": winner,
        "recommendations": [f"{winner.upper()} is {speedup:.2f}x faster for token generation"]
        if speedup != 1.0 else ["Single-mode run (no CPU probe)"],
    }

    data = {
        "model": model,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_reasoning": _is_reasoning(model),
        "has_vision": _has_vision(model),
        "gpu_info": {"name": _gpu_name(), "free_memory_mb": 0},
        "mode_scores": {"gpu": gpu_block, "cpu": cpu_block},
        "comparison": comparison,
    }
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", model)
    out = BENCHMARK_DIR / f"ollama_gpu_benchmark_{safe}_{ts}.json"
    out.write_text(json.dumps(data, indent=2), encoding="utf-8")
    report = BENCHMARK_DIR / f"ollama_gpu_benchmark_{safe}_{ts}_report.md"
    report.write_text(_build_report(model, gpu_block, cpu_block, comparison), encoding="utf-8")
    logger.info("Wrote %s", out)
    return out


def _empty_block() -> dict[str, Any]:
    return {
        "weighted_total": 0.0, "quality_score": 0.0, "avg_latency_ms": 0.0,
        "avg_tokens_per_second": 0.0, "successful_queries": 0, "total_queries": 0,
        "task_scores": {},
    }


if __name__ == "__main__":
    sys.exit(main())

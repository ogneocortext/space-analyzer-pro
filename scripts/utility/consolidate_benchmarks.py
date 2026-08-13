#!/usr/bin/env python3
"""
Consolidate all Ollama GPU benchmark results into a single CSV and summary report.
Links each row to its corresponding JSON and MD files.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

BENCHMARK_DIR: Path = Path("benchmark_results")
OUTPUT_CSV: Path = BENCHMARK_DIR / "consolidated_benchmarks.csv"
OUTPUT_MD: Path = BENCHMARK_DIR / "consolidated_benchmarks.md"

OLLAMA_LIST_TIMEOUT_S: int = 10
GPU_NAME_DEFAULT: str = "NVIDIA GeForce GTX 1070 Ti (8 GB VRAM)"

logger = logging.getLogger("consolidate_benchmarks")

# Task score keys mapped to CSV field names
TASK_SCORE_FIELDS: dict[str, str] = {
    "disk_analysis_quality": "task_disk_analysis",
    "file_categorization": "task_file_categorization",
    "code_review": "task_code_review",
    "structured_json": "task_structured_json",
    "reasoning": "task_reasoning",
    "generation_speed": "task_generation_speed",
    "response_latency": "task_response_latency",
    "vision_ui_analysis": "task_vision_ui",
    "vision_element_detection": "task_vision_elements",
    "vision_speed": "task_vision_speed",
}

CSV_FIELDNAMES: list[str] = [
    "model", "timestamp", "is_reasoning", "has_vision",
    "gpu_name", "gpu_vram_free_mb",
    "gpu_weighted_score", "gpu_quality_score", "gpu_avg_latency_ms",
    "gpu_tokens_per_sec", "gpu_success_rate",
    "cpu_weighted_score", "cpu_quality_score", "cpu_avg_latency_ms",
    "cpu_tokens_per_sec", "cpu_success_rate",
    "speedup_factor", "latency_improvement_pct", "quality_difference",
    "winner", "recommendations",
    "task_disk_analysis", "task_file_categorization", "task_code_review",
    "task_structured_json", "task_reasoning", "task_generation_speed",
    "task_response_latency", "task_vision_ui", "task_vision_elements",
    "task_vision_speed",
    "json_file", "md_file", "json_path", "md_path",
]


def _format_score(mode: dict[str, Any], key: str, decimals: int) -> Any:
    """Round a numeric score from a mode dict, defaulting to 0.

    Args:
        mode: Source dict (gpu or cpu score block).
        key: Key to read.
        decimals: Number of decimal places.

    Returns:
        Rounded value.
    """
    return round(mode.get(key, 0), decimals)


def _format_success_rate(mode: dict[str, Any]) -> str:
    """Format the success rate as "successful/total" string.

    Args:
        mode: Score block for a mode.

    Returns:
        Formatted rate string.
    """
    return f"{mode.get('successful_queries', 0)}/{mode.get('total_queries', 0)}"


def _extract_result_row(json_file: Path, data: dict[str, Any]) -> dict[str, Any] | None:
    """Build a single result row from one benchmark JSON file.

    Args:
        json_file: Source path (used to populate json/md file fields).
        data: Parsed JSON data.

    Returns:
        Result row, or None if the entry has zero scores on both modes.
    """
    comp = data.get("comparison", {})
    gpu = data.get("mode_scores", {}).get("gpu", {})
    cpu = data.get("mode_scores", {}).get("cpu", {})
    gpu_tasks = gpu.get("task_scores", {})

    if gpu.get("weighted_total", 0) == 0 and cpu.get("weighted_total", 0) == 0:
        return None

    row: dict[str, Any] = {
        "model": data.get("model", ""),
        "timestamp": data.get("timestamp", ""),
        "is_reasoning": data.get("is_reasoning", False),
        "has_vision": data.get("has_vision", False),
        "gpu_vram_free_mb": data.get("gpu_info", {}).get("free_memory_mb", 0),
        "gpu_name": data.get("gpu_info", {}).get("name", ""),
        "gpu_weighted_score": _format_score(gpu, "weighted_total", 1),
        "gpu_quality_score": _format_score(gpu, "quality_score", 1),
        "gpu_avg_latency_ms": _format_score(gpu, "avg_latency_ms", 0),
        "gpu_tokens_per_sec": _format_score(gpu, "avg_tokens_per_second", 1),
        "gpu_success_rate": _format_success_rate(gpu),
        "cpu_weighted_score": _format_score(cpu, "weighted_total", 1),
        "cpu_quality_score": _format_score(cpu, "quality_score", 1),
        "cpu_avg_latency_ms": _format_score(cpu, "avg_latency_ms", 0),
        "cpu_tokens_per_sec": _format_score(cpu, "avg_tokens_per_second", 1),
        "cpu_success_rate": _format_success_rate(cpu),
        "speedup_factor": _format_score(comp, "speedup_factor", 2),
        "latency_improvement_pct": _format_score(comp, "latency_improvement_pct", 1),
        "quality_difference": _format_score(comp, "quality_difference", 1),
        "winner": comp.get("winner", ""),
        "recommendations": "; ".join(comp.get("recommendations", [])),
        "json_file": json_file.name,
        "md_path": str(json_file.with_name(json_file.stem + "_report.md")),
        "md_file": json_file.with_name(json_file.stem + "_report.md").name,
        "json_path": str(json_file),
    }

    for task_key, field_name in TASK_SCORE_FIELDS.items():
        row[field_name] = round(gpu_tasks.get(task_key, 0), 1)
    return row


def _parse_timestamp(value: Any) -> tuple[int, Any]:
    """Return a sortable key for a timestamp, robust to mixed formats.

    Both numeric epochs and ISO-8601 strings are normalized to a float epoch
    so they compare on equal footing (recency wins); unparseable strings fall
    back to a lexicographic tier that sorts after any parseable value; missing
    or empty values sort last.

    Args:
        value: Timestamp as int/float, ISO string, or unknown.

    Returns:
        Tuple usable with standard comparison operators.
    """
    if isinstance(value, (int, float)):
        return (0, float(value))
    if isinstance(value, str) and value:
        try:
            return (0, datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
        except ValueError:
            return (1, value)
    return (2, "")


def load_benchmark_results(benchmark_dir: Path = BENCHMARK_DIR) -> list[dict[str, Any]]:
    """Load all benchmark JSON files and extract key metrics.

    Keeps only the latest run per model (highest timestamp).

    Args:
        benchmark_dir: Directory containing benchmark JSON files.

    Returns:
        List of result rows, deduplicated to one entry per model.
    """
    if not benchmark_dir.is_dir():
        logger.warning("Benchmark directory %s does not exist", benchmark_dir)
        return []

    all_results: list[dict[str, Any]] = []
    for json_file in sorted(benchmark_dir.glob("ollama_gpu_benchmark_*.json")):
        if "latest" in json_file.name:
            continue
        try:
            with json_file.open(encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("Could not read %s: %s", json_file, e)
            continue

        row = _extract_result_row(json_file, data)
        if row is not None:
            all_results.append(row)

    # Deduplicate: keep the latest run per model (timestamp-aware).
    best_per_model: dict[str, dict[str, Any]] = {}
    for result in all_results:
        model = result["model"]
        existing = best_per_model.get(model)
        if existing is None or _parse_timestamp(result["timestamp"]) > _parse_timestamp(existing["timestamp"]):
            best_per_model[model] = result
    return sorted(best_per_model.values(), key=lambda r: r["model"])


def write_csv(results: list[dict[str, Any]], output_csv: Path = OUTPUT_CSV) -> None:
    """Write the consolidated CSV.

    Args:
        results: Result rows to serialize.
        output_csv: Destination CSV path.
    """
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(results)
    logger.info("Wrote %d rows to %s", len(results), output_csv)


def _get_installed_models(timeout: int = OLLAMA_LIST_TIMEOUT_S) -> set[str]:
    """Return the set of currently installed Ollama model names.

    Args:
        timeout: Timeout for the ``ollama list`` subprocess.

    Returns:
        Set of model name strings (empty on error).
    """
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
        logger.debug("Could not list ollama models: %s", e)
        return set()

    if result.returncode != 0:
        return set()
    models: set[str] = set()
    for line in result.stdout.strip().split("\n")[1:]:  # skip header
        parts = line.split()
        if parts:
            models.add(parts[0])
    return models


def _get_nvidia_smi_gpu() -> str | None:
    """Detect the local GPU name and total VRAM via ``nvidia-smi``.

    Returns:
        A human-readable description like
        ``"NVIDIA GeForce RTX 4070 (12 GB VRAM)"``, or ``None`` when
        ``nvidia-smi`` is unavailable or its output cannot be parsed.
    """
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
        logger.debug("nvidia-smi unavailable: %s", e)
        return None

    if result.returncode != 0 or not result.stdout.strip():
        return None
    lines = [ln.strip() for ln in result.stdout.strip().split("\n") if ln.strip()]
    if not lines:
        return None
    parts = [p.strip() for p in lines[0].split(",")]
    if len(parts) < 2:
        return None
    name, mem_mib = parts[0], parts[1]
    try:
        mem_gb = round(float(mem_mib) / 1024)
    except ValueError:
        mem_gb = 0
    return f"{name} ({mem_gb} GB VRAM)"


def _winner_label(winner: str) -> str:
    """Convert a winner key into a short display label.

    Args:
        winner: Winner key (gpu/cpu/tie or unknown).

    Returns:
        Display label.
    """
    return {"gpu": "GPU", "cpu": "CPU", "tie": "TIE"}.get(winner, "?")


def _quick_comparison_rows(results: list[dict[str, Any]], installed: set[str]) -> list[str]:
    """Build the quick-comparison markdown table rows.

    Args:
        results: All result rows.
        installed: Set of currently installed model names.

    Returns:
        List of markdown table row strings.
    """
    rows: list[str] = []
    for r in results:
        status = "Installed" if r["model"] in installed else "Removed"
        model_type = "Reasoning" if r["is_reasoning"] else "Text"
        vision = "Yes" if r["has_vision"] else "No"
        rows.append(
            f"| {r['model']} | {status} | {model_type} | {vision} | "
            f"{r['gpu_tokens_per_sec']:.1f} | {r['cpu_tokens_per_sec']:.1f} | "
            f"{r['speedup_factor']:.2f}x | {r['quality_difference']:+.1f} | "
            f"{_winner_label(r['winner'])} | [JSON]({r['json_file']}) | [MD]({r['md_file']}) |"
        )
    return rows


def _detailed_performance_rows(results: list[dict[str, Any]]) -> list[str]:
    """Build the detailed GPU performance markdown table rows.

    Args:
        results: All result rows.

    Returns:
        List of markdown table row strings.
    """
    rows: list[str] = []
    for r in results:
        rows.append(
            f"| {r['model']} | {r['gpu_weighted_score']:.1f} | {r['gpu_quality_score']:.1f} | "
            f"{r['gpu_avg_latency_ms']:.0f} | {r['gpu_tokens_per_sec']:.1f} | {r['gpu_success_rate']} | "
            f"{r['task_disk_analysis']:.1f} | {r['task_code_review']:.1f} | "
            f"{r['task_structured_json']:.1f} | {r['task_reasoning']:.1f} | "
            f"{r['task_vision_ui']:.1f} |"
        )
    return rows


def _ranking_lines(results: list[dict[str, Any]], key: str, formatter: str) -> list[str]:
    """Build numbered ranking lines sorted by a numeric key.

    Args:
        results: Result rows to rank.
        key: Key to sort by.
        formatter: Format string for each entry (e.g. "{value:.1f} tok/s").

    Returns:
        List of markdown lines.
    """
    ranked = sorted(results, key=lambda r: r[key], reverse=True)
    return [f"{i}. **{r['model']}** — {formatter.format(value=r[key])}" for i, r in enumerate(ranked, 1)]


def _recommendation_lines(results: list[dict[str, Any]], installed: set[str]) -> list[str]:
    """Build recommendation lines filtered to installed models.

    Args:
        results: All result rows.
        installed: Set of currently installed model names.

    Returns:
        List of markdown recommendation lines.
    """
    installed_results = [r for r in results if r["model"] in installed]
    if not installed_results:
        return ["- No benchmarked models currently installed"]

    lines: list[str] = []
    vision_models = [r for r in installed_results if r["has_vision"]]
    text_models = [r for r in installed_results if not r["has_vision"]]
    reasoning_models = [r for r in installed_results if r["is_reasoning"]]

    if vision_models:
        best = max(vision_models, key=lambda x: x["gpu_weighted_score"])
        lines.append(
            f"- **Vision + Text**: `{best['model']}` — {best['gpu_tokens_per_sec']:.1f} tok/s, "
            f"quality {best['gpu_quality_score']:.1f}, vision score {best['task_vision_ui']:.1f}"
        )
    if text_models:
        fastest = max(text_models, key=lambda x: x["gpu_tokens_per_sec"])
        lines.append(f"- **Fastest text**: `{fastest['model']}` — {fastest['gpu_tokens_per_sec']:.1f} tok/s")
        best_quality = max(text_models, key=lambda x: x["gpu_quality_score"])
        lines.append(f"- **Best quality text**: `{best_quality['model']}` — quality {best_quality['gpu_quality_score']:.1f}")
    if reasoning_models:
        best_reasoning = max(reasoning_models, key=lambda x: x["gpu_weighted_score"])
        lines.append(f"- **Best reasoning**: `{best_reasoning['model']}` — quality {best_reasoning['gpu_quality_score']:.1f}")
    if installed:
        lines.append("")
        lines.append(f"**Installed models:** {', '.join(sorted(installed))}")
    return lines


def _slow_on_gpu_lines(results: list[dict[str, Any]]) -> list[str]:
    """Build lines for models that are slower on GPU than CPU.

    Args:
        results: All result rows.

    Returns:
        Markdown lines listing underperforming models.
    """
    slow = [r for r in results if r["speedup_factor"] < 1.0]
    if not slow:
        return ["- None — all models benefit from GPU acceleration"]
    return [
        f"- `{r['model']}` — GPU is {r['speedup_factor']:.2f}x slower than CPU (use CPU mode)"
        for r in slow
    ]


def _file_reference_rows(results: list[dict[str, Any]]) -> list[str]:
    """Build the file-reference markdown table rows.

    Args:
        results: All result rows.

    Returns:
        List of markdown table row strings.
    """
    return [
        f"| {r['model']} | `{r['json_file']}` | `{r['md_file']}` |"
        for r in results
    ]


def write_markdown_report(
    results: list[dict[str, Any]],
    output_md: Path = OUTPUT_MD,
    gpu_name: str = GPU_NAME_DEFAULT,
    fetch_installed: bool = True,
) -> None:
    """Write the consolidated markdown report.

    Args:
        results: All result rows.
        output_md: Destination markdown path.
        gpu_name: GPU description for the header (overridden by the real GPU
            name found in the benchmark data when available).
        fetch_installed: When True, run ``ollama list`` to mark installed models.
            Set False to skip the subprocess (e.g. Ollama not installed).
    """
    installed = _get_installed_models() if fetch_installed else set()
    data_gpu = next((r.get("gpu_name") for r in results if r.get("gpu_name")), "")
    # Precedence: real hardware (nvidia-smi) > benchmark data name > CLI arg.
    gpu_name_resolved = _get_nvidia_smi_gpu() or data_gpu or gpu_name
    lines: list[str] = [
        "# Ollama GPU vs CPU Benchmark — Consolidated Results",
        f"Generated: {datetime.now().isoformat()}",
        f"GPU: {gpu_name_resolved}",
        f"Models Tested: {len(results)}",
        "",
        "## Quick Comparison",
        "",
        "| Model | Status | Type | Vision | GPU tok/s | CPU tok/s | Speedup | Quality Δ | Winner | JSON | Report |",
        "|-------|--------|------|--------|-----------|-----------|---------|-----------|--------|------|--------|",
        *_quick_comparison_rows(results, installed),
        "",
        "## Detailed GPU Performance",
        "",
        "| Model | Weighted Score | Quality | Latency (ms) | tok/s | Success | Disk Analysis | Code Review | JSON Output | Reasoning | Vision UI |",
        "|-------|---------------|---------|-------------|-------|---------|--------------|-------------|-------------|-----------|-----------|",
        *_detailed_performance_rows(results),
        "",
        "## Rankings by Category",
        "",
        "### Fastest (GPU tokens/sec)",
        "",
        *_ranking_lines(results, "gpu_tokens_per_sec", "{value:.1f} tok/s"),
        "",
        "### Best Quality (GPU score)",
        "",
        *_ranking_lines(results, "gpu_quality_score", "{value:.1f}"),
        "",
        "### Biggest GPU Speedup",
        "",
        *_ranking_lines(results, "speedup_factor", "{value:.2f}x"),
        "",
        "## Recommendations for Space Analyzer Pro",
        "",
        "### Currently Installed Models",
        "",
        *_recommendation_lines(results, installed),
        "",
        "### Historical: Models to Avoid on GPU (slower than CPU)",
        "",
        *_slow_on_gpu_lines(results),
        "",
        "## File References",
        "",
        "| Model | JSON File | Markdown Report |",
        "|-------|-----------|-----------------|",
        *_file_reference_rows(results),
        "",
    ]

    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_md.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Wrote consolidated report to %s", output_md)


def _print_summary(results: list[dict[str, Any]]) -> None:
    """Print a one-line-per-model summary to stdout.

    Args:
        results: All result rows.
    """
    print(f"\nConsolidated {len(results)} benchmark runs:")
    for r in results:
        print(
            f"  {r['model']:30s} "
            f"GPU={r['gpu_tokens_per_sec']:5.1f} tok/s  "
            f"CPU={r['cpu_tokens_per_sec']:5.1f} tok/s  "
            f"Speedup={r['speedup_factor']:.2f}x  "
            f"Winner={r['winner']}"
        )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Optional argument list.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(description="Consolidate Ollama GPU benchmark results")
    parser.add_argument("--benchmark-dir", default=str(BENCHMARK_DIR), help="Benchmark results directory")
    parser.add_argument("--output-csv", default=str(OUTPUT_CSV), help="Output CSV path")
    parser.add_argument("--output-md", default=str(OUTPUT_MD), help="Output markdown path")
    parser.add_argument("--gpu-name", default=GPU_NAME_DEFAULT, help="GPU description for the report")
    parser.add_argument("--no-ollama", action="store_true",
                        help="Skip 'ollama list' (installed-status lookups)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI.

    Args:
        argv: Optional argument list.

    Returns:
        Process exit code.
    """
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    benchmark_dir = Path(args.benchmark_dir)
    benchmark_dir.mkdir(parents=True, exist_ok=True)
    results = load_benchmark_results(benchmark_dir)

    if not results:
        logger.info("No benchmark results found")
        return 0

    write_csv(results, Path(args.output_csv))
    write_markdown_report(
        results,
        Path(args.output_md),
        gpu_name=args.gpu_name,
        fetch_installed=not args.no_ollama,
    )
    _print_summary(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())

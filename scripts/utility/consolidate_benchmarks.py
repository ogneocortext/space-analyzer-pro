#!/usr/bin/env python3
"""
Consolidate all Ollama GPU benchmark results into a single CSV and summary report.
Links each row to its corresponding JSON and MD files.
"""

import csv
import json
import statistics
from pathlib import Path
from datetime import datetime

BENCHMARK_DIR = Path("benchmark_results")
OUTPUT_CSV = BENCHMARK_DIR / "consolidated_benchmarks.csv"
OUTPUT_MD = BENCHMARK_DIR / "consolidated_benchmarks.md"


def load_benchmark_results():
    """Load all benchmark JSON files and extract key metrics.
    Keeps only the latest run per model (highest timestamp)."""
    all_results = []
    for f in sorted(BENCHMARK_DIR.glob("ollama_gpu_benchmark_*.json")):
        if "latest" in f.name:
            continue
        with open(f, encoding="utf-8") as fh:
            data = json.load(fh)

        comp = data.get("comparison", {})
        gpu = data.get("mode_scores", {}).get("gpu", {})
        cpu = data.get("mode_scores", {}).get("cpu", {})

        model = data.get("model", "")
        ts = data.get("timestamp", "")

        # Skip runs with zero scores (buggy early runs before reasoning model fix)
        if gpu.get("weighted_total", 0) == 0 and cpu.get("weighted_total", 0) == 0:
            continue

        # Extract per-task scores
        gpu_tasks = gpu.get("task_scores", {})
        cpu_tasks = cpu.get("task_scores", {})

        all_results.append({
            "model": model,
            "timestamp": ts,
            "is_reasoning": data.get("is_reasoning", False),
            "has_vision": data.get("has_vision", False),
            "gpu_vram_free_mb": data.get("gpu_info", {}).get("free_memory_mb", 0),
            "gpu_name": data.get("gpu_info", {}).get("name", ""),
            "gpu_weighted_score": round(gpu.get("weighted_total", 0), 1),
            "gpu_quality_score": round(gpu.get("quality_score", 0), 1),
            "gpu_avg_latency_ms": round(gpu.get("avg_latency_ms", 0), 0),
            "gpu_tokens_per_sec": round(gpu.get("avg_tokens_per_second", 0), 1),
            "gpu_success_rate": f"{gpu.get('successful_queries', 0)}/{gpu.get('total_queries', 0)}",
            "cpu_weighted_score": round(cpu.get("weighted_total", 0), 1),
            "cpu_quality_score": round(cpu.get("quality_score", 0), 1),
            "cpu_avg_latency_ms": round(cpu.get("avg_latency_ms", 0), 0),
            "cpu_tokens_per_sec": round(cpu.get("avg_tokens_per_second", 0), 1),
            "cpu_success_rate": f"{cpu.get('successful_queries', 0)}/{cpu.get('total_queries', 0)}",
            "speedup_factor": round(comp.get("speedup_factor", 0), 2),
            "latency_improvement_pct": round(comp.get("latency_improvement_pct", 0), 1),
            "quality_difference": round(comp.get("quality_difference", 0), 1),
            "winner": comp.get("winner", ""),
            "recommendations": "; ".join(comp.get("recommendations", [])),
            "json_file": f.name,
            "md_file": f.name.replace(".json", "_report.md"),
            "json_path": str(f),
            "md_path": str(f).replace(".json", "_report.md"),
            "task_disk_analysis": gpu_tasks.get("disk_analysis_quality", 0),
            "task_file_categorization": gpu_tasks.get("file_categorization", 0),
            "task_code_review": gpu_tasks.get("code_review", 0),
            "task_structured_json": gpu_tasks.get("structured_json", 0),
            "task_reasoning": gpu_tasks.get("reasoning", 0),
            "task_generation_speed": gpu_tasks.get("generation_speed", 0),
            "task_response_latency": gpu_tasks.get("response_latency", 0),
            "task_vision_ui": gpu_tasks.get("vision_ui_analysis", 0),
            "task_vision_elements": gpu_tasks.get("vision_element_detection", 0),
            "task_vision_speed": gpu_tasks.get("vision_speed", 0),
        })

    # Deduplicate: keep only the latest run per model (highest timestamp)
    best_per_model = {}
    for r in all_results:
        model = r["model"]
        if model not in best_per_model or r["timestamp"] > best_per_model[model]["timestamp"]:
            best_per_model[model] = r

    results = sorted(best_per_model.values(), key=lambda x: x["model"])
    return results


def write_csv(results):
    """Write consolidated CSV."""
    fieldnames = [
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

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"Wrote {len(results)} rows to {OUTPUT_CSV}")


def write_markdown_report(results):
    """Write consolidated markdown report."""
    lines = []
    lines.append("# Ollama GPU vs CPU Benchmark — Consolidated Results")
    lines.append(f"Generated: {datetime.now().isoformat()}")
    lines.append(f"GPU: NVIDIA GeForce GTX 1070 Ti (8 GB VRAM)")
    lines.append(f"Models Tested: {len(results)}")
    lines.append("")

    # Summary table
    lines.append("## Quick Comparison")
    lines.append("")
    lines.append("| Model | Status | Type | Vision | GPU tok/s | CPU tok/s | Speedup | Quality Δ | Winner | JSON | Report |")
    lines.append("|-------|--------|------|--------|-----------|-----------|---------|-----------|--------|------|--------|")

    # Get currently installed models
    try:
        import subprocess
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=10)
        installed_models = set()
        for line in result.stdout.strip().split("\n")[1:]:  # Skip header
            parts = line.split()
            if parts:
                installed_models.add(parts[0])
    except Exception:
        installed_models = set()

    for r in results:
        model_type = "Reasoning" if r["is_reasoning"] else "Text"
        vision = "Yes" if r["has_vision"] else "No"
        winner_icon = {"gpu": "GPU", "cpu": "CPU", "tie": "TIE"}.get(r["winner"], "?")
        json_link = f"[JSON]({r['json_file']})"
        md_link = f"[MD]({r['md_file']})"
        status = "✅ Installed" if r["model"] in installed_models else "❌ Removed"

        lines.append(
            f"| {r['model']} | {status} | {model_type} | {vision} | "
            f"{r['gpu_tokens_per_sec']:.1f} | {r['cpu_tokens_per_sec']:.1f} | "
            f"{r['speedup_factor']:.2f}x | {r['quality_difference']:+.1f} | "
            f"{winner_icon} | {json_link} | {md_link} |"
        )

    lines.append("")

    # Detailed per-model table
    lines.append("## Detailed GPU Performance")
    lines.append("")
    lines.append("| Model | Weighted Score | Quality | Latency (ms) | tok/s | Success | Disk Analysis | Code Review | JSON Output | Reasoning | Vision UI |")
    lines.append("|-------|---------------|---------|-------------|-------|---------|--------------|-------------|-------------|-----------|-----------|")

    for r in results:
        lines.append(
            f"| {r['model']} | {r['gpu_weighted_score']:.1f} | {r['gpu_quality_score']:.1f} | "
            f"{r['gpu_avg_latency_ms']:.0f} | {r['gpu_tokens_per_sec']:.1f} | {r['gpu_success_rate']} | "
            f"{r['task_disk_analysis']:.1f} | {r['task_code_review']:.1f} | "
            f"{r['task_structured_json']:.1f} | {r['task_reasoning']:.1f} | "
            f"{r['task_vision_ui']:.1f} |"
        )

    lines.append("")

    # Rankings
    lines.append("## Rankings by Category")
    lines.append("")

    # By speed
    by_speed = sorted(results, key=lambda x: x["gpu_tokens_per_sec"], reverse=True)
    lines.append("### Fastest (GPU tokens/sec)")
    lines.append("")
    for i, r in enumerate(by_speed, 1):
        lines.append(f"{i}. **{r['model']}** — {r['gpu_tokens_per_sec']:.1f} tok/s")
    lines.append("")

    # By quality
    by_quality = sorted(results, key=lambda x: x["gpu_quality_score"], reverse=True)
    lines.append("### Best Quality (GPU score)")
    lines.append("")
    for i, r in enumerate(by_quality, 1):
        lines.append(f"{i}. **{r['model']}** — {r['gpu_quality_score']:.1f}")
    lines.append("")

    # By speedup
    by_speedup = sorted(results, key=lambda x: x["speedup_factor"], reverse=True)
    lines.append("### Biggest GPU Speedup")
    lines.append("")
    for i, r in enumerate(by_speedup, 1):
        lines.append(f"{i}. **{r['model']}** — {r['speedup_factor']:.2f}x")
    lines.append("")

    # Recommendations (filtered to installed models only)
    lines.append("## Recommendations for Space Analyzer Pro")
    lines.append("")
    lines.append("### Currently Installed Models")
    lines.append("")

    installed_results = [r for r in results if r["model"] in installed_models]

    if not installed_results:
        lines.append("- No benchmarked models currently installed")
    else:
        vision_models = [r for r in installed_results if r["has_vision"]]
        text_models = [r for r in installed_results if not r["has_vision"]]

        if vision_models:
            best_vision = max(vision_models, key=lambda x: x["gpu_weighted_score"])
            lines.append(f"- **Vision + Text**: `{best_vision['model']}` — {best_vision['gpu_tokens_per_sec']:.1f} tok/s, "
                         f"quality {best_vision['gpu_quality_score']:.1f}, vision score {best_vision['task_vision_ui']:.1f}")

        if text_models:
            best_text = max(text_models, key=lambda x: x["gpu_tokens_per_sec"])
            lines.append(f"- **Fastest text**: `{best_text['model']}` — {best_text['gpu_tokens_per_sec']:.1f} tok/s")

            best_quality_text = max(text_models, key=lambda x: x["gpu_quality_score"])
            lines.append(f"- **Best quality text**: `{best_quality_text['model']}` — quality {best_quality_text['gpu_quality_score']:.1f}")

        reasoning_models = [r for r in installed_results if r["is_reasoning"]]
        if reasoning_models:
            best_reasoning = max(reasoning_models, key=lambda x: x["gpu_weighted_score"])
            lines.append(f"- **Best reasoning**: `{best_reasoning['model']}` — quality {best_reasoning['gpu_quality_score']:.1f}")

        lines.append("")
        lines.append(f"**Total disk usage:** {', '.join(installed_models)}")

    # Historical: Models to avoid on GPU
    lines.append("")
    lines.append("### Historical: Models to Avoid on GPU (slower than CPU)")
    lines.append("")
    slow_on_gpu = [r for r in results if r["speedup_factor"] < 1.0]
    if slow_on_gpu:
        for r in slow_on_gpu:
            lines.append(f"- `{r['model']}` — GPU is {r['speedup_factor']:.2f}x slower than CPU (use CPU mode)")
    else:
        lines.append("- None — all models benefit from GPU acceleration")

    lines.append("")

    # File references
    lines.append("## File References")
    lines.append("")
    lines.append("| Model | JSON File | Markdown Report |")
    lines.append("|-------|-----------|-----------------|")
    for r in results:
        lines.append(f"| {r['model']} | `{r['json_file']}` | `{r['md_file']}` |")

    lines.append("")

    with open(OUTPUT_MD, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print(f"Wrote consolidated report to {OUTPUT_MD}")


def main():
    BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
    results = load_benchmark_results()

    if not results:
        print("No benchmark results found.")
        return

    write_csv(results)
    write_markdown_report(results)

    print(f"\nConsolidated {len(results)} benchmark runs:")
    for r in results:
        print(f"  {r['model']:30s} GPU={r['gpu_tokens_per_sec']:5.1f} tok/s  "
              f"CPU={r['cpu_tokens_per_sec']:5.1f} tok/s  "
              f"Speedup={r['speedup_factor']:.2f}x  Winner={r['winner']}")


if __name__ == "__main__":
    main()

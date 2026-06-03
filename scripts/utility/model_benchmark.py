#!/usr/bin/env python3
"""
Space Analyzer Ollama Model Benchmark Suite
=============================================
Benchmarks multiple Ollama models against criteria specific to
the Space Analyzer app context, then generates keep/delete recommendations.

Usage:
    python model_benchmark.py                    # Full benchmark all models
    python model_benchmark.py --quick            # Quick benchmark (fewer iterations)
    python model_benchmark.py --models phi4-mini:latest,qwen3-vl:4b
    python model_benchmark.py --report-only      # Generate report from cached results
"""

import argparse
import json
import os
import sys
import time
import statistics
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from collections import defaultdict

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "ai-service"))
from ollama_client import OllamaClient


# ── Configuration ──────────────────────────────────────────────────
BENCHMARK_DIR = Path("benchmark_results")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# App-specific prompt templates
PROMPT_TEMPLATES = {
    "vision_ui_analysis": """You are analyzing a screenshot of a Rust/egui desktop application (Space Analyzer - a disk space analysis tool).

Current screenshot: [IMAGE]

Rate each dimension 1-10:
1. Layout clarity - Can you easily understand the information hierarchy?
2. Color contrast - Is text readable against backgrounds?
3. Information density - Is there too much or too little information displayed?
4. Visual consistency - Do UI elements look cohesive?
5. Navigation clarity - Can you tell where you are and what you can do?

Then list 2 specific improvements with actionable egui code suggestions.""",

    "code_analysis": """Analyze this code snippet and provide:
1. Language identification
2. What the code does (1-2 sentences)
3. Potential bugs or issues
4. Suggestions for improvement
5. Complexity rating (1-10, 10=very complex)

Code:
```
{code}
```""",

    "file_categorization": """Given the following file metadata, categorize this file:
- Name: {name}
- Extension: {ext}
- Size: {size} bytes
- Last modified: {modified}
- Description: {description}

Category options: documents, images, videos, audio, code, archives, system, temporary, configuration, executables, fonts, backups, logs, cache, databases, unknown

Return ONLY the category name and a confidence score 0-1.""",

    "cleanup_recommendation": """A user has a disk space analyzer showing the following statistics:
- Total files: {total_files}
- Total size: {total_size}
- Largest categories: {top_categories}
- Oldest files: {oldest_files}
- Duplicate candidates: {duplicates}

Provide 5 specific cleanup recommendations with estimated space savings for each.""",

    "documentation_generation": """Generate user-facing documentation for a disk space analyzer feature. The feature is:
{feature_description}

Write clear, concise documentation suitable for end users. Include:
- Purpose of the feature
- How to use it (step by step)
- Tips and best practices
- Known limitations""",

    "reasoning_coding_problem": """A user wants to implement a {task_description} in a Rust egui application. They have:
- Codebase structure: {codebase_structure}
- Current implementation: {current_impl}
- Constraints: {constraints}

Provide a detailed implementation plan with code snippets and reasoning.""",
}

# ── Benchmark tasks ───────────────────────────────────────────────
BENCHMARK_TASKS = {
    "vision_speed": {
        "description": "How fast a model processes image inputs",
        "category": "performance",
        "weight": 1.0,
        "prompt": "What objects do you see in this image? List them concisely.",
        "iterations": 3,
    },
    "vision_accuracy": {
        "description": "Accuracy of UI element identification",
        "category": "quality",
        "weight": 2.0,
        "prompt": PROMPT_TEMPLATES["vision_ui_analysis"],
        "iterations": 1,
    },
    "code_analysis_quality": {
        "description": "Quality of source code analysis",
        "category": "quality",
        "weight": 2.0,
        "prompt": PROMPT_TEMPLATES["code_analysis"],
        "iterations": 2,
    },
    "text_reasoning": {
        "description": "General text reasoning and analysis",
        "category": "quality",
        "weight": 1.5,
        "prompt": "Explain the tradeoffs between using B-trees vs hash maps for file indexing in a disk space analyzer. Which would you choose and why?",
        "iterations": 1,
    },
    "structured_output": {
        "description": "Ability to produce well-structured JSON output",
        "category": "quality",
        "weight": 1.5,
        "prompt": "Return a JSON object with exactly this structure: {{\"issues\": [{{\"severity\": \"string\", \"description\": \"string\", \"fix\": \"string\"}}], \"summary\": \"string\"}} listing 3 issues found in a disk space analyzer UI.",
        "iterations": 2,
    },
    "small_model_efficiency": {
        "description": "Performance of small/fast models (under 4GB)",
        "category": "performance",
        "weight": 1.0,
        "prompt": "In under 50 words, explain what a disk space analyzer does.",
        "iterations": 3,
    },
    "instruction_following": {
        "description": "How well the model follows complex instructions",
        "category": "quality",
        "weight": 1.5,
        "prompt": "You are a UI critic. I will describe an interface. Rate it 1-10 on these criteria (output ONLY a JSON object): {\"layout\": \"number\", \"usability\": \"number\", \"aesthetics\": \"number\", \"accessibility\": \"number\"}. The interface: A dark-themed file browser with tree view on left, file details on right, breadcrumb navigation at top.",
        "iterations": 2,
    },
}

DEFAULT_VISION_IMAGE_DIRS = [
    REPO_ROOT / "tools" / "design-screenshot",
    REPO_ROOT / "assets" / "screenshots",
    REPO_ROOT / "docs" / "screenshots",
]


# ── Data classes ──────────────────────────────────────────────────
@dataclass
class BenchmarkResult:
    """Result of a single benchmark run."""
    task_name: str
    model: str
    iteration: int
    success: bool
    latency_ms: float = 0.0
    tokens_per_second: float = 0.0
    response_length: int = 0
    quality_score: float = 0.0
    error: str = ""
    response_text: str = ""


@dataclass
class ModelScore:
    """Aggregated score for a model across tasks."""
    model: str
    task_scores: Dict[str, float] = field(default_factory=dict)
    weighted_total: float = 0.0
    ranks: Dict[str, int] = field(default_factory=dict)

    # Category breakdowns
    performance_score: float = 0.0
    quality_score: float = 0.0

    # Metadata
    model_size_mb: float = 0.0
    is_vision_model: bool = False


@dataclass
class KeepDeleteRecommendation:
    """Recommendation for a model."""
    model: str
    action: str  # "keep", "delete", "conditional", "replace"
    confidence: float  # 0-1
    reasoning: str
    alternatives: List[str] = field(default_factory=list)
    model_size_mb: float = 0.0


# ── Benchmark runner ──────────────────────────────────────────────
class ModelBenchmarkSuite:
    """Comprehensive benchmark suite for Ollama models."""

    def __init__(
        self,
        models: List[str],
        host: str = OLLAMA_HOST,
        quick: bool = False,
        vision_image_dir: Optional[Path] = None,
    ):
        self.models = models
        self.host = host
        self.quick = quick
        self.client = OllamaClient(base_url=host)
        self.results: List[BenchmarkResult] = []
        self.model_scores: Dict[str, ModelScore] = {}
        self.model_info: Dict[str, Dict] = {}
        self.vision_image_dir = vision_image_dir
        self.vision_images: List[Path] = self._discover_vision_images(vision_image_dir)

    def _discover_vision_images(self, vision_image_dir: Optional[Path]) -> List[Path]:
        search_dirs: List[Path] = []
        if vision_image_dir:
            search_dirs.append(vision_image_dir)
        else:
            search_dirs.extend(DEFAULT_VISION_IMAGE_DIRS)

        images: List[Path] = []
        for d in search_dirs:
            try:
                if not d.exists() or not d.is_dir():
                    continue
                images.extend(sorted(d.glob("*.png")))
            except Exception:
                continue

        preferred = [p for p in images if any(k in p.name.lower() for k in ["page_", "final_", "analyze_"])]
        if preferred:
            images = preferred
        return sorted(images)[:12]

    def discover_models(self) -> List[str]:
        """Get list of installed models from Ollama."""
        models = self.client.list_models()
        return [m["name"] for m in models]

    def get_model_size(self, model: str) -> float:
        """Get model size in MB from Ollama."""
        try:
            info = self.client.show_model_info(model)
            if info and "modelfile" in info:
                # Parse size from modelfile or digest
                for line in info.get("modelfile", "").split("\n"):
                    if line.startswith(">>>"):
                        continue
                size_bytes = info.get("size", 0)
                return size_bytes / (1024 * 1024)
        except Exception:
            pass
        # Try to estimate from model name
        size_map = {
            "1b": 700, "2b": 1400, "3b": 2100, "4b": 2800,
            "7b": 4500, "8b": 5200, "13b": 8000, "34b": 18000,
            "70b": 35000,
        }
        for size_str, mb in size_map.items():
            if size_str in model:
                return float(mb)
        return 0.0

    def classify_model(self, model: str) -> bool:
        """Check if a model is a vision model."""
        vision_keywords = ["llava", "vision", "bakllava", "qwen3-vl", "qwen-vl", "cogvlm", "idefics"]
        return any(kw in model.lower() for kw in vision_keywords)

    def run_single_benchmark(
        self,
        model: str,
        task_name: str,
        task: Dict,
        iteration: int,
        prompt_override: Optional[str] = None,
    ) -> BenchmarkResult:
        """Run a single benchmark task for a model."""
        prompt = prompt_override or task["prompt"]

        # For vision tasks, use analyze_image; otherwise use generate
        is_vision = "vision" in task_name or "[image]" in prompt.lower()

        start_time = time.time()
        try:
            if is_vision and self.classify_model(model):
                if not self.vision_images:
                    raise RuntimeError(
                        "No vision benchmark images found. Provide --vision-image-dir or add PNGs under "
                        "tools/design-screenshot/, assets/screenshots/, or docs/screenshots/."
                    )

                image_path = str(self.vision_images[iteration % len(self.vision_images)])
                response = self.client.analyze_image(
                    image_path=image_path,
                    prompt=prompt,
                    model=model,
                    temperature=0.1,
                    num_predict=300,
                )
            else:
                response = self.client.generate(
                    prompt=prompt,
                    model=model,
                    temperature=0.1 if task_name == "structured_output" else 0.3,
                    num_predict=300,
                )

            latency_ms = (time.time() - start_time) * 1000

            return BenchmarkResult(
                task_name=task_name,
                model=model,
                iteration=iteration,
                success=response.success,
                latency_ms=latency_ms,
                tokens_per_second=response.tokens_per_second,
                response_length=len(response.response) if response.response else 0,
                quality_score=self._score_response(response.response, task_name),
                response_text=response.response[:500] if response.response else "",
            )

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return BenchmarkResult(
                task_name=task_name,
                model=model,
                iteration=iteration,
                success=False,
                latency_ms=latency_ms,
                error=str(e)[:200],
            )

    def _score_response(self, response: str, task_name: str) -> float:
        """Score a response for quality (0-10). Heuristic but consistent."""
        if not response or len(response.strip()) < 5:
            return 0.0

        score = 5.0  # Base score

        # Length bonus (not too short, not absurdly long)
        length = len(response)
        if length >= 50:
            score += 1.0
        if length >= 150:
            score += 0.5
        if length > 1000:
            score -= 0.5

        # Structured output bonus
        if task_name == "structured_output" or task_name == "code_analysis_quality":
            if "{" in response or "```" in response or "\n" in response:
                score += 1.0

        # Quality language bonus
        quality_words = ["recommend", "suggest", "should", "consider", "improve", "optimize"]
        found_quality = sum(1 for w in quality_words if w.lower() in response.lower())
        score += min(found_quality * 0.25, 1.0)

        # Penalize obvious refusal patterns
        if "apologize" in response.lower()[:200] and "cannot" in response.lower():
            score -= 2.0
        if "cannot perform" in response.lower():
            score -= 2.0

        return max(0.0, min(10.0, score))

    def run_all_benchmarks(self) -> None:
        """Run all benchmarks across all models."""
        num_iterations = 2 if self.quick else BENCHMARK_TASKS["vision_accuracy"]["iterations"] + 1

        total_tasks = len(BENCHMARK_TASKS) * len(self.models) * num_iterations
        completed = 0

        print(f"\n{'='*60}")
        print(f"  MODEL BENCHMARK SUITE")
        print(f"  Models: {len(self.models)}")
        print(f"  Tasks: {len(BENCHMARK_TASKS)}")
        print(f"  Iterations: {num_iterations}")
        print(f"  Total runs: {total_tasks}")
        print(f"{'='*60}\n")

        if not self.client.check_server():
            print("  ERROR: Ollama server not reachable. Is it running?")
            sys.exit(1)

        installed_names = set(m.get("name") for m in self.client.list_models())

        for model in self.models:
            # Get model info
            self.model_info[model] = {
                "size_mb": self.get_model_size(model),
                "is_vision": self.classify_model(model),
            }

            if model not in installed_names:
                print(f"  WARN: {model} - Skipping (not installed in Ollama)")
                continue

            print(f"\n  Testing model: {model}")
            print(f"     Size: {self.model_info[model]['size_mb']:.0f} MB")
            print(f"     Vision: {'Yes' if self.model_info[model]['is_vision'] else 'No'}")

            for task_name, task in BENCHMARK_TASKS.items():
                iterations = 1 if self.quick else task.get("iterations", 2)
                task_results = []

                for i in range(iterations):
                    completed += 1
                    pct = (completed / total_tasks) * 100
                    print(f"     [{pct:.0f}%] {task_name} (iter {i+1}/{iterations})...", end=" ", flush=True)

                    result = self.run_single_benchmark(model, task_name, task, i)
                    task_results.append(result)
                    self.results.append(result)

                    if result.success:
                        print(f"OK ({result.latency_ms:.0f}ms, score: {result.quality_score:.1f}/10)")
                    else:
                        print(f"FAIL ({result.error[:60]})" if result.error else "FAIL")

                # Store aggregated task score
                if model not in self.model_scores:
                    self.model_scores[model] = ModelScore(
                        model=model,
                        is_vision_model=self.model_info[model]["is_vision"],
                        model_size_mb=self.model_info[model]["size_mb"],
                    )

                successful_results = [r for r in task_results if r.success]
                if successful_results:
                    avg_quality = statistics.mean(r.quality_score for r in successful_results)
                    avg_latency = statistics.mean(r.latency_ms for r in successful_results)
                    avg_tps = statistics.mean(r.tokens_per_second for r in successful_results if r.tokens_per_second > 0)
                    self.model_scores[model].task_scores[task_name] = round(avg_quality, 1)

                    # Weighted scoring
                    self.model_scores[model].weighted_total += avg_quality * task["weight"]

                    if "speed" in task_name or "efficiency" in task_name:
                        if avg_tps > 0:
                            self.model_scores[model].performance_score += avg_tps * task["weight"]
                    else:
                        self.model_scores[model].quality_score += avg_quality * task["weight"]

    def generate_recommendations(self) -> List[KeepDeleteRecommendation]:
        """Generate keep/delete recommendations based on benchmark results."""
        recommendations = []
        scores_list = sorted(self.model_scores.values(), key=lambda x: x.weighted_total, reverse=True)

        if not scores_list:
            return recommendations

        # Determine thresholds
        top_score = scores_list[0].weighted_total
        median_score = statistics.median([s.weighted_total for s in scores_list]) if len(scores_list) > 1 else 0

        # Category-specific best models
        best_by_category = {}
        for cat in ["performance", "quality"]:
            best_model = None
            best_cat_score = 0
            for ms in scores_list:
                score = ms.performance_score if cat == "performance" else ms.quality_score
                if score > best_cat_score:
                    best_cat_score = score
                    best_model = ms.model
            if best_model:
                best_by_category[cat] = best_model

        for i, ms in enumerate(scores_list):
            total = len(scores_list)
            rank = i + 1
            score = ms.weighted_total

            # Relative score (0-100)
            relative = (score / top_score * 100) if top_score > 0 else 0

            # Determine recommendation
            reasons = []
            alternatives = []

            # Performance check for this app
            perf_score = ms.task_scores.get("vision_speed", 0)
            quality_score = ms.task_scores.get("vision_accuracy", 0)
            code_quality = ms.task_scores.get("code_analysis_quality", 0)
            structured = ms.task_scores.get("structured_output", 0)
            reasoning = ms.task_scores.get("text_reasoning", 0)

            use_cases = []
            if ms.is_vision_model:
                if quality_score >= 6:
                    use_cases.append("UI screenshot analysis")
                if perf_score >= 70:
                    use_cases.append("Live screenshot analysis")
            else:
                if code_quality >= 5:
                    use_cases.append("Code analysis")
                if structured >= 5:
                    use_cases.append("Structured output generation")
                if reasoning >= 5:
                    use_cases.append("General reasoning")

            if rank == 1:
                action = "keep"
                confidence = 0.95
                reasons.append(f"Top performer (score: {score:.1f})")
                if ms.is_vision_model:
                    reasons.append("Best for UI screenshot analysis")
                else:
                    reasons.append("Best for code/documentation analysis")
            elif score >= median_score * 1.2:
                action = "keep"
                confidence = 0.8
                reasons.append(f"Above average performance (score: {score:.1f})")
                if use_cases:
                    reasons.append(f"Good for: {', '.join(use_cases)}")
            elif score >= median_score * 0.8:
                action = "conditional"
                confidence = 0.5
                reasons.append(f"Average performance (score: {score:.1f})")
                if ms.model_size_mb > 5000:
                    reasons.append(f"Large model ({ms.model_size_mb:.0f} MB) - consider if storage is limited")
                    alternatives.append(best_by_category.get("quality", scores_list[0].model))
                else:
                    reasons.append("Decent fallback option")
            else:
                action = "delete"
                confidence = 0.7
                reasons.append(f"Below average (score: {score:.1f} vs top {top_score:.1f})")
                if ms.model_size_mb > 3000:
                    reasons.append(f"Wastes {ms.model_size_mb:.0f} MB storage for poor performance")
                # Suggest replacement
                for rec in recommendations:
                    if rec.action == "keep" and rec.model != ms.model:
                        alternatives.append(rec.model)
                        break
                if not alternatives and len(scores_list) > 1:
                    alternatives.append(scores_list[0].model)

            # Special case: vision models that can't do vision
            if ms.is_vision_model and quality_score < 3:
                action = "delete"
                confidence = 0.85
                reasons.append("Vision model with poor vision task performance")

            # Special case: small fast models keep as fallback
            if ms.model_size_mb < 2500 and perf_score > 4:
                if action == "delete":
                    action = "conditional"
                    confidence = 0.5
                    reasons.append("However, small/fast enough for quick tasks")

            recommendations.append(KeepDeleteRecommendation(
                model=ms.model,
                action=action,
                confidence=confidence,
                reasoning="; ".join(reasons),
                alternatives=alternatives,
                model_size_mb=ms.model_size_mb,
            ))

        return recommendations

    def generate_report(self, recommendations: List[KeepDeleteRecommendation]) -> str:
        """Generate the full benchmark report."""
        report = []
        report.append("# Space Analyzer — Ollama Model Benchmark Report")
        report.append(f"Generated: {datetime.now().isoformat()}")
        report.append(f"Ollama Host: {self.host}")
        report.append(f"Models Tested: {len(self.model_scores)}")
        report.append(f"Tasks: {len(BENCHMARK_TASKS)}")
        report.append("")

        # Rankings table
        report.append("## 🏆 Model Rankings")
        report.append("")
        report.append("| Rank | Model | Score | Performance | Quality | Size | Action |")
        report.append("|------|-------|-------|-------------|---------|------|--------|")

        sorted_models = sorted(self.model_scores.values(), key=lambda x: x.weighted_total, reverse=True)
        for i, ms in enumerate(sorted_models, 1):
            rec = next((r for r in recommendations if r.model == ms.model), None)
            action_str = rec.action if rec else "?"
            report.append(
                f"| {i} | {ms.model} | {ms.weighted_total:.1f} | "
                f"{ms.performance_score:.0f} | {ms.quality_score:.0f} | "
                f"{ms.model_size_mb:.0f}MB | {action_str} |"
            )

        # Per-model deep dive
        report.append("")
        report.append("## 📊 Per-Model Task Scores")
        report.append("")

        for ms in sorted_models:
            report.append(f"### {ms.model}")
            report.append(f"- Size: {ms.model_size_mb:.0f} MB | Vision: {'Yes' if ms.is_vision_model else 'No'}")
            report.append(f"- Weighted Total: {ms.weighted_total:.1f}")
            report.append("")
            report.append("| Task | Score |")
            report.append("|------|-------|")
            for task_name, score in sorted(ms.task_scores.items(), key=lambda x: x[1], reverse=True):
                task_desc = BENCHMARK_TASKS.get(task_name, {}).get("description", task_name)
                report.append(f"| {task_desc} | {score:.1f} |")
            report.append("")

        # Recommendations
        report.append("## 🔧 Recommendations")
        report.append("")
        for rec in recommendations:
            icon = {"keep": "[KEEP]", "delete": "[DELETE]", "conditional": "[CONDITIONAL]"}.get(rec.action, "[?]")
            report.append(f"### {icon} {rec.model}")
            report.append(f"- **Action**: {rec.action.upper()}")
            report.append(f"- **Confidence**: {rec.confidence * 100:.0f}%")
            report.append(f"- **Reasoning**: {rec.reasoning}")
            if rec.alternatives:
                report.append(f"- **Alternative**: {', '.join(rec.alternatives)}")
            report.append("")

        # Storage summary
        keep_size = sum(r.model_size_mb for r in recommendations if r.action == "keep")
        delete_size = sum(r.model_size_mb for r in recommendations if r.action == "delete")
        report.append("## Storage Impact")
        report.append("")
        report.append(f"- Recommended to **keep**: {keep_size:.0f} MB")
        report.append(f"- Recommended to **delete**: {delete_size:.0f} MB")
        report.append(f"- **Potential savings**: {delete_size:.0f} MB")
        report.append("")

        # Quick commands
        report.append("## 🚀 Cleanup Commands")
        report.append("```bash")
        for rec in recommendations:
            if rec.action == "delete":
                report.append(f"ollama rm {rec.model}")
        report.append("```")
        report.append("")

        return "\n".join(report)

    def save_results(self) -> Path:
        """Save benchmark results to disk."""
        BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Raw results
        results_file = BENCHMARK_DIR / f"benchmark_results_{ts}.json"
        data = {
            "timestamp": ts,
            "host": self.host,
            "models": self.models,
            "model_info": self.model_info,
            "results": [asdict(r) for r in self.results],
            "scores": {m: asdict(s) for m, s in self.model_scores.items()},
        }
        results_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

        recommendations = self.generate_recommendations()

        # Report
        report = self.generate_report(recommendations)
        report_file = BENCHMARK_DIR / f"benchmark_report_{ts}.md"
        report_file.write_text(report, encoding="utf-8")

        # Recommendations JSON
        rec_file = BENCHMARK_DIR / f"recommendations_{ts}.json"
        rec_file.write_text(
            json.dumps([asdict(r) for r in recommendations], indent=2),
            encoding="utf-8",
        )

        # Latest symlink
        latest = BENCHMARK_DIR / "latest.json"
        latest.write_text(json.dumps(data, indent=2), encoding="utf-8")

        print(f"\n  📄 Results: {results_file}")
        print(f"  📝 Report: {report_file}")
        print(f"  🔧 Recommendations: {rec_file}")

        return report_file

    def print_summary(self, recommendations: List[KeepDeleteRecommendation]):
        """Print summary to console."""
        print(f"\n{'='*60}")
        print(f"  BENCHMARK SUMMARY")
        print(f"{'='*60}")

        sorted_models = sorted(self.model_scores.values(), key=lambda x: x.weighted_total, reverse=True)
        for i, ms in enumerate(sorted_models, 1):
            rec = next((r for r in recommendations if r.model == ms.model), None)
            icon = {"keep": "[KEEP]", "delete": "[DELETE]", "conditional": "[CONDITIONAL]"}.get(rec.action if rec else "", "[?]")
            print(f"  {i}. {icon} {ms.model}")
            print(f"     Score: {ms.weighted_total:.1f} | Size: {ms.model_size_mb:.0f}MB")
            if rec:
                print(f"     {rec.reasoning}")

        keep = [r for r in recommendations if r.action == "keep"]
        delete = [r for r in recommendations if r.action == "delete"]
        conditional = [r for r in recommendations if r.action == "conditional"]

        print(f"\n  Keep: {len(keep)}")
        print(f"  Conditional: {len(conditional)}")
        print(f"  Delete: {len(delete)}")
        total_savings = sum(r.model_size_mb for r in delete)
        print(f"\n  Estimated storage savings: {total_savings:.0f} MB")
        print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="Ollama Model Benchmark Suite for Space Analyzer")
    parser.add_argument("--models", default=None,
                        help="Comma-separated list of models to test")
    parser.add_argument("--quick", action="store_true",
                        help="Quick benchmark (fewer iterations)")
    parser.add_argument("--report-only", action="store_true",
                        help="Generate report from cached results only")
    parser.add_argument("--host", default=OLLAMA_HOST,
                        help=f"Ollama host URL (default: {OLLAMA_HOST})")
    parser.add_argument("--auto-discover", action="store_true",
                        help="Auto-discover installed models")
    parser.add_argument(
        "--vision-image-dir",
        default=None,
        help="Directory containing PNG screenshots for vision benchmarks (default: tools/design-screenshot/)",
    )

    args = parser.parse_args()

    # Determine which models to test
    if args.auto_discover:
        client = OllamaClient(base_url=args.host)
        if client.check_server():
            available = client.list_models()
            args.models = ",".join([m["name"] for m in available])
            print(f"  🔍 Auto-discovered models: {args.models}")
        else:
            print("  ERROR: Cannot discover models - Ollama not running")
            sys.exit(1)

    if not args.models:
        # Default models to benchmark
        args.models = "phi4-mini:latest,qwen3-vl:4b,gemma3:4b,llava:7b,deepseek-coder:6.7b-instruct"

    models = [m.strip() for m in args.models.split(",")]

    suite = ModelBenchmarkSuite(
        models=models,
        host=args.host,
        quick=args.quick,
        vision_image_dir=Path(args.vision_image_dir) if args.vision_image_dir else None,
    )

    if args.report_only:
        # Load cached results
        latest = BENCHMARK_DIR / "latest.json"
        if not latest.exists():
            print("No cached results found. Run benchmark first.")
            sys.exit(1)
        with open(latest) as f:
            data = json.load(f)
        suite.results = [BenchmarkResult(**r) for r in data["results"]]
        for model, sdata in data["scores"].items():
            suite.model_scores[model] = ModelScore(**sdata)
            suite.model_info[model] = data.get("model_info", {}).get(model, {})
        recommendations = suite.generate_recommendations()
        suite.print_summary(recommendations)
        suite.save_results()
    else:
        suite.run_all_benchmarks()
        recommendations = suite.generate_recommendations()
        suite.print_summary(recommendations)
        report_file = suite.save_results()
        print(f"\n  📄 Full report: {report_file}")


if __name__ == "__main__":
    main()

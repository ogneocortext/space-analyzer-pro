#!/usr/bin/env python3
"""
Ollama CUDA vs Non-CUDA Performance Benchmark
===============================================
Optimized Ollama benchmark to compare CUDA vs non-CUDA performance for coding models.
"""

import argparse
import json
import os
import sys
import time
import statistics
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "ai-service"))
from ollama_client import OllamaClient

# ── Configuration ──────────────────────────────────────────────────
BENCHMARK_DIR = Path("benchmark_results")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# Coding-specific prompt templates
CODING_PROMPTS = {
    "code_generation": """Write a Python function that:
1. Takes a list of integers as input
2. Returns the sum of all even numbers
3. Handles empty lists gracefully
4. Includes type hints and docstring

Provide only the function code, no explanation.""",

    "code_debugging": """Find and fix the bug in this Python code:

```python
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)
```

Explain the bug and provide the fixed code.""",

    "code_explanation": """Explain what this Python function does in simple terms:

```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)
```

Include time complexity and use cases.""",

    "code_refactoring": """Refactor this Python code to be more Pythonic and efficient:

```python
result = []
for i in range(len(items)):
    if items[i] > 0:
        result.append(items[i] * 2)
```

Provide the improved code with explanation.""",

    "algorithm_design": """Design an algorithm to find the longest palindromic substring in a string.
Provide:
1. Approach explanation
2. Time/space complexity
3. Python implementation
4. Edge cases handling""",
}

# ── Benchmark tasks ───────────────────────────────────────────────
BENCHMARK_TASKS = {
    "code_generation_speed": {
        "description": "Speed of code generation",
        "category": "performance",
        "weight": 1.5,
        "prompt": CODING_PROMPTS["code_generation"],
        "iterations": 3,
    },
    "code_generation_quality": {
        "description": "Quality of generated code",
        "category": "quality",
        "weight": 2.0,
        "prompt": CODING_PROMPTS["code_generation"],
        "iterations": 2,
    },
    "debugging_accuracy": {
        "description": "Accuracy in finding and fixing bugs",
        "category": "quality",
        "weight": 2.0,
        "prompt": CODING_PROMPTS["code_debugging"],
        "iterations": 2,
    },
    "code_explanation": {
        "description": "Clarity of code explanations",
        "category": "quality",
        "weight": 1.5,
        "prompt": CODING_PROMPTS["code_explanation"],
        "iterations": 2,
    },
    "refactoring_skill": {
        "description": "Code refactoring ability",
        "category": "quality",
        "weight": 1.5,
        "prompt": CODING_PROMPTS["code_refactoring"],
        "iterations": 2,
    },
    "algorithm_design": {
        "description": "Algorithm design and implementation",
        "category": "quality",
        "weight": 2.0,
        "prompt": CODING_PROMPTS["algorithm_design"],
        "iterations": 1,
    },
}


# ── Data classes ──────────────────────────────────────────────────
@dataclass
class BenchmarkResult:
    """Result of a single benchmark run."""
    task_name: str
    environment: str  # "cuda" or "non-cuda"
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
class EnvironmentScore:
    """Aggregated score for an environment."""
    environment: str
    model: str
    task_scores: Dict[str, float] = field(default_factory=dict)
    weighted_total: float = 0.0

    # Category breakdowns
    performance_score: float = 0.0
    quality_score: float = 0.0

    # Metadata
    avg_latency_ms: float = 0.0
    avg_tokens_per_second: float = 0.0
    total_queries: int = 0
    successful_queries: int = 0


@dataclass
class ComparisonResult:
    """Comparison between CUDA and non-CUDA."""
    cuda_score: EnvironmentScore
    non_cuda_score: EnvironmentScore
    winner: str
    speedup_factor: float
    latency_improvement_pct: float
    recommendations: List[str] = field(default_factory=list)


# ── Benchmark runner ──────────────────────────────────────────────
class OllamaCUDABenchmark:
    """Benchmark suite for comparing CUDA vs non-CUDA Ollama performance."""

    def __init__(
        self,
        model: str = "qwen2.5-coder:7b-instruct",
        quick: bool = False,
        force_environment: Optional[str] = None,
    ):
        self.model = model
        self.quick = quick
        self.force_environment = force_environment
        self.client = OllamaClient(base_url=OLLAMA_HOST, default_model=model)
        self.results: List[BenchmarkResult] = []
        self.environment_scores: Dict[str, EnvironmentScore] = {}

    def run_single_benchmark(
        self,
        environment: str,
        task_name: str,
        task: Dict,
        iteration: int,
    ) -> BenchmarkResult:
        """Run a single benchmark task."""
        prompt = task["prompt"]
        start_time = time.time()

        try:
            # Use CUDA optimization if in CUDA environment
            cuda_opts = {}
            if environment == "cuda":
                cuda_opts = {
                    "num_gpu": 50,  # Use 50 GPU layers
                    "num_ctx": 4096,  # Larger context for CUDA
                    "num_thread": 8,  # More threads for CUDA
                }
            
            response = self.client.generate(
                prompt=prompt,
                model=self.model,
                temperature=0.2,
                num_predict=500,
                **cuda_opts,
            )

            latency_ms = (time.time() - start_time) * 1000

            # Extract response data safely
            response_text = getattr(response, 'response', '')
            tokens_per_second = getattr(response, 'tokens_per_second', 0.0)
            success = getattr(response, 'success', False)
            error_msg = getattr(response, 'error', '')

            return BenchmarkResult(
                task_name=task_name,
                environment=environment,
                model=self.model,
                iteration=iteration,
                success=success,
                latency_ms=latency_ms,
                tokens_per_second=tokens_per_second,
                response_length=len(response_text) if response_text else 0,
                quality_score=self._score_coding_response(response_text, task_name),
                response_text=response_text[:500] if response_text else "",
                error=error_msg[:200] if error_msg else '',
            )

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            return BenchmarkResult(
                task_name=task_name,
                environment=environment,
                model=self.model,
                iteration=iteration,
                success=False,
                latency_ms=latency_ms,
                error=str(e)[:200],
            )

    def _score_coding_response(self, response: str, task_name: str) -> float:
        """Score a coding response for quality (0-10)."""
        if not response or len(response.strip()) < 5:
            return 0.0

        score = 5.0  # Base score

        # Length bonus (code responses should be substantial)
        length = len(response)
        if length >= 100:
            score += 1.0
        if length >= 300:
            score += 0.5
        if length > 2000:
            score -= 0.5  # Too verbose

        # Code-specific bonuses
        code_indicators = ["def ", "function", "class ", "import ", "```", "return ", "if ", "for "]
        found_code = sum(1 for indicator in code_indicators if indicator in response)
        score += min(found_code * 0.3, 2.0)

        # Explanation quality
        explanation_words = ["because", "since", "therefore", "however", "approach", "algorithm", "complexity"]
        found_explanation = sum(1 for w in explanation_words if w.lower() in response.lower())
        score += min(found_explanation * 0.2, 1.0)

        # Structured output bonus
        if "{" in response or "```" in response or "\n" in response:
            score += 0.5

        # Penalize obvious refusal patterns
        if "apologize" in response.lower()[:200] and "cannot" in response.lower():
            score -= 2.0
        if "cannot perform" in response.lower():
            score -= 2.0

        return max(0.0, min(10.0, score))

    def run_all_benchmarks(self) -> None:
        """Run all benchmarks in both environments."""
        num_iterations = 2 if self.quick else 3
        total_tasks = len(BENCHMARK_TASKS) * 2 * num_iterations  # 2 environments
        completed = 0

        print(f"\n{'='*60}")
        print(f"  OLLAMA CUDA vs NON-CUDA BENCHMARK")
        print(f"  Model: {self.model}")
        print(f"  Tasks: {len(BENCHMARK_TASKS)}")
        print(f"  Iterations: {num_iterations}")
        print(f"  Total runs: {total_tasks}")
        print(f"{'='*60}\n")

        # Check Ollama server
        if not self.client.check_server():
            print("  ERROR: Ollama server not reachable. Exiting.")
            sys.exit(1)
        print("  [OK] Ollama server available\n")

        # Benchmark in current environment (will be detected as CUDA or non-CUDA)
        current_env = self._detect_environment()
        print(f"  Detected environment: {current_env.upper()}\n")

        for task_name, task in BENCHMARK_TASKS.items():
            iterations = 1 if self.quick else task.get("iterations", 2)
            
            for i in range(iterations):
                completed += 1
                pct = (completed / total_tasks) * 100
                print(f"     [{pct:.0f}%] {current_env.upper()} - {task_name} (iter {i+1}/{iterations})...", end=" ", flush=True)

                result = self.run_single_benchmark(current_env, task_name, task, i)
                self.results.append(result)

                if result.success:
                    print(f"OK ({result.latency_ms:.0f}ms, {result.tokens_per_second:.1f} tok/s, score: {result.quality_score:.1f}/10)")
                else:
                    print(f"FAIL ({result.error[:60]})" if result.error else "FAIL (no error message)")

        # Calculate scores
        self._calculate_scores()

    def _detect_environment(self) -> str:
        """Detect if running in CUDA environment."""
        # Use forced environment if provided
        if self.force_environment:
            return self.force_environment.lower()
        
        # Check for CUDA environment variables
        if os.getenv('CUDA_VISIBLE_DEVICES') or os.getenv('CUDA_HOME') or os.getenv('NVIDIA_VISIBLE_DEVICES'):
            return "cuda"
        
        # Check for conda environment with CUDA
        conda_env = os.getenv('CONDA_DEFAULT_ENV')
        if conda_env and 'cuda' in conda_env.lower():
            return "cuda"
        
        # Default to non-cuda
        return "non-cuda"

    def _calculate_scores(self) -> None:
        """Calculate aggregated scores for each environment."""
        for environment in ["cuda", "non-cuda"]:
            env_results = [r for r in self.results if r.environment == environment]
            if not env_results:
                continue

            score = EnvironmentScore(
                environment=environment,
                model=self.model,
            )

            for task_name, task in BENCHMARK_TASKS.items():
                task_results = [r for r in env_results if r.task_name == task_name and r.success]
                if task_results:
                    avg_quality = statistics.mean(r.quality_score for r in task_results)
                    tps_values = [r.tokens_per_second for r in task_results if r.tokens_per_second > 0]
                    avg_tps = statistics.mean(tps_values) if tps_values else 0.0

                    score.task_scores[task_name] = round(avg_quality, 1)
                    score.weighted_total += avg_quality * task["weight"]

                    if "speed" in task_name:
                        if avg_tps > 0:
                            score.performance_score += avg_tps * task["weight"]
                    else:
                        score.quality_score += avg_quality * task["weight"]

            # Calculate averages
            successful_results = [r for r in env_results if r.success]
            if successful_results:
                score.total_queries = len(env_results)
                score.successful_queries = len(successful_results)
                score.avg_latency_ms = statistics.mean(r.latency_ms for r in successful_results)
                score.avg_tokens_per_second = statistics.mean(
                    r.tokens_per_second for r in successful_results if r.tokens_per_second > 0
                )

            self.environment_scores[f"{environment}_{self.model}"] = score

    def generate_comparison(self) -> Optional[ComparisonResult]:
        """Generate comparison between CUDA and non-CUDA."""
        cuda_key = f"cuda_{self.model}"
        non_cuda_key = f"non_cuda_{self.model}"

        if cuda_key not in self.environment_scores or non_cuda_key not in self.environment_scores:
            return None

        cuda_score = self.environment_scores[cuda_key]
        non_cuda_score = self.environment_scores[non_cuda_key]

        # Determine winner
        if cuda_score.weighted_total > non_cuda_score.weighted_total:
            winner = "cuda"
        else:
            winner = "non-cuda"

        # Calculate speedup
        if non_cuda_score.avg_tokens_per_second > 0:
            speedup_factor = cuda_score.avg_tokens_per_second / non_cuda_score.avg_tokens_per_second
        else:
            speedup_factor = 1.0

        # Calculate latency improvement
        if non_cuda_score.avg_latency_ms > 0:
            latency_improvement_pct = ((non_cuda_score.avg_latency_ms - cuda_score.avg_latency_ms) / 
                                      non_cuda_score.avg_latency_ms) * 100
        else:
            latency_improvement_pct = 0.0

        # Generate recommendations
        recommendations = []
        if winner == "cuda":
            recommendations.append("CUDA environment provides better overall performance")
            if speedup_factor > 1.2:
                recommendations.append(f"CUDA is {speedup_factor:.2f}x faster in token generation")
            if latency_improvement_pct > 10:
                recommendations.append(f"CUDA has {latency_improvement_pct:.1f}% lower latency")
        else:
            recommendations.append("Non-CUDA environment provides better overall performance")
            if speedup_factor < 0.8:
                recommendations.append(f"Non-CUDA is {1/speedup_factor:.2f}x faster in token generation")
            if latency_improvement_pct < -10:
                recommendations.append(f"Non-CUDA has {abs(latency_improvement_pct):.1f}% lower latency")

        return ComparisonResult(
            cuda_score=cuda_score,
            non_cuda_score=non_cuda_score,
            winner=winner,
            speedup_factor=speedup_factor,
            latency_improvement_pct=latency_improvement_pct,
            recommendations=recommendations,
        )

    def generate_report(self, comparison: Optional[ComparisonResult]) -> str:
        """Generate the benchmark report."""
        report = []
        report.append("# Ollama CUDA vs Non-CUDA Benchmark Report")
        report.append(f"Generated: {datetime.now().isoformat()}")
        report.append(f"Model: {self.model}")
        report.append(f"Tasks: {len(BENCHMARK_TASKS)}")
        report.append("")

        # Comparison summary
        if comparison:
            report.append("## Overall Winner")
            report.append("")
            report.append(f"**{comparison.winner.upper()}** wins with better overall performance")
            report.append("")

            report.append("### Performance Metrics")
            report.append("")
            report.append("| Metric | CUDA | Non-CUDA | Difference |")
            report.append("|--------|------|----------|------------|")
            report.append(f"| Weighted Score | {comparison.cuda_score.weighted_total:.1f} | {comparison.non_cuda_score.weighted_total:.1f} | {comparison.cuda_score.weighted_total - comparison.non_cuda_score.weighted_total:+.1f} |")
            report.append(f"| Quality Score | {comparison.cuda_score.quality_score:.1f} | {comparison.non_cuda_score.quality_score:.1f} | {comparison.cuda_score.quality_score - comparison.non_cuda_score.quality_score:+.1f} |")
            report.append(f"| Avg Latency (ms) | {comparison.cuda_score.avg_latency_ms:.0f} | {comparison.non_cuda_score.avg_latency_ms:.0f} | {comparison.cuda_score.avg_latency_ms - comparison.non_cuda_score.avg_latency_ms:+.0f} |")
            report.append(f"| Tokens/sec | {comparison.cuda_score.avg_tokens_per_second:.1f} | {comparison.non_cuda_score.avg_tokens_per_second:.1f} | {comparison.cuda_score.avg_tokens_per_second - comparison.non_cuda_score.avg_tokens_per_second:+.1f} |")
            report.append(f"| Speedup Factor | - | - | {comparison.speedup_factor:.2f}x |")
            report.append(f"| Latency Improvement | - | - | {comparison.latency_improvement_pct:+.1f}% |")
            report.append("")

            report.append("### Recommendations")
            report.append("")
            for rec in comparison.recommendations:
                report.append(f"- {rec}")
            report.append("")

        # Per-task breakdown
        report.append("## Per-Task Scores")
        report.append("")

        for task_name, task in BENCHMARK_TASKS.items():
            report.append(f"### {task['description']}")
            report.append("")
            
            cuda_score = self.environment_scores.get(f"cuda_{self.model}", EnvironmentScore(environment="cuda", model=self.model))
            non_cuda_score = self.environment_scores.get(f"non_cuda_{self.model}", EnvironmentScore(environment="non-cuda", model=self.model))
            
            cuda_task_score = cuda_score.task_scores.get(task_name, 0)
            non_cuda_task_score = non_cuda_score.task_scores.get(task_name, 0)
            
            report.append("| Environment | Score |")
            report.append("|-------------|-------|")
            report.append(f"| CUDA | {cuda_task_score:.1f} |")
            report.append(f"| Non-CUDA | {non_cuda_task_score:.1f} |")
            report.append("")

        return "\n".join(report)

    def save_results(self) -> Path:
        """Save benchmark results to disk."""
        BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Raw results
        results_file = BENCHMARK_DIR / f"ollama_cuda_benchmark_{ts}.json"
        data = {
            "timestamp": ts,
            "model": self.model,
            "results": [asdict(r) for r in self.results],
            "environment_scores": {k: asdict(v) for k, v in self.environment_scores.items()},
        }
        results_file.write_text(json.dumps(data, indent=2), encoding="utf-8")

        comparison = self.generate_comparison()
        report = self.generate_report(comparison)
        report_file = BENCHMARK_DIR / f"ollama_cuda_benchmark_report_{ts}.md"
        report_file.write_text(report, encoding="utf-8")

        print(f"\n  [Results] {results_file}")
        print(f"  [Report] {report_file}")

        return report_file


def main():
    parser = argparse.ArgumentParser(description="Ollama CUDA vs Non-CUDA Benchmark")
    parser.add_argument("--model", default="qwen2.5-coder:7b-instruct",
                        help="Ollama model to benchmark")
    parser.add_argument("--quick", action="store_true",
                        help="Quick benchmark (fewer iterations)")
    parser.add_argument("--environment", choices=["cuda", "non-cuda"], default=None,
                        help="Force specific environment (cuda or non-cuda)")

    args = parser.parse_args()

    suite = OllamaCUDABenchmark(
        model=args.model,
        quick=args.quick,
        force_environment=args.environment,
    )

    suite.run_all_benchmarks()
    report_file = suite.save_results()
    print(f"\n  Full report: {report_file}")


if __name__ == "__main__":
    main()

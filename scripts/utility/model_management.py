#!/usr/bin/env python3
"""
Ollama Model Management - Keep/Delete/Replace based on benchmark results
and Space Analyzer use cases.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient

BENCHMARK_DIR: Path = Path("benchmark_results")
OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")

DEFAULT_OLLAMA_TIMEOUT_S: int = 10
REMOVE_TIMEOUT_S: int = 60
PULL_TIMEOUT_S: int = 300

logger = logging.getLogger("model_management")


class UseCase:
    """Definition of a Space Analyzer use case and its model preferences."""

    def __init__(
        self,
        description: str,
        required_capabilities: list[str],
        preferred_models: list[str],
        min_quality: float,
        max_latency_ms: int,
    ) -> None:
        self.description = description
        self.required_capabilities = required_capabilities
        self.preferred_models = preferred_models
        self.min_quality = min_quality
        self.max_latency_ms = max_latency_ms

    def matches(self, model_name: str) -> bool:
        """Check whether a model name could serve this use case.

        Args:
            model_name: Installed model name.

        Returns:
            True if the model's family matches a preferred model.
        """
        name_lower = model_name.lower()
        for preferred in self.preferred_models:
            family = preferred.split(":")[0].lower()
            if name_lower.startswith(family):
                return True
        return False

    def is_preferred(self, model_name: str) -> bool:
        """Check whether a model name is in the preferred list exactly.

        Args:
            model_name: Installed model name.

        Returns:
            True if the model name matches a preferred entry.
        """
        return model_name in self.preferred_models


class ModelManager:
    """Manage Ollama models based on benchmark results and app needs."""

    USE_CASES: dict[str, UseCase] = {
        "ui_screenshot_analysis": UseCase(
            description="Analyzing application screenshots for UI/UX feedback",
            required_capabilities=["vision"],
            preferred_models=[
                "qwen3-vl:2b",
                "qwen3-vl:4b",
                "gemma4:e2b-it-qat",
                "llava:7b",
                "bakllava",
            ],
            min_quality=6.0,
            max_latency_ms=30000,
        ),
        "code_analysis": UseCase(
            description="Analyzing source code files for categorization",
            required_capabilities=["code_reasoning"],
            preferred_models=[
                "qwen3.5:4b",
                "qwen3.5:9b",
                "deepseek-r1:7b",
                "qwen2.5-coder:7b-instruct",
                "gemma4:e2b-it-qat",
            ],
            min_quality=5.0,
            max_latency_ms=15000,
        ),
        "cleanup_recommendations": UseCase(
            description="Generating file cleanup and organization recommendations",
            required_capabilities=["reasoning"],
            preferred_models=[
                "qwen3.5:4b",
                "qwen3.5:9b",
                "gemma4:e2b-it-qat",
                "llama3.2:3b",
                "deepseek-r1:7b",
            ],
            min_quality=5.0,
            max_latency_ms=15000,
        ),
        "documentation": UseCase(
            description="Generating user documentation and help content",
            required_capabilities=["writing"],
            preferred_models=[
                "qwen3.5:9b",
                "llama3.2:3b",
                "gemma4:e2b-it-qat",
                "qwen3.5:4b",
            ],
            min_quality=5.0,
            max_latency_ms=20000,
        ),
        "fast_chat": UseCase(
            description="Quick conversational AI for in-app assistance",
            required_capabilities=["conversation"],
            preferred_models=[
                "qwen3.5:4b",
                "llama3.2:3b",
                "gemma4:e2b-it-qat",
                "deepseek-r1:7b",
            ],
            min_quality=4.0,
            max_latency_ms=5000,
        ),
    }

    def __init__(self, host: str = OLLAMA_HOST, timeout: int = DEFAULT_OLLAMA_TIMEOUT_S) -> None:
        """Initialize the manager with the Ollama host URL.

        Args:
            host: Base URL of the Ollama server.
            timeout: Default HTTP timeout in seconds.
        """
        self.host = host
        self.client = OllamaClient(host=host, timeout=timeout, retries=1)

    def list_installed_models(self) -> list[dict[str, Any]]:
        """List all installed models with sizes from the Ollama API.

        Returns:
            List of model metadata dicts (empty list on error).
        """
        result: list[dict[str, Any]] = self.client.list_models()
        return result

    def get_model_size_mb(self, model_name: str) -> float:
        """Get the size of an installed model in megabytes.

        Args:
            model_name: Name of the model as reported by Ollama.

        Returns:
            Size in MB, or 0.0 if the model is not installed.
        """
        for model in self.list_installed_models():
            if model.get("name") == model_name:
                return float(model.get("size", 0)) / (1024 * 1024)
        return 0.0

    def _run_ollama_command(self, args: list[str], timeout: int) -> subprocess.CompletedProcess[str] | None:
        """Run an ollama CLI command with consistent error handling.

        Args:
            args: Command arguments (including "ollama" as the first element).
            timeout: Timeout in seconds.

        Returns:
            CompletedProcess on success, None on failure.
        """
        try:
            return subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except FileNotFoundError:
            logger.error("ollama CLI not found in PATH")
            return None
        except subprocess.TimeoutExpired:
            logger.error("Command timed out after %ds: %s", timeout, " ".join(args))
            return None

    def remove_model(self, model_name: str) -> bool:
        """Remove a model from Ollama.

        Args:
            model_name: Name of the model to remove.

        Returns:
            True if removal succeeded, False otherwise.
        """
        result = self._run_ollama_command(["ollama", "rm", model_name], REMOVE_TIMEOUT_S)
        if result is None:
            return False
        if result.returncode == 0:
            logger.info("Removed: %s", model_name)
            return True
        logger.error("Failed to remove %s: %s", model_name, result.stderr.strip())
        return False

    def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama.

        Args:
            model_name: Name of the model to pull.

        Returns:
            True if pull succeeded, False otherwise.
        """
        result = self._run_ollama_command(["ollama", "pull", model_name], PULL_TIMEOUT_S)
        if result is None:
            return False
        if result.returncode == 0:
            logger.info("Pulled: %s", model_name)
            return True
        logger.error("Failed to pull %s: %s", model_name, result.stderr.strip())
        return False

    def _load_benchmark_scores(self, benchmark_file: str) -> dict[str, dict[str, Any]]:
        """Load aggregated benchmark scores for installed models.

        Args:
            benchmark_file: Path to a benchmark results JSON file.

        Returns:
            Mapping of model name to score dict.
        """
        path = Path(benchmark_file)
        if not path.exists():
            return {}
        try:
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("Could not read benchmark file %s: %s", path, e)
            return {}

        scores = data.get("scores", {})
        if not isinstance(scores, dict):
            return {}
        return scores

    def analyze_installed_models(
        self,
        benchmark_file: str | None = None,
    ) -> list[dict[str, Any]]:
        """Analyze installed models against use case requirements.

        Args:
            benchmark_file: Optional path to benchmark results JSON.

        Returns:
            Per-model analysis entries with size, use case fit, and benchmark data.
        """
        installed = self.list_installed_models()
        if not installed:
            logger.info("No models found")
            return []

        benchmark_scores = self._load_benchmark_scores(benchmark_file) if benchmark_file else {}
        analysis: list[dict[str, Any]] = []

        for model in installed:
            name = model["name"]
            size_mb = model.get("size", 0) / (1024 * 1024)
            bench = benchmark_scores.get(name)
            bench_summary = {
                "weighted_total": bench.get("weighted_total", 0),
                "quality_score": bench.get("quality_score", 0),
                "performance_score": bench.get("performance_score", 0),
                "task_scores": bench.get("task_scores", {}),
            } if bench else None

            suitable_for = [
                {
                    "use_case": use_case_name,
                    "description": uc.description,
                    "priority": "high" if uc.is_preferred(name) else "low",
                }
                for use_case_name, uc in self.USE_CASES.items()
                if uc.matches(name)
            ]

            analysis.append({
                "model": name,
                "size_mb": round(size_mb, 1),
                "suitable_for": suitable_for,
                "benchmark_available": bench_summary is not None,
                "last_benchmark_weighted_total": bench_summary["weighted_total"] if bench_summary else None,
                "last_benchmark_task_scores": bench_summary["task_scores"] if bench_summary else None,
            })

        return analysis

    def generate_cleanup_plan(
        self,
        keep_models: list[str],
        delete_models: list[str],
        dry_run: bool = True,
    ) -> dict[str, Any]:
        """Generate and optionally execute a cleanup plan.

        Args:
            keep_models: Models to keep.
            delete_models: Models to delete.
            dry_run: If True, do not actually remove models.

        Returns:
            Plan dict with keep/delete entries and total space to free.
        """
        installed = {m["name"]: m for m in self.list_installed_models()}

        plan: dict[str, Any] = {
            "timestamp": datetime.now().isoformat(),
            "keep": [],
            "delete": [],
            "total_space_freed_mb": 0.0,
            "dry_run": dry_run,
        }

        for model_name in keep_models:
            if model_name in installed:
                plan["keep"].append({
                    "model": model_name,
                    "size_mb": self.get_model_size_mb(model_name),
                })

        for model_name in delete_models:
            if model_name not in installed:
                continue
            size = self.get_model_size_mb(model_name)
            plan["delete"].append({
                "model": model_name,
                "size_mb": size,
            })
            plan["total_space_freed_mb"] += size
            if not dry_run:
                self.remove_model(model_name)

        return plan

    def interactive_cleanup(self, benchmark_dir: str = "benchmark_results") -> None:
        """Interactive cleanup wizard based on benchmark results.

        Args:
            benchmark_dir: Directory containing benchmark JSON files.
        """
        latest = Path(benchmark_dir) / "latest.json"
        if not latest.exists():
            logger.info("No benchmark results found in %s/", benchmark_dir)
            logger.info("Run: python scripts/model_benchmark.py first")
            return

        with latest.open(encoding="utf-8") as f:
            data = json.load(f)

        logger.info("=" * 60)
        logger.info("MODEL CLEANUP WIZARD")
        logger.info("=" * 60)

        installed_names = [m["name"] for m in self.list_installed_models()]
        keep: list[str] = []
        delete: list[str] = []

        for rec in data.get("model_scores", {}):
            if rec not in installed_names:
                continue

            size_mb = self.get_model_size_mb(rec)
            action = input(f"  Model: {rec} (size: {size_mb:.0f} MB) — Keep/Delete/Skip? [k/d/s]: ").strip().lower()
            if action == "d":
                delete.append(rec)
            elif action == "k":
                keep.append(rec)

        plan = self.generate_cleanup_plan(keep, delete, dry_run=True)
        logger.info(
            "Plan Summary: Keep=%d, Delete=%d, Space freed=%.0f MB",
            len(plan["keep"]),
            len(plan["delete"]),
            plan["total_space_freed_mb"],
        )

        if input("Execute cleanup? [y/n]: ").strip().lower() == "y":
            plan = self.generate_cleanup_plan(keep, delete, dry_run=False)
            logger.info("Cleanup complete! Freed %.0f MB", plan["total_space_freed_mb"])
        else:
            logger.info("Cancelled")


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Optional argument list.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(description="Ollama Model Management for Space Analyzer")
    parser.add_argument("--list", action="store_true", help="List installed models")
    parser.add_argument("--analyze", action="store_true", help="Analyze models against use cases")
    parser.add_argument("--benchmark-file", default=None, help="Path to benchmark results JSON")
    parser.add_argument("--cleanup", action="store_true", help="Interactive cleanup wizard")
    parser.add_argument("--rm", default=None, help="Remove a specific model")
    parser.add_argument("--pull", default=None, help="Pull a specific model")
    parser.add_argument("--dry-run", action="store_true", help="Show cleanup plan without executing")
    parser.add_argument("--keep", default=None, help="Comma-separated models to keep")
    parser.add_argument("--delete", default=None, help="Comma-separated models to delete")
    parser.add_argument("--use-cases", action="store_true", help="Show supported use cases")
    parser.add_argument("--host", default=OLLAMA_HOST, help="Ollama host URL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def _setup_logging(verbose: bool = False) -> None:
    """Configure root logger with a consistent format.

    Args:
        verbose: If True, set DEBUG level; otherwise INFO.
    """
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def _print_installed_models(manager: ModelManager) -> None:
    """Print a formatted list of installed models.

    Args:
        manager: Initialized ModelManager.
    """
    print("\nInstalled Models:")
    for model in manager.list_installed_models():
        size_mb = model.get("size", 0) / (1024 * 1024)
        print(f"  {model['name']:<40} {size_mb:>8.1f} MB")


def _print_analysis(manager: ModelManager, benchmark_file: str | None) -> None:
    """Print a formatted model analysis report.

    Args:
        manager: Initialized ModelManager.
        benchmark_file: Optional benchmark file path.
    """
    print("\nModel Analysis:")
    for item in manager.analyze_installed_models(benchmark_file):
        print(f"\n  {item['model']} ({item['size_mb']} MB)")
        if item["suitable_for"]:
            for uc in item["suitable_for"]:
                print(f"    -> {uc['use_case']} [{uc['priority']}]")
        else:
            print("    -> No matching use cases")


def _print_use_cases() -> None:
    """Print the supported use case definitions."""
    print("\nSupported Use Cases:")
    for name, uc in ModelManager.USE_CASES.items():
        print(f"\n  {name}:")
        print(f"    {uc.description}")
        print(f"    Min quality: {uc.min_quality}/10 | Max latency: {uc.max_latency_ms}ms")
        print(f"    Preferred: {', '.join(uc.preferred_models[:3])}...")


def _print_plan(manager: ModelManager, keep: list[str], delete: list[str], dry_run: bool) -> None:
    """Print a cleanup plan as JSON.

    Args:
        manager: Initialized ModelManager.
        keep: Models to keep.
        delete: Models to delete.
        dry_run: Whether to skip actual removal.
    """
    plan = manager.generate_cleanup_plan(keep, delete, dry_run=dry_run)
    print(json.dumps(plan, indent=2))


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI.

    Args:
        argv: Optional argument list.

    Returns:
        Process exit code.
    """
    args = _parse_args(argv)
    _setup_logging(args.verbose)
    manager = ModelManager(host=args.host)

    if args.list:
        _print_installed_models(manager)
    elif args.analyze:
        _print_analysis(manager, args.benchmark_file)
    elif args.use_cases:
        _print_use_cases()
    elif args.cleanup:
        manager.interactive_cleanup()
    elif args.rm:
        manager.remove_model(args.rm)
    elif args.pull:
        manager.pull_model(args.pull)
    elif args.keep or args.delete:
        keep = [m.strip() for m in args.keep.split(",")] if args.keep else []
        delete = [m.strip() for m in args.delete.split(",")] if args.delete else []
        _print_plan(manager, keep, delete, args.dry_run)
    else:
        _parse_args(["--help"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

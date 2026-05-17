#!/usr/bin/env python3
"""
Ollama Model Management - Keep/Delete/Replace based on benchmark results
and Space Analyzer use cases.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

BENCHMARK_DIR = Path("benchmark_results")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


class ModelManager:
    """Manage Ollama models based on benchmark results and app needs."""

    # Space Analyzer use case requirements
    USE_CASES = {
        "ui_screenshot_analysis": {
            "description": "Analyzing application screenshots for UI/UX feedback",
            "required_capabilities": ["vision"],
            "preferred_models": [
                "qwen3-vl:4b",
                "qwen2.5-vl:7b",
                "llava:7b",
                "bakllava",
                "phi3-vision",
            ],
            "min_quality": 6.0,
            "max_latency_ms": 30000,
        },
        "code_analysis": {
            "description": "Analyzing source code files for categorization",
            "required_capabilities": ["code_reasoning"],
            "preferred_models": [
                "qwen2.5-coder:7b-instruct",
                "deepseek-coder:6.7b-instruct",
                "codegemma:7b",
                "starcoder2:7b",
                "phi4-mini:latest",
            ],
            "min_quality": 5.0,
            "max_latency_ms": 15000,
        },
        "cleanup_recommendations": {
            "description": "Generating file cleanup and organization recommendations",
            "required_capabilities": ["reasoning"],
            "preferred_models": [
                "phi4-mini:latest",
                "gemma3:4b",
                "qwen2.5:7b-instruct",
                "mistral:7b-instruct",
            ],
            "min_quality": 5.0,
            "max_latency_ms": 15000,
        },
        "documentation": {
            "description": "Generating user documentation and help content",
            "required_capabilities": ["writing"],
            "preferred_models": [
                "qwen2.5:7b-instruct",
                "gemma3:4b",
                "mistral:7b-instruct",
                "llama3.1:8b-instruct",
            ],
            "min_quality": 5.0,
            "max_latency_ms": 20000,
        },
        "fast_chat": {
            "description": "Quick conversational AI for in-app assistance",
            "required_capabilities": ["conversation"],
            "preferred_models": [
                "phi4-mini:latest",
                "gemma3:4b",
                "qwen2.5:3b-instruct",
                "llama3.1:8b-instruct",
            ],
            "min_quality": 4.0,
            "max_latency_ms": 5000,
        },
    }

    def __init__(self, host: str = OLLAMA_HOST):
        self.host = host
        self.base_url = host.rstrip("/")

    def list_installed_models(self) -> List[Dict[str, Any]]:
        """List all installed models with sizes."""
        import urllib.request
        try:
            url = f"{self.base_url}/api/tags"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                return data.get("models", [])
        except Exception as e:
            print(f"Error fetching models: {e}")
            return []

    def get_model_size_mb(self, model_name: str) -> float:
        """Get model size in MB."""
        models = self.list_installed_models()
        for m in models:
            if m["name"] == model_name:
                return m.get("size", 0) / (1024 * 1024)
        return 0.0

    def remove_model(self, model_name: str) -> bool:
        """Remove a model from Ollama."""
        try:
            result = subprocess.run(
                ["ollama", "rm", model_name],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode == 0:
                print(f"  ✅ Removed: {model_name}")
                return True
            else:
                print(f"  ❌ Failed to remove {model_name}: {result.stderr}")
                return False
        except FileNotFoundError:
            print("  ❌ ollama CLI not found in PATH")
            return False
        except subprocess.TimeoutExpired:
            print(f"  ❌ Timeout removing {model_name}")
            return False
        except Exception as e:
            print(f"  ❌ Error: {e}")
            return False

    def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama."""
        try:
            result = subprocess.run(
                ["ollama", "pull", model_name],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode == 0:
                print(f"  ✅ Pulled: {model_name}")
                return True
            else:
                print(f"  ❌ Failed to pull {model_name}: {result.stderr}")
                return False
        except FileNotFoundError:
            print("  ❌ ollama CLI not found in PATH")
            return False
        except subprocess.TimeoutExpired:
            print(f"  ⏰ Timeout pulling {model_name} (may still be downloading)")
            return False
        except Exception as e:
            print(f"  ❌ Error: {e}")
            return False

    def analyze_installed_models(
        self,
        benchmark_file: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Analyze installed models against use case requirements."""
        installed = self.list_installed_models()
        if not installed:
            print("No models found.")
            return []

        analysis = []
        for model in installed:
            name = model["name"]
            size_mb = model.get("size", 0) / (1024 * 1024)

            # Check benchmark results if available (prefer aggregated scores)
            bench_summary = None
            if benchmark_file and Path(benchmark_file).exists():
                with open(benchmark_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # scripts/model_benchmark.py writes aggregated scores under "scores"
                scores = data.get("scores", {})
                if isinstance(scores, dict) and name in scores:
                    s = scores[name]
                    bench_summary = {
                        "weighted_total": s.get("weighted_total", 0),
                        "quality_score": s.get("quality_score", 0),
                        "performance_score": s.get("performance_score", 0),
                        "task_scores": s.get("task_scores", {}),
                    }

            # Check which use cases this model could serve
            suitable_for = []
            for use_case, reqs in self.USE_CASES.items():
                if any(name.startswith(pref.split(":")[0].lower()) for pref in reqs["preferred_models"]):
                    suitable_for.append({
                        "use_case": use_case,
                        "description": reqs["description"],
                        "priority": "high" if name in reqs["preferred_models"] else "low",
                    })

            analysis.append({
                "model": name,
                "size_mb": round(size_mb, 1),
                "suitable_for": suitable_for,
                "benchmark_available": bench_summary is not None,
                "last_benchmark_weighted_total": bench_summary.get("weighted_total") if bench_summary else None,
                "last_benchmark_task_scores": bench_summary.get("task_scores") if bench_summary else None,
            })

        return analysis

    def generate_cleanup_plan(
        self,
        keep_models: List[str],
        delete_models: List[str],
        dry_run: bool = True,
    ) -> Dict[str, Any]:
        """Generate and optionally execute a cleanup plan."""
        plan = {
            "timestamp": datetime.now().isoformat(),
            "keep": [],
            "delete": [],
            "total_space_freed_mb": 0,
            "dry_run": dry_run,
        }

        installed = {m["name"]: m for m in self.list_installed_models()}

        for model_name in keep_models:
            if model_name in installed:
                plan["keep"].append({
                    "model": model_name,
                    "size_mb": self.get_model_size_mb(model_name),
                })

        for model_name in delete_models:
            if model_name in installed:
                size = self.get_model_size_mb(model_name)
                plan["delete"].append({
                    "model": model_name,
                    "size_mb": size,
                })
                plan["total_space_freed_mb"] += size

                if not dry_run:
                    self.remove_model(model_name)

        return plan

    def interactive_cleanup(self, benchmark_dir: str = "benchmark_results"):
        """Interactive cleanup wizard based on benchmark results."""
        latest = Path(benchmark_dir) / "latest.json"
        if not latest.exists():
            print(f"  No benchmark results found in {benchmark_dir}/")
            print("  Run: python scripts/model_benchmark.py first")
            return

        with open(latest) as f:
            data = json.load(f)

        recommendations_file = None
        for f in sorted(Path(benchmark_dir).glob("recommendations_*.json"), reverse=True):
            recommendations_file = f
            break

        if recommendations_file:
            with open(recommendations_file) as f:
                recs = [json.loads(line) if line.strip() else None for line in f.read().split("\n") if line.strip()]
                recs = [json.loads(f.read())] if not recs else recs

        print("\n" + "=" * 60)
        print("  🧹 MODEL CLEANUP WIZARD")
        print("=" * 60 + "\n")

        installed = self.list_installed_models()
        installed_names = [m["name"] for m in installed]

        keep = []
        delete = []

        for rec in data.get("model_scores", {}).keys():
            if rec not in installed_names:
                continue

            print(f"  Model: {rec}")
            print(f"    Installed size: {self.get_model_size_mb(rec):.0f} MB")

            action = input("    Keep (k), Delete (d), Skip (s)? [k/d/s]: ").strip().lower()

            if action == "d":
                delete.append(rec)
            elif action == "k":
                keep.append(rec)

        plan = self.generate_cleanup_plan(keep, delete, dry_run=True)

        print(f"\n  Plan Summary:")
        print(f"    Keep: {len(plan['keep'])} models")
        print(f"    Delete: {len(plan['delete'])} models")
        print(f"    Space freed: {plan['total_space_freed_mb']:.0f} MB")

        execute = input("\n  Execute cleanup? [y/n]: ").strip().lower()
        if execute == "y":
            plan = self.generate_cleanup_plan(keep, delete, dry_run=False)
            print(f"\n  ✅ Cleanup complete! Freed {plan['total_space_freed_mb']:.0f} MB")
        else:
            print("  Cancelled.")


def main():
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

    args = parser.parse_args()

    manager = ModelManager()

    if args.list:
        print("\n📦 Installed Models:")
        for m in manager.list_installed_models():
            size_mb = m.get("size", 0) / (1024 * 1024)
            print(f"  {m['name']:<40} {size_mb:>8.1f} MB")

    elif args.analyze:
        analysis = manager.analyze_installed_models(args.benchmark_file)
        print("\n📊 Model Analysis:")
        for item in analysis:
            print(f"\n  {item['model']} ({item['size_mb']} MB)")
            if item["suitable_for"]:
                for uc in item["suitable_for"]:
                    print(f"    → {uc['use_case']} [{uc['priority']}]")
            else:
                print(f"    → No matching use cases")

    elif args.use_cases:
        print("\n🎯 Supported Use Cases:")
        for name, info in ModelManager.USE_CASES.items():
            print(f"\n  {name}:")
            print(f"    {info['description']}")
            print(f"    Min quality: {info['min_quality']}/10 | Max latency: {info['max_latency_ms']}ms")
            print(f"    Preferred: {', '.join(info['preferred_models'][:3])}...")

    elif args.cleanup:
        manager.interactive_cleanup()

    elif args.rm:
        manager.remove_model(args.rm)

    elif args.pull:
        manager.pull_model(args.pull)

    elif args.keep or args.delete:
        keep = [m.strip() for m in args.keep.split(",")] if args.keep else []
        delete = [m.strip() for m in args.delete.split(",")] if args.delete else []
        plan = manager.generate_cleanup_plan(keep, delete, dry_run=args.dry_run)
        print(json.dumps(plan, indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()

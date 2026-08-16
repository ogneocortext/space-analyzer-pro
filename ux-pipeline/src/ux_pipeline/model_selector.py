"""Pick Ollama models from benchmark-derived recommendations.

Loads ``benchmark_results/task_recommendations.json`` (produced by
``consolidate_benchmarks.py``) and maps a Space Analyzer use case or task to
the highest-scoring model. Everything degrades gracefully when the file is
missing or the recommended model is not installed, so the helpers can be used
as drop-in defaults without risking import-time or runtime failures.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("ux_pipeline.model_selector")

#: File written by ``consolidate_benchmarks.py``.
DEFAULT_RECOMMENDATIONS_FILE = "benchmark_results/task_recommendations.json"

#: Use case that drives the pipeline's vision-centric default model.
DEFAULT_USE_CASE = "ui_screenshot_analysis"

#: Last-resort model when no benchmark data is available at all.
FALLBACK_MODEL = "qwen3-vl:4b"

#: Per-use-case fallback models (used only when the benchmark file is absent
#: or the recommended model is not installed).
USE_CASE_FALLBACKS: dict[str, str] = {
    "ui_screenshot_analysis": "qwen3-vl:4b",
    "code_analysis": "qwen3.5:4b",
    "cleanup_recommendations": "llama3.2:3b",
    "documentation": "qwen3.5:9b",
    "fast_chat": "llama3.2:3b",
}


def _find_recommendations_file(explicit: str | None = None) -> Path | None:
    """Locate ``task_recommendations.json`` from an explicit path or by search.

    Args:
        explicit: Optional explicit path override (env or caller-supplied).

    Returns:
        Resolved :class:`Path` to the JSON file, or ``None`` when not found.
    """
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    env = os.getenv("BENCHMARK_RECOMMENDATIONS")
    if env:
        candidates.append(Path(env))
    candidates.append(Path.cwd() / DEFAULT_RECOMMENDATIONS_FILE)
    # Walk up from this module looking for a repo-root benchmark_results dir.
    here = Path(__file__).resolve().parent
    candidates.extend(parent / DEFAULT_RECOMMENDATIONS_FILE for parent in [here, *here.parents])

    for candidate in candidates:
        try:
            if candidate.is_file():
                return candidate
        except OSError:
            continue
    return None


def load_recommendations(explicit: str | None = None) -> dict[str, Any]:
    """Load the benchmark recommendation mapping.

    Args:
        explicit: Optional explicit path to the recommendations JSON.

    Returns:
        Parsed dict (``{"per_task": ..., "per_use_case": ...}``) or ``{}`` when
        the file is missing or unreadable.
    """
    path = _find_recommendations_file(explicit)
    if path is None:
        return {}
    try:
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read recommendations %s: %s", path, exc)
        return {}
    return data if isinstance(data, dict) else {}


def _is_installed(model: str, installed: list[str] | None) -> bool:
    """Return True when ``model`` is in ``installed`` (or when unknown)."""
    if installed is None:
        return True
    return model in installed


def recommend_model(
    use_case: str,
    installed: list[str] | None = None,
    explicit: str | None = None,
    default: str | None = None,
) -> str:
    """Return the recommended model name for a use case.

    Args:
        use_case: Key from ``per_use_case`` (e.g. ``"ui_screenshot_analysis"``).
        installed: Optional list of installed model names; when provided, the
            recommendation falls back to a known-good model if the top pick is
            not installed.
        explicit: Optional explicit path to the recommendations JSON.
        default: Optional override for the fallback model.

    Returns:
        Model name to use. Never raises.
    """
    recs = load_recommendations(explicit)
    entry = recs.get("per_use_case", {}).get(use_case)
    if entry:
        model = entry.get("model")
        if model and _is_installed(model, installed):
            return model

    if default is None:
        default = USE_CASE_FALLBACKS.get(use_case, FALLBACK_MODEL)
    if _is_installed(default, installed):
        return default
    if installed:
        return installed[0]
    return default


def recommend_model_for_task(
    task_key: str,
    installed: list[str] | None = None,
    explicit: str | None = None,
    default: str | None = None,
) -> str:
    """Return the recommended model for a single benchmarked task.

    Args:
        task_key: Key from ``per_task`` (e.g. ``"vision_ui_analysis"``).
        installed: Optional installed-model filter.
        explicit: Optional explicit path to the recommendations JSON.
        default: Optional fallback model.

    Returns:
        Model name to use. Never raises.
    """
    recs = load_recommendations(explicit)
    entry = recs.get("per_task", {}).get(task_key)
    if entry:
        model = entry.get("model")
        if model and _is_installed(model, installed):
            return model
    if default is None:
        default = FALLBACK_MODEL
    if _is_installed(default, installed):
        return default
    if installed:
        return installed[0]
    return default


def resolve_pipeline_vision_model(
    installed: list[str] | None = None,
    explicit: str | None = None,
    default: str = FALLBACK_MODEL,
) -> str:
    """Convenience: best model for the pipeline's vision-centric workload."""
    return recommend_model(DEFAULT_USE_CASE, installed=installed, explicit=explicit, default=default)


def all_recommendations(explicit: str | None = None) -> dict[str, Any]:
    """Return the full recommendation mapping (empty dict when unavailable)."""
    return load_recommendations(explicit)

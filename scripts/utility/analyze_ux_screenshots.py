#!/usr/bin/env python3
"""Backward-compatible entry point for the UX analysis pipeline.

The implementation moved into the :mod:`ux_analysis` package (same directory):
the public API is re-exported here so existing importers
(``live_progress_server``, ``ux_server_render``, ``_regen_per_shot``) and the
subprocess invocation keep working unchanged.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ux_analysis import (  # noqa: E402
    MODEL,
    OllamaClient,
    ask_ollama,
    ANALYSIS_SCHEMA,
    ANALYSIS_SYSTEM,
    AGGREGATE_SYSTEM,
    CODE_SCHEMA,
    CODE_SYSTEM,
    _build_analysis_prompt,
    _build_single_shot_analysis_prompt,
    _build_code_prompt,
    _parse_shot,
    _render_full_report,
    run_analysis,
)
from ux_analysis.cli import main  # noqa: E402

__all__ = [
    "MODEL",
    "OllamaClient",
    "ask_ollama",
    "ANALYSIS_SCHEMA",
    "ANALYSIS_SYSTEM",
    "AGGREGATE_SYSTEM",
    "CODE_SCHEMA",
    "CODE_SYSTEM",
    "_build_analysis_prompt",
    "_build_single_shot_analysis_prompt",
    "_build_code_prompt",
    "_parse_shot",
    "_render_full_report",
    "run_analysis",
    "main",
]

if __name__ == "__main__":
    sys.exit(main())

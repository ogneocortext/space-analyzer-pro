"""Standalone UX pipeline for Space Analyzer Pro.

The package bundles the Python tooling that lives around the Rust desktop app:
PIL feature extraction, Ollama vision analysis, a consolidated issue tracker,
quality history, a localhost web dashboard, and an optional PyTorch/CUDA vision
analyzer. Every module is importable independently; the CLI surfaces in
:mod:`ux_pipeline.pipeline` and :mod:`ux_pipeline.web_dashboard`.

Public API
----------
This top-level module re-exports the most stable names so that downstream
code can simply do ``from ux_pipeline import IssueTracker, PipelineConfig``.
"""

from __future__ import annotations

from ._issue_tracker import IssueTracker, IssueRow, IssueStatus
from ._ollama_client import OllamaClient, OllamaError
from ._pipeline_config import PipelineConfig, load_config
from ._quality_history import QualityHistory, QualityRecord
from ._screenshot_links import ScreenshotLinkStore
from ._sqlite_store import SqliteIssueStore
from ._vision_to_issues import (
    VisionFinding,
    findings_to_rows,
    row_from_finding,
)

__all__ = [
    "IssueRow",
    "IssueStatus",
    "IssueTracker",
    "SqliteIssueStore",
    "OllamaClient",
    "OllamaError",
    "PipelineConfig",
    "QualityHistory",
    "QualityRecord",
    "ScreenshotLinkStore",
    "VisionFinding",
    "findings_to_rows",
    "load_config",
    "row_from_finding",
]

__version__ = "0.1.1"

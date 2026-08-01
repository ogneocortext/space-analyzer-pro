"""Compatibility shim: re-export OllamaClient from the ux-pipeline package."""
from __future__ import annotations

from ux_pipeline._ollama_client import OllamaClient

__all__ = ["OllamaClient"]

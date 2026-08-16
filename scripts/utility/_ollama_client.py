"""Compatibility shim: re-export OllamaClient from the ux-pipeline package."""
from ux_pipeline._ollama_client import OllamaClient

__all__ = ["OllamaClient"]

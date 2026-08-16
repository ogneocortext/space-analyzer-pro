"""Local Ollama vision helper - semantic (slower) screenshot analysis.

Thin wrapper over the shared :class:`OllamaClient` from ``_ollama_client``
(which itself re-exports the stdlib client from the ``ux_pipeline`` package).
Kept as a stable API for ``analyze_single_screenshot.py``.

Usage:
    python ollama_vision.py <image> [prompt] [model] [host]

On any failure it raises OllamaVisionError with a clear message so callers
(analyze_single_screenshot.py) can degrade gracefully instead of crashing.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient

DEFAULT_MODEL = "gemma4:e2b-it-qat"
DEFAULT_HOST = "http://localhost:11434"
DEFAULT_TIMEOUT = 180


class OllamaVisionError(Exception):
    """Raised when the Ollama vision call fails."""


def describe(image_path, prompt, model=DEFAULT_MODEL, host=DEFAULT_HOST, timeout=DEFAULT_TIMEOUT):
    client = OllamaClient(host=host, timeout=timeout, retries=2)
    try:
        with open(image_path, "rb") as f:
            data = f.read()
    except OSError as e:
        raise OllamaVisionError(f"cannot read image {image_path!r}: {e}") from e

    try:
        return client.generate(model, prompt, stream=False, images=[data])
    except Exception as exc:  # noqa: BLE001 - surface a clear, typed error
        raise OllamaVisionError(str(exc)) from exc


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python ollama_vision.py <image> [prompt] [model] [host]")
        sys.exit(1)
    path = sys.argv[1]
    prompt = sys.argv[2] if len(sys.argv) > 2 else (
        "Describe this UI screenshot in detail: what application is it, the screen/page name, "
        "the main panels and controls, any text/labels you can read, and the overall layout. "
        "Be specific about whether it looks like a disk-space analyzer dashboard."
    )
    model = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_MODEL
    host = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_HOST
    try:
        print(describe(path, prompt, model, host))
    except OllamaVisionError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

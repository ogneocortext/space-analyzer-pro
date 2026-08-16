"""Shared helpers for the Space Analyzer screenshot / UX analysis scripts.

Consolidates functionality that was previously copy-pasted across
``analyze_ux_screenshots.py``, ``analyze_design_feedback.py`` and
``benchmark_models.py``: console configuration, screenshot-directory
resolution, image encoding for vision models, model-text parsing, and
vision-model detection against a local Ollama instance.

Keeping these in one place means bug fixes (e.g. image-encoding behaviour)
only need to land once.
"""

from __future__ import annotations

import logging
import platform
import re
import sys
from pathlib import Path
from typing import Any

try:
    from PIL import Image
    _HAVE_PIL = True
except Exception:  # pragma: no cover - PIL optional for callers that never encode
    _HAVE_PIL = False

logger = logging.getLogger("space_analyzer.scripts.common")

# Heuristic prefixes that identify a vision-capable Ollama model.
VISION_MODEL_HINTS: tuple[str, ...] = (
    "qwen3-vl", "qwen3.5", "gemma4", "llava", "moondream", "idefics2", "paligemma",
)
DEFAULT_VISION_MODEL: str = "gemma4:e2b-it-qat"

# Thematic capture buckets: "YYYY-MM-DD__<origin>__<representation>".
# The date sorts lexicographically (chronological) and the two trailing
# segments record *what led to the capture* (origin) and *what it shows*
# (representation), e.g. "2026-08-13__winui3-capture__ui-pages".
CAPTURE_BUCKET_RE = re.compile(r"^\d{4}-\d{2}-\d{2}__.+__.+$")


def is_capture_dir(name: str) -> bool:
    """True for any directory that holds a capture: legacy ``screenshots_*`` or a
    thematic ``YYYY-MM-DD__<origin>__<representation>`` bucket."""
    return name.startswith("screenshots_") or bool(CAPTURE_BUCKET_RE.match(name))


def configure_console() -> None:
    """Best-effort UTF-8 ``stdout`` reconfiguration (Windows).

    Without this, a model that emits non-ASCII text can crash the script with
    a ``UnicodeEncodeError`` when the default console codec is not UTF-8.
    """
    if platform.system() == "Windows":
        try:
            reconfigure = getattr(sys.stdout, "reconfigure", None)
            if reconfigure is not None:
                reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError) as exc:
            logger.debug("Could not reconfigure stdout: %s", exc)


def find_latest_screenshots_dir(root: Path | str) -> Path | None:
    """Return the most-recently-modified capture directory.

    A "capture directory" is either a legacy ``screenshots_*`` folder or a
    thematic ``YYYY-MM-DD__<origin>__<representation>`` bucket. If *root* itself
    is a capture directory it is returned directly; otherwise the newest capture
    subdirectory of *root* is chosen.

    Sorting is by modification time (not name), because a stale ``screenshots_verify``
    directory otherwise sorts after timestamped ones alphabetically (``'v' > '2'``)
    and shadows the newest capture.
    """
    root = Path(root)
    if root.is_dir() and is_capture_dir(root.name):
        return root
    if not root.is_dir():
        return None
    candidates = [d for d in root.iterdir() if d.is_dir() and is_capture_dir(d.name)]
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def encode_image_for_vision(path: Path | str, max_dim: int = 1024) -> bytes | None:
    """Resize an image for a vision model and return raw PNG bytes, or ``None``.

    The image is converted to RGB and downscaled so the longest side is at most
    *max_dim* (matching the app's ``resizeBase64Image`` behaviour). Returns
    ``None`` if the file cannot be read or encoded.
    """
    if not _HAVE_PIL:
        logger.warning("Pillow is not installed; cannot encode %s", path)
        return None
    try:
        import io

        with Image.open(path) as img:
            img = img.convert("RGB")
            w, h = img.size
            scale = max_dim / max(w, h)
            if scale < 1.0:
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
    except Exception as exc:
        logger.warning("Could not encode %s: %s", path, exc)
        return None


def parse_model_text(text: str) -> str:
    """Strip ``<think>`` reasoning traces and channel tokens from a response."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<think>.*$", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<\|channel\|>", "", text, flags=re.IGNORECASE)
    return text.strip()


def detect_vision_models(
    client: Any,
    preferred: tuple[str, ...] = VISION_MODEL_HINTS,
) -> list[str]:
    """Return installed models that look like vision models (best-effort).

    Falls back to the first few installed models when no name matches a known
    vision prefix, so a custom-named local model still gets picked up.
    """
    try:
        models = client.list_models()
    except Exception as exc:
        logger.debug("Vision model detection failed: %s", exc)
        return []
    names = [m.get("name", "") for m in models if isinstance(m, dict)]
    return [n for n in names if any(n.lower().startswith(h) for h in preferred)] or names[:3]


def pick_vision_model(
    client: Any,
    default: str = DEFAULT_VISION_MODEL,
    preferred: tuple[str, ...] = VISION_MODEL_HINTS,
) -> str:
    """Pick a vision model for analysis.

    Prefers *default* if it is installed, otherwise the first detected vision
    model, otherwise *default* (which the caller will attempt regardless).
    """
    available = detect_vision_models(client, preferred)
    if default in available:
        return default
    for candidate in available:
        if any(candidate.startswith(h) for h in preferred):
            return candidate
    return default

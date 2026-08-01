"""Ollama vision enrichment for the issue tracker.

Given a screenshot file and a baseline prompt, this module asks Ollama to
produce a list of UX issues. The response is parsed by
:func:`ux_pipeline._vision_to_issues.parse_model_findings` and returned as
:class:`VisionFinding` objects ready to be turned into tracker rows.

The module is deliberately import-safe in environments without a live
Ollama server: :func:`enrich_screenshot` returns an empty list on transport
errors so the rest of the pipeline keeps working.
"""

from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from typing import Any

from ._ollama_client import OllamaClient, OllamaError
from ._vision_to_issues import VisionFinding, parse_model_findings

logger = logging.getLogger("ux_pipeline.llm_enrich")

DEFAULT_PROMPT: str = (
    "You are a UI/UX auditor. Look at this desktop application screenshot "
    "and respond with a JSON array of issues, where each item has the keys "
    '"title" (short string), "category" (one of: ui, ux, a11y, layout, color, '
    'typography, performance, other), "severity" (one of: low, medium, high, '
    'critical) and "notes" (one sentence). If you see no issues, return an '
    "empty JSON array. Do not include any other prose."
)

DEFAULT_VISION_MODEL: str = "qwen3-vl:4b"


def _read_image(path: Path) -> bytes:
    """Read the bytes of an image file (assumed to be small enough to fit in memory)."""
    return path.read_bytes()


def enrich_screenshot(
    screenshot: Path | str,
    *,
    client: OllamaClient | None = None,
    model: str = DEFAULT_VISION_MODEL,
    prompt: str = DEFAULT_PROMPT,
) -> list[VisionFinding]:
    """Send ``screenshot`` to Ollama and parse the response into findings.

    Uses the Ollama ``/api/chat`` endpoint with multimodal message format,
    which is the current standard for vision-capable models (qwen3-vl,
    gemma4, etc.).

    Args:
        screenshot: Path to a PNG/JPG screenshot.
        client: Optional pre-built :class:`OllamaClient`. When ``None`` one
            is constructed with default settings (host from ``OLLAMA_HOST``).
        model: Ollama vision model name. Defaults to ``qwen3-vl:2b``.
        prompt: Prompt text sent alongside the image.

    Returns:
        List of :class:`VisionFinding` rows. Empty on transport / parse
        errors; the underlying exception is logged at debug level.
    """
    path = Path(screenshot)
    if not path.exists():
        logger.debug("Screenshot %s does not exist", path)
        return []
    if client is None:
        client = OllamaClient()
    try:
        image_bytes = _read_image(path)
    except OSError as exc:
        logger.debug("Could not read screenshot %s: %s", path, exc)
        return []
    try:
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        messages = [
            {"role": "user", "content": prompt, "images": [image_b64]}
        ]
        response = client.chat(
            model=model,
            messages=messages,
            stream=False,
            think=False,
        )
    except OllamaError as exc:
        logger.debug("Ollama chat failed: %s", exc)
        return []
    return parse_model_findings(response, screenshot=path.name)


def enrich_text(
    prompt: str,
    *,
    client: OllamaClient | None = None,
    model: str = DEFAULT_VISION_MODEL,
) -> str:
    """Convenience wrapper for text-only Ollama calls via ``/api/chat``.

    Returns:
        The model's response text, or an empty string on error.
    """
    if client is None:
        client = OllamaClient()
    try:
        return client.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            think=False,
        )
    except OllamaError as exc:
        logger.debug("Ollama chat failed: %s", exc)
        return ""


def encode_image_data_url(path: Path | str) -> str:
    """Build a ``data:`` URL for an image file (handy for the dashboard).

    Returns:
        A ``data:image/<ext>;base64,<...>`` string.
    """
    p = Path(path)
    ext = p.suffix.lstrip(".").lower() or "png"
    media = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "bmp": "image/bmp",
    }.get(ext, "application/octet-stream")
    payload = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:{media};base64,{payload}"


def build_summary_payload(
    findings: list[VisionFinding],
    *,
    screenshot: str | None = None,
) -> dict[str, Any]:
    """Group findings by severity / category for the dashboard view."""
    by_severity: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for f in findings:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        by_category[f.category] = by_category.get(f.category, 0) + 1
    return {
        "screenshot": screenshot,
        "count": len(findings),
        "by_severity": by_severity,
        "by_category": by_category,
        "findings": [
            {
                "title": f.title,
                "category": f.category,
                "severity": f.severity,
                "notes": f.notes,
                "confidence": f.confidence,
                "bbox": list(f.bbox) if f.bbox else None,
            }
            for f in findings
        ],
    }


def payload_to_json(payload: dict[str, Any]) -> str:
    """Helper to dump a payload as a pretty JSON string."""
    return json.dumps(payload, indent=2, ensure_ascii=False)

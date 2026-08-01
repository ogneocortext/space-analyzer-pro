"""Optional GPU-accelerated vision analysis.

This module tries to import PyTorch at import time. If PyTorch is not
installed, the analyzer degrades to a CPU-only stub that still exposes the
same public API (so callers can rely on a stable interface) but returns
empty/heuristic results.

Public API:

* :class:`GpuVisionAnalyzer` — class that batches screenshot analysis.
* :func:`analyze_screenshot` — convenience one-shot helper.
* :func:`is_torch_available` — ``True`` if PyTorch is importable.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("ux_pipeline.gpu_vision_analyzer")

try:  # pragma: no cover - exercised only when torch is installed
    import torch  # type: ignore[import-not-found]
    _TORCH_AVAILABLE: bool = True
except ImportError:  # pragma: no cover - default path
    torch = None  # type: ignore[assignment]
    _TORCH_AVAILABLE = False


def is_torch_available() -> bool:
    """Return ``True`` if PyTorch is importable in the current interpreter."""
    return _TORCH_AVAILABLE


def _torch_device() -> Any | None:
    """Return the preferred torch device (CUDA > MPS > CPU) or ``None``."""
    if not _TORCH_AVAILABLE:
        return None
    try:
        if torch.cuda.is_available():  # type: ignore[union-attr]
            return torch.device("cuda")  # type: ignore[union-attr]
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():  # type: ignore[union-attr]
            return torch.device("mps")  # type: ignore[union-attr]
    except Exception as exc:  # noqa: BLE001
        logger.debug("torch device probe failed: %s", exc)
    return torch.device("cpu")  # type: ignore[union-attr]


class GpuVisionAnalyzer:
    """Batch screenshot analyzer with optional CUDA acceleration."""

    def __init__(self, device: Any | None = None) -> None:
        if device is None:
            device = _torch_device()
        self.device = device
        self.uses_gpu: bool = bool(
            _TORCH_AVAILABLE and device is not None and str(device) != "cpu"
        )

    def analyze(self, screenshot: Path | str) -> dict[str, Any]:
        """Run analysis on a single screenshot.

        Returns:
            Dict with at least ``{"path", "device", "score", "torch"}`` keys.
        """
        path = Path(screenshot)
        result: dict[str, Any] = {
            "path": str(path),
            "device": str(self.device) if self.device is not None else "none",
            "torch": _TORCH_AVAILABLE,
            "score": 0,
            "error": None,
        }
        if not path.exists():
            result["error"] = f"file not found: {path}"
            return result
        if not _TORCH_AVAILABLE:
            result["error"] = "torch not installed; using CPU stub"
            return result
        try:
            from PIL import Image
        except ImportError as exc:
            result["error"] = f"Pillow missing: {exc}"
            return result
        try:
            img = Image.open(path)
            tensor = self._image_to_tensor(img)
            score = self._tensor_score(tensor)
            result["score"] = score
            return result
        except (OSError, ValueError, RuntimeError) as exc:
            result["error"] = f"{type(exc).__name__}: {exc}"
            return result

    def analyze_batch(self, paths: list[Path | str]) -> list[dict[str, Any]]:
        """Run :meth:`analyze` on a list of paths and return all results."""
        return [self.analyze(p) for p in paths]

    def _image_to_tensor(self, img: Any) -> Any:
        """Convert a PIL image to a 1x3xHxW float tensor on the target device."""
        from PIL import Image

        rgb = img.convert("RGB").resize((224, 224))
        arr = _to_numpy(rgb)
        chw = arr.transpose(2, 0, 1).astype("float32") / 255.0
        tensor = torch.from_numpy(chw).unsqueeze(0)  # type: ignore[union-attr]
        return tensor.to(self.device)  # type: ignore[union-attr]

    def _tensor_score(self, tensor: Any) -> int:
        """Compute a 0-100 quality score from a normalized image tensor."""
        mean = float(tensor.mean().item())
        std = float(tensor.std().item())
        base = max(0.0, min(100.0, mean * 100.0))
        bonus = min(20.0, std * 100.0)
        return int(round(max(0.0, min(100.0, base + bonus - 50.0))))


def _to_numpy(img: Any):
    """``np.array`` wrapper that avoids a hard numpy dependency at import time."""
    try:
        import numpy as np

        return np.array(img)
    except ImportError:
        import array

        w, h = img.size
        data = list(img.get_flattened_data())
        flat = [v for px in data for v in px]
        return array.array("B", flat).tolist()  # type: ignore[return-value]


def analyze_screenshot(
    screenshot: Path | str,
    *,
    device: Any | None = None,
) -> dict[str, Any]:
    """Convenience helper: build an analyzer and run a single screenshot."""
    return GpuVisionAnalyzer(device=device).analyze(screenshot)

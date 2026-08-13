"""Fast, algorithm-driven (technical) screenshot analyzer.

Uses PIL + numpy to compute a structured, layout-oriented view of a UI
screenshot: dimensions, luminance/contrast, dominant color palette, edge
density, and projection-based panel/region detection. This is the *technical*
counterpart to ollama_vision.py (semantic, slower). Both can be combined by
analyze_screenshot.py for a faster + slower dual perspective.

No external services required; runs locally in milliseconds.
"""
import sys
import os
import json
import numpy as np
from PIL import Image


def _to_array(path):
    img = Image.open(path).convert("RGB")
    return np.asarray(img), img.size


def basic_stats(rgb):
    h, w = rgb.shape[:2]
    gray = rgb.mean(axis=2)
    return {
        "width": w,
        "height": h,
        "aspect_ratio": round(w / h, 3),
        "mean_luminance": round(float(gray.mean()), 2),
        "luminance_std": round(float(gray.std()), 2),
        "is_dark": bool(gray.mean() < 128),
    }


def palette(rgb, n=8):
    img = Image.fromarray(rgb).quantize(colors=n, method=Image.FASTOCTREE)
    counts = np.array(img.getcolors(), dtype=object)
    total = counts[:, 0].sum()
    order = counts[:, 0].argsort()[::-1]
    pal = img.getpalette()
    out = []
    for idx in order:
        cnt, label = int(counts[idx][0]), int(counts[idx][1])
        r, g, b = pal[label * 3:label * 3 + 3]
        out.append({"hex": "#%02x%02x%02x" % (r, g, b), "percent": round(100.0 * cnt / total, 1)})
    return out


def edge_analysis(rgb):
    gray = rgb.mean(axis=2).astype(np.float32)
    gx = np.abs(np.gradient(gray, axis=1))
    gy = np.abs(np.gradient(gray, axis=0))
    edges = gx + gy
    thr = edges.max() * 0.15
    density = float((edges > thr).mean()) if thr > 0 else 0.0
    return edges, density


def _segments(profile):
    prof = profile / (profile.max() + 1e-9)
    gap = prof < 0.08
    segs = []
    start = None
    for i, g in enumerate(gap):
        if not g and start is None:
            start = i
        elif g and start is not None:
            segs.append((start, i))
            start = None
    if start is not None:
        segs.append((start, len(gap)))
    return segs


def projections(edges):
    col_segs = _segments(edges.sum(axis=0))
    row_segs = _segments(edges.sum(axis=1))
    boxes = []
    for (y0, y1) in row_segs:
        for (x0, x1) in col_segs:
            boxes.append({"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)})
    boxes = [b for b in boxes if b["w"] > 40 and b["h"] > 40]
    return col_segs, row_segs, boxes


def analyze(path):
    rgb, size = _to_array(path)
    stats = basic_stats(rgb)
    pal = palette(rgb, 8)
    edges, density = edge_analysis(rgb)
    col_segs, row_segs, boxes = projections(edges)
    return {
        "file": path,
        "size": {"width": size[0], "height": size[1]},
        "basic": stats,
        "edge_density": round(density, 4),
        "palette_top": pal[:8],
        "layout": {
            "vertical_regions": len(col_segs),
            "horizontal_regions": len(row_segs),
            "detected_panels": len(boxes),
            "panel_boxes": boxes[:20],
        },
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python screenshot_technical.py <image>")
        sys.exit(1)
    print(json.dumps(analyze(sys.argv[1]), indent=2))

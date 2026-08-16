"""Fast, algorithm-driven (technical) screenshot analyzer.

Uses PIL + numpy to compute a structured, layout-oriented view of a UI
screenshot: dimensions, luminance/contrast, dominant color palette, edge
density, a content/whitespace signal, and panel detection.
This is the *technical* counterpart to ollama_vision.py (semantic, slower).
Both can be combined by analyze_single_screenshot.py for a faster + slower dual
perspective.

No external services required; runs locally.
"""
import sys
import os
import json
import numpy as np
from PIL import Image


def _to_array(path):
    with Image.open(path) as img:
        rgb = np.asarray(img.convert("RGB"))
    return rgb, (rgb.shape[1], rgb.shape[0])


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float64)


def _luminance(rgb):
    return 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]


def basic_stats(rgb):
    h, w = rgb.shape[:2]
    gray = _luminance(rgb)
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
    colors = img.getcolors()
    if colors is None:  # >256 colors (only if `n` is raised); fall back gracefully
        arr = np.asarray(img.convert("RGB"))
        uniq, counts = np.unique(arr.reshape(-1, 3), axis=0, return_counts=True)
        order = counts.argsort()[::-1][:n]
        out = []
        total = counts.sum()
        for idx in order:
            r, g, b = uniq[idx]
            out.append({"hex": "#%02x%02x%02x" % (int(r), int(g), int(b)),
                        "percent": round(100.0 * int(counts[idx]) / int(total), 1)})
        return out
    counts = np.array(colors, dtype=object)
    total = int(counts[:, 0].sum())
    order = counts[:, 0].argsort()[::-1]
    pal = img.getpalette()
    out = []
    for idx in order[:n]:
        cnt, label = int(counts[idx][0]), int(counts[idx][1])
        r, g, b = pal[label * 3:label * 3 + 3]
        out.append({"hex": "#%02x%02x%02x" % (r, g, b),
                    "percent": round(100.0 * cnt / total, 1)})
    return out


def edge_analysis(rgb):
    gray = _luminance(rgb).astype(np.float32)
    gx = np.abs(np.gradient(gray, axis=1))
    gy = np.abs(np.gradient(gray, axis=0))
    edges = gx + gy
    # Percentile threshold is robust to a single bright outlier border, unlike
    # a max-relative threshold (old behaviour: edges.max() * 0.15).
    thr = float(np.percentile(edges, 92)) if edges.size else 0.0
    thr = max(thr, 1e-6)
    density = float((edges > thr).mean())
    return edges, density


def content_mask(rgb, bg, tau=40.0):
    diff = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    return diff > tau


def _runs(flags):
    out = []
    start = None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(flags)))
    return out


def _merge_runs(runs, gap):
    """Merge consecutive runs whose gap is <= `gap` px (collapses nearby
    text lines / chrome into one region band)."""
    if not runs:
        return []
    out = [runs[0]]
    for s, e in runs[1:]:
        if s - out[-1][1] <= gap:
            out[-1] = (out[-1][0], e)
        else:
            out.append((s, e))
    return out


def whitespace_bands(mask, sep_frac=0.01, merge_gap=24):
    """Content bands separated by near-background (whitespace) gaps. Adjacent
    bands closer than `merge_gap` are merged so a header with several text lines
    reads as one region rather than dozens of 1px strips."""
    h, w = mask.shape
    col = mask.sum(axis=0)
    row = mask.sum(axis=1)
    sep_c = col < (h * sep_frac)
    sep_r = row < (w * sep_frac)
    return _merge_runs(_runs(~sep_c), merge_gap), _merge_runs(_runs(~sep_r), merge_gap)


def column_regions(mask, bg_frac=0.92, merge_gap=24):
    """Vertical structure (sidebars / columns) detected as content columns
    separated by near-background gaps. A column is a gap when >= `bg_frac` of
    its pixels are near-background, which tolerates a thin divider or border
    inside the gap. Unlike whitespace_bands' strict <1%-content rule this finds
    sidebars even in dark, edge-to-edge layouts where no fully empty full-height
    column exists."""
    h, w = mask.shape
    col_bg = (~mask).sum(axis=0) / h
    sep = col_bg >= bg_frac
    return _merge_runs(_runs(~sep), merge_gap)


def detect_panels(mask, min_area=64, min_fill=0.02):
    """Panel regions = content cells of the (row band x column band) grid that
    are actually filled with content, tightened to their content bounding box.
    This yields a small, meaningful set of UI regions rather than every glyph
    cluster."""
    h, w = mask.shape
    col_bands, row_bands = whitespace_bands(mask)
    boxes = []
    for (y0, y1) in row_bands:
        for (x0, x1) in col_bands:
            cell = mask[y0:y1, x0:x1]
            if cell.size == 0 or cell.mean() < min_fill:
                continue
            ys, xs = np.where(cell)
            if ys.size == 0:
                continue
            bx0, bx1 = int(xs.min() + x0), int(xs.max() + 1 + x0)
            by0, by1 = int(ys.min() + y0), int(ys.max() + 1 + y0)
            bw, bh = bx1 - bx0, by1 - by0
            if bw * bh < min_area:
                continue
            boxes.append({"x": bx0, "y": by0, "w": bw, "h": bh, "area": bw * bh})
    boxes.sort(key=lambda b: b["area"], reverse=True)
    return boxes


def readability(rgb, bg_rgb):
    gray = _luminance(rgb)
    bg_lum = float(_luminance(bg_rgb.reshape(1, 1, 3))[0, 0])
    maxc = rgb.max(axis=2)
    minc = rgb.min(axis=2)
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(maxc > 0, (maxc - minc) / maxc, 0.0)
    return {
        "bg_luminance": round(bg_lum, 2),
        "fg_luminance": round(float(gray.mean()), 2),
        "contrast": round(float(gray.mean() - bg_lum), 2),
        "mean_saturation": round(float(np.nanmean(sat)), 3),
    }


def analyze(path, palette_n=8, min_panel=64):
    rgb, size = _to_array(path)
    stats = basic_stats(rgb)
    pal = palette(rgb, palette_n)
    bg = hex_to_rgb(pal[0]["hex"])
    edges, density = edge_analysis(rgb)
    mask = content_mask(rgb, bg)
    col_bands, row_bands = whitespace_bands(mask)
    v_regions = column_regions(mask)
    boxes = detect_panels(mask, min_area=min_panel)
    content_ratio = float(mask.mean())
    return {
        "file": path,
        "size": {"width": size[0], "height": size[1]},
        "basic": stats,
        "background": {"hex": pal[0]["hex"], "percent": pal[0]["percent"]},
        "edge_density": round(density, 4),
        "palette_top": pal[:palette_n],
        "content": {
            "content_ratio": round(content_ratio, 4),
            "is_sparse": bool(content_ratio < 0.005),
        },
        "readability": readability(rgb, bg),
        "layout": {
            "vertical_regions": len(v_regions),
            "horizontal_regions": len(row_bands),
            "detected_panels": len(boxes),
            "panel_boxes": boxes[:20],
        },
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python technical_screenshot_analysis.py <image> [palette_n] [min_panel]")
        sys.exit(1)
    pn = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    mp = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    print(json.dumps(analyze(sys.argv[1], pn, mp), indent=2))

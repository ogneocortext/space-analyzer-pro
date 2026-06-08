#!/usr/bin/env python3
"""
Analyze macro screenshots using PIL feature extraction + Ollama phi4-mini.
With iterative feedback loop: tracks improvements across runs.
"""

from __future__ import annotations

import argparse
import json
import logging
import platform
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageFilter, UnidentifiedImageError

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient

MODEL: str = "phi4-mini:latest"
ANALYSIS_HISTORY_DIR: Path = Path("analysis_history")
DEFAULT_SHOTS_ROOT: Path = Path("macro_logs")
MAX_FEEDBACK_CHARS: int = 2000
OLLAMA_TIMEOUT_S: int = 120
GENERATION_OPTIONS: dict[str, Any] = {"temperature": 0.2, "num_predict": 384}
QUALITY_IMPROVEMENT_THRESHOLD: int = 1

# Quality scoring weights
BRIGHTNESS_TARGET: float = 50.0
EDGE_LOW: float = 5.0
EDGE_HIGH: float = 15.0
EDGE_TARGET: float = 10.0
COLOR_SCORE_SCALE: float = 2.0
DARK_PENALTY_WEIGHT: float = 0.3

# Color thresholds for description
DARK_THRESHOLD_PCT: float = 50.0
EDGE_SPARSE_PCT: float = 5.0
EDGE_DENSE_PCT: float = 15.0

logger = logging.getLogger("analyze_screenshots")


def _configure_console() -> None:
    """Reconfigure stdout for UTF-8 on Windows consoles."""
    if platform.system() == "Windows":
        try:
            stdout = sys.stdout
            reconfigure = getattr(stdout, "reconfigure", None)
            if reconfigure is not None:
                reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError) as e:
            logger.debug("Could not reconfigure stdout: %s", e)


def _find_latest_screenshots_dir(shots_root: Path) -> Path | None:
    """Return the most recent screenshots_ directory under shots_root.

    Args:
        shots_root: Directory containing timestamped screenshot folders.

    Returns:
        Latest directory or None if no matches.
    """
    if not shots_root.is_dir():
        return None
    candidates = sorted(
        (d for d in shots_root.iterdir() if d.is_dir() and d.name.startswith("screenshots_")),
        reverse=True,
    )
    return candidates[0] if candidates else None


def ask_ollama(
    prompt: str,
    model: str = MODEL,
    ollama_url: str | None = None,
    timeout: int = OLLAMA_TIMEOUT_S,
    retries: int = 3,
) -> str:
    """Send a prompt to Ollama with retry/backoff.

    Args:
        prompt: The prompt text.
        model: Ollama model name.
        ollama_url: Ignored (host is resolved from OLLAMA_HOST); kept for CLI compat.
        timeout: HTTP timeout in seconds.
        retries: Number of attempts before giving up.

    Returns:
        Response text, or an "ERROR: ..." string on failure.
    """
    del ollama_url
    client = OllamaClient(timeout=timeout, retries=retries)
    try:
        result: str = client.generate(
            model=model,
            prompt=prompt,
            stream=False,
            options=GENERATION_OPTIONS,
        )
        return result
    except Exception as e:
        logger.error("All retries failed: %s", e)
        return f"ERROR: {e}"


def extract_features(path: Path) -> dict[str, Any]:
    """Extract visual features from a screenshot using PIL.

    Args:
        path: Path to the screenshot.

    Returns:
        Dict of brightness, edge density, palette, etc.

    Raises:
        FileNotFoundError: If path does not exist.
        UnidentifiedImageError: If the file is not a valid image.
    """
    img = Image.open(path)
    w, h = img.size
    gray = img.convert("L")

    pixels = list(gray.getdata())
    total = len(pixels)
    avg_bright = sum(pixels) / total
    dark_pct = sum(1 for p in pixels if p < 64) / total * 100
    light_pct = sum(1 for p in pixels if p > 192) / total * 100

    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_pct = sum(1 for p in list(edges.getdata()) if p > 128) / total * 100

    reduced = img.quantize(32)
    palette = reduced.getpalette() or []
    counts = Counter(reduced.getdata())
    top_colors = []
    for idx, _ in counts.most_common(5):
        r, g, b = palette[idx * 3 : idx * 3 + 3]
        top_colors.append(f"rgb({r},{g},{b})")

    center = img.crop((w // 4, h // 4, 3 * w // 4, 3 * h // 4)).quantize(16)
    center_variety = len(set(center.getdata()))

    return {
        "dim": f"{w}x{h}",
        "bright": round(avg_bright, 1),
        "dark_pct": round(dark_pct, 1),
        "light_pct": round(light_pct, 1),
        "edge_pct": round(edge_pct, 1),
        "center_colors": center_variety,
        "palette": top_colors,
    }


def describe(features: dict[str, Any]) -> str:
    """Generate a brief description of visual features.

    Args:
        features: Output from ``extract_features``.

    Returns:
        Human-readable description string.
    """
    parts: list[str] = []
    parts.append("dark" if features["dark_pct"] > DARK_THRESHOLD_PCT else "light")
    if features["edge_pct"] < EDGE_SPARSE_PCT:
        parts.append("sparse")
    elif features["edge_pct"] > EDGE_DENSE_PCT:
        parts.append("dense")
    else:
        parts.append("moderate")
    parts.append(f"{features['center_colors']} tones in content")
    parts.append(" ".join(features["palette"][:3]))
    return "; ".join(parts)


KEY_SHOTS: dict[str, str] = {
    "02_dashboard_initial": "Dashboard with system info overview",
    "04_files_summary": "Scan results summary with stats grid",
    "05_files_file_types_report": "File types grouped by category",
    "06_files_size_audit": "Largest files ranking",
    "07_files_organization_planner": "Organization view with file actions",
    "08_files_cleanup_review": "Cleanup review with delete buttons",
    "10_charts": "Charts/visualizations tab",
    "11_history": "Scan history list",
    "13_settings": "Settings page",
}


def compute_quality_score(features: dict[str, Any]) -> int:
    """Compute a unified quality score (0-100) from visual features.

    Args:
        features: Output from ``extract_features``.

    Returns:
        Score clamped to [0, 100].
    """
    bright_score = max(0.0, 100.0 - abs(features["bright"] - BRIGHTNESS_TARGET) * 2.0)
    edge = features["edge_pct"]
    edge_score = (100.0 if EDGE_LOW <= edge <= EDGE_HIGH
                  else max(0.0, 100.0 - abs(edge - EDGE_TARGET) * 3.0))
    color_score = min(100.0, float(features["center_colors"]) * COLOR_SCORE_SCALE)
    dark_penalty = float(features["dark_pct"]) * DARK_PENALTY_WEIGHT
    raw = (bright_score + edge_score + color_score) / 3.0 - dark_penalty
    clamped: int = round(max(0.0, min(100.0, raw)))
    return clamped


def compare_with_history(
    current_extracted: dict[str, dict[str, Any]],
    ts: str,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Compare extracted features with the previous run history.

    Args:
        current_extracted: Mapping of screenshot key to features.
        ts: Timestamp string used to locate the history file.

    Returns:
        Tuple of (comparison dict, previous features dict or None).
    """
    history_file = ANALYSIS_HISTORY_DIR / f"features_{ts}.json"
    comparison: dict[str, Any] = {"improvements": [], "regressions": [], "scores": {}}

    if not history_file.exists():
        return comparison, None

    try:
        with history_file.open(encoding="utf-8") as f:
            previous = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Could not read history %s: %s", history_file, e)
        return comparison, None

    for key, curr_data in current_extracted.items():
        if key not in previous:
            continue
        prev_score = previous[key].get("quality_score", 0)
        curr_score = curr_data.get("quality_score", 0)
        comparison["scores"][key] = {
            "previous": prev_score,
            "current": curr_score,
            "change": curr_score - prev_score,
        }
        if curr_score > prev_score + QUALITY_IMPROVEMENT_THRESHOLD:
            comparison["improvements"].append({
                "screenshot": key,
                "from": prev_score,
                "to": curr_score,
            })
        elif curr_score < prev_score - QUALITY_IMPROVEMENT_THRESHOLD:
            comparison["regressions"].append({
                "screenshot": key,
                "from": prev_score,
                "to": curr_score,
            })

    return comparison, previous


def _build_analysis_prompt(context: str) -> str:
    """Build the UX analysis prompt for the LLM.

    Args:
        context: Multi-line screenshot context string.

    Returns:
        Full prompt text.
    """
    return (
        "You are a UI/UX expert. Evaluate this dark-theme desktop app based on "
        f"extracted visual data:\n\n{context}\n\n"
        "The app is a Rust/egui disk space analyzer with Tabs: "
        "Dashboard, Files (5 sub-views), Charts, History, Settings.\n\n"
        "Provide:\n"
        "1. VISUAL STYLE (1 line)\n"
        "2. TOP 3 ISSUES (specific)\n"
        "3. TOP 3 QUICK WINS (actionable code changes)\n"
        "Format as plain text bullet points."
    )


def _build_code_prompt(analysis: str) -> str:
    """Build the code-recommendation prompt for the LLM.

    Args:
        analysis: Previous UX analysis text.

    Returns:
        Full prompt text.
    """
    feedback = analysis[:MAX_FEEDBACK_CHARS] if analysis else "No analysis available"
    return (
        "Based on this UX feedback, suggest 3 specific egui 0.34 code changes:\n\n"
        f"FEEDBACK:\n{feedback}\n\n"
        "Give concrete Rust/egui API calls (Visuals, Frame, Style, Layout). "
        "Format as short code snippets with explanation."
    )


def _print_summary(extracted: dict[str, dict[str, Any]], comparison: dict[str, Any]) -> None:
    """Print the human-readable analysis summary to stdout.

    Args:
        extracted: Extracted features per screenshot.
        comparison: Output of ``compare_with_history``.
    """
    print("\nUX ANALYSIS RESULTS")
    print("=" * 60)
    print("\nScreenshots analyzed:")
    for k, v in extracted.items():
        score = v.get("quality_score", "?")
        print(f"  {k}: quality={score}/100 - {v['desc'][:80]}")

    if comparison.get("improvements"):
        print(f"\nImprovements detected ({len(comparison['improvements'])}):")
        for item in comparison["improvements"]:
            print(f"  + {item['screenshot']}: {item['from']} -> {item['to']}")

    if comparison.get("regressions"):
        print(f"\nRegressions detected ({len(comparison['regressions'])}):")
        for item in comparison["regressions"]:
            print(f"  - {item['screenshot']}: {item['from']} -> {item['to']}")


def _save_features_history(extracted: dict[str, dict[str, Any]], ts: str) -> Path:
    """Persist current features to the analysis history directory.

    Args:
        extracted: Extracted features per screenshot.
        ts: Timestamp string.

    Returns:
        Path to the saved history file.
    """
    ANALYSIS_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        k: {
            "quality_score": v.get("quality_score", 0),
            "bright": v["bright"],
            "edge_pct": v["edge_pct"],
            "dark_pct": v["dark_pct"],
            "center_colors": v["center_colors"],
        }
        for k, v in extracted.items()
    }
    out_path = ANALYSIS_HISTORY_DIR / f"features_{ts}.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return out_path


def run_analysis(
    screenshots_dir: Path,
    report_path: Path,
    ts: str,
    ollama_url: str | None = None,
) -> int:
    """Run the full analysis pipeline on a screenshots directory.

    Args:
        screenshots_dir: Directory containing screenshot PNGs.
        report_path: Output path for the JSON report.
        ts: Timestamp string used to name the history file.
        ollama_url: Optional Ollama URL override.

    Returns:
        Process exit code.
    """
    print("Extracting visual features...")
    screenshots = {s.stem: s for s in screenshots_dir.glob("*.png") if s.stem in KEY_SHOTS}

    extracted: dict[str, dict[str, Any]] = {}
    for key, label in KEY_SHOTS.items():
        path = screenshots.get(key)
        if path is None:
            print(f"  Skipping {key} (not found)")
            continue
        try:
            features = extract_features(path)
        except (FileNotFoundError, UnidentifiedImageError, OSError) as e:
            logger.error("Could not extract features for %s: %s", key, e)
            continue
        features["quality_score"] = compute_quality_score(features)
        desc = describe(features)
        extracted[key] = {"label": label, "desc": desc, **features}
        print(f"  [{key}] quality={features['quality_score']}/100  {desc[:90]}...")

    if not extracted:
        logger.error("No key screenshots found in %s", screenshots_dir)
        return 1

    context_lines = [
        f"[{k}] {v['label']}: {v['desc']} (quality: {v.get('quality_score', '?')}/100)"
        for k, v in extracted.items()
    ]
    context = "\n".join(context_lines)

    analysis_prompt = _build_analysis_prompt(context)
    print("\nAnalyzing with LLM...", end=" ", flush=True)
    analysis = ask_ollama(analysis_prompt, ollama_url=ollama_url)
    print("OK")

    code_prompt = _build_code_prompt(analysis)
    print("Generating code recommendations...", end=" ", flush=True)
    code_recs = ask_ollama(code_prompt, ollama_url=ollama_url)
    print("OK")

    comparison, _ = compare_with_history(extracted, ts)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "model": MODEL,
        "timestamp": datetime.now().isoformat(),
        "screenshots": extracted,
        "ux_recommendations": analysis,
        "code_recommendations": code_recs,
        "quality_comparison": comparison,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    history_path = _save_features_history(extracted, ts)
    _print_summary(extracted, comparison)

    print("\nRECOMMENDATIONS:\n")
    print(analysis or "No analysis generated")
    print("\nCODE CHANGES:\n")
    print(code_recs or "No code recommendations generated")
    print(f"\nReport: {report_path}")
    print(f"History: {history_path}")
    return 0


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Optional argument list.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(description="Analyze macro screenshots via PIL + Ollama")
    parser.add_argument("--shots-root", default=str(DEFAULT_SHOTS_ROOT), help="Directory containing screenshots_* subdirs")
    parser.add_argument("--ollama-url", default=None, help="Full URL to Ollama /api/generate")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI.

    Args:
        argv: Optional argument list.

    Returns:
        Process exit code.
    """
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    _configure_console()

    shots_root = Path(args.shots_root)
    latest = _find_latest_screenshots_dir(shots_root)
    if latest is None:
        logger.error("No screenshot directories found in %s/", shots_root)
        return 1

    ts = latest.name.replace("screenshots_", "")
    report_path = shots_root / f"ux_analysis_{ts}.json"
    return run_analysis(latest, report_path, ts, ollama_url=args.ollama_url)


if __name__ == "__main__":
    sys.exit(main())

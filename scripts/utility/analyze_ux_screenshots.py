#!/usr/bin/env python3
"""
Analyze macro screenshots using PIL feature extraction + Ollama vision models.
With iterative feedback loop: tracks improvements across runs.
Sends actual screenshots to local vision models (qwen3-vl:2b, etc.)
for real visual analysis, not just text-only feature descriptions.
"""

import argparse
import json
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageFilter, UnidentifiedImageError

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient
from _common import (
    configure_console,
    encode_image_for_vision,
    parse_model_text,
    pick_vision_model,
    find_latest_screenshots_dir,
)

MODEL: str = os.getenv("VISION_MODEL", "qwen3-vl:4b")
ANALYSIS_HISTORY_DIR: Path = Path("analysis_history")
DEFAULT_SHOTS_ROOT: Path = Path("macro_logs")
MAX_FEEDBACK_CHARS: int = 2000
OLLAMA_TIMEOUT_S: int = 180
# num_ctx must be large enough for the combined analysis prompt (10 screenshot
# vision descriptions + schema ≈ 9k tokens). 8192 caused HTTP 400
# "exceeds_context_size_error". qwen3-vl models support up to 32k.
GENERATION_OPTIONS: dict[str, Any] = {"temperature": 0.1, "num_ctx": 16384, "num_predict": 2048}

# Resize cap for vision payloads (matches app's resizeBase64Image behavior)
VISION_IMG_MAX: int = 300

ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "app_title": {"type": "string"},
        "visible_navigation": {
            "type": "array",
            "items": {"type": "string"},
        },
        "main_content": {"type": "string"},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "finding": {"type": "string"},
                    "location": {"type": "string"},
                },
                "required": ["severity", "finding"],
            },
        },
        "quick_wins": {"type": "array", "items": {"type": "string"}},
        "evidence_confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    },
    "required": ["app_title", "visible_navigation", "main_content", "issues", "quick_wins", "evidence_confidence"],
}

CODE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "changes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "file": {"type": "string"},
                    "change": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["file", "change", "why"],
            },
        },
    },
    "required": ["changes"],
}

logger = logging.getLogger("analyze_ux_screenshots")


def ask_ollama(
    prompt: str,
    model: str = MODEL,
    client: OllamaClient | None = None,
    image_path: Path | None = None,
    *,
    json_schema: dict[str, Any] | None = None,
) -> str:
    client = client or OllamaClient()
    effective_model = model
    image_b64 = encode_image_for_vision(image_path) if image_path else None

    if image_b64:
        vision_prompt = (
            "Analyze this desktop app screenshot. "
            "Only use visible evidence. No invented UI.\n"
            f"{prompt}"
        )
        try:
            response = client.generate(
                model=effective_model,
                prompt=vision_prompt,
                stream=False,
                options=GENERATION_OPTIONS,
                images=[image_b64],
                think=False,
                format=json_schema,
            )
            return parse_model_text(response)
        except Exception as exc:
            logger.error("Vision Ollama call failed: %s", exc)
            return f"ERROR: {exc}"

    strict_prompt = (
        "You are a structured analysis API. Return ONLY a single JSON object. "
        "No markdown, no prose, no explanations.\n"
        "App context: WinUI 3 desktop disk space analyzer.\n"
        f"Screenshot features:\n{prompt}\n"
        '{"app_title":"","visible_navigation":[""],"main_content":"",'
        '"issues":[{"severity":"high|medium|low","finding":""}],'
        '"quick_wins":[""],"evidence_confidence":"high|medium|low"}'
    )
    try:
        response = client.generate(
            model=effective_model,
            prompt=strict_prompt,
            stream=False,
            options=GENERATION_OPTIONS,
            think=False,
            format=json_schema,
        )
        return parse_model_text(response)
    except Exception as exc:
        logger.error("Ollama call failed: %s", exc)
        return f"ERROR: {exc}"


def extract_features(path: Path) -> dict[str, Any]:
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
    parts: list[str] = []
    parts.append("dark" if features["dark_pct"] > 50.0 else "light")
    if features["edge_pct"] < 5.0:
        parts.append("sparse")
    elif features["edge_pct"] > 15.0:
        parts.append("dense")
    else:
        parts.append("moderate")
    parts.append(f"{features['center_colors']} tones in content")
    desc = "; ".join(parts)
    return desc


KEY_SHOTS: dict[str, str] = {
    "01_launched": "App initial launch screen",
    "01_tab_dashboard": "Dashboard system overview",
    "02_tab_scan": "Scan page with directory input, depth slider, hidden-files checkbox, and scan results",
    "03_tab_history": "History and past scans list",
    "04_tab_smart_search": "Advanced Search view with query and size filters",
    "05_tab_workflows": "Automation Workflows view",
    "06_tab_ai_chat": "AI Assistant chat view",
    "07_tab_dedup": "Duplicates analysis view",
    "08_tab_system": "System resources info view",
    "09_tab_settings": "Settings page",
}

ALIASES: dict[str, str] = {
}


def _resolve_screenshots_dir(shots_root: Path) -> Path | None:
    return find_latest_screenshots_dir(shots_root)


def _matching_screenshots(screenshots_dir: Path) -> dict[str, Path]:
    candidates = {s.stem: s for s in screenshots_dir.glob("*.png")}
    matches: dict[str, Path] = {}
    for key, label in KEY_SHOTS.items():
        alias = ALIASES.get(key, key)
        path = candidates.get(alias)
        if path is not None:
            matches[key] = path
    return matches


def compute_quality_score(features: dict[str, Any]) -> int:
    BRIGHTNESS_TARGET = 50.0
    EDGE_LOW = 5.0
    EDGE_HIGH = 15.0
    EDGE_TARGET = 10.0
    COLOR_SCORE_SCALE = 2.0
    DARK_PENALTY_WEIGHT = 0.3

    bright_score = max(0.0, 100.0 - abs(features["bright"] - BRIGHTNESS_TARGET) * 2.0)
    edge = features["edge_pct"]
    edge_score = (100.0 if EDGE_LOW <= edge <= EDGE_HIGH else max(0.0, 100.0 - abs(edge - EDGE_TARGET) * 3.0))
    color_score = min(100.0, float(features["center_colors"]) * COLOR_SCORE_SCALE)
    dark_penalty = float(features["dark_pct"]) * DARK_PENALTY_WEIGHT
    raw = (bright_score + edge_score + color_score) / 3.0 - dark_penalty
    return round(max(0.0, min(100.0, raw)))


def compare_with_history(
    current_extracted: dict[str, dict[str, Any]],
    ts: str,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    history_file = ANALYSIS_HISTORY_DIR / f"features_{ts}.json"
    comparison: dict[str, Any] = {"improvements": [], "regressions": [], "scores": {}}

    if not history_file.exists():
        return comparison, None

    try:
        with history_file.open(encoding="utf-8") as f:
            previous = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read history %s: %s", history_file, exc)
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
        if curr_score > prev_score + 1:
            comparison["improvements"].append({"screenshot": key, "from": prev_score, "to": curr_score})
        elif curr_score < prev_score - 1:
            comparison["regressions"].append({"screenshot": key, "from": prev_score, "to": curr_score})

    return comparison, previous


def _build_analysis_prompt(context: str) -> str:
    schema_hint = (
        '{"app_title":"","visible_navigation":[""],"main_content":"",'
        '"issues":[{"severity":"high|medium|low","finding":"","location":""}],'
        '"quick_wins":[""],"evidence_confidence":"high|medium|low"}'
    )
    return (
        "You are a UX analysis engine for WinUI 3 desktop screenshots.\n"
        "For each screenshot, extract:\n"
        '1. app_title: exact visible window/title text\n'
        '2. visible_navigation: every visible tab label, sidebar entry, menu item (read the actual text)\n'
        '3. main_content: what is rendered in the main panel (charts, tables, lists, empty states, cards)\n'
        '4. issues: high=usability blockers, medium=friction/confusion, low=polish — cite the specific location if visible\n'
        '5. quick_wins: concrete, actionable UI improvements (no vague advice)\n'
        '6. evidence_confidence: high if text and structure are clear, medium if partially visible, low if ambiguous\n'
        "App context: Space Analyzer Pro.\n"
        f"{context}\n"
        f"{schema_hint}"
    )


def _build_code_prompt(analysis: str) -> str:
    feedback = analysis[:MAX_FEEDBACK_CHARS] if analysis else "No analysis available"
    schema_hint = (
        '{"changes":[{"file":"gui-winui/SpaceAnalyzer/Views/ExamplePage.xaml","change":"...","why":"..."}]}'
    )
    return (
        "Based on this UX feedback, suggest exactly 3 specific WinUI 3 code changes.\n"
        "Return ONLY a compact JSON object with no prose.\n"
        "Each change targets one of: XAML Layout, Styling/Resources, Data Binding, "
        "Code-Behind (C#). Prefer editing files under gui-winui/SpaceAnalyzer/ "
        "(Views/*.xaml, Views/*.xaml.cs, Services/*.cs, App.xaml resources).\n"
        f"FEEDBACK:\n{feedback}\n"
        f"{schema_hint}"
    )


def _print_summary(extracted: dict[str, dict[str, Any]], comparison: dict[str, Any]) -> None:
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
    print("Extracting visual features...")
    screenshots = _matching_screenshots(screenshots_dir)

    extracted: dict[str, dict[str, Any]] = {}
    client = OllamaClient()
    picked_model = pick_vision_model(client, default=MODEL)
    print(f"  Using vision model: {picked_model}")

    if not screenshots:
        logger.error("No matching screenshots found in %s (have: %s)", screenshots_dir,
                     ", ".join(sorted(s.stem for s in screenshots_dir.glob("*.png"))[:10]) or "none")
        return 1

    for key, path in screenshots.items():
        label = KEY_SHOTS[key]
        print(f"  analyzing {path.stem}...", end=" ", flush=True)
        try:
            features = extract_features(path)
        except (FileNotFoundError, UnidentifiedImageError, OSError) as exc:
            logger.error("Could not extract features for %s: %s", key, exc)
            continue
        features["quality_score"] = compute_quality_score(features)
        desc = describe(features)
        extracted[key] = {"label": label, "desc": desc, **features}
        print(f"ok quality={features['quality_score']}/100")

    if not extracted:
        logger.error("No key screenshots found in %s", screenshots_dir)
        return 1

    # Per-screenshot vision pass: send each screenshot's ACTUAL image to the vision
    # model so it can read visible UI text/labels/controls. PIL features alone ("dark;
    # sparse; 16 tones") cannot report what's really displayed on each tab, so without
    # this the "vision" analysis is text-only inference on feature stats.
    print("\nRunning per-screenshot vision analysis...")
    vision_results: dict[str, str] = {}
    for key, path in screenshots.items():
        if key not in extracted:
            continue
        print(f"  vision {path.stem}...", end=" ", flush=True)
        shot_prompt = (
            f"This is the '{KEY_SHOTS[key]}' tab of Space Analyzer Pro (a WinUI 3 "
            "desktop disk-space analyzer). Describe EXACTLY what is visible: "
            "headings, button labels, input fields, slider values, checkboxes, "
            "stat cards and their numbers, list/table contents, and empty states. "
            "Read visible text literally. Note layout structure. One concise paragraph."
        )
        vision_results[key] = ask_ollama(
            shot_prompt, model=picked_model, client=client, image_path=path
        )
        extracted[key]["vision_description"] = vision_results[key]
        print("ok")

    context_lines = [
        f"[{k}] {v['label']}: {v['desc']} (quality: {v.get('quality_score', '?')}/100)\n"
        f"  vision: {vision_results.get(k, 'n/a')}"
        for k, v in extracted.items()
    ]
    context = "\n".join(context_lines)

    # Ground the combined UX analysis in a real screenshot (the Scan page shows the
    # scanning parameters the user wants to verify) by passing it as the image.
    scan_image = screenshots.get("02_tab_scan") or next(iter(screenshots.values()), None)
    analysis_prompt = _build_analysis_prompt(context)
    print("\nAnalyzing with LLM (JSON schema)...", end=" ", flush=True)
    analysis = ask_ollama(
        analysis_prompt, model=picked_model, client=client, json_schema=ANALYSIS_SCHEMA, image_path=scan_image
    )
    print("OK")

    code_prompt = _build_code_prompt(analysis)
    print("\nGenerating code recommendations...", end=" ", flush=True)
    code_recs = ask_ollama(code_prompt, model=picked_model, client=client, json_schema=CODE_SCHEMA)
    print("OK")

    comparison, _ = compare_with_history(extracted, ts)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "model": picked_model,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "screenshots": extracted,
        "vision_analysis": vision_results,
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
    parser = argparse.ArgumentParser(description="Analyze macro screenshots via PIL + Ollama")
    parser.add_argument("--shots-root", default=str(DEFAULT_SHOTS_ROOT), help="Directory containing screenshots_* subdirs")
    parser.add_argument("--shots-dir", default=None, help="Direct path to a screenshots directory (named or unnamed)")
    parser.add_argument("--ollama-url", default=None, help="Full URL to Ollama /api/generate")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    configure_console()

    shots_root = Path(args.shots_root)
    latest = None
    # An explicit --shots-dir always wins over auto-resolving the newest
    # screenshots_* dir under --shots-root (otherwise an empty/partial newest
    # capture shadows the set the user actually asked to analyze).
    if args.shots_dir:
        latest = _resolve_screenshots_dir(Path(args.shots_dir))
    if latest is None:
        latest = _resolve_screenshots_dir(shots_root)
    if latest is None:
        logger.error("No screenshot directories found in %s/", shots_root)
        return 1

    ts = latest.name.replace("screenshots_", "") if latest.name.startswith("screenshots_") else latest.name
    report_path = shots_root / f"ux_analysis_{ts}.json"
    if not report_path.parent.exists():
        report_path = latest.parent / f"ux_analysis_{ts}.json"
    return run_analysis(latest, report_path, ts, ollama_url=args.ollama_url)


if __name__ == "__main__":
    sys.exit(main())

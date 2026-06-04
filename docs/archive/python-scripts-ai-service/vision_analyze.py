#!/usr/bin/env python3
"""
Vision Analysis with Iterative Feedback Loop Support
Analyzes UI screenshots via Ollama and tracks improvement cycles.
"""

import json
import base64
import io
import sys
import time
import os
import urllib.request
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any
from PIL import Image

# Add parent directory for ollama_client
sys.path.insert(0, str(Path(__file__).parent.parent / "ai-service"))

from ollama_client import OllamaClient, get_client

MODEL = "qwen3-vl:4b"
IMG_MAX = 300

shots_root = Path("macro_logs")
shot_dirs = sorted(
    [d for d in shots_root.iterdir() if d.is_dir() and d.name.startswith("screenshots_")],
    reverse=True,
)

if not shot_dirs:
    print("ERROR: No screenshot directories found in macro_logs/")
    sys.exit(1)

DIR = shot_dirs[0]
ts = DIR.name.replace("screenshots_", "")
SAVE = shots_root / f"vision_analysis_{ts}.json"

# Categories for grouping
CATEGORIES = {
    "dashboard": ["01_launched", "02_dashboard_initial", "03_dashboard_refreshed"],
    "files": [
        "04_files_summary", "05_files_file_types_report", "06_files_size_audit",
        "07_files_organization_planner", "08_files_cleanup_review", "09_files_summary",
    ],
    "charts": ["10_charts"],
    "history": ["11_history", "12_history_loaded"],
    "settings": ["13_settings"],
    "about": ["14_about"],
}

PROMPTS = {
    "dashboard": (
        "Analyze this Space Analyzer dashboard screenshot. Rate layout, readability, "
        "color contrast, and information density on a 1-10 scale. List 3 specific improvements "
        "and 2 things that work well. Be specific about UI elements."
    ),
    "files": (
        "Analyze this Files/Scanner page screenshot. Evaluate: "
        "1. File listing clarity and organization (1-10) "
        "2. Table/column layout quality (1-10) "
        "3. Filter/search UI effectiveness (1-10) "
        "4. Scan progress indicators visibility (1-10) "
        "5. Data density vs readability balance (1-10) "
        "List 3 specific improvements and 2 positive aspects."
    ),
    "charts": (
        "Analyze these embedded charts/visualizations. Evaluate: "
        "1. Chart rendering quality and accuracy (1-10) "
        "2. Label readability and axis scaling (1-10) "
        "3. Color scheme effectiveness for dark theme (1-10) "
        "4. Interactive elements visibility (1-10) "
        "5. Data insight clarity (1-10) "
        "List 3 improvements and suggest specific chart library settings."
    ),
    "history": (
        "Analyze this scan history list. Evaluate: "
        "1. Timeline visualization quality (1-10) "
        "2. Event listing clarity (1-10) "
        "3. Date/time navigation elements (1-10) "
        "4. Progress indicators (1-10) "
        "5. Information density management (1-10) "
        "List 3 specific improvements."
    ),
    "settings": (
        "Analyze this settings page. Evaluate: "
        "1. Form layout and organization (1-10) "
        "2. Input field clarity (1-10) "
        "3. Section grouping and hierarchy (1-10) "
        "4. Button and action visibility (1-10) "
        "5. Overall settings UX quality (1-10) "
        "List 3 specific improvements for layout or clarity."
    ),
    "about": (
        "Analyze this About page. Evaluate: "
        "1. Information layout and hierarchy (1-10) "
        "2. Branding and version display (1-10) "
        "3. Link and action visibility (1-10) "
        "4. Overall polish and professionalism (1-10) "
        "List 2 improvements."
    ),
}

# Feedback loop: track scores across iterations
FEEDBACK_HISTORY_FILE = shots_root / f"feedback_history_{ts}.json"


def encode_image(path: Path) -> str:
    """Resize and encode image for Ollama vision model."""
    img = Image.open(path)
    if img.mode != "RGB":
        img = img.convert("RGB")
    r = IMG_MAX / max(img.size)
    if r < 1.0:
        img = img.resize((int(img.width * r), int(img.height * r)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def extract_ratings(analysis_text: str) -> Dict[str, Any]:
    """Extract numeric ratings from analysis text."""
    ratings = {}
    import re

    # Look for "Category: X/10" or similar patterns
    for match in re.finditer(r"(\w[\w\s]+?)\s*[:\-]\s*(\d+(?:\.\d+)?)\s*/\s*10", analysis_text):
        key = match.group(1).strip().lower().replace(" ", "_")
        ratings[key] = float(match.group(2))

    # Look for "X/10" at start of lines
    for i, line in enumerate(analysis_text.split("\n")):
        match = re.match(r"\s*(\d+(?:\.\d+)?)\s*/\s*10", line)
        if match:
            ratings[f"rating_{i}"] = float(match.group(1))

    return ratings


def extract_improvements(analysis_text: str) -> List[str]:
    """Extract listed improvements from analysis text."""
    improvements = []
    lines = analysis_text.split("\n")
    capture = False

    for line in lines:
        stripped = line.strip().lstrip("-*•0123456789. ")
        if any(kw in stripped.lower() for kw in ["improve", "suggestion", "recommend", "fix", "issue", "problem"]):
            capture = True
        if capture and stripped and len(stripped) > 10:
            improvements.append(stripped)
        if capture and stripped and "above" in stripped.lower():
            break

    return improvements[:5]  # Limit to top 5


def analyze_screenshot_ollama(
    image_path: Path,
    prompt: str,
    client: OllamaClient,
    model: str = MODEL,
) -> Dict[str, Any]:
    """Analyze a single screenshot using Ollama vision model."""
    b64 = encode_image(image_path)

    response = client.analyze_image(
        image_path=str(image_path),
        prompt=prompt,
        model=model,
        temperature=0.2,
        num_predict=768,
    )

    result = {
        "screenshot": image_path.name,
        "category": None,
        "analysis": response.response,
        "ratings": extract_ratings(response.response) if response.response else {},
        "improvements": extract_improvements(response.response) if response.response else [],
        "time_ms": response.total_duration_ms,
        "model": model,
    }

    if not response.success:
        result["error"] = response.error
        result["analysis"] = f"ERROR: {response.error}"

    return result


def generate_summary(
    results: Dict[str, List[Dict]],
    client: OllamaClient,
    model: str = MODEL,
) -> str:
    """Generate cross-category summary using Ollama."""
    all_text = ""
    for cat, items in results.items():
        for item in items:
            analysis = item.get("analysis", "")
            if analysis and "ERROR" not in analysis:
                all_text += f"[{cat}] {analysis}\n"

    if not all_text.strip():
        return "No valid analyses available for summary."

    summary_prompt = (
        f"You are a UI/UX expert reviewing Space Analyzer application screenshots. "
        f"Based on these evaluations, provide:\n"
        f"1. Top 3 UI issues across all pages (specific, actionable)\n"
        f"2. Top 3 quick wins (code changes that would have the most impact)\n"
        f"3. Overall UX score (1-10) with justification\n"
        f"4. Priority order for fixing issues\n\n"
        f"Data:\n{all_text[:3000]}\n\n"
        f"Format as structured JSON with keys: issues, quick_wins, overall_score, priority_order"
    )

    response = client.generate(
        prompt=summary_prompt,
        model=model,
        temperature=0.3,
        num_predict=512,
    )

    if response.success:
        return response.response
    return f"Summary generation failed: {response.error}"


def compare_with_history(
    current_results: Dict[str, List[Dict]],
    history_file: Path,
) -> Dict[str, Any]:
    """Compare current results with previous iteration history."""
    comparison = {"improvements": [], "regressions": [], "unchanged": []}

    if not history_file.exists():
        return comparison

    try:
        with open(history_file) as f:
            history = json.load(f)
    except (json.JSONDecodeError, Exception):
        return comparison

    prev_analyses = history.get("categories", {})

    for cat, current_items in current_results.items():
        prev_items = prev_analyses.get(cat, [])

        for i, item in enumerate(current_items):
            if i < len(prev_items):
                prev = prev_items[i]
                curr_rating = _avg_rating(item)
                prev_rating = _avg_rating(prev)

                if curr_rating > 0 and prev_rating > 0:
                    diff = curr_rating - prev_rating
                    entry = {
                        "category": cat,
                        "screenshot": item.get("screenshot", ""),
                        "previous_score": prev_rating,
                        "current_score": curr_rating,
                        "change": round(diff, 1),
                    }

                    if diff > 0:
                        comparison["improvements"].append(entry)
                    elif diff < 0:
                        comparison["regressions"].append(entry)
                    else:
                        comparison["unchanged"].append(entry)

    return comparison


def _avg_rating(item: Dict) -> float:
    """Get average rating from an analysis item."""
    ratings = item.get("ratings", {})
    if not ratings:
        return 0.0
    return sum(ratings.values()) / len(ratings)


def save_feedback_history(results: Dict, comparison: Dict) -> None:
    """Save analysis results for future comparison."""
    history = {
        "timestamp": datetime.now().isoformat(),
        "categories": results,
        "comparison": comparison,
    }
    FEEDBACK_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(FEEDBACK_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2, default=str)
    print(f"\n  📜 Feedback history saved -> {FEEDBACK_HISTORY_FILE}")


def main():
    print(f"\n  🔍 Vision Analysis with Feedback Loop")
    print(f"  Model: {MODEL}")
    print(f"  Screenshots: {DIR}")
    print(f"  Categories: {list(CATEGORIES.keys())}")
    print(f"  History: {'enabled' if FEEDBACK_HISTORY_FILE.exists() else 'new'}\n")

    # Initialize Ollama client
    client = get_client()
    if not client.check_server():
        print("  ❌ Ollama server not available at", client.base_url)
        print("  Make sure Ollama is running: ollama serve")
        sys.exit(1)

    print("  ✅ Ollama server connected")
    print(f"  Available models: {client.available_models or 'checking...'}")

    # Verify target model is available
    if MODEL not in client.available_models:
        print(f"  ⚠️  Model '{MODEL}' not found. Available: {client.available_models}")
        if client.available_models:
            MODEL_FALLBACK = client.available_models[0]
            print(f"  Using fallback: {MODEL_FALLBACK}")
        else:
            print("  ❌ No models available. Exiting.")
            sys.exit(1)

    shots = {s.stem: s for s in DIR.glob("*.png")}
    results = {}
    total_time = 0

    for cat, stems in CATEGORIES.items():
        print(f"\n  ── [{cat.upper()}] ──")
        cat_results = []
        for stem in stems:
            if stem not in shots:
                print(f"    ⏭ Skipping {stem}.png (not found)")
                continue

            prompt = PROMPTS.get(cat, "Analyze this application screenshot.")
            print(f"    🖼 Analyzing {stem}.png...", end=" ", flush=True)

            result = analyze_screenshot_ollama(shots[stem], prompt, client)
            total_time += result.get("time_ms", 0)
            cat_results.append(result)

            if result.get("success", False) or "error" not in result:
                rating_str = ""
                if result.get("ratings"):
                    avg = sum(result["ratings"].values()) / max(len(result["ratings"]), 1)
                    rating_str = f" | Rating: {avg:.1f}/10"
                print(f"✓ ({result.get('time_ms', '?')}ms){rating_str}")
            else:
                print(f"✗ ERROR: {result.get('error', 'unknown')[:50]}")

        results[cat] = cat_results

    # Generate cross-category summary
    print(f"\n  {'='*60}")
    print(f"  📊 GENERATING CROSS-CATEGORY SUMMARY")
    print(f"  {'='*60}")

    summary = generate_summary(results, client)

    # Compare with previous iteration
    comparison = compare_with_history(results, FEEDBACK_HISTORY_FILE)

    # Save results
    SAVE.parent.mkdir(parents=True, exist_ok=True)
    full_report = {
        "model": MODEL,
        "timestamp": datetime.now().isoformat(),
        "total_time_ms": round(total_time),
        "categories": results,
        "summary": summary,
        "iteration_comparison": comparison,
        "feedback_history_file": str(FEEDBACK_HISTORY_FILE),
    }

    SAVE.write_text(json.dumps(full_report, indent=2), encoding="utf-8")
    print(f"\n  📄 Report saved -> {SAVE}")

    # Save feedback history for next iteration
    save_feedback_history(results, comparison)

    # Print improvement tracking
    if comparison["improvements"]:
        print(f"\n  📈 IMPROVEMENTS ({len(comparison['improvements'])})")
        for item in comparison["improvements"]:
            print(f"    + {item['category']}/{item['screenshot']}: "
                  f"{item['previous_score']} → {item['current_score']} "
                  f"(+{item['change']})")

    if comparison["regressions"]:
        print(f"\n  📉 REGRESSIONS ({len(comparison['regressions'])})")
        for item in comparison["regressions"]:
            print(f"    - {item['category']}/{item['screenshot']}: "
                  f"{item['previous_score']} → {item['current_score']} "
                  f"({item['change']})")

    # Print summary
    print(f"\n  {'='*60}")
    print(f"  🧠 AI SUMMARY")
    print(f"  {'='*60}")
    print(summary)

    print(f"\n  ⏱️  Total time: {total_time / 1000:.1f}s")
    print(f"  📊 Report: {SAVE}")
    print(f"  📜 History: {FEEDBACK_HISTORY_FILE}")
    print(f"  🔄 Run again after making changes to track improvements!\n")


if __name__ == "__main__":
    main()
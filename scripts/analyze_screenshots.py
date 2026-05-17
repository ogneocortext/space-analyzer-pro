#!/usr/bin/env python3
"""
Analyze macro screenshots using PIL feature extraction + Ollama phi4-mini.
With iterative feedback loop: tracks improvements across runs.
"""

import json
import sys
import io
import urllib.request
import os
from pathlib import Path
from datetime import datetime
from collections import Counter
from PIL import Image, ImageFilter
import platform

MODEL = "phi4-mini:latest"
OLLAMA_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434") + "/api/generate"
ANALYSIS_HISTORY_DIR = Path("analysis_history")

# Fix encoding for Windows console
if platform.system() == "Windows":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

shots_root = Path("macro_logs")
shot_dirs = sorted(
    [d for d in shots_root.iterdir() if d.is_dir() and d.name.startswith("screenshots_")],
    reverse=True,
)
if not shot_dirs:
    print("ERROR: No screenshot directories found in macro_logs/")
    sys.exit(1)

SCREENSHOTS_DIR = shot_dirs[0]
ts = SCREENSHOTS_DIR.name.replace("screenshots_", "")
REPORT_PATH = shots_root / f"ux_analysis_{ts}.json"


def ask_ollama(prompt, model=MODEL):
    """Ask Ollama a question with retry logic."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.2, "num_predict": 384},
    }
    retries = 3
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                OLLAMA_URL,
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode()).get("response", "").strip()
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  ⏳ Retry {attempt+1}/{retries} after {wait}s... ({e})")
                time.sleep(wait)
            else:
                return f"ERROR: {e}"


def extract_features(path):
    """Extract visual features from a screenshot using PIL."""
    img = Image.open(path)
    w, h = img.size
    gray = img.convert("L")

    # Brightness
    px = list(gray.getdata())
    avg_bright = sum(px) / len(px)
    dark_pct = sum(1 for p in px if p < 64) / len(px) * 100
    light_pct = sum(1 for p in px if p > 192) / len(px) * 100

    # Edge density
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_pct = sum(1 for p in list(edges.getdata()) if p > 128) / len(px) * 100

    # Color palette (top 5)
    reduced = img.quantize(32)
    pal = reduced.getpalette()
    counts = Counter(reduced.getdata())
    top_colors = []
    for idx, _ in counts.most_common(5):
        r, g, b = pal[idx * 3 : idx * 3 + 3]
        top_colors.append(f"rgb({r},{g},{b})")

    # Center variety
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


def describe(f):
    """Generate a brief description of visual features."""
    parts = []
    parts.append("dark" if f["dark_pct"] > 50 else "light")
    parts.append("sparse" if f["edge_pct"] < 5 else "dense" if f["edge_pct"] > 15 else "moderate")
    parts.append(f"{f['center_colors']} tones in content")
    parts.append(" ".join(f["palette"][:3]))
    return "; ".join(parts)


KEY_SHOTS = {
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


def compute_quality_score(features):
    """Compute a unified quality score (0-100) from visual features."""
    # Brightness: prefer mid-range (40-60 brightness)
    bright_score = max(0, 100 - abs(features["bright"] - 50) * 2)

    # Edge density: moderate is best (5-15%)
    edge = features["edge_pct"]
    edge_score = 100 if 5 <= edge <= 15 else max(0, 100 - abs(edge - 10) * 3)

    # Color variety: more center colors is generally better
    color_score = min(100, features["center_colors"] * 2)

    # Dark percentage penalty
    dark_penalty = features["dark_pct"] * 0.3

    return round(max(0, min(100, (bright_score + edge_score + color_score) / 3 - dark_penalty)))


def compare_with_history(current_extracted, ts):
    """Compare extracted features with previous run history."""
    history_file = ANALYSIS_HISTORY_DIR / f"features_{ts}.json"
    comparison = {"improvements": [], "regressions": [], "scores": {}}

    if not history_file.exists():
        return comparison, None

    try:
        with open(history_file) as f:
            previous = json.load(f)
    except (json.JSONDecodeError, Exception):
        return comparison, None

    for key, curr_data in current_extracted.items():
        if key in previous:
            prev_score = previous[key].get("quality_score", 0)
            curr_score = curr_data.get("quality_score", 0)
            comparison["scores"][key] = {
                "previous": prev_score,
                "current": curr_score,
                "change": curr_score - prev_score,
            }
            if curr_score > prev_score + 1:
                comparison["improvements"].append({
                    "screenshot": key,
                    "from": prev_score,
                    "to": curr_score,
                })
            elif curr_score < prev_score - 1:
                comparison["regressions"].append({
                    "screenshot": key,
                    "from": prev_score,
                    "to": curr_score,
                })

    return comparison, previous


def main():
    print("\n  🔍 Extracting visual features...\n")
    screenshots = {
        s.stem: s
        for s in SCREENSHOTS_DIR.glob("*.png")
        if s.stem in KEY_SHOTS
    }

    extracted = {}
    for key, label in KEY_SHOTS.items():
        if key not in screenshots:
            print(f"  ⏭ Skipping {key} (not found)")
            continue
        f = extract_features(screenshots[key])
        f["quality_score"] = compute_quality_score(f)
        desc = describe(f)
        extracted[key] = {"label": label, "desc": desc, **f}
        print(
            f"  [{key}] quality={f['quality_score']}/100  {desc[:90]}..."
        )

    # Build compact context for LLM
    context_lines = []
    for k, v in extracted.items():
        context_lines.append(f"[{k}] {v['label']}: {v['desc']} (quality: {v.get('quality_score', '?')}/100)")
    context = "\n".join(context_lines)

    analysis_prompt = (
        f"You are a UI/UX expert. Evaluate this dark-theme desktop app based on "
        f"extracted visual data:\n\n{context}\n\n"
        f"The app is a Rust/egui disk space analyzer with Tabs: "
        f"Dashboard, Files (5 sub-views), Charts, History, Settings.\n\n"
        f"Provide:\n"
        f"1. VISUAL STYLE (1 line)\n"
        f"2. TOP 3 ISSUES (specific)\n"
        f"3. TOP 3 QUICK WINS (actionable code changes)\n"
        f"Format as plain text bullet points."
    )

    print("\n  🤖 Analyzing with LLM...", end=" ", flush=True)
    analysis = ask_ollama(analysis_prompt)
    print("OK")

    code_prompt = (
        f"Based on this UX feedback, suggest 3 specific egui 0.34 code changes:\n\n"
        f"FEEDBACK:\n{analysis[:2000] if analysis else 'No analysis available'}\n\n"
        f"Give concrete Rust/egui API calls (Visuals, Frame, Style, Layout). "
        f"Format as short code snippets with explanation."
    )

    print("  🤖 Generating code recommendations...", end=" ", flush=True)
    code_recs = ask_ollama(code_prompt)
    print("OK")

    # Compare with history
    comparison, _ = compare_with_history(extracted, ts)

    # Save
    report = {
        "model": MODEL,
        "timestamp": datetime.now().isoformat(),
        "screenshots": extracted,
        "ux_recommendations": analysis,
        "code_recommendations": code_recs,
        "quality_comparison": comparison,
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Save features for future comparison
    ANALYSIS_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    features_for_history = {
        k: {
            "quality_score": v.get("quality_score", 0),
            "bright": v["bright"],
            "edge_pct": v["edge_pct"],
            "dark_pct": v["dark_pct"],
            "center_colors": v["center_colors"],
        }
        for k, v in extracted.items()
    }
    with open(ANALYSIS_HISTORY_DIR / f"features_{ts}.json", "w") as f:
        json.dump(features_for_history, f, indent=2)

    # Print results
    print("\n" + "=" * 60)
    print("  📊 UX ANALYSIS RESULTS")
    print("=" * 60)
    print("\n  Screenshots analyzed:")
    for k, v in extracted.items():
        score = v.get("quality_score", "?")
        print(f"    {k}: quality={score}/100 - {v['desc'][:80]}")

    if comparison["improvements"]:
        print(f"\n  📈 Improvements detected ({len(comparison['improvements'])}):")
        for item in comparison["improvements"]:
            print(f"    + {item['screenshot']}: {item['from']} → {item['to']}")

    if comparison["regressions"]:
        print(f"\n  📉 Regressions detected ({len(comparison['regressions'])}):")
        for item in comparison["regressions"]:
            print(f"    - {item['screenshot']}: {item['from']} → {item['to']}")

    print("\n" + "-" * 60)
    print("\nRECOMMENDATIONS:\n")
    print(analysis if analysis else "No analysis generated")
    print("\n" + "-" * 60)
    print("CODE CHANGES:\n")
    print(code_recs if code_recs else "No code recommendations generated")
    print("\n" + "=" * 60)
    print(f"  📄 Report: {REPORT_PATH}")
    print(f"  📊 History: {ANALYSIS_HISTORY_DIR / f'features_{ts}.json'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
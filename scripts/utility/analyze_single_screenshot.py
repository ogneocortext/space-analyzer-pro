"""Dual-perspective screenshot analysis: technical (fast) + semantic (Ollama).

Runs the local Python technical analyzer (technical_screenshot_analysis.py) by default
for an instant, layout-oriented view, and optionally the slower Ollama vision
model (ollama_vision.py) for a natural-language semantic description. The two
together give a faster technically-driven check plus a slower semantically-
driven one, which can catch different issues.

If Ollama is unavailable or returns an error, the technical analysis is still
emitted and the semantic field carries the error - the run never fails hard.

Usage:
    python analyze_single_screenshot.py <image>                 # technical only (fast)
    python analyze_single_screenshot.py <image> --semantic      # + Ollama description
    python analyze_single_screenshot.py <image> --semantic --out report.json
"""
import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import technical_screenshot_analysis as tech
import ollama_vision as ollama


DEFAULT_PROMPT = (
    "Describe this UI screenshot: app name, screen, main panels, "
    "controls, and any readable text. Note anything that looks broken."
)


def build_verdict(report):
    tech_report = report.get("technical", {})
    sem = report.get("semantic")
    if not isinstance(sem, str):
        return None
    layout = tech_report.get("layout", {})
    content = tech_report.get("content", {})
    notes = []
    panels = layout.get("detected_panels", 0)
    low = sem.lower()
    if content.get("is_sparse") and ("panel" in low or "dashboard" in low or "chart" in low):
        notes.append("technical: screen is near-blank (low content ratio) but semantic "
                     "describes a rich UI - verify the capture actually rendered.")
    if panels == 0 and "panel" in low:
        notes.append("technical detected 0 panels but semantic describes panels - "
                     "segmentation may need tuning for this theme.")
    return notes or ["technical and semantic outputs appear consistent."]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--semantic", action="store_true", help="also run Ollama vision (slower)")
    ap.add_argument("--prompt", default=None)
    ap.add_argument("--model", default="gemma4:e2b-it-qat")
    ap.add_argument("--palette", type=int, default=8, help="palette colors for technical")
    ap.add_argument("--min-panel", type=int, default=64, help="min panel area (px) for technical")
    ap.add_argument("--host", default="http://localhost:11434", help="Ollama base URL")
    ap.add_argument("--timeout", type=int, default=180, help="Ollama request timeout (s)")
    ap.add_argument("--out", default=None, help="write combined JSON report to file")
    ap.add_argument("--quiet", action="store_true", help="suppress stdout when --out is set")
    args = ap.parse_args()

    if args.prompt and not args.semantic:
        print("note: --prompt is ignored without --semantic", file=sys.stderr)

    report = {"technical": tech.analyze(args.image, args.palette, args.min_panel)}
    if args.semantic:
        try:
            report["semantic"] = ollama.describe(
                args.image, args.prompt or DEFAULT_PROMPT, args.model,
                host=args.host, timeout=args.timeout,
            )
        except ollama.OllamaVisionError as e:
            report["semantic"] = {"error": str(e)}
        except Exception as e:  # never let semantic kill the technical report
            report["semantic"] = {"error": f"{type(e).__name__}: {e}"}
        report["verdict"] = build_verdict(report)

    text = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print("report written to", args.out)
    if not args.out or not args.quiet:
        print(text)


if __name__ == "__main__":
    main()

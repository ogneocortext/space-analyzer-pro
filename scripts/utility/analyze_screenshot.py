"""Dual-perspective screenshot analysis: technical (fast) + semantic (Ollama).

Runs the local Python technical analyzer (screenshot_technical.py) by default
for an instant, layout-oriented view, and optionally the slower Ollama vision
model (ollama_vision.py) for a natural-language semantic description. The two
together give a faster technically-driven check plus a slower semantically-
driven one, which can catch different issues.

Usage:
    python analyze_screenshot.py <image>                # technical only (fast)
    python analyze_screenshot.py <image> --semantic     # + Ollama description
    python analyze_screenshot.py <image> --semantic --out report.json
"""
import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import screenshot_technical as tech
import ollama_vision as ollama


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--semantic", action="store_true", help="also run Ollama vision (slower)")
    ap.add_argument("--prompt", default=None)
    ap.add_argument("--model", default="gemma4:e2b-it-qat")
    ap.add_argument("--out", default=None, help="write combined JSON report to file")
    args = ap.parse_args()

    report = {"technical": tech.analyze(args.image)}
    if args.semantic:
        report["semantic"] = ollama.describe(
            args.image,
            args.prompt or (
                "Describe this UI screenshot: app name, screen, main panels, "
                "controls, and any readable text. Note anything that looks broken."
            ),
            args.model,
        )

    text = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print("report written to", args.out)
    else:
        print(text)


if __name__ == "__main__":
    main()

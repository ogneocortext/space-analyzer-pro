"""Local Ollama vision helper — semantic (slower) screenshot analysis.

Usage:
    python ollama_vision.py <image> [prompt] [model]

Calls a local Ollama vision model (default gemma4:e2b-it-qat) and prints the
text response. This is the *semantic* counterpart to screenshot_technical.py,
which gives a fast, algorithm-driven (technical) view of the same image.
"""
import sys
import base64
import json
import urllib.request


def describe(image_path, prompt, model="gemma4:e2b-it-qat", host="http://localhost:11434", timeout=180):
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    payload = {"model": model, "prompt": prompt, "images": [b64], "stream": False}
    req = urllib.request.Request(
        host + "/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)["response"]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python ollama_vision.py <image> [prompt] [model]")
        sys.exit(1)
    path = sys.argv[1]
    prompt = sys.argv[2] if len(sys.argv) > 2 else (
        "Describe this UI screenshot in detail: what application is it, the screen/page name, "
        "the main panels and controls, any text/labels you can read, and the overall layout. "
        "Be specific about whether it looks like a disk-space analyzer dashboard."
    )
    model = sys.argv[3] if len(sys.argv) > 3 else "gemma4:e2b-it-qat"
    print(describe(path, prompt, model))

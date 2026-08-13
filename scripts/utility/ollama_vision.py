"""Local Ollama vision helper - semantic (slower) screenshot analysis.

Usage:
    python ollama_vision.py <image> [prompt] [model] [host]

Calls a local Ollama vision model (default gemma4:e2b-it-qat) and returns the
text response. This is the *semantic* counterpart to screenshot_technical.py,
which gives a fast, algorithm-driven (technical) view of the same image.

On any failure it raises OllamaVisionError with a clear message so callers
(analyze_screenshot.py) can degrade gracefully instead of crashing.
"""
import sys
import json
import base64
import urllib.request
import urllib.error


class OllamaVisionError(Exception):
    pass


def describe(image_path, prompt, model="gemma4:e2b-it-qat",
             host="http://localhost:11434", timeout=180):
    try:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
    except OSError as e:
        raise OllamaVisionError(f"cannot read image {image_path!r}: {e}")

    payload = {"model": model, "prompt": prompt, "images": [b64], "stream": False}
    req = urllib.request.Request(
        host + "/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")
        except Exception:
            pass
        raise OllamaVisionError(f"Ollama HTTP {e.code}: {body[:500]}")
    except urllib.error.URLError as e:
        raise OllamaVisionError(f"cannot reach Ollama at {host}: {e.reason}")

    if not isinstance(data, dict):
        raise OllamaVisionError(f"unexpected Ollama response: {type(data).__name__}")
    if "error" in data:
        raise OllamaVisionError(f"Ollama error: {data['error']}")
    if "response" not in data:
        raise OllamaVisionError(f"Ollama response missing 'response' key; keys={list(data)}")
    return data["response"]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python ollama_vision.py <image> [prompt] [model] [host]")
        sys.exit(1)
    path = sys.argv[1]
    prompt = sys.argv[2] if len(sys.argv) > 2 else (
        "Describe this UI screenshot in detail: what application is it, the screen/page name, "
        "the main panels and controls, any text/labels you can read, and the overall layout. "
        "Be specific about whether it looks like a disk-space analyzer dashboard."
    )
    model = sys.argv[3] if len(sys.argv) > 3 else "gemma4:e2b-it-qat"
    host = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:11434"
    try:
        print(describe(path, prompt, model, host))
    except OllamaVisionError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

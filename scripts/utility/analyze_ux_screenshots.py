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
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import time

from PIL import Image, ImageFilter, ImageStat, UnidentifiedImageError

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
# num_ctx must be large enough for the combined analysis prompt (per-shot
# vision descriptions + schema). 16384 caused HTTP 400 "exceed_context_size_error"
# when every duplicate capture (launched/launched-2/...) was concatenated. We now
# also cap the aggregated context to the canonical key shots, but keep headroom
# for the model (qwen3-vl supports 32k).
# num_predict is deliberately generous: the per-shot schema carries a long
# main_content + evidence + recommendation per issue, and 2048 tokens silently
# truncated ~21 of 33 shots mid-string. The report renderer used to emit those
# fragments verbatim (unparseable JSON in <pre>), so every truncated shot read as
# a wall of raw model text. Bounding the output here keeps the whole object
# intact; the renderer also dedupes near-identical captures.
GENERATION_OPTIONS: dict[str, Any] = {"temperature": 0.1, "num_ctx": 32768, "num_predict": 8192}
# Per-shot vision calls analyze a single 300px screenshot + schema and only
# need ~16k context. The full 32k window above forces a partial GPU offload
# (the KV cache blows the VRAM budget) and is the dominant per-call slowdown:
# the model runs 31% on CPU and each of the 33+33 calls pays for the huge window.
VISION_OPTIONS: dict[str, Any] = {"temperature": 0.1, "num_ctx": 16384, "num_predict": 8192}
# When a shot's JSON is truncated, ask once more with the tail already emitted
# as a hint so the model can finish instead of re-describing from scratch.
MAX_REPAIR_TRIES: int = 2

# Resize cap for vision payloads (matches app's resizeBase64Image behavior)
VISION_IMG_MAX: int = 300
# A full capture run can contain dozens of interaction states. Analyze a broad,
# deterministic subset in depth so actionable findings are not limited to the
# handful of canonical tab screenshots.
MAX_REPRESENTATIVE_SHOTS: int = 40

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
                    "category": {
                        "type": "string",
                        "enum": ["layout", "navigation", "content", "interaction", "accessibility", "visual_polish", "reliability"],
                    },
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "finding": {"type": "string"},
                    "location": {"type": "string"},
                    "evidence": {"type": "string"},
                    "recommendation": {"type": "string"},
                },
                "required": ["category", "severity", "finding", "evidence", "recommendation"],
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

# Co-located with the run report; consumed by live_progress_server.py so the
# analysis can be watched in a browser while Ollama is still working.
DEFAULT_PROGRESS_PATH: Path = Path("macro_logs") / "analysis_progress.json"


def _write_progress(state: dict[str, Any], path: Path = DEFAULT_PROGRESS_PATH) -> None:
    """Write the live progress state the dashboard polls.

    Writes directly to the target file (no tmp + os.replace). A rename/replace
    fails with ``WinError 5 Access is denied`` on Windows while the
    live_progress_server holds the file open for reading (it blocks the
    delete/rename share), which previously spammed the run with warnings.
    """
    state = dict(state)
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.warning("Could not write progress file %s: %s", path, exc)


def _mark_fatal(exc: Exception) -> None:
    """Record a crash in the live progress file so the dashboard never shows a
    stale ``status: "running"`` after the analyzer dies unexpectedly.

    Without this, any uncaught exception leaves ``analysis_progress.json``
    advertising a running run that is actually dead — which makes the live
    model-output panel go blank and hides where the failure happened.
    """
    try:
        state = {
            "status": "error",
            "phase": "crashed",
            "message": f"Crashed: {exc}",
            "error": repr(exc),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        _write_progress(state, DEFAULT_PROGRESS_PATH)
        logger.error("Analysis crashed: %r", exc)
    except OSError:
        pass


def ask_ollama(
    prompt: str,
    model: str = MODEL,
    client: OllamaClient | None = None,
    image_path: Path | None = None,
    *,
    json_schema: dict[str, Any] | None = None,
    on_token: "Callable[[str], None] | None" = None,
    options: dict[str, Any] | None = None,
) -> str:
    """Analyze one prompt via Ollama.

    When ``on_token`` is supplied the call streams and invokes ``on_token``
    with each generated text fragment so a dashboard can show live progress;
    it falls back to a non-streaming call if streaming fails. ``options``
    overrides the default generation options (e.g. a smaller ``num_ctx`` for
    per-shot vision calls).
    """
    client = client or OllamaClient()
    gen_opts = options or GENERATION_OPTIONS
    effective_model = model
    image_b64 = encode_image_for_vision(image_path) if image_path else None

    if image_b64:
        model_prompt = (
            "You are reviewing one screenshot as a strict UX auditor. "
            "Return ONLY one JSON object matching the supplied schema. "
            "Use only visible evidence from this image; never infer hidden behavior, "
            "off-screen content, implementation details, or user intent. "
            "If text is unreadable, say so and lower evidence_confidence. "
            "Do not repeat the screenshot description as an issue. "
            "Report only actionable problems or clear strengths.\n"
            f"{prompt}"
        )
    else:
        model_prompt = (
            "You are a structured analysis API. Return ONLY a single JSON object. "
            "No markdown, no prose, no explanations.\n"
            "App context: WinUI 3 desktop disk space analyzer.\n"
            f"Screenshot features:\n{prompt}\n"
            '{"app_title":"","visible_navigation":[""],"main_content":"",'
            '"issues":[{"category":"layout|navigation|content|interaction|accessibility|visual_polish|reliability","severity":"high|medium|low","finding":"","evidence":"","recommendation":""}],'
            '"quick_wins":[""],"evidence_confidence":"high|medium|low"}'
        )

    if on_token is not None:
        try:
            text = client.stream_generate(
                model=effective_model,
                prompt=model_prompt,
                think=False,
                format=json_schema,
                options=gen_opts,
                images=[image_b64] if image_b64 else None,
                on_chunk=on_token,
            )
            return parse_model_text(text)
        except Exception as exc:  # pragma: no cover - defensive fallback
            logger.warning("stream_generate failed, falling back to non-stream: %s", exc)

    if image_b64:
        try:
            response = client.generate(
                model=effective_model,
                prompt=model_prompt,
                stream=False,
                options=gen_opts,
                images=[image_b64],
                think=False,
                format=json_schema,
            )
            return parse_model_text(response)
        except Exception as exc:
            logger.error("Vision Ollama call failed: %s", exc)
            return f"ERROR: {exc}"

    try:
        response = client.generate(
            model=effective_model,
            prompt=model_prompt,
            stream=False,
            options=GENERATION_OPTIONS,
            think=False,
            format=json_schema,
        )
        return parse_model_text(response)
    except Exception as exc:
        logger.error("Ollama call failed: %s", exc)
        return f"ERROR: {exc}"


def _vision_with_retry(prompt: str, model: str, client: "OllamaClient", path: Path, max_tries: int = 3, on_token: "Callable[[str], None] | None" = None) -> str:
    """Call the vision model, retrying on empty/garbled output.

    qwen3-vl occasionally returns an empty string for a frame (especially
    near-duplicate pre/post pairs). A blank vision_description silently drops
    that screen from the analysis, so retry with a tightened prompt before
    giving up. Don't retry on hard ERRORs (e.g. context overflow) — those
    repeat deterministically. When ``on_token`` is supplied the generated text
    is streamed so the dashboard shows live vision output too.
    """
    last = ""
    for _ in range(max_tries):
        res = ask_ollama(prompt, model=model, client=client, image_path=path, on_token=on_token, options=VISION_OPTIONS)
        if res and res.strip() and not res.startswith("ERROR"):
            return res
        last = res or ""
        if last.startswith("ERROR"):
            break
        prompt = (
            prompt
            + " Be thorough and explicit: name every visible heading, button, field, "
            "value, list, and empty state. Do not return an empty description."
        )
    return last or "⚠️ model returned empty"


def _close_json(raw: str) -> str:
    """Best-effort repair of a truncated JSON object.

    The vision model occasionally stops mid-string (num_predict / context
    limit), leaving an object that never closes. Closing the last open string
    and any open braces/brackets lets the renderer show the *partial* finding
    instead of dumping raw model text — a partial finding is still useful, an
    unparseable blob is not.

    The nesting order of the remaining open ``{``/``[`` cannot be recovered from
    net counts alone, so we try the plausible closure orderings and return the
    first that actually parses.
    """
    if not raw:
        return raw
    s = raw
    in_string = False
    escape = False
    last_quote = None
    for i, ch in enumerate(s):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            if not in_string:
                last_quote = i
            in_string = not in_string
    if in_string and last_quote is not None:
        s = s[: last_quote + 1] + '"'
    # Strip a trailing comma that would otherwise be invalid before the closes.
    s = re.sub(r",\s*$", "", s)
    depth_obj = max(s.count("{") - s.count("}"), 0)
    depth_arr = max(s.count("[") - s.count("]"), 0)
    for closes in (
        "}" * depth_obj + "]" * depth_arr,
        "]" * depth_arr + "}" * depth_obj,
        "".join("}]" for _ in range(min(depth_obj, depth_arr)))
        + "}" * (depth_obj - depth_arr)
        + "]" * (depth_arr - depth_obj),
    ):
        candidate = s + closes
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            continue
    # Nothing parsed; return the closed-string form as a last resort.
    return s


def _parse_shot(raw: str) -> tuple[dict | None, str]:
    """Parse one per-shot response into (data, status).

    status is one of: 'ok', 'truncated', 'unparseable'. Truncated-but-repaired
    output is returned with status 'truncated' so the report can flag it.
    """
    if not raw or raw.strip().startswith("ERROR"):
        return None, "error"
    try:
        return json.loads(raw), "ok"
    except json.JSONDecodeError:
        pass
    repaired = _close_json(raw)
    try:
        return json.loads(repaired), "truncated"
    except json.JSONDecodeError:
        return None, "unparseable"


def _base_tab(key: str) -> str:
    """Group near-duplicate capture suffixes onto one canonical tab.

    The capture harness re-shoots each tab several times (launched-2,
    dashboard-3, settings-5 ...) and the analyzer analyzed every one, so the
    report showed the same tab 5 times. Grouping by the trailing ``-<n>``
    suffix collapses that to one row per real screen while keeping the
    highest-quality capture as the representative.
    """
    return re.sub(r"-\d+$", "", key)


def _build_deduped_view(
    screenshots: dict[str, Any],
    per_shot_data: dict[str, dict | None],
    per_shot_status: dict[str, str],
) -> dict[str, Any]:
    """Collapse the per-shot map into one row per canonical tab.

    Returns ``{"groups": {base_tab: {...}}, "counts": {...}}`` where each group
    exposes the representative capture (best quality_score), the list of
    duplicate capture keys it subsumes, and the parsed finding.
    """
    groups: dict[str, dict[str, Any]] = {}
    for key, shot in screenshots.items():
        if not isinstance(shot, dict):
            continue
        base = _base_tab(key)
        g = groups.setdefault(
            base,
            {
                "base": base,
                "label": shot.get("label", base),
                "captures": [],
                "best_key": key,
                "best_score": int(shot.get("quality_score", 0)),
            },
        )
        score = int(shot.get("quality_score", 0))
        g["captures"].append(
            {"key": key, "score": score, "label": shot.get("label", key)}
        )
        if score > g["best_score"]:
            g["best_key"] = key
            g["best_score"] = score

    for base, g in groups.items():
        if g["best_key"].endswith("_pre"):
            non_pre = [c for c in g["captures"] if not c["key"].endswith("_pre")]
            if non_pre:
                g["best_key"] = non_pre[0]["key"]
                g["best_score"] = non_pre[0]["score"]

    for base, g in groups.items():
        g["captures"].sort(key=lambda c: (-c["score"], c["key"]))
        g["dup_count"] = len(g["captures"]) - 1
        best = g["best_key"]
        g["data"] = per_shot_data.get(best)
        g["status"] = per_shot_status.get(best, "unparseable")
        shot = screenshots.get(best, {})
        g["desc"] = shot.get("desc", "")
        g["dim"] = shot.get("dim", "")
        g["bright"] = shot.get("bright")
        g["dark_pct"] = shot.get("dark_pct")
        g["edge_pct"] = shot.get("edge_pct")
        g["center_colors"] = shot.get("center_colors")

    counts = {
        "tabs": len(groups),
        "captures": len(screenshots),
        "duplicates": sum(g["dup_count"] for g in groups.values()),
        "truncated": sum(1 for s in per_shot_status.values() if s == "truncated"),
        "unparseable": sum(1 for s in per_shot_status.values() if s == "unparseable"),
    }
    return {"groups": groups, "counts": counts}


def _pixels(img: "Image.Image") -> list[int]:
    """Return the flattened pixel data without the Pillow 14 ``getdata`` deprecation.

    ``get_flattened_data`` is the non-deprecated replacement (Pillow ≥ 10.2); fall
    back to ``getdata`` on older installs so the feature-extraction path keeps working.
    """
    if hasattr(img, "get_flattened_data"):
        return list(img.get_flattened_data())  # type: ignore[attr-defined]
    return list(img.getdata())  # type: ignore[attr-defined]


# Features (brightness, edges, dominant colors) are resolution-invariant at
# coarse scale, so we downscale huge screenshots once before any pixel work.
# This keeps memory bounded and is ~20x faster on 4K captures with negligible
# loss of signal.
_MAX_FEATURE_SIDE: int = 512


def extract_features(path: Path) -> dict[str, Any]:
    with Image.open(path) as img:
        img.load()  # decode fully while the handle is open so it can close cleanly
        w, h = img.size
        # Downscale once for the pixel-analysis pass (features are scale-invariant).
        if max(w, h) > _MAX_FEATURE_SIDE:
            scale = _MAX_FEATURE_SIDE / max(w, h)
            img = img.resize(
                (max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS
            )
        w, h = img.size
        total = w * h
        if total == 0:
            return {
                "dim": f"{w}x{h}",
                "bright": 0.0,
                "dark_pct": 0.0,
                "light_pct": 0.0,
                "edge_pct": 0.0,
                "center_colors": 0,
                "palette": [],
            }

        gray = img.convert("L")
        stat = ImageStat.Stat(gray)
        hist = gray.histogram()
        avg_bright = stat.mean[0]
        dark_pct = sum(hist[:64]) / total * 100
        light_pct = sum(hist[193:]) / total * 100

        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_pct = sum(edges.histogram()[129:]) / total * 100

        reduced = img.quantize(32)
        palette = reduced.getpalette() or []
        counts = Counter(_pixels(reduced))
        top_colors = []
        for idx, _ in counts.most_common(5):
            lo, hi = idx * 3, idx * 3 + 3
            if hi > len(palette):
                # Palette shorter than expected for this index; stop safely
                # instead of unpacking fewer than 3 values.
                break
            r, g, b = palette[lo:hi]
            top_colors.append(f"rgb({r},{g},{b})")

        center = img.crop((w // 4, h // 4, 3 * w // 4, 3 * h // 4)).quantize(16)
        center_variety = len(set(_pixels(center)))

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
    # Recursively collect every PNG so reorganized/subfolder layouts and flat
    # unique-only dirs are all analyzed. Key = relative path (minus .png) so
    # files in different subfolders stay unique; KEY_SHOTS provides friendly
    # labels for known shots and is used as a fallback below.
    candidates: dict[str, Path] = {}
    for s in screenshots_dir.rglob("*.png"):
        key = s.relative_to(screenshots_dir).as_posix()[:-4]
        candidates[key] = s
    matches: dict[str, Path] = {}
    for key, label in KEY_SHOTS.items():
        alias = ALIASES.get(key, key)
        path = candidates.get(alias)
        if path is not None:
            matches[key] = path
    # Include every other screenshot too (not just the curated key shots).
    for key, path in candidates.items():
        if key not in matches:
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
        '"issues":[{"category":"layout|navigation|content|interaction|accessibility|visual_polish|reliability","severity":"high|medium|low","finding":"","location":"","evidence":"","recommendation":""}],'
        '"quick_wins":[""],"evidence_confidence":"high|medium|low"}'
    )
    return (
        "You are a UX analysis engine for WinUI 3 desktop screenshots.\n"
        "For each screenshot, extract:\n"
        '1. app_title: exact visible window/title text\n'
        '2. visible_navigation: every visible tab label, sidebar entry, menu item (read the actual text)\n'
        '3. main_content: what is rendered in the main panel (charts, tables, lists, empty states, cards)\n'
        '4. issues: categorize each as layout, navigation, content, interaction, accessibility, visual_polish, or reliability; high=usability blockers, medium=friction/confusion, low=polish — cite the specific location if visible\n'
        '5. quick_wins: concrete, actionable UI improvements (name the affected control or view and expected user benefit)\n'
        '6. evidence_confidence: high if text and structure are clear, medium if partially visible, low if ambiguous\n'
        'For every issue include: evidence (what is visibly wrong and where), recommendation (one concrete fix), and avoid duplicate issues across screenshots.\n'
        "App context: Space Analyzer Pro.\n"
        f"{context}\n"
        f"{schema_hint}"
    )


def _build_single_shot_analysis_prompt(label: str, features: dict[str, Any], vision: str) -> str:
    """Analyze ONE screenshot (its own image is passed separately as grounding)."""
    schema_hint = (
        '{"app_title":"","visible_navigation":[""],"main_content":"",'
        '"issues":[{"category":"layout|navigation|content|interaction|accessibility|visual_polish|reliability","severity":"high|medium|low","finding":"","location":"","evidence":"","recommendation":""}],'
        '"quick_wins":[""],"evidence_confidence":"high|medium|low"}'
    )
    return (
        "You are a UX analysis engine for ONE WinUI 3 desktop screenshot of "
        "Space Analyzer Pro (a disk-space analyzer).\n"
        f"Screenshot label: {label}\n"
        f"PIL features: {json.dumps(features)}\n"
        f"Vision description: {vision}\n"
        "Extract only what is visible in THIS screenshot:\n"
        '1. app_title: exact visible window/title text\n'
        '2. visible_navigation: every visible tab label / menu item (read actual text)\n'
        '3. main_content: what renders in the main panel (charts, tables, lists, cards, empty states)\n'
        '4. issues: categorize each as layout, navigation, content, interaction, accessibility, visual_polish, or reliability; high=usability blockers, medium=friction/confusion, low=polish — cite the specific location\n'
        '5. quick_wins: concrete, actionable UI improvements (name the affected control or view and expected user benefit)\n'
        '6. evidence_confidence: high if text/structure are clear, medium if partial, low if ambiguous\n'
        'For every issue include: evidence (what is visibly wrong and where), recommendation (one concrete fix), and do not invent behavior that is not shown.\n'
        f"{schema_hint}"
    )


def _build_code_prompt(feedback: str) -> str:
    """Suggest 3 specific WinUI 3 code changes grounded on real UX findings.

    ``feedback`` is the consolidated/per-shot analysis text. It must NOT be an
    ``ERROR: ...`` string — callers pass the real findings, never a failed-model
    echo, otherwise the model fabricates plausible-looking but bogus files (e.g.
    ``gui-win0ui/...``, ``SpaceAnalyzerService.cs`` referencing non-existent APIs).
    """
    feedback = (feedback or "No analysis available").strip()
    if feedback.startswith("ERROR"):
        feedback = "(analysis pipeline produced no structured findings; do not invent code)"
    if len(feedback) > MAX_FEEDBACK_CHARS:
        feedback = feedback[:MAX_FEEDBACK_CHARS]
    schema_hint = (
        '{"changes":[{"file":"gui-winui/SpaceAnalyzer/Views/ExamplePage.xaml","change":"...","why":"..."}]}'
    )
    return (
        "Based on this UX feedback, suggest exactly 3 specific WinUI 3 code changes.\n"
        "Return ONLY a compact JSON object with no prose.\n"
        "Each change targets one of: XAML Layout, Styling/Resources, Data Binding, "
        "Code-Behind (C#). Prefer editing files under gui-winui/SpaceAnalyzer/ "
        "(Views/*.xaml, Views/*.xaml.cs, Services/*.cs, App.xaml resources).\n"
        "Only reference files that actually exist in this project. Do not invent new "
        "pages or services. If the feedback is thin, return an empty changes list.\n"
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


def _esc(value: Any) -> str:
    """HTML-escape a value for safe interpolation into the report."""
    s = (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    # Truncated model output occasionally carries lone UTF-16 surrogates that
    # cannot be encoded; drop them so the report renders instead of crashing.
    return s.encode("utf-8", "ignore").decode("utf-8")


def _quality_color(score: int) -> str:
    if score >= 70:
        return "#3fb950"
    if score >= 45:
        return "#d29922"
    return "#f85149"


def _dedupe_issues(issues: list[dict] | None) -> list[dict]:
    """Collapse repeated findings within one tab.

    The vision model often emits the same issue many times (especially on a
    small-parameter build). Group by a normalized finding key, keep the
    highest-severity copy, and surface how many times the model raised it via
    ``occurrences`` so the reader still sees it was a recurring concern.
    """
    sev_rank = {"high": 3, "medium": 2, "low": 1}

    def norm(finding: str) -> str:
        return re.sub(r"\s+", " ", (finding or "").strip().lower())

    kept: dict[str, dict] = {}
    for it in issues or []:
        if not isinstance(it, dict):
            continue
        n = norm(it.get("finding", ""))
        if not n:
            continue
        existing = kept.get(n)
        if existing is None:
            merged = dict(it)
            merged["occurrences"] = 1
            kept[n] = merged
        else:
            existing["occurrences"] = existing.get("occurrences", 1) + 1
            if sev_rank.get(it.get("severity", "low"), 0) > sev_rank.get(existing.get("severity", "low"), 0):
                existing["severity"] = it.get("severity", existing.get("severity"))
                existing["evidence"] = it.get("evidence") or existing.get("evidence")
                existing["recommendation"] = it.get("recommendation") or existing.get("recommendation")

    def sev_key(it: dict) -> int:
        return sev_rank.get(it.get("severity", "low"), 0)

    return sorted(kept.values(), key=lambda it: (-sev_key(it), -it.get("occurrences", 1)))


def _render_issue(it: dict) -> str:
    category = str(it.get("category", "uncategorized")).replace("_", " ")
    sev = str(it.get("severity", "low")).lower()
    finding = _esc(it.get("finding", ""))
    loc = _esc(it.get("location", ""))
    evidence = _esc(it.get("evidence", ""))
    recommendation = _esc(it.get("recommendation", ""))
    occ = it.get("occurrences", 1)
    occ_badge = f'<span class="occ" title="model raised this {occ} times">×{occ}</span>' if occ > 1 else ""
    return (
        f'<div class="issue sev-{_esc(sev)}">'
        f'<span class="cat-badge">{_esc(category)}</span>'
        f'<span class="sev-badge">{_esc(sev)}</span>'
        f'<span class="finding">{finding}{occ_badge}</span>'
        + (f'<span class="loc">— {loc}</span>' if loc else "")
        + (f'<div class="evidence"><b>Evidence:</b> {evidence}</div>' if evidence else "")
        + (f'<div class="recommendation"><b>Fix:</b> {recommendation}</div>' if recommendation else "")
        + "</div>"
    )


def _render_findings(raw: str, dedupe: bool = True, image_key: str | None = None, status: str | None = None) -> str:
    """Render one per-shot analysis (JSON string, possibly an ERROR) to HTML."""
    if not raw:
        return '<p class="muted">(none)</p>'
    if raw.strip().startswith("ERROR"):
        return f'<p class="err">{_esc(raw.strip())}</p>'

    data: dict | None = None
    if status == "truncated":
        data, _ = _parse_shot(raw)
    else:
        try:
            data = json.loads(raw)
        except (ValueError, json.JSONDecodeError):
            data = None
    if not isinstance(data, dict):
        # Fall back to best-effort repair so a truncated blob still renders
        # what was recovered instead of a wall of raw model text.
        data, st = _parse_shot(raw)
        if not isinstance(data, dict):
            note = ' <span class="warn">(analysis unparseable — listing raw below)</span>' if status == "unparseable" else ""
            return f'<p class="err">Could not parse analysis.{note}</p><pre class="raw">{_esc(raw)}</pre>'

    parts: list[str] = []
    if status == "truncated":
        parts.append('<p class="warn">⚠ This analysis was truncated by the model and repaired; some trailing detail may be missing.</p>')
    if image_key:
        parts.append(
            f'<div class="shot-img"><a href="/api/shot?key={_esc(image_key)}" target="_blank" '
            f'rel="noopener"><img loading="lazy" src="/api/shot?key={_esc(image_key)}" '
            f'alt="{_esc(image_key)} screenshot"></a></div>'
        )
    nav = data.get("visible_navigation") or []
    if nav:
        parts.append(
            '<div class="nav-chips">'
            + "".join(f'<span class="chip">{_esc(n)}</span>' for n in nav)
            + "</div>"
        )
    content = data.get("main_content")
    if content:
        parts.append(f'<p class="content">{_esc(content)}</p>')
    issues = _dedupe_issues(data.get("issues")) if dedupe else (data.get("issues") or [])
    if issues:
        parts.append(f'<div class="issues"><div class="issues-head">'
                     f'{len(issues)} finding{"s" if len(issues) != 1 else ""}'
                     f'{"" if dedupe else ""}</div>')
        parts.append("".join(_render_issue(it) for it in issues))
        parts.append("</div>")
    wins = data.get("quick_wins") or []
    if wins:
        items = "".join(f"<li>{_esc(w)}</li>" for w in wins)
        parts.append(f'<ul class="wins">{items}</ul>')
    conf = data.get("evidence_confidence")
    if conf:
        parts.append(f'<p class="conf">evidence confidence: {_esc(conf)}</p>')
    return "\n".join(parts)


def _render_code_recs(raw: str) -> str:
    """Render the code-recommendations JSON (or raw text) to HTML."""
    if not raw:
        return '<p class="muted">No code recommendations generated.</p>'
    try:
        data = json.loads(raw)
    except (ValueError, json.JSONDecodeError):
        return f'<pre class="raw">{_esc(raw)}</pre>'
    changes = (data or {}).get("changes") or []
    if not changes:
        return '<p class="muted">No code recommendations generated.</p>'
    rows = []
    for c in changes:
        rows.append(
            '<div class="code-change">'
            f'<div class="code-file">{_esc(c.get("file", ""))}</div>'
            f'<pre class="code-diff">{_esc(c.get("change", ""))}</pre>'
            f'<div class="code-why"><b>why:</b> {_esc(c.get("why", ""))}</div>'
            "</div>"
        )
    return "\n".join(rows)


def _render_html_report(report: dict[str, Any]) -> str:
    """Build a self-contained dark-themed HTML report from the analysis JSON."""
    model = _esc(report.get("model", "—"))
    ts = _esc(report.get("timestamp", ""))
    status = _esc(report.get("status", "complete"))
    screens = report.get("screenshots", {}) or {}
    ux = (report.get("ux_recommendations", {}) or {})
    per_shot = ux.get("per_screenshot", {}) or {}
    per_shot_status = ux.get("per_shot_status", {}) or {}
    deduped = ux.get("deduped") or {}
    groups = (deduped.get("groups") or {}) if isinstance(deduped, dict) else {}
    counts = (deduped.get("counts") or {}) if isinstance(deduped, dict) else {}
    summary = ux.get("summary")
    summary_failed = ux.get("summary_failed")
    code_raw = report.get("code_recommendations")
    comparison = report.get("quality_comparison", {}) or {}

    scores = [v.get("quality_score", 0) for v in screens.values() if isinstance(v, dict)]
    avg = round(sum(scores) / len(scores)) if scores else 0

    # Per-tab rows (deduplicated across near-duplicate captures).
    use_groups = bool(groups)
    tab_rows: list[str] = []
    sev_tally = {"high": 0, "medium": 0, "low": 0}
    for base, g in (groups.items() if use_groups else {}):
        best = g.get("best_key") or base
        raw = per_shot.get(best, "")
        st = per_shot_status.get(best, "unparseable")
        label = _esc(g.get("label", base))
        score = int(g.get("best_score", 0))
        dup = g.get("dup_count", 0)
        dup_badge = (
            f'<span class="dup-badge" title="This tab was captured {dup + 1} times; '
            f'repeat captures merged">{dup + 1}× captures</span>'
        ) if dup else ""
        # Count findings by severity so the row header doubles as a triage signal.
        data, _ = _parse_shot(raw) if st != "ok" else (None, "ok")
        if data is None:
            try:
                data = json.loads(raw)
            except (ValueError, json.JSONDecodeError):
                data = {}
        for it in (data.get("issues") or []) if isinstance(data, dict) else []:
            s = str(it.get("severity", "low")).lower()
            sev_tally[s] = sev_tally.get(s, 0) + 1
        row = (
            '<section class="shot" '
            f'data-sev-high="{sev_tally["high"]}" data-sev-medium="{sev_tally["medium"]}" '
            f'data-sev-low="{sev_tally["low"]}" data-score="{score}" data-label="{_esc(base)}">'
            f'<h3><span class="dot" style="background:{_quality_color(score)}"></span>'
            f'{label} <span class="shot-score" style="color:{_quality_color(score)}">{score}/100</span>'
            f'{dup_badge}</h3>'
            f'<div class="shot-body">{_render_findings(raw, image_key=best, status=st)}</div>'
            "</section>"
        )
        tab_rows.append(row)
        sev_tally = {"high": 0, "medium": 0, "low": 0}
    shots_html = "\n".join(tab_rows)

    if not use_groups:
        # Fallback: no deduped view (older report); render flat per screenshot.
        for k, v in screens.items():
            if not isinstance(v, dict):
                continue
            raw = per_shot.get(k, "")
            st = per_shot_status.get(k, "unparseable")
            label = _esc(v.get("label", k))
            score = int(v.get("quality_score", 0))
            tab_rows.append(
                '<section class="shot" data-score="' + str(score) + f'" data-label="{_esc(k)}">'
                f'<h3><span class="dot" style="background:{_quality_color(score)}"></span>'
                f'{label} <span class="shot-score" style="color:{_quality_color(score)}">{score}/100</span></h3>'
                f'<div class="shot-body">{_render_findings(raw, image_key=k, status=st)}</div>'
                "</section>"
            )
        shots_html = "\n".join(tab_rows)

    # Global severity tally across all tabs for the summary stats row.
    g_sev = {"high": 0, "medium": 0, "low": 0}
    for _raw in per_shot.values():
        if not _raw:
            continue
        try:
            _d = json.loads(_raw) if isinstance(_raw, str) else _raw
        except (ValueError, json.JSONDecodeError):
            _d = None
        if not isinstance(_d, dict):
            continue
        for _it in _d.get("issues") or []:
            _s = str(_it.get("severity", "low")).lower()
            if _s in g_sev:
                g_sev[_s] += 1
    _total_findings = sum(g_sev.values())
    stats_html = (
        '<div class="stats">'
        f'<div class="stat"><div class="n">{_total_findings}</div><div class="k">total findings</div></div>'
        f'<div class="stat sev-high"><div class="n">{g_sev["high"]}</div><div class="k">high severity</div></div>'
        f'<div class="stat sev-medium"><div class="n">{g_sev["medium"]}</div><div class="k">medium severity</div></div>'
        f'<div class="stat sev-low"><div class="n">{g_sev["low"]}</div><div class="k">low severity</div></div>'
        '</div>'
    )

    # Comparison
    comp_html = ""
    if comparison.get("improvements") or comparison.get("regressions"):
        items = []
        for it in comparison.get("improvements", []):
            items.append(f'<li class="up">+ {_esc(it["screenshot"])}: {it["from"]} → {it["to"]}</li>')
        for it in comparison.get("regressions", []):
            items.append(f'<li class="down">- {_esc(it["screenshot"])}: {it["from"]} → {it["to"]}</li>')
        comp_html = '<ul class="comp">' + "\n".join(items) + "</ul>"

    if summary_failed:
        summary_html = (
            '<p class="err">Summary consolidation failed; per-screen findings above are authoritative.</p>'
        )
    else:
        summary_html = _render_findings(summary, dedupe=True) if summary else '<p class="muted">(none)</p>'

    # Header health badges from the deduped counts.
    truncated = counts.get("truncated", 0)
    unparseable = counts.get("unparseable", 0)
    dup_free = counts.get("tabs", len(screens))
    health = []
    if truncated:
        health.append(f'<span class="hbadge warn">{truncated} truncated</span>')
    if unparseable:
        health.append(f'<span class="hbadge err">{unparseable} unparseable</span>')
    if counts.get("duplicates", 0):
        health.append(f'<span class="hbadge ok">{counts["duplicates"]} duplicate captures merged</span>')
    health_html = " ".join(health)

    css = """
    :root { --bg:#0d1117; --panel:#161b22; --panel2:#1c2330; --line:#2b3440;
            --txt:#e6edf3; --muted:#8b949e; --accent:#4aa3ff; --ok:#3fb950; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--txt);
           font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
           font-size:14px; line-height:1.55; }
    a { color:var(--accent); }
    header { padding:20px 28px; border-bottom:1px solid var(--line);
             display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
    header h1 { margin:0; font-size:22px; }
    .back { color:var(--accent); text-decoration:none; font-weight:600; font-size:13px;
            margin-left:auto; padding:5px 12px; border:1px solid var(--accent);
            border-radius:999px; background:rgba(74,163,255,.12); white-space:nowrap; }
    .back:hover { background:rgba(74,163,255,.22); }
    .meta { color:var(--muted); font-size:13px; }
    .hbadge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; }
    .hbadge.warn { background:#3a2c0a; color:#e3b341; }
    .hbadge.err { background:#3d1418; color:#ff7b72; }
    .hbadge.ok { background:#1b3326; color:#9be7b4; }
    main { padding:24px 28px 64px; max-width:1200px; margin:0 auto; }
    main > section { margin-top:32px; padding-top:28px; border-top:1px solid var(--line); }
    main > section:first-of-type { margin-top:0; padding-top:0; border-top:none; }
    h2 { font-size:16px; border-left:3px solid var(--accent); padding-left:10px; margin:0 0 14px; }
    .qgrid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); }
    .qcard { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; text-align:center; }
    .qscore { font-size:30px; font-weight:700; }
    .qlabel { font-weight:600; margin-top:4px; }
    .qdesc { color:var(--muted); font-size:12px; margin-top:4px; }
    .shot { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:20px 22px; margin-bottom:18px; }
    .shot h3 { margin:0 0 10px; font-size:15px; display:flex; align-items:center; gap:8px; }
    .dot { width:10px; height:10px; border-radius:50%; display:inline-block; flex:none; }
    .shot-score { margin-left:auto; font-weight:700; }
    .dup-badge { font-size:10px; font-weight:700; color:#9be7b4; background:#14241b;
                 border:1px solid #20402d; border-radius:999px; padding:1px 7px; }
    .shot-img { margin:6px 0 12px; }
    .shot-img img { max-width:100%; max-height:520px; border-radius:8px; border:1px solid var(--line);
                    cursor:zoom-in; display:block; }
    .nav-chips { margin:6px 0; }
    .chip { display:inline-block; background:var(--panel2); border:1px solid var(--line);
            border-radius:999px; padding:2px 9px; font-size:12px; margin:2px 4px 2px 0; }
    .content { color:var(--txt); font-size:14px; line-height:1.6; }
    .content p { margin:6px 0; }
    .issues { margin:10px 0; }
    .issues-head { font-size:12px; color:var(--muted); margin-bottom:6px; }
    .issue { display:flex; gap:10px; align-items:baseline; flex-wrap:wrap;
             padding:10px 12px; border-radius:8px; background:#0f141b;
             border:1px solid var(--line); margin:6px 0; }
    .cat-badge { font-size:10px; text-transform:uppercase; letter-spacing:.03em; font-weight:700; border-radius:6px;
      padding:2px 6px; background:#252b35; color:#b8c4d6; white-space:nowrap; }
    .evidence, .recommendation { flex-basis:100%; margin-left:4px; color:#aab4c2; font-size:12px; }
    .recommendation { color:#9dd6a8; }
    .occ { font-size:10px; font-weight:700; color:#e3b341; background:#2a2208; border-radius:999px; padding:0 6px; margin-left:6px; }
    .sev-badge { font-size:11px; text-transform:uppercase; font-weight:700; border-radius:6px; padding:1px 7px; flex:none; }
    .sev-high { background:#3d1418; color:#ff7b72; }
    .sev-medium { background:#3a2c0a; color:#e3b341; }
    .sev-low { background:#1b2733; color:#79c0ff; }
    .finding { flex:1; font-size:13px; min-width:200px; }
    .loc { color:var(--muted); font-size:12px; }
    .wins { margin:8px 0 0; padding-left:18px; }
    .wins li { font-size:13px; margin:3px 0; }
    .conf { color:var(--muted); font-size:12px; }
    .warn { color:#e3b341; font-size:12px; }
    .code-change { background:var(--panel); border:1px solid var(--line); border-radius:10px;
                   padding:12px 14px; margin:10px 0; }
    .code-file { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--accent); font-size:13px; }
    .code-diff { background:#0b0f14; border-radius:8px; padding:10px; overflow:auto; font-size:12px;
                 max-height:320px; white-space:pre-wrap; }
    .code-why { color:var(--muted); font-size:12px; margin-top:6px; }
    .raw { background:#0b0f14; border-radius:8px; padding:10px; overflow:auto; font-size:12px; white-space:pre-wrap; }
    .muted { color:var(--muted); font-size:13px; }
    .consolidated { background:linear-gradient(180deg,#101b14,#0f141b); border:1px solid #1f3a2a;
                    border-left:4px solid var(--ok); border-radius:12px; padding:16px 18px; }
    .err { color:#ff7b72; font-size:13px; }
    .comp { list-style:none; padding:0; }
    .comp li { padding:3px 0; font-size:13px; }
    .comp .up { color:var(--ok); } .comp .down { color:#f85149; }
    .toolbar { position:sticky; top:0; z-index:5; background:#11161d; border:1px solid var(--line);
               border-radius:10px; padding:10px 12px; display:flex; gap:8px; align-items:center;
               flex-wrap:wrap; margin-bottom:18px; }
    .toolbar b { font-size:12px; color:var(--muted); }
    .toolbar select, .toolbar input, .toolbar button { background:var(--panel2); color:var(--txt);
               border:1px solid var(--line); border-radius:6px; padding:6px 9px; font-size:13px; }
    .toolbar input[type=search] { min-width:200px; }
    .toolbar button { cursor:pointer; }
    .toolbar button.active { background:var(--accent); color:#08131d; border-color:var(--accent); }
    .toolbar .spacer { margin-left:auto; }
    .count { color:var(--muted); font-size:12px; }
    .stats { display:flex; gap:12px; flex-wrap:wrap; margin:0 0 8px; }
    .stat { background:var(--panel); border:1px solid var(--line); border-left:4px solid var(--muted);
            border-radius:10px; padding:12px 18px; min-width:120px; }
    .stat .n { font-size:26px; font-weight:800; line-height:1; }
    .stat .k { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-top:4px; }
    .stat.sev-high { border-left-color:#ff7b72; } .stat.sev-high .n { color:#ff7b72; }
    .stat.sev-medium { border-left-color:#e3b341; } .stat.sev-medium .n { color:#e3b341; }
    .stat.sev-low { border-left-color:#79c0ff; } .stat.sev-low .n { color:#79c0ff; }
    .hidden { display:none !important; }
    .shot.collapsed > *:not(h3) { display:none; }
    @media (max-width:640px){ .shot-img img{max-height:320px;} main{padding:16px;}
       .stats{flex-direction:column} .stat{min-width:0} }
    @media print { .toolbar{display:none;} .shot-img img{max-height:none;} body{background:#fff;color:#000;} }
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UX Analysis Report</title>
<style>{css}</style>
</head>
<body>
<header>
  <h1>UX Analysis Report</h1>
  <a class="back" href="/" title="Back to the live analysis dashboard">&larr; Dashboard</a>
  <span class="meta">model: <b>{model}</b></span>
  <span class="meta">captured: {ts}</span>
  <span class="meta">tabs: <b>{dup_free}</b></span>
  <span class="meta">avg render score: <b style="color:{_quality_color(avg)}">{avg}/100</b></span>
  {health_html}
</header>
<main>
  <div class="toolbar">
    <b>Filter</b>
    <select id="cat"><option value="">All categories</option><option>layout</option>
      <option>navigation</option><option>content</option><option>interaction</option>
      <option>accessibility</option><option>visual polish</option><option>reliability</option></select>
    <select id="sev"><option value="">All severities</option><option value="high">high</option>
      <option value="medium">medium</option><option value="low">low</option></select>
    <input type="search" id="q" placeholder="search findings…">
    <b>Sort</b>
    <select id="sort"><option value="">Default</option><option value="sev">Severity</option>
      <option value="score-desc">Score ↓</option><option value="score-asc">Score ↑</option></select>
    <button id="collapse">Collapse all</button>
    <span class="spacer"></span>
    <span class="count" id="count"></span>
   </div>
   {stats_html}
   <section>
     <h2>Quality overview <span class="muted" style="font-weight:400;font-size:12px">(render heuristic — not a UX judgment)</span></h2>
    <div class="qgrid">{_quality_cards_html(screens)}</div>
  </section>
   <section>
     <h2>Consolidated recommendations</h2>
     <div class="consolidated">{summary_html}</div>
   </section>
  <section>
    <h2>Per-tab findings <span class="muted" style="font-weight:400;font-size:12px">(duplicate captures merged, findings deduped)</span></h2>
    {shots_html}
  </section>
  <section>
    <h2>WinUI 3 code recommendations</h2>
    {_render_code_recs(code_raw)}
  </section>
  {('<section><h2>Quality comparison vs previous run</h2>' + comp_html + '</section>') if comp_html else ''}
</main>
<script>
const shots = [...document.querySelectorAll('.shot')];
const cat = document.getElementById('cat');
const sev = document.getElementById('sev');
const q = document.getElementById('q');
const sort = document.getElementById('sort');
const count = document.getElementById('count');
function apply() {{
  const c = cat.value, s = sev.value, t = q.value.trim().toLowerCase();
  let visible = 0;
  shots.forEach(shot => {{
    const issues = [...shot.querySelectorAll('.issue')];
    const matches = issues.filter(i => {{
      const cc = i.querySelector('.cat-badge')?.textContent.toLowerCase() || '';
      const ss = i.querySelector('.sev-badge')?.textContent.toLowerCase() || '';
      const txt = i.textContent.toLowerCase();
      return (!c || cc === c) && (!s || ss === s) && (!t || txt.includes(t));
    }});
    issues.forEach(i => i.classList.toggle('hidden', !matches.includes(i)));
    const show = (!c && !s && !t) ? true
      : (issues.length > 0 && matches.length > 0);
    shot.classList.toggle('hidden', !show);
    if (show) visible++;
  }});
  count.textContent = visible + ' of ' + shots.length + ' tabs shown';
}}
function sortTabs() {{
  const mode = sort.value;
  if (!mode) return;
  const wrap = shots[0].parentElement;
  const sorted = [...shots].sort((a,b) => {{
    if (mode === 'sev') {{
      const hs = x => +x.dataset.sevHigh*9 + +x.dataset.sevMedium*3 + +x.dataset.sevLow;
      return hs(b) - hs(a);
    }}
    const av = x => +x.dataset.score;
    return mode === 'score-desc' ? av(b)-av(a) : av(a)-av(b);
  }});
  sorted.forEach(s => wrap.appendChild(s));
}}
cat.onchange = sev.onchange = () => {{ apply(); }};
q.oninput = apply;
sort.onchange = () => {{ sortTabs(); apply(); }};
document.getElementById('collapse').onclick = e => {{
  const collapse = e.target.textContent === 'Collapse all';
  shots.forEach(s => s.classList.toggle('collapsed', collapse));
  e.target.textContent = collapse ? 'Expand all' : 'Collapse all';
}};
// Severity accent: tint each tab card's left border by its worst severity so
// high-impact tabs are scannable at a glance (gemma: faster severity cue).
shots.forEach(shot => {{
  const h = +shot.dataset.sevHigh || 0, m = +shot.dataset.sevMedium || 0, l = +shot.dataset.sevLow || 0;
  if (h > 0) shot.style.borderLeft = '4px solid #ff7b72';
  else if (m > 0) shot.style.borderLeft = '4px solid #e3b341';
  else if (l > 0) shot.style.borderLeft = '4px solid #79c0ff';
}});
apply();
</script>
</body>
</html>
"""


def _quality_cards_html(screens: dict) -> str:
    """Render the quality-overview cards (one per captured screenshot)."""
    cards = []
    for k, v in screens.items():
        if not isinstance(v, dict):
            continue
        score = int(v.get("quality_score", 0))
        label = _esc(v.get("label", k))
        desc = _esc(v.get("desc", ""))
        cards.append(
            '<div class="qcard">'
            f'<div class="qscore" style="color:{_quality_color(score)}">{score}</div>'
            f'<div class="qlabel">{label}</div>'
            f'<div class="qdesc">{desc}</div>'
            "</div>"
        )
    return "\n".join(cards)


def run_analysis(
    screenshots_dir: Path,
    report_path: Path,
    ts: str,
) -> int:
    print("Extracting visual features...")
    logger.info("run_analysis start: screenshots_dir=%s", screenshots_dir)
    screenshots = _matching_screenshots(screenshots_dir)

    extracted: dict[str, dict[str, Any]] = {}
    client = OllamaClient()
    picked_model = pick_vision_model(client, default=MODEL)
    print(f"  Using vision model: {picked_model}")

    progress_path = report_path.parent / "analysis_progress.json"
    prog: dict[str, Any] = {
        "status": "running",
        "model": picked_model,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "phase": "features",
        "total": len(screenshots),
        "features_done": 0,
        "vision_done": 0,
        "analysis_done": 0,
        "analysis_total": 0,
        "current": "",
        "current_label": "",
        "live_output": "",
        "errors": [],
        "shots": {k: {"status": "pending", "label": KEY_SHOTS.get(k, k)} for k in screenshots},
        "message": "Extracting visual features",
    }

    def _emit_progress(**kwargs: Any) -> None:
        prog.update(kwargs)
        prog["updated_at"] = datetime.now(timezone.utc).isoformat()
        _write_progress(prog, progress_path)

    # Streaming reporter: throttled live preview of the model's generated text
    # so the dashboard shows activity during the long analysis/summary/code calls.
    _last_stream_emit = {"t": 0.0}

    def _make_stream_reporter() -> Callable[[str], None]:
        def on_token(piece: str) -> None:
            prog["live_output"] = (prog.get("live_output", "") + piece)[-600:]
            now = time.monotonic()
            if now - _last_stream_emit["t"] >= 0.3:
                _last_stream_emit["t"] = now
                _emit_progress()
        _emit_progress()
        return on_token

    reporter = _make_stream_reporter()

    _emit_progress()
    prog["live_output"] = (
        f"Extracting visual features (PIL) from {len(screenshots)} screenshots "
        f"— no model text yet; live model output begins with the vision pass."
    )
    _emit_progress()

    if not screenshots:
        logger.error("No matching screenshots found in %s (have: %s)", screenshots_dir,
                     ", ".join(sorted(s.stem for s in screenshots_dir.glob("*.png"))[:10]) or "none")
        return 1

    for key, path in screenshots.items():
        label = KEY_SHOTS.get(key, key)
        prog["shots"][key]["status"] = "features"
        _emit_progress(current=key, current_label=label, message=f"Extracting features: {label}")
        logger.info("Feature extraction start: %s (quality_score pending)", key)
        print(f"  analyzing {path.stem}...", end=" ", flush=True)
        try:
            features = extract_features(path)
        except (FileNotFoundError, UnidentifiedImageError, OSError) as exc:
            logger.error("Could not extract features for %s: %s", key, exc)
            prog["shots"][key]["status"] = "error"
            prog["errors"].append(f"{key}: features failed ({exc})")
            _emit_progress()
            continue
        features["quality_score"] = compute_quality_score(features)
        desc = describe(features)
        extracted[key] = {"label": label, "desc": desc, **features}
        prog["shots"][key]["status"] = "features_done"
        prog["features_done"] = prog.get("features_done", 0) + 1
        _emit_progress()
        print(f"ok quality={features['quality_score']}/100", flush=True)

    if not extracted:
        logger.error("No key screenshots found in %s", screenshots_dir)
        _emit_progress(status="error", phase="done", message="No extractable screenshots found")
        return 1

    # Per-screenshot vision pass: send each screenshot's ACTUAL image to the vision
    # model so it can read visible UI text/labels/controls. PIL features alone ("dark;
    # sparse; 16 tones") cannot report what's really displayed on each tab, so without
    # this the "vision" analysis is text-only inference on feature stats.
    print("\nRunning per-screenshot vision analysis...")
    logger.info(
        "Features pass complete (%d/%d screens). Entering vision pass.",
        prog["features_done"], len(screenshots),
    )
    vision_results: dict[str, str] = {}
    per_shot_analysis: dict[str, str] = {}
    per_shot_data: dict[str, dict | None] = {}
    per_shot_status: dict[str, str] = {}

    _emit_progress(phase="vision", message="Running per-screenshot vision analysis")
    logger.info("Starting vision loop over %d screenshots.", len(screenshots))
    for key, path in screenshots.items():
        if key not in extracted:
            continue
        if key.endswith("_pre"):
            # Pre-click baseline duplicates the tab's resting state; skip the
            # vision call (saves tokens) and reuse the resting description.
            vision_results[key] = extracted[key].get("vision_description", "(pre-click baseline, skipped)")
            extracted[key]["vision_description"] = vision_results[key]
            prog["shots"][key]["status"] = "done"
            prog["vision_done"] = prog.get("vision_done", 0) + 1
            _emit_progress()
            print(f"  vision {path.stem}... skipped (pre-click baseline)")
            continue
        prog["shots"][key]["status"] = "vision"
        prog["live_output"] = ""
        _emit_progress(current=key, current_label=KEY_SHOTS.get(key, key), message=f"Vision: {KEY_SHOTS.get(key, key)} — reading visible UI text/controls")
        print(f"  vision {path.stem}...", end=" ", flush=True)
        logger.info("Vision call start: %s", key)
        shot_prompt = (
            f"This is the '{KEY_SHOTS.get(key, key)}' tab of Space Analyzer Pro (a WinUI 3 "
            "desktop disk-space analyzer). Describe EXACTLY what is visible: "
            "headings, button labels, input fields, slider values, checkboxes, "
            "stat cards and their numbers, list/table contents, and empty states. "
            "Read visible text literally. Note layout structure. One concise paragraph."
        )
        vision_results[key] = _vision_with_retry(shot_prompt, picked_model, client, path, on_token=reporter)
        extracted[key]["vision_description"] = vision_results[key]
        prog["shots"][key]["status"] = "done"
        # Store the full vision inventory (not a 1500-char slice) so the live
        # preview renders the complete object. 1500 cut the JSON mid-object for
        # busy screens, which made the server flag every such shot as "truncated".
        prog["shots"][key]["vision_preview"] = vision_results[key][:6000]
        prog["vision_done"] = prog.get("vision_done", 0) + 1
        _emit_progress()
        print("ok")

    # Per-screenshot grounded UX analysis: run the structured analysis on EACH
    # representative screenshot using its OWN image as grounding, so findings are
    # specific to that tab (not collapsed onto one frame, which previously let the
    # model misreport e.g. "no progress bar" when one was visible). The
    # representative set is capped to fit the vision model's context window.
    candidates = [k for k in extracted if not k.endswith("_pre")]
    # Prioritize launch/tab/result states, then include interaction states in
    # stable filename order. This keeps reports comparable across runs while
    # covering settings, search, workflow, and button states too.
    priority = [
        k for k in candidates
        if ("01_launch__" in k or "02_tabs__" in k
            or "03_results" in k or "99_after_all" in k)
    ]
    remainder = [k for k in candidates if k not in priority]
    representative = (priority + remainder)[:MAX_REPRESENTATIVE_SHOTS]
    if not representative:
        representative = list(extracted)[:MAX_REPRESENTATIVE_SHOTS]
    prog["analysis_total"] = len(representative)
    _emit_progress(phase="analysis", message=f"Per-screenshot UX analysis ({len(representative)} screens)", analysis_total=len(representative))
    logger.info(
        "Vision pass complete (%d done). Starting per-screenshot analysis of %d representatives.",
        prog["vision_done"], len(representative),
    )
    for i, k in enumerate(representative, 1):
        prog["shots"].setdefault(k, {"status": "pending", "label": KEY_SHOTS.get(k, k)})
        prog["shots"][k]["status"] = "analysis"
        prog["live_output"] = ""
        _emit_progress(current=k, current_label=KEY_SHOTS.get(k, k),
                       message=f"Analysis {i}/{len(representative)}: {KEY_SHOTS.get(k, k)} — reading UI, extracting issues/quick wins")
        shot = extracted[k]
        shot_prompt = _build_single_shot_analysis_prompt(
            shot.get("label", k), shot, vision_results.get(k, "")
        )
        shot_img = screenshots.get(k)
        print(f"\n  analyzing {k}...", end=" ", flush=True)
        logger.info("Analysis call start %d/%d: %s", i, len(representative), k)
        raw = ask_ollama(
            shot_prompt, model=picked_model, client=client,
            json_schema=ANALYSIS_SCHEMA, image_path=shot_img, on_token=reporter,
            options=VISION_OPTIONS,
        )
        data, status = _parse_shot(raw)
        # Truncated output is still useful if repaired, but ask once more with
        # the emitted tail as a hint so the model can finish the object.
        tries = 0
        while status == "truncated" and tries < MAX_REPAIR_TRIES:
            tries += 1
            prog["shots"][k]["status"] = "analysis"
            _emit_progress(current=k, current_label=KEY_SHOTS.get(k, k),
                           message=f"Repairing truncated JSON for {KEY_SHOTS.get(k, k)} ({tries}/{MAX_REPAIR_TRIES})")
            print(f"\n  truncated ({len(raw)} chars), repairing...", end=" ", flush=True)
            repair_prompt = (
                shot_prompt
                + "\n\nYour previous response was cut off before the JSON object closed. "
                  "Continue from where you stopped and finish the object — do NOT repeat "
                  "the content you already emitted. Return only the remaining fields to close "
                  "the JSON: the rest of the issues array, quick_wins, and evidence_confidence."
            )
            raw = ask_ollama(
                repair_prompt, model=picked_model, client=client,
                json_schema=ANALYSIS_SCHEMA, image_path=shot_img, on_token=reporter,
                options=VISION_OPTIONS,
            )
            data, status = _parse_shot(raw)
        per_shot_analysis[k] = raw
        per_shot_data[k] = data
        per_shot_status[k] = status
        prog["shots"][k]["status"] = "done"
        # Same reasoning as vision_preview: keep the full analysis JSON so the
        # live card shows every issue instead of being sliced mid-finding.
        prog["shots"][k]["analysis_preview"] = (raw or "")[:6000]
        prog["shots"][k]["parse_status"] = status
        prog["analysis_done"] = prog.get("analysis_done", 0) + 1
        prog["live_output"] = ""
        _emit_progress()
        print("OK" if status == "ok" else f"({status})")

    # Aggregate the per-screenshot findings into one summary, grounded on a real
    # Scan screenshot so the model has an anchor image to reason about.
    # Bound the context to the canonical key shots (not every -2/-3 duplicate
    # capture) so the prompt stays under the model's context window; the full
    # per-screenshot findings are still emitted individually below.
    summary_keys = representative[:24]
    agg_context = "\n".join(
        f"[{k}]\n{per_shot_analysis.get(k, '')[:1800]}" for k in summary_keys
    )
    summary_prompt = _build_analysis_prompt(agg_context)
    scan_image = (
        next((p for k, p in screenshots.items()
              if "scan" in k.lower() and not k.endswith("_pre")), None)
        or next(iter(screenshots.values()), None)
    )
    _emit_progress(phase="summary",
                   message=f"Aggregating findings from {len(summary_keys)} representative screenshots into a consolidated report")
    logger.info("Per-shot analysis complete (%d). Aggregating summary.", prog["analysis_done"])
    print("\nAnalyzing with LLM (JSON schema)...", end=" ", flush=True)
    analysis = ask_ollama(
        summary_prompt, model=picked_model, client=client,
        json_schema=ANALYSIS_SCHEMA, image_path=scan_image, on_token=reporter,
    )
    prog["live_output"] = ""
    _emit_progress()
    print("OK")

    # The summary consolidation can fail (e.g. transient context overflow). Don't
    # let a failed echo poison the downstream code step — feed the real per-shot
    # findings instead, and surface a clear note in the console/HTML report.
    if isinstance(analysis, str) and analysis.strip().startswith("ERROR"):
        logger.warning("Summary consolidation failed; code recs will use per-shot findings")
        code_feedback = agg_context
        analysis_note = analysis.strip()
    else:
        code_feedback = analysis
        analysis_note = None

    _emit_progress(phase="code", message="Generating WinUI 3 code recommendations")
    logger.info("Summary done. Generating code recommendations.")
    code_prompt = _build_code_prompt(code_feedback)
    print("\nGenerating code recommendations...", end=" ", flush=True)
    code_recs = ask_ollama(code_prompt, model=picked_model, client=client, json_schema=CODE_SCHEMA, on_token=reporter)
    prog["live_output"] = ""
    _emit_progress()
    print("OK")

    comparison, _ = compare_with_history(extracted, ts)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "model": picked_model,
        "per_shot_model": picked_model,
        "combined_model": picked_model,
        "status": "complete",
        "analysis_per_screenshot": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "screenshots": extracted,
        "vision_analysis": vision_results,
        "ux_recommendations": {
            "per_screenshot": per_shot_analysis,
            "per_shot_data": {k: v for k, v in per_shot_data.items()},
            "per_shot_status": dict(per_shot_status),
            "summary": analysis,
            "summary_failed": analysis_note is not None,
            "summary_error": analysis_note,
            "deduped": _build_deduped_view(extracted, per_shot_data, per_shot_status),
        },
        "code_recommendations": code_recs,
        "quality_comparison": comparison,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    html_path = report_path.with_suffix(".html")
    html_text = ""
    try:
        html_text = _render_html_report(report)
        html_path.write_text(html_text, encoding="utf-8")
    except Exception as exc:  # pragma: no cover - presentation only
        logger.warning("Could not render HTML report %s: %s", html_path, exc)

    # Canonical persistence: mirror the report into the SQLite store so the
    # self-improvement loop's runs are queryable/retrievable (by model, set,
    # severity) instead of only discoverable via filename mtime scans. The
    # on-disk JSON/HTML remain as a portable backup.
    try:
        from ux_reports_db import ReportsStore
        report_key = report_path.stem
        if report_key.startswith("ux_analysis_"):
            report_key = report_key[len("ux_analysis_"):]
        store = ReportsStore(report_path.parent / "ux_reports.db")
        store.upsert_from_report(report, html=html_text, report_key=report_key)
        store.close()
        logger.info("Persisted report to database (key=%s)", report_key)
    except Exception as exc:  # pragma: no cover - persistence is best-effort
        logger.warning("Could not persist report to database: %s", exc)

    # --- Issue tracker sync --------------------------------------------------
    # Mirror the per-screenshot UX findings into the canonical docs/issues.json so
    # the self-improvement loop and the dashboard's Issue Tracker panel all operate
    # on one shared store. Re-runs dedupe on the stable issue_id (category + title
    # + screenshot hash), preserving history/status; only the first "open"
    # occurrence seeds a row, later runs just bump occurrences. Best-effort: a
    # missing ux_pipeline install or a write failure must never fail the analysis.
    try:
        from ux_pipeline._issue_tracker import (
            IssueTracker, IssueRow, make_issue_id,
        )
        set_name = screenshots_dir.name
        tracker = IssueTracker(Path("docs") / "issues.json")
        tracker.load()
        synced = 0
        for k, data in per_shot_data.items():
            if not isinstance(data, dict):
                continue
            for it in (data.get("issues") or []):
                if not isinstance(it, dict):
                    continue
                title = (it.get("finding") or it.get("title") or "").strip()
                if not title:
                    continue
                category = (it.get("category") or "ui").strip().lower() or "ui"
                severity = (it.get("severity") or "medium").strip().lower() or "medium"
                location = it.get("location") or ""
                evidence = it.get("evidence") or ""
                recommendation = it.get("recommendation") or ""
                issue_id = make_issue_id(category, title, k)
                row = IssueRow(
                    issue_id=issue_id,
                    title=title,
                    category=category,
                    severity=severity,
                    screenshot=k,
                    notes=recommendation or evidence,
                    tags=["ux-analysis", f"set:{set_name}"],
                    extra={
                        "screenshot_key": k,
                        "shot_label": KEY_SHOTS.get(k, k),
                        "location": location,
                        "evidence": evidence,
                        "recommendation": recommendation,
                        "source_set": set_name,
                    },
                )
                tracker.upsert(row)
                synced += 1
        if synced:
            tracker.save()
            logger.info("Synced %d UX findings into issue tracker (%s)", synced, tracker.path)
    except Exception as exc:  # pragma: no cover - tracker sync is best-effort
        logger.warning("Could not sync findings to issue tracker: %s", exc)

    _emit_progress(status="done", phase="done", report_path=str(report_path),
                   html_report_path=str(html_path), message="Analysis complete", live_output="")
    logger.info("Analysis complete. Report: %s | HTML: %s", report_path, html_path)

    history_path = _save_features_history(extracted, ts)
    _print_summary(extracted, comparison)

    print("\nRECOMMENDATIONS (summary):\n")
    if analysis_note:
        print(f"(summary consolidation failed: {analysis_note}; per-screen findings below are authoritative)")
    print(analysis or "No analysis generated")
    print("\nPER-SCREENSHOT FINDINGS:\n")
    for k, v in per_shot_analysis.items():
        print(f"--- {k} ---")
        print(v or "(none)")
    print("\nCODE CHANGES:\n")
    print(code_recs or "No code recommendations generated")
    print(f"\nReport: {report_path}")
    print(f"HTML report: {html_path}")
    print(f"History: {history_path}")
    return 0


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze macro screenshots via PIL + Ollama")
    parser.add_argument("--shots-root", default=str(DEFAULT_SHOTS_ROOT), help="Directory containing screenshots_* subdirs")
    parser.add_argument("--shots-dir", default=None, help="Direct path to a screenshots directory (named or unnamed)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


class _FlushStreamHandler(logging.StreamHandler):
    """StreamHandler that flushes after every record.

    Under a pipe (the dashboard server captures the analyzer's stderr into the
    run log) the default handler is block-buffered, so log lines lag behind the
    flush=True stdout prints and the tail shows them offset by a screen. Flushing
    per emit keeps the raw log in order with the printed progress.
    """

    def emit(self, record):
        super().emit(record)
        try:
            self.flush()
        except Exception:
            pass


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        handlers=[_FlushStreamHandler()],
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
    requested_model = os.getenv("VISION_MODEL", MODEL)
    model_slug = "".join(c if c.isalnum() or c in "._-" else "-" for c in requested_model).strip("-")
    report_ts = f"{ts}__{model_slug}" if model_slug else ts
    report_path = shots_root / f"ux_analysis_{report_ts}.json"
    if not report_path.parent.exists():
        report_path = latest.parent / f"ux_analysis_{report_ts}.json"
    try:
        return run_analysis(latest, report_path, report_ts)
    except BaseException:  # noqa: BLE001 - catch SystemExit too (not an Exception)
        logger.exception("run_analysis terminated (BaseException)")
        exc = sys.exc_info()[1]
        _mark_fatal(exc if exc is not None else RuntimeError("unknown error"))
        return 1


if __name__ == "__main__":
    sys.exit(main())

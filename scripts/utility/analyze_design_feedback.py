#!/usr/bin/env python3
"""
Incremental frontend-design feedback for captured WinUI3 screenshots.

Design goals
------------
* Use the most capable local vision model (default ``qwen3.5:9b``) to critique
  each screenshot from a professional frontend-designer perspective.
* The per-run report is additive, but the real accumulation lives in
  ``macro_logs/design_backlog.md`` — a categorized, status-tracked checklist of
  concrete changes that the implementation AI works through across sessions.

SELF-IMPROVEMENT LOOP — capture vs. re-analyze
----------------------------------------------
* CAPTURE (capture_winui3_screenshots.py) is expensive and only meaningful when a
  UI change would VISIBLY differ from the screenshots you already have. Do NOT
  re-run capture merely to get new feedback.
* RE-ANALYZE (this script) is cheap relative to capture and should be run
  repeatedly on the SAME image set. Each run rotates to the NEXT designer persona
  (see PERSONA_ORDER), so successive iterations build broad, multi-perspective
  feedback on the identical screenshots and feed the categorized backlog. Only
  re-capture once an implemented change is visible in the UI.

Personas (rotate across iterations)
-----------------------------------
  general        — overall UX / clarity lead
  accessibility   — WCAG contrast, focus, readability, screen-reader semantics
  design_systems  — cross-screen consistency, tokens, spacing rhythm, component reuse
  data_viz       — information density, hierarchy, lists / charts, scannability
  interaction    — affordances, button hierarchy, empty/loading states, micro-interactions

Usage
-----
    python analyze_design_feedback.py [--shots-dir PATH] [--model qwen3.5:9b]
                                      [--persona next|all|general|accessibility|...]
                                      [--out PATH] [--max-dim 1024]
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
DEFAULT_MODEL = "qwen3.5:9b"
SHOTS_ROOT = Path("macro_logs")
BACKLOG_PATH = SHOTS_ROOT / "design_backlog.md"          # accumulated, status-tracked change list
ROTATION_STATE = SHOTS_ROOT / ".persona_rotation.json"   # persists which persona is "next"
VISION_IMG_MAX = int(__import__("os").environ.get("VISION_IMG_MAX", "1024"))
OLLAMA_TIMEOUT_S = 240
GEN_OPTS: dict[str, Any] = {"temperature": 0.2, "num_ctx": 16384, "num_predict": 1700}

# Order + human-readable context for each captured filename stem.
SHOT_CONTEXT: dict[str, str] = {
    "01_launched": "App initial launch / splash state",
    "01_tab_dashboard": "Dashboard — system storage overview (stat cards, drive bars, quick actions)",
    "02_tab_scan": "Scan page — directory input, depth slider, hidden-files checkbox, scan results",
    "03_tab_history": "History — past scans list",
    "04_tab_smart_search": "Advanced Search — query box, size/type filters",
    "05_tab_workflows": "Automation Workflows — automation presets",
    "06_tab_ai_chat": "AI Assistant — chat with tool-calling agent",
    "07_tab_dedup": "Duplicates — duplicate-file analysis",
    "08_tab_system": "System — resource/process monitor",
    "09_tab_settings": "Settings — preferences page",
    "10_tab_cleanup": "Cleanup — junk/large-file cleanup",
}

# --------------------------------------------------------------------------- #
# Personas — rotate across iterations for broad, multi-perspective feedback
# --------------------------------------------------------------------------- #
BASE_PERSONA = (
    "You are a senior frontend / product designer reviewing screenshots of "
    "'Space Analyzer Pro', a WinUI 3 desktop disk-space analyzer. Critique each "
    "screen with a professional designer's eye: visual hierarchy, spacing & "
    "rhythm, typographic scale, color & contrast, component consistency, "
    "affordances, empty/loading states, alignment, density, and accessibility. "
    "Be specific and concrete, citing what you actually see. Keep it candid but "
    "constructive. Do not invent UI that is not visible.\n\n"
    "GUARDRAILS (follow closely):\n"
    "- These screenshots are captured programmatically (PrintWindow) of a running "
    "WinUI 3 app. Minor text blurriness, font-fallback quirks, or sub-pixel "
    "rendering are CAPTURE ARTIFACTS, not design defects. Do NOT report them as "
    "contrast/typography bugs unless the text is genuinely unreadable in context.\n"
    "- Intentionally subtle UI is deliberate, not a mistake: muted helper text, "
    "low-emphasis captions, empty-state messages styled with an icon, and warning "
    "states framed with a colored border are intentional design choices. Describe "
    "them as such; do NOT call a screen 'broken' or 'bug-like' for showing a "
    "correctly styled empty/warning state.\n"
    "- Only flag contrast as a real accessibility issue if the text is genuinely "
    "hard to read, not merely 'low contrast' by eye. Acknowledge when subtle text "
    "is by design.\n"
    "- Do NOT repeat the same generic cross-screen critique on every screen. Only "
    "raise a recurring theme when it is a NEW occurrence here or its severity has "
    "changed. Vary your analysis; avoid templated phrasing.\n"
    "- Quote the ACTUAL visible text you see (e.g. exactly what a card displays) "
    "instead of assuming values. If a region shows 'Not available' or a specific "
    "message, say so — never invent '0 B' or 'n/a' that isn't on screen.\n"
)

# Each persona narrows the lens. The base guardrails always apply on top.
PERSONA_FOCUS: dict[str, tuple[str, str]] = {
    "general": (
        "General UX Lead",
        "Take a balanced, end-to-end view of clarity and usability. Prioritize the "
        "changes that most improve first-run comprehension and everyday use.",
    ),
    "accessibility": (
        "Accessibility Specialist",
        "Focus on WCAG 2.1 AA: text/background contrast ratios, focus visibility, "
        "readable font sizes, and screen-reader-friendly semantics/labels. Only "
        "file an issue when a real user with low vision or a keyboard-only flow "
        "would be blocked — never for stylistic subtlety.",
    ),
    "design_systems": (
        "Design Systems / Consistency Lead",
        "Focus on cross-screen consistency: shared spacing rhythm, token/color "
        "usage, button and card styles, header patterns, and reusable components. "
        "Flag deviations from the established pattern and propose the canonical fix.",
    ),
    "data_viz": (
        "Information Density & Data-Viz Expert",
        "Focus on information hierarchy and scannability: whether stat cards, "
        "lists, charts, and tables let a user extract meaning at a glance, and "
        "whether density is appropriate for a system-monitoring tool.",
    ),
    "interaction": (
        "Interaction / Affordance Engineer",
        "Focus on affordances and state communication: button hierarchy, hover/"
        "focus/pressed states, empty/loading/error states, and whether each "
        "control's purpose is obvious without trial-and-error.",
    ),
}

# Rotated order used when --persona next (the default).
PERSONA_ORDER: list[str] = ["general", "accessibility", "design_systems", "data_viz", "interaction"]

# Valid categories used to file backlog items (keeps the backlog well-grouped).
CATEGORIES: list[str] = [
    "contrast", "spacing", "empty_state", "consistency",
    "affordance", "typography", "hierarchy", "accessibility", "other",
]

OUTPUT_TEMPLATE = """### {index}. {stem} — {context}

{feedback}

---
"""

logger = logging.getLogger("design_feedback")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def encode_image_for_vision(path: Path, max_dim: int = VISION_IMG_MAX) -> bytes | None:
    try:
        from PIL import Image
        import io

        with Image.open(path) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")
            w, h = img.size
            scale = max_dim / max(w, h)
            if scale < 1.0:
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not encode %s: %s", path, exc)
        return None


def _resolve_shots_dir(shots_root: Path, explicit: str | None) -> Path | None:
    if explicit:
        p = Path(explicit)
        if p.is_dir():
            return p
        return None
    if shots_root.is_dir() and shots_root.name.startswith("screenshots_"):
        return shots_root
    candidates = [d for d in shots_root.iterdir() if d.is_dir() and d.name.startswith("screenshots_")]
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def _ordered_shots(shots_dir: Path) -> list[Path]:
    files = [p for p in shots_dir.glob("*.png") if p.is_file()]
    files.sort(key=lambda p: p.name)
    return files


def _call_vision(client: OllamaClient, model: str, prompt: str, image: bytes) -> str:
    return client.generate(
        model,
        prompt,
        stream=False,
        think=False,
        options=GEN_OPTS,
        images=[image],
    )


def _build_memory_lines(memory: list[str]) -> str:
    if not memory:
        return "(no prior screens analyzed yet)"
    recent = memory[-8:]
    return "\n".join(f"- {m}" for m in recent)


def _build_prompt(stem: str, context: str, memory_block: str, persona_key: str = "general") -> str:
    pname, pfocus = PERSONA_FOCUS.get(persona_key, PERSONA_FOCUS["general"])
    cats = ", ".join(f'"{c}"' for c in CATEGORIES)
    return (
        f"{BASE_PERSONA}\n\n"
        f"YOUR PERSONA FOR THIS PASS: {pname}.\n{pfocus}\n\n"
        f"RUNNING MEMORY (themes from earlier screens in this sequence):\n{memory_block}\n\n"
        f"Current screen: '{stem}' — {context}.\n\n"
        "Analyze THIS screenshot only. Structure your critique as:\n"
        "1) First impressions (what the eye lands on, overall polish)\n"
        "2) Layout & hierarchy\n"
        "3) Typography, color & contrast (note when subtle/muted text is intentional)\n"
        "4) Spacing, alignment & density\n"
        "5) Components & affordances (buttons, inputs, lists, cards, charts)\n"
        "6) Consistency vs earlier screens (use the running memory; only if relevant here)\n"
        "7) Top 3 concrete fixes — for EACH: state the Severity (Critical / Major / "
        "Minor / Nit), quote the exact visible text/element, and give ONE specific, "
        "actionable change. Skip generic restatements of already-fixed or intentional states.\n"
        "8) One line 'Intentional / acceptable as-is:' — list anything on this screen "
        "that is a deliberate, good design choice (e.g. a correctly styled empty or "
        "warning state) so it is not mistaken for a defect.\n"
        "9) At the very end, output a fenced code block tagged `feedback_items` "
        "containing a JSON array (one object per concrete issue you would actually "
        f"file), each: {{\"category\": one of {cats}, \"screen\": \"<stem>\", "
        "\"severity\": \"critical|major|minor|nit\", \"issue\": \"one concise sentence\", "
        "\"fix\": \"one concise actionable sentence\"}}. If nothing is worth filing, "
        "output an empty array [].\n"
    )


def _compress_to_memory(stem: str, feedback: str) -> str:
    """Distill a feedback block into one memory line for cross-screen continuity."""
    lowered = feedback.lower()
    themes = []
    if any(k in lowered for k in ("inconsisten", "mismatch", "different header", "header styl")):
        themes.append("cross-screen inconsistency")
    if any(k in lowered for k in ("empty state", "no data", "placeholder", "loading")):
        themes.append("weak/empty states")
    if any(k in lowered for k in ("contrast", "low contrast", "hard to read", "illegible")):
        themes.append("contrast/readability issue")
    if any(k in lowered for k in ("spacing", "padding", "cramped", "crowded", "density")):
        themes.append("spacing/density")
    if any(k in lowered for k in ("hierarchy", "emphasis", "focal", "attention")):
        themes.append("hierarchy")
    if any(k in lowered for k in ("alignment", "misalign", "ragged")):
        themes.append("alignment")
    if any(k in lowered for k in ("typograph", "font", "size scale", "label")):
        themes.append("typography")
    if not themes:
        themes.append("general polish")
    return f"{stem}: " + ", ".join(themes[:3])


# --------------------------------------------------------------------------- #
# Structured items -> categorized, status-tracked backlog
# --------------------------------------------------------------------------- #
def _normalize_key(text: str) -> str:
    t = text.lower()
    t = re.sub(r"[^a-z0-9 ]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _extract_items(stem: str, persona_key: str, feedback: str) -> list[dict]:
    """Pull the structured ``feedback_items`` JSON block out of a model response.

    Tolerant of the model using either a ```feedback_items or a ```json fence
    (or any fenced block whose content is a JSON array of issue objects).
    """
    items: list[dict] = []
    # 1) fenced blocks (any language tag)
    for raw in re.findall(r"```[a-zA-Z0-9_]*\s*\n(.*?)```", feedback, re.DOTALL):
        raw = raw.strip()
        try:
            data = json.loads(raw)
        except Exception:  # noqa: BLE001
            continue
        if isinstance(data, list):
            items = _coerce_items(data, stem, persona_key)
            if items:
                return items
    # 2) last-resort: a bare top-level JSON array in the text
    m = re.search(r"\[\s*\{.*?\}\s*\]", feedback, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(0))
        except Exception:  # noqa: BLE001
            data = None
        if isinstance(data, list):
            items = _coerce_items(data, stem, persona_key)
    if not items:
        logger.warning("no structured feedback_items array found")
    return items


def _coerce_items(data: list, stem: str, persona_key: str) -> list[dict]:
    out: list[dict] = []
    for obj in data:
        if not isinstance(obj, dict):
            continue
        cat = str(obj.get("category", "other")).lower()
        if cat not in CATEGORIES:
            cat = "other"
        sev = str(obj.get("severity", "nit")).lower()
        if sev not in ("critical", "major", "minor", "nit"):
            sev = "nit"
        issue = str(obj.get("issue", "")).strip()
        issue = re.sub(r"\s+", " ", issue).strip()
        if not issue:
            continue
        out.append({
            "category": cat,
            "screen": str(obj.get("screen") or stem),
            "severity": sev,
            "issue": issue,
            "persona": persona_key,
        })
    return out


def _parse_backlog(path: Path) -> tuple[list[str], dict[str, list[tuple[bool, str]]]]:
    cats: list[str] = []
    items: dict[str, list[tuple[bool, str]]] = {}
    cur: str | None = None
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^##\s+(.+?)\s*$", line)
            if m:
                cur = m.group(1).strip()
                if cur not in items:
                    cats.append(cur)
                    items[cur] = []
                continue
            m = re.match(r"^-\s+\[( |x|X)\]\s+(.*)$", line)
            if m and cur is not None:
                done = m.group(1).lower() == "x"
                items[cur].append((done, m.group(2).strip()))
    return cats, items


def _update_backlog(path: Path, new_items: list[dict]) -> int:
    """Merge new items into the backlog, preserving status, de-duping per
    (issue + persona + screen). Returns the number of newly appended items."""
    cats, items = _parse_backlog(path)
    seen: set[str] = set()
    for cat, lst in items.items():
        for _, line in lst:
            seen.add(_normalize_key(line))
    for it in new_items:
        if it["category"] not in items:
            cats.append(it["category"])
            items[it["category"]] = []
    appended = 0
    for it in new_items:
        line = f"{it['issue']} — {it['screen']} · {it['persona']} · sev:{it['severity']}"
        key = _normalize_key(line)
        if key in seen:
            continue
        items[it["category"]].append((False, line))
        seen.add(key)
        appended += 1
    cats = [c for c in cats if items.get(c)]
    with path.open("w", encoding="utf-8") as f:
        f.write("# Design Feedback Backlog — Space Analyzer Pro\n\n")
        f.write("Status: `[ ]` open, `[x]` done. Accumulated across rotating persona "
                "analyses of captured screenshots; worked through by the implementation AI "
                "and marked complete as changes land in the Rust backend / WinUI 3 frontend.\n")
        f.write("Categories: " + ", ".join(cats) + "\n\n")
        for c in cats:
            f.write(f"## {c}\n")
            for done, line in items[c]:
                mark = "x" if done else " "
                f.write(f"- [{mark}] {line}\n")
            f.write("\n")
    return appended


def _next_persona(order: list[str]) -> str:
    """Return the next persona in rotation, persisting the cursor to disk."""
    state: dict[str, Any] = {}
    if ROTATION_STATE.is_file():
        try:
            state = json.loads(ROTATION_STATE.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            state = {}
    idx = int(state.get("index", 0)) % len(order)
    key = order[idx]
    state["index"] = idx + 1
    ROTATION_STATE.write_text(json.dumps(state), encoding="utf-8")
    return key


# --------------------------------------------------------------------------- #
# Main loop
def run(shots_dir: Path, model: str, persona_keys: list[str], out_dir: Path, max_dim: int) -> int:
    shots = _ordered_shots(shots_dir)
    if not shots:
        logger.error("No PNG screenshots in %s", shots_dir)
        return 1

    client = OllamaClient(timeout=OLLAMA_TIMEOUT_S)
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    shots_ts = shots_dir.name.replace("screenshots_", "")

    total_appended = 0
    for pkey in persona_keys:
        pname, _ = PERSONA_FOCUS[pkey]
        memory: list[str] = []
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        out_path = out_dir / f"design_feedback_{shots_ts}__{pkey}_{run_ts}.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        new_items: list[dict] = []
        with out_path.open("w", encoding="utf-8") as rf:
            rf.write(f"# Frontend Design Feedback — Space Analyzer Pro\n\n")
            rf.write(f"- Generated: {ts}\n")
            rf.write(f"- Persona: `{pname}` (`{pkey}`)\n")
            rf.write(f"- Vision model: `{model}`\n")
            rf.write(f"- Screens analyzed: {len(shots)}\n")
            rf.write(f"- Source: `{shots_dir}`\n\n")
            rf.write("---\n\n")
            for i, path in enumerate(shots, start=1):
                stem = path.stem
                context = SHOT_CONTEXT.get(stem, stem)
                img = encode_image_for_vision(path, max_dim=max_dim)
                if img is None:
                    logger.error("skipping %s (encode failed)", stem)
                    continue
                prompt = _build_prompt(stem, context, _build_memory_lines(memory), pkey)
                logger.info("[%s %d/%d] analyzing %s ...", pkey, i, len(shots), stem)
                try:
                    feedback = _call_vision(client, model, prompt, img).strip()
                except Exception as exc:  # noqa: BLE001
                    logger.error("vision call failed for %s: %s", stem, exc)
                    feedback = f"_Vision analysis failed: {exc}_"
                rf.write(OUTPUT_TEMPLATE.format(index=i, stem=stem, context=context, feedback=feedback))
                rf.flush()
                memory.append(_compress_to_memory(stem, feedback))
                new_items.extend(_extract_items(stem, pkey, feedback))
                time.sleep(0.5)
            rf.write("## Cross-cutting themes (rolling memory)\n\n")
            for m in memory:
                rf.write(f"- {m}\n")
            rf.write("\n")
        appended = _update_backlog(BACKLOG_PATH, new_items)
        total_appended += appended
        logger.info("Report: %s | backlog +%d new items", out_path, appended)
        print(f"Report: {out_path} (+{appended} backlog items)")

    print(f"Backlog: {BACKLOG_PATH} (total new this run: {total_appended})")
    return 0


def _resolve_personas(arg: str) -> list[str] | None:
    if arg == "all":
        # reset rotation so the next 'next' starts at the first persona again
        ROTATION_STATE.write_text(json.dumps({"index": 0}), encoding="utf-8")
        return list(PERSONA_ORDER)
    if arg == "next":
        return [_next_persona(PERSONA_ORDER)]
    if arg in PERSONA_FOCUS:
        return [arg]
    return None


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Incremental frontend-design feedback for screenshots")
    p.add_argument("--shots-dir", default=None, help="Direct path to a screenshots_* directory")
    p.add_argument("--shots-root", default=str(SHOTS_ROOT), help="Root containing screenshots_* dirs")
    p.add_argument("--model", default=DEFAULT_MODEL, help="Vision model to use")
    p.add_argument("--persona", default="next",
                   help="Persona to use: 'next' (rotate), 'all', or one of: "
                        + ", ".join(PERSONA_ORDER))
    p.add_argument("--out", default=None, help="Output directory for per-persona reports (default: macro_logs)")
    p.add_argument("--max-dim", type=int, default=VISION_IMG_MAX, help="Max image dimension for vision payload")
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    shots_dir = _resolve_shots_dir(Path(args.shots_root), args.shots_dir)
    if shots_dir is None:
        logger.error("Could not resolve a screenshots directory")
        return 1

    persona_keys = _resolve_personas(args.persona)
    if persona_keys is None:
        logger.error("Unknown persona '%s'. Choices: next, all, %s",
                     args.persona, ", ".join(PERSONA_ORDER))
        return 1

    out_dir = Path(args.out) if args.out else shots_dir.parent
    return run(shots_dir, args.model, persona_keys, out_dir, args.max_dim)


if __name__ == "__main__":
    sys.exit(main())

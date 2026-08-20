#!/usr/bin/env python3
"""
Incremental, multi-perspective frontend-design feedback for captured WinUI 3
screenshots, driven by a local VISION model (default ``gemma4:e2b-it-qat``) with
supplementary input from local TEXT/CODING models.

WHY THIS SHAPE (fast + broad)
-----------------------------
gemma4:e2b is the only reliable *vision* model in this environment; small vision
models consistently miss what a different prompt "lens" would catch. But re-running
the vision model once per persona is the slow part (5 vision passes x N screens).

This script collapses the vision work to ONE comprehensive pass per screen (gemma
reviews all five specialist lenses in a single call and tags each finding with the
lens it came from), then feeds that extracted TEXT to one or more TEXT/CODING models
(qwen3.5:9b, deepseek-r1:7b, llama3.2:3b, ...) which are fast and need no image
decode. The coding models supplement gemma's visual findings with an
engineering/implementation perspective (XAML structure, accessibility implementation,
cross-screen systemic patterns). Because the coding passes are text-only and run in
a bounded parallel pool, total wall-clock is roughly N vision calls + a few text
calls instead of 5N vision calls.

Two modes (``--mode``)
----------------------
  fast      (DEFAULT) — 1 gemma vision pass per screen (all lenses) + ONE aggregate
                        coding pass over all observations. ~N+1 model calls.
  thorough  — 1 gemma vision pass per screen + a PER-SCREEN coding pass (parallel
              pool) + the aggregate pass. Deeper, slower.

Coding models (``--coding-model``, ``--no-coding``)
---------------------------------------------------
  A text/code model (default ``qwen3.5:9b``) supplements gemma. Pass another model
  with ``--coding-model deepseek-r1:7b`` for stronger reasoning, or ``--no-coding``
  to run vision-only (fastest).

Outputs
-------
  * ``design_feedback_<set>__gemma_<ts>.md`` — gemma's multi-lens vision critique.
  * ``design_feedback_<set>__code_<ts>.md`` — coding-model supplement.
  * ``macro_logs/design_backlog.md`` — categorized, status-tracked, de-duplicated
    change list that accumulates across runs (``[x]`` = done). A ``consensus:N``
    count rises when more than one lens / model flags the same issue.
  * ``macro_logs/design_consensus_<set>_<ts>.md`` — severity x consensus priority list.
  * ``macro_logs/design_synthesis_<set>_<ts>.md`` — optional LLM merge (``--synthesize``).

Usage
-----
    python analyze_design_feedback.py [--shots-dir PATH] [--vision-model gemma4:e2b-it-qat]
                                       [--coding-model qwen3.5:9b] [--no-coding]
                                       [--mode fast|thorough]
                                       [--persona all|general|accessibility|...]
                                       [--consens/--no-consensus] [--synthesize]
                                       [--out PATH] [--max-dim 1024] [--list-personas]
"""

import argparse
import concurrent.futures
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from _ollama_client import OllamaClient
from _common import encode_image_for_vision

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
VISION_MODEL = os.environ.get("VISION_MODEL", "gemma4:e2b-it-qat")
CODING_MODEL = os.environ.get("CODING_MODEL", "qwen3.5:9b")
SHOTS_ROOT = Path("macro_logs")
BACKLOG_PATH = SHOTS_ROOT / "design_backlog.md"          # accumulated, status-tracked change list
VISION_IMG_MAX = int(os.environ.get("VISION_IMG_MAX", "1024"))
OLLAMA_TIMEOUT_S = 240

# Vision pass: one comprehensive multi-lens call per screen.
# num_ctx is intentionally modest (8k): images are downscaled (~1k tokens) and the
# output is capped at num_predict, so a 16k context only wastes VRAM. Keeping the
# vision context small is what lets the coding model load without both being
# resident at once.
VISION_OPTS: dict[str, Any] = {"temperature": 0.3, "num_ctx": 8192, "num_predict": 1600}
# Coding/text pass: fast, no image, smaller context. Budget is generous enough to
# emit the full JSON array without truncation (a cut-off array fails to parse).
CODING_OPTS: dict[str, Any] = {"temperature": 0.2, "num_ctx": 8192, "num_predict": 2600}
# Synthesis (text-only LLM merge of the consensus list) — its own modest budget.
SYNTH_OPTS: dict[str, Any] = {"temperature": 0.3, "num_ctx": 8192, "num_predict": 2200}
# Structured-output schema for coding models: forces a VALID JSON ARRAY of issue
# objects (no unescaped-quote breakage, no single-object surprises).
CODING_SCHEMA: dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "lens": {"type": "string"},
            "category": {"type": "string"},
            "screen": {"type": "string"},
            "severity": {"type": "string"},
            "issue": {"type": "string"},
            "fix": {"type": "string"},
        },
        "required": ["issue", "severity", "category", "screen"],
    },
}
# How many coding-model calls run concurrently (bounded to avoid VRAM thrash).
CODING_CONCURRENCY = int(os.environ.get("CODING_CONCURRENCY", "2"))

# VRAM management: only ever keep ONE model resident.
#  - Vision stage: keep the vision model resident across all N screens (a positive
#    keep_alive avoids reloading it between images, which would add ~30s each).
#  - After vision we EXPLICITLY evict it (keep_alive=0) before the coding stage
#    loads, so the vision model and the coding model never share VRAM.
#  - Coding stage + synthesis: evict immediately (keep_alive=0) when done.
VISION_KEEP_ALIVE = "10m"   # resident for the whole vision loop (loop is <10m)
EVICT = 0                   # unload from VRAM right after the call

# Severity ranking for consensus sorting (lower = more urgent).
_SEV_RANK = {"critical": 0, "major": 1, "minor": 2, "nit": 3}

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
# Lenses — the specialist angles. gemma reviews them ALL in one vision pass and
# tags each finding with the lens it came from; coding models then add a "code" lens.
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

LENS_FOCUS: dict[str, str] = {
    "general": "overall UX, clarity, first-run comprehension and everyday usability",
    "accessibility": "WCAG 2.1 AA: text/background contrast, focus visibility, readable "
                     "font sizes, and screen-reader-friendly semantics/labels",
    "design_systems": "cross-screen consistency: shared spacing rhythm, token/color usage, "
                      "button and card styles, header patterns, reusable components",
    "data_viz": "information hierarchy and scannability: stat cards, lists, charts, tables "
                "let a user extract meaning at a glance; density appropriate for a "
                "system-monitoring tool",
    "interaction": "affordances and state communication: button hierarchy, hover/focus/pressed "
                   "states, empty/loading/error states, each control's purpose obvious",
}
LENS_ORDER: list[str] = ["general", "accessibility", "design_systems", "data_viz", "interaction"]

# Valid categories used to file backlog items (keeps the backlog well-grouped).
CATEGORIES: list[str] = [
    "contrast", "spacing", "empty_state", "consistency",
    "affordance", "typography", "hierarchy", "accessibility", "other",
]
CODE_LENS = "code"  # tag applied to every coding-model finding

logger = logging.getLogger("design_feedback")


# A capture directory is either a legacy ``screenshots_*`` folder or a thematic
# ``YYYY-MM-DD__<origin>__<representation>`` bucket.
_CAPTURE_DIR_RE = re.compile(r"^(screenshots_|\d{4}-\d{2}-\d{2}__.+__.+$)")

_PERSONA_PROMPT_INTRO = (
    "After your critique, at the very end output a fenced code block tagged "
    "`feedback_items` containing a JSON array (one object per concrete issue you "
    "would actually file), each: {\"lens\": one of %lenses, \"category\": one of %cats, "
    "\"screen\": \"<stem>\", \"severity\": \"critical|major|minor|nit\", "
    "\"issue\": \"one concise sentence\", \"fix\": \"one concise actionable sentence\"}. "
    "If nothing is worth filing, output an empty array []."
)


# --------------------------------------------------------------------------- #
# Path / shot resolution
# --------------------------------------------------------------------------- #
def _resolve_shots_dir(shots_root: Path, explicit: str | None) -> Path | None:
    if explicit:
        p = Path(explicit)
        if p.is_dir():
            return p
        return None
    if not shots_root.is_dir():
        return None
    if _CAPTURE_DIR_RE.match(shots_root.name):
        return shots_root
    candidates = [d for d in shots_root.iterdir() if d.is_dir() and _CAPTURE_DIR_RE.match(d.name)]
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


# Filenames that are placeholders / harness noise rather than real app screens
# (e.g. `test-screenshot.png` dropped during development). Analyzing them only
# pollutes the backlog with "impossible to assess" items.
_NOISE_STEM_RE = re.compile(r"^(test|sample|placeholder|tmp|temp|example|demo)\b", re.I)


def _ordered_shots(shots_dir: Path) -> list[Path]:
    files = [p for p in shots_dir.glob("*.png") if p.is_file()]
    files = [p for p in files if not _NOISE_STEM_RE.match(p.stem)]
    files.sort(key=lambda p: p.name)
    return files


# --------------------------------------------------------------------------- #
# Model calls (vision OR text-only, with one short-prompt retry on empty/garbage)
# --------------------------------------------------------------------------- #
def _call_llm(client: OllamaClient, model: str, prompt: str, image: bytes | None = None,
               options: dict[str, Any] | None = None, fmt: str | None = None,
               keep_alive: "float | str | None" = None) -> str:
    kwargs: dict[str, Any] = {"stream": False, "think": False, "options": options or {}}
    if image is not None:
        kwargs["images"] = [image]
    if fmt is not None:
        kwargs["format"] = fmt
    if keep_alive is not None:
        kwargs["keep_alive"] = keep_alive
    return client.generate(model, prompt, **kwargs) or ""


def _call_llm_with_retry(client: OllamaClient, model: str, prompt: str,
                         image: bytes | None = None,
                         options: dict[str, Any] | None = None,
                         fmt: str | None = None,
                         keep_alive: "float | str | None" = None) -> str:
    text = _call_llm(client, model, prompt, image=image, options=options, fmt=fmt,
                     keep_alive=keep_alive).strip()
    if len(text) < 5:
        logger.warning("empty/short response from %s — retrying once with a nudge", model)
        text = _call_llm(
            client, model, prompt + "\n\n(Respond with a concrete, detailed analysis now.)",
            image=image, options=options, fmt=fmt, keep_alive=keep_alive,
        ).strip()
    return text


def _unload(client: OllamaClient, model: str) -> None:
    """Evict ``model`` from VRAM immediately (keep_alive=0).

    If the model is already resident this is a near-instant metadata update; if it
    is not resident it is a no-op (a tiny throwaway generate). Keeps only one model
    in VRAM at a time. Failures are logged but non-fatal.
    """
    try:
        client.generate(model, " ", stream=False, think=False, keep_alive=0)
        logger.info("evicted %s from VRAM", model)
    except Exception as exc:  # noqa: BLE001
        logger.debug("unload %s failed (likely already unloaded): %s", model, exc)


def _log_vram(client: OllamaClient, label: str) -> None:
    """Log which models are resident and how much VRAM they hold."""
    try:
        data = client.ps() or {}
        models = data.get("models", [])
        if not models:
            logger.info("[vram] %s: (no models resident)", label)
            return
        parts = []
        for m in models:
            size = m.get("size_vram") or m.get("size") or 0
            gb = size / (1024 ** 3) if isinstance(size, (int, float)) else 0
            parts.append(f"{m.get('name')}={gb:.1f}GB")
        logger.info("[vram] %s: %s", label, ", ".join(parts) if parts else "(unknown)")
    except Exception as exc:  # noqa: BLE001
        logger.debug("vram probe failed: %s", exc)


# --------------------------------------------------------------------------- #
# Prompt construction
# --------------------------------------------------------------------------- #
def _build_memory_lines(memory: list[str]) -> str:
    if not memory:
        return "(no prior screens analyzed yet)"
    recent = memory[-8:]
    return "\n".join(f"- {m}" for m in recent)


def _vision_prompt(stem: str, context: str, memory_block: str, lenses: list[str]) -> str:
    cats = ", ".join(f'"{c}"' for c in CATEGORIES)
    lens_list = "\n".join(f"- {k} ({LENS_FOCUS[k]})" for k in lenses)
    lens_enum = "[" + ", ".join(f'"{k}"' for k in lenses + ["multi"]) + "]"
    intro = _PERSONA_PROMPT_INTRO.replace("%lenses", lens_enum).replace("%cats", cats)
    return (
        f"{BASE_PERSONA}\n\n"
        f"REVIEW BRIEF: This is screen '{stem}' — {context}.\n\n"
        "MULTI-LENS PASS: Review this single screen from ALL of the following "
        f"specialist lenses in ONE pass:\n{lens_list}\n\n"
        "RUNNING MEMORY (themes from earlier screens):\n"
        f"{memory_block}\n\n"
        "Produce:\n"
        "1) A short free-form critique (4-8 sentences) covering the strongest points "
        "from each lens above.\n"
        "2) At the very end, " + intro + "\n"
        "If a finding spans several lenses, use lens \"multi\".\n"
    )


def _coding_aggregate_prompt(observations: list[tuple[str, str]]) -> str:
    cats = ", ".join(f'"{c}"' for c in CATEGORIES)
    obs_block = "\n\n".join(f"### {stem}\n{text}" for stem, text in observations)
    return (
        "You are a senior software/UX engineer reviewing 'Space Analyzer Pro' (a WinUI 3 "
        "disk-space analyzer). You CANNOT see the screenshots; the text below is a vision "
        "model's structured observation of each screen. SUPPLEMENT those findings with an "
        "engineering / implementation lens:\n"
        "- XAML/control structure and how to achieve the desired layout with WinUI 3 primitives\n"
        "- Accessibility IMPLEMENTATION (AutomationProperties.Name, keyboard navigation, "
        "contrast-token usage) rather than just the visual symptom\n"
        "- Data-binding / virtualization / scannability concerns for a tool that lists many items\n"
        "- Cross-screen systemic patterns (the same mistake repeated, a missing shared component)\n\n"
        "Only file issues that ADD value beyond the vision observations (do not merely echo "
        "them). Pick the 8 MOST IMPORTANT issues at most; keep each issue and fix to ONE "
        "concise sentence. Respond with ONE JSON array (no markdown fences, no prose), each "
        f"element: {{\"lens\": \"code\", \"category\": one of {cats}, \"screen\": \"<stem as "
        "given>\", \"severity\": \"critical|major|minor|nit\", \"issue\": \"...\", \"fix\": "
        "\"...\"}}. If none, output [].\n\n"
        "VISION OBSERVATIONS:\n"
        f"{obs_block}\n"
    )


def _coding_image_prompt(stem: str, context: str, vision_text: str) -> str:
    cats = ", ".join(f'"{c}"' for c in CATEGORIES)
    return (
        "You are a senior software/UX engineer reviewing 'Space Analyzer Pro' (a WinUI 3 "
        "disk-space analyzer). You CANNOT see the screenshot; the text below is a vision "
        "model's observation of ONE screen. SUPPLEMENT it with an engineering / "
        "implementation lens (XAML structure, accessibility implementation, data-binding / "
        "scannability, cross-screen systemic patterns). Only file issues that ADD value.\n\n"
        f"SCREEN: '{stem}' — {context}.\n\n"
        "VISION OBSERVATION:\n"
        f"{vision_text}\n\n"
        "Pick the 5 MOST IMPORTANT issues at most; keep each issue and fix to ONE concise "
        "sentence. Respond with ONE JSON array (no markdown fences, no prose), each element: "
        f"{{\"lens\": \"code\", \"category\": one of {cats}, \"screen\": \"{stem}\", "
        "\"severity\": \"critical|major|minor|nit\", \"issue\": \"...\", \"fix\": \"...\"}}. "
        "If none, output [].\n"
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
# Structured items -> categorized, status-tracked, consensus-aware backlog
# --------------------------------------------------------------------------- #
def _normalize_key(text: str) -> str:
    t = text.lower()
    t = re.sub(r"[^a-z0-9 ]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _item_key(issue: str, screen: str, severity: str) -> str:
    """Identity for de-duplication — independent of which lens/model filed it."""
    return _normalize_key(f"{issue}|{screen}|{severity}")


def _extract_items(stem: str, text: str, default_lens: str) -> list[dict]:
    """Pull a JSON array of issue objects out of a model response.

    Tolerant of several shapes: bare JSON (when the model was called with
    ``format: "json"``), a fenced ```feedback_items / ```json block, or a
    bracketed array embedded in prose.
    """
    candidates: list[str] = []

    stripped = text.strip()
    if stripped[:1] in ("[", "{"):
        candidates.append(stripped)

    for raw in re.findall(r"```[a-zA-Z0-9_]*\s*\n(.*?)```", text, re.DOTALL):
        candidates.append(raw.strip())

    # Slice from the first '[' to the last ']' to rescue arrays embedded in prose
    # (handles models that wrap valid JSON in stray commentary).
    first, last = text.find("["), text.rfind("]")
    if first != -1 and last > first:
        candidates.append(text[first:last + 1])

    for cand in candidates:
        try:
            data = json.loads(cand)
        except Exception:  # noqa: BLE001
            continue
        if isinstance(data, list) and data:
            items = _coerce_items(data, stem, default_lens)
            if items:
                return items
        if isinstance(data, dict):
            # Tolerate a model that emits a single object instead of an array.
            if "issue" in data:
                items = _coerce_items([data], stem, default_lens)
                if items:
                    return items
            # Or an object that wraps the array under some key.
            for v in data.values():
                if isinstance(v, list) and v:
                    items = _coerce_items(v, stem, default_lens)
                    if items:
                        return items
    if not candidates:
        logger.warning("no structured JSON array found for %s", stem)
    return []


def _coerce_items(data: list, stem: str, default_lens: str) -> list[dict]:
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
        lens = str(obj.get("lens", default_lens)).lower()
        if lens not in LENS_ORDER + [CODE_LENS, "multi"]:
            lens = default_lens
        fix = str(obj.get("fix", "")).strip()
        fix = re.sub(r"\s+", " ", fix).strip()
        out.append({
            "category": cat,
            "screen": str(obj.get("screen") or stem),
            "severity": sev,
            "issue": issue,
            "fix": fix,
            "lens": lens,
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


def _parse_backlog_line(line: str) -> dict[str, Any] | None:
    """Parse a backlog line (new or legacy format) into structured fields."""
    raw = line.strip()
    if not raw:
        return None
    consensus = 1
    if " · consensus:" in raw:
        raw, cnum = raw.rsplit(" · consensus:", 1)
        try:
            consensus = int(cnum.strip())
        except Exception:  # noqa: BLE001
            consensus = 1
    sev = "nit"
    if " · sev:" in raw:
        raw, sev = raw.rsplit(" · sev:", 1)
        sev = sev.strip().lower()
    persons: list[str] = []
    if " · [" in raw:
        raw, pinner = raw.rsplit(" · [", 1)
        pinner = pinner.rstrip("]")
        persons = [p.strip() for p in pinner.split(",") if p.strip()]
    elif " · " in raw:
        raw, last = raw.rsplit(" · ", 1)
        persons = [last.strip()]
    if " — " in raw:
        issue, screen = raw.rsplit(" — ", 1)
    else:
        issue, screen = raw, ""
    return {
        "issue": issue.strip(),
        "screen": screen.strip(),
        "persons": persons or ["unknown"],
        "severity": sev,
        "consensus": consensus,
    }


def _update_backlog(path: Path, new_items: list[dict]) -> int:
    """Merge new items into the backlog, preserving status, de-duping per
    (issue + screen + severity), and accumulating a persona CONSENSUS count.

    Returns the number of newly appended items.
    """
    cats, items = _parse_backlog(path)
    work: dict[str, list[dict]] = {}
    seen: set[str] = set()
    for cat in cats:
        work[cat] = []
        for done, line in items[cat]:
            p = _parse_backlog_line(line)
            if not p:
                continue
            key = _item_key(p["issue"], p["screen"], p["severity"])
            work[cat].append({
                "issue": p["issue"], "screen": p["screen"],
                "persons": set(p["persons"]), "severity": p["severity"],
                "consensus": max(1, int(p.get("consensus", 1))), "done": done, "key": key,
            })
            seen.add(key)
    for it in new_items:
        if it["category"] not in work:
            work[it["category"]] = []

    appended = 0
    for it in new_items:
        key = _item_key(it["issue"], it["screen"], it["severity"])
        if key in seen:
            for rec in work[it["category"]]:
                if rec["key"] == key:
                    rec["persons"].add(it["lens"])
                    rec["consensus"] = len(rec["persons"])
            continue
        work[it["category"]].append({
            "issue": it["issue"], "screen": it["screen"],
            "persons": {it["lens"]}, "severity": it["severity"],
            "consensus": 1, "done": False, "key": key,
        })
        seen.add(key)
        appended += 1

    cats_order = [c for c in cats if c in work] + [c for c in work if c not in cats]
    cats_order = [c for c in cats_order if work.get(c)]
    with path.open("w", encoding="utf-8") as f:
        f.write("# Design Feedback Backlog — Space Analyzer Pro\n\n")
        f.write("Status: `[ ]` open, `[x]` done. Accumulated across vision + coding-model "
                "analyses of captured screenshots; worked through by the implementation AI "
                "and marked complete as changes land in the Rust backend / WinUI 3 frontend.\n")
        f.write("`consensus:N` = N distinct lens/model perspectives flagged the same issue "
                "(higher = more confident it is a real problem).\n")
        f.write("Categories: " + ", ".join(cats_order) + "\n\n")
        for c in cats_order:
            f.write(f"## {c}\n")
            recs = sorted(
                work[c],
                key=lambda r: (_SEV_RANK.get(r["severity"], 9), -r["consensus"], r["issue"]),
            )
            for rec in recs:
                mark = "x" if rec["done"] else " "
                persons = ",".join(sorted(rec["persons"]))
                f.write(f"- [{mark}] {rec['issue']} — {rec['screen']} · [{persons}] · "
                        f"sev:{rec['severity']} · consensus:{rec['consensus']}\n")
            f.write("\n")
    return appended


def _write_consensus_report(backlog_path: Path, out_path: Path, screens: set[str] | None) -> int:
    """Write a severity × consensus ranked priority report for the current set.

    Returns the number of high-priority items (critical/major) emitted.
    """
    if not backlog_path.is_file():
        return 0
    cats, items = _parse_backlog(backlog_path)
    recs: list[dict] = []
    for cat in cats:
        for done, line in items[cat]:
            p = _parse_backlog_line(line)
            if not p or done:
                continue
            if screens is not None and p["screen"] not in screens:
                continue
            recs.append({**p, "category": cat})
    recs.sort(key=lambda r: (_SEV_RANK.get(r["severity"], 9), -int(r.get("consensus", 1)),
                             r["category"], r["issue"]))
    by_sev: dict[str, list[dict]] = {}
    for r in recs:
        by_sev.setdefault(r["severity"], []).append(r)
    high = sum(len(v) for k, v in by_sev.items() if k in ("critical", "major"))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        f.write("# Design Feedback — Consensus Priority (this set)\n\n")
        f.write(f"- Items (open, this set): {len(recs)}\n")
        f.write(f"- High priority (critical/major): {high}\n")
        f.write("- Ranking: severity first, then persona consensus (more lenses = more confident).\n\n")
        for sev in ("critical", "major", "minor", "nit"):
            grp = by_sev.get(sev)
            if not grp:
                continue
            f.write(f"## {sev.capitalize()} ({len(grp)})\n\n")
            for r in grp:
                cons = int(r.get("consensus", 1))
                cons_tag = f"consensus:{cons}" + (" ⚠" if cons >= 2 else "")
                f.write(f"- [{r['category']}] {r['issue']} — {r['screen']} "
                        f"· [{','.join(sorted(r['persons']))}] · {cons_tag}\n")
            f.write("\n")
    return high


def _synthesize(client: OllamaClient, model: str, consensus_text: str, out_path: Path) -> bool:
    """Optional LLM merge: turn the consensus list into a ranked master plan."""
    prompt = (
        "You are the lead reviewer for 'Space Analyzer Pro' (a WinUI 3 disk-space "
        "analyzer). The following is a severity-ranked, multi-lens consensus list "
        "of open UI issues derived from screenshots. Produce a MASTER IMPLEMENTATION "
        "PLAN for the implementation AI:\n"
        "- Collapse near-duplicate items into one entry.\n"
        "- Rank the top 10 by user impact (not just severity).\n"
        "- For each, give: the exact screen, the one-sentence fix, and the WinUI 3 "
        "control/attribute/XAML change (e.g. 'replace hardcoded #1F1F1F with "
        "CardBackgroundFillColorDefaultBrush').\n"
        "- End with a one-line 'Do NOT change:' list of intentional designs mistakenly "
        "flagged.\n\n"
        f"CONSENSUS LIST:\n{consensus_text}\n"
    )
    try:
        text = _call_llm(client, model, prompt, options=VISION_OPTS)
    except Exception as exc:  # noqa: BLE001
        logger.error("synthesis failed: %s", exc)
        return False
    text = (text or "").strip()
    if len(text) < 10:
        return False
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("# Design Feedback — Synthesis (master plan)\n\n" + text + "\n", encoding="utf-8")
    return True


# --------------------------------------------------------------------------- #
# Main pipeline
# --------------------------------------------------------------------------- #
def run(shots_dir: Path, vision_model: str, coding_model: str | None, mode: str,
        lenses: list[str], out_dir: Path, max_dim: int,
        consensus: bool, synthesize: bool) -> int:
    shots = _ordered_shots(shots_dir)
    if not shots:
        logger.error("No PNG screenshots in %s", shots_dir)
        return 1

    client = OllamaClient(timeout=OLLAMA_TIMEOUT_S)
    _log_vram(client, "start")
    run_ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    shots_ts = shots_dir.name.replace("screenshots_", "")
    screens = {p.stem for p in shots}
    start = time.time()

    gemma_path = out_dir / f"design_feedback_{shots_ts}__gemma_{run_ts}.md"
    out_dir.mkdir(parents=True, exist_ok=True)
    gemma_path.parent.mkdir(parents=True, exist_ok=True)

    gemma_items: list[dict] = []
    observations: list[tuple[str, str]] = []  # (stem, gemma feedback text) for coding stage
    memory: list[str] = []

    # ---- Phase 1: ONE multi-lens vision pass per screen (the only vision work) ----
    with gemma_path.open("w", encoding="utf-8") as rf:
        rf.write("# Frontend Design Feedback (vision) — Space Analyzer Pro\n\n")
        rf.write(f"- Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}\n")
        rf.write(f"- Vision model: `{vision_model}` (all lenses in one pass)\n")
        rf.write(f"- Screens analyzed: {len(shots)}\n")
        rf.write(f"- Source: `{shots_dir}`\n\n---\n\n")
        default_lens = lenses[0] if len(lenses) == 1 else "general"
        for i, path in enumerate(shots, start=1):
            stem = path.stem
            context = SHOT_CONTEXT.get(stem, stem)
            img = encode_image_for_vision(path, max_dim=max_dim)
            if img is None:
                logger.error("skipping %s (encode failed)", stem)
                continue
            prompt = _vision_prompt(stem, context, _build_memory_lines(memory), lenses)
            logger.info("[vision %d/%d] %s", i, len(shots), stem)
            try:
                feedback = _call_llm_with_retry(client, vision_model, prompt, image=img,
                                                options=VISION_OPTS,
                                                keep_alive=VISION_KEEP_ALIVE).strip()
            except Exception as exc:  # noqa: BLE001
                logger.error("vision call failed for %s: %s", stem, exc)
                feedback = f"_Vision analysis failed: {exc}_"
            rf.write(f"### {i}. {stem} — {context}\n\n{feedback}\n\n---\n\n")
            rf.flush()
            memory.append(_compress_to_memory(stem, feedback))
            observations.append((stem, feedback))
            for it in _extract_items(stem, feedback, default_lens):
                it["lens"] = it.get("lens") or default_lens
                gemma_items.append(it)
            time.sleep(0.3)

    # Free the vision model's VRAM before loading the (separate) coding model, so the
    # two never share memory — this is the single biggest VRAM win in the pipeline.
    if coding_model:
        _unload(client, vision_model)
        _log_vram(client, "after vision / pre-coding")

    # ---- Phase 2: coding-model supplementation (text-only, parallel) ----
    coding_items: list[dict] = []
    code_path = out_dir / f"design_feedback_{shots_ts}__code_{run_ts}.md"
    if coding_model:
        with code_path.open("w", encoding="utf-8") as cf:
            cf.write("# Frontend Design Feedback (coding supplement) — Space Analyzer Pro\n\n")
            cf.write(f"- Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}\n")
            cf.write(f"- Coding model: `{coding_model}` (text-only, fed vision observations)\n")
            cf.write(f"- Mode: `{mode}`\n\n---\n\n")

            def _one_image(stem: str, context: str, vision_text: str) -> list[dict]:
                prompt = _coding_image_prompt(stem, context, vision_text)
                try:
                    resp = _call_llm_with_retry(client, coding_model, prompt,
                                                options=CODING_OPTS, fmt=CODING_SCHEMA,
                                                keep_alive=EVICT)
                except Exception as exc:  # noqa: BLE001
                    logger.error("coding call failed for %s: %s", stem, exc)
                    return []
                return _extract_items(stem, resp, CODE_LENS)

            if mode == "thorough":
                tasks = [(s, SHOT_CONTEXT.get(s, s), t) for s, t in observations]
                with concurrent.futures.ThreadPoolExecutor(max_workers=CODING_CONCURRENCY) as ex:
                    futures = {ex.submit(_one_image, s, c, t): s for s, c, t in tasks}
                    for fut in concurrent.futures.as_completed(futures):
                        stem = futures[fut]
                        try:
                            items = fut.result()
                        except Exception as exc:  # noqa: BLE001
                            logger.error("coding task failed for %s: %s", stem, exc)
                            items = []
                        for it in items:
                            it["lens"] = CODE_LENS
                            coding_items.append(it)
                        cf.write(f"### {stem}\n\n" + ("\n".join(
                            f"- [{it['severity']}] {it['issue']} — {it['fix']}" for it in items)
                            if items else "_no additional findings_") + "\n\n---\n\n")
                        cf.flush()
            # Aggregate pass always runs (cheap, catches cross-screen patterns).
            agg_prompt = _coding_aggregate_prompt(observations)
            logger.info("[coding] aggregate pass (%s)", coding_model)
            try:
                agg_resp = _call_llm_with_retry(client, coding_model, agg_prompt,
                                                options=CODING_OPTS, fmt=CODING_SCHEMA,
                                                keep_alive=EVICT)
            except Exception as exc:  # noqa: BLE001
                logger.error("coding aggregate failed: %s", exc)
                agg_resp = ""
            agg_items = _extract_items("<aggregate>", agg_resp, CODE_LENS)
            for it in agg_items:
                it["lens"] = CODE_LENS
                it["screen"] = it.get("screen") or "<aggregate>"
                coding_items.append(it)
            cf.write("### Cross-screen (aggregate)\n\n" + ("\n".join(
                f"- [{it['severity']}] {it['issue']} — {it['fix']}" for it in agg_items)
                if agg_items else "_no systemic findings_") + "\n\n---\n\n")
            cf.flush()
        logger.info("Coding supplement: %d items", len(coding_items))
    else:
        logger.info("Coding model disabled (--no-coding); vision-only run")

    # ---- Phase 3: merge into backlog + consensus ----
    # Keep the backlog next to the generated reports so everything for a run lives
    # in one place regardless of the current working directory.
    backlog_path = out_dir / "design_backlog.md"
    all_items = gemma_items + coding_items
    appended = _update_backlog(backlog_path, all_items)
    logger.info("Backlog +%d new items (vision=%d, code=%d)", appended,
                len(gemma_items), len(coding_items))
    print(f"Vision report: {gemma_path} ({len(gemma_items)} items)")
    if coding_model:
        print(f"Coding report: {code_path} ({len(coding_items)} items)")
    print(f"Backlog: {backlog_path} (+{appended} new)")

    if consensus:
        cpath = out_dir / f"design_consensus_{shots_ts}_{run_ts}.md"
        high = _write_consensus_report(backlog_path, cpath, screens)
        print(f"Consensus: {cpath} ({high} high-priority items this set)")
        if synthesize:
            spath = out_dir / f"design_synthesis_{shots_ts}_{run_ts}.md"
            if _synthesize(client, vision_model, cpath.read_text(encoding="utf-8"), spath):
                print(f"Synthesis: {spath}")

    elapsed = time.time() - start
    logger.info("Done in %.1fs (%.1fs/screen vision)", elapsed, elapsed / max(1, len(shots)))
    print(f"Elapsed: {elapsed:.1f}s")
    return 0


def _resolve_lenses(arg: str) -> list[str] | None:
    if arg == "all":
        return list(LENS_ORDER)
    if arg in LENS_ORDER:
        return [arg]
    return None


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Multi-perspective frontend-design feedback for screenshots")
    p.add_argument("--shots-dir", default=None, help="Direct path to a screenshots_* directory")
    p.add_argument("--shots-root", default=str(SHOTS_ROOT), help="Root containing screenshots_* dirs")
    p.add_argument("--vision-model", default=VISION_MODEL, help="Vision model to use")
    p.add_argument("--coding-model", default=CODING_MODEL,
                   help="Text/code model that supplements the vision findings (text-only)")
    p.add_argument("--no-coding", action="store_true", help="Skip the coding-model stage (vision-only)")
    p.add_argument("--mode", choices=["fast", "thorough"], default="fast",
                   help="fast = 1 vision pass + 1 aggregate coding pass (default); "
                        "thorough = + per-screen coding passes in parallel")
    p.add_argument("--persona", default="all",
                   help="Vision lens subset: 'all' (default) or one of: " + ", ".join(LENS_ORDER))
    p.add_argument("--consensus", dest="consensus", action="store_true", default=True,
                   help="Write a severity x consensus priority report (default on)")
    p.add_argument("--no-consensus", dest="consensus", action="store_false")
    p.add_argument("--synthesize", action="store_true",
                   help="Also run an LLM merge of the consensus list into a master plan")
    p.add_argument("--out", default=None, help="Output directory for reports (default: macro_logs)")
    p.add_argument("--max-dim", type=int, default=VISION_IMG_MAX, help="Max image dimension for vision payload")
    p.add_argument("--list-personas", action="store_true", help="List available lenses and exit")
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if args.list_personas:
        print("Vision lenses (gemma reviews all of these in ONE pass per screen):")
        for k in LENS_ORDER:
            print(f"  - {k:14s} {LENS_FOCUS[k]}")
        print(f"\nCoding supplement model (text-only): {CODING_MODEL}")
        print(f"  override with --coding-model <name> or --no-coding to disable.")
        print("\nUse --mode fast (default) for speed, --mode thorough for depth.")
        return 0

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    shots_dir = _resolve_shots_dir(Path(args.shots_root), args.shots_dir)
    if shots_dir is None:
        logger.error("Could not resolve a screenshots directory")
        return 1

    lenses = _resolve_lenses(args.persona)
    if lenses is None:
        logger.error("Unknown persona '%s'. Choices: all, %s",
                     args.persona, ", ".join(LENS_ORDER))
        return 1

    coding_model = None if args.no_coding else args.coding_model
    out_dir = Path(args.out) if args.out else shots_dir.parent
    return run(shots_dir, args.vision_model, coding_model, args.mode, lenses,
               out_dir, args.max_dim, args.consensus, args.synthesize)


if __name__ == "__main__":
    sys.exit(main())

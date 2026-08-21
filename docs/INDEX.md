# Documentation Index — Space Analyzer Pro

> **Agent entry point.** Read `AGENTS.md` (repo root) first for behavioral rules and
> build commands. This file tells you **what each doc is and whether it reflects current
> status**, so you don't waste time on stale material.

## Project Status (as of 2026-08-20)

- **What this is:** Space Analyzer Pro — a disk-space analysis tool. Core is Rust
  (`src/`); the active desktop app is **WinUI 3 (C#)** in `gui-winui/`.
- **Second GUI — do not touch unless asked:** `gui-egui/` is an eframe/egui Rust GUI
  kept side-by-side for comparison only. Per `AGENTS.md`, exclude egui from any work.
- **Active subsystems beyond the GUI:** the **Macro Dashboard server**
  (`scripts/utility/live_progress_server.py` + `ux_server_*.py`, served at
  `http://localhost:8777`), the **Vision / UX analysis pipeline**
  (`scripts/utility/analyze_ux_screenshots.py` + `ux-pipeline/src/ux_pipeline/`), and the
  **agent execution trace** (`/api/agent/*` → `macro_logs/agent_traces.jsonl`). See
  `DATA_FLOW.md` for how data moves between these and the GUI.
- **Feature status:** The WinUI app is feature-complete except one item. Scan, dedup,
  AI assistant, settings, semantic Smart Search, USN Journal, bloat/forecast, and export
  formats are all implemented and build clean. See `docs/archive/FEATURE_GAP_ANALYSIS.md`.
- **ON HOLD (important):** Workflow triggers/scheduler (LowDiskSpace, FileSystemChange,
  OnStartup). Only the **Manual** trigger exists. Deliberately blocked until every other
  system is proven stable, because misconfiguration could cause **destructive changes**
  on the user's machine. See `ARCHITECTURE_DECISIONS.md` §8 before proposing automation.
- **Deprecated / ignore:** The Vue/Tauri web frontend under `archive/web-era/` is
  historical and is **not** the current app. Do not use it to infer current behavior.

## Active documentation (read these for current status)

- `DATA_FLOW.md` — **agent-oriented map**: the five subsystems, how data flows between
  them (Rust CLI ↔ C# models, Macro/Live UX Dashboard server, vision pipeline), and a "I need X →
  go to `<path>`" file locator. Start here when you need to find a file or understand
  an integration boundary.
- `CHANGELOG.md` — version history; `[Unreleased]` holds the latest fixes (e.g. Settings
  Store/ViewModel hardening, 2026-08-11).
- `docs/CHANGELOG.md` + `AGENTS.md` — feature status; the only on-hold item is workflow triggers/scheduler
   (Architecture Decisions §8).
- `ARCHITECTURE_DECISIONS.md` — key decisions + on-hold rules (GPU toggle placeholder,
  workflow triggers). **Read this before any automation/cleanup change.**
- `ISSUES.md` (generated from `issues.json` via `python docs/generate_status_summary.py --write`; gitignored) + `issues.json` — open-issue tracker (0 open; 125 done, 1 blocked). `issues.json` is the authoritative structured source.
- `docs/ai/` — Ollama benchmarks and AI recommendations (reference).
- `../assets/diagrams/architecture.md`, `../assets/diagrams/workflow.md` — current
  architecture and data-flow diagrams.
- `gui-winui/README.md` — WinUI 3 build & architecture (active GUI).

## Generated state (machine-written — do NOT hand-edit, not status)

- `archive/state/issues.db*` and `archive/state/.loop_state.json` — produced by tooling;
  ignore when assessing status.
- **Runtime artifacts (gitignored — never source, never commit):** `.playwright-cli/`,
  `ux_issues/`, `report_snap.yml`, `scripts/utility/analysis_history/`,
  `scripts/utility/ux_analysis/`, `scripts/utility/docs/`, `scripts/utility/*.log`,
  `macro_logs/`, and stray root screenshots (`dash-*.png`, `nav-*.png`, …). These are
  outputs of the dashboard server, vision pipeline, and Playwright captures — see
  `DATA_FLOW.md` §4 for the full list.

## Archive (historical — out of the tracked tree)

- Older analysis/status docs under `archive/` and `docs/archive/` are **gitignored and not part of the tracked tree** — do not rely on them for current status.
- Current status lives in `AGENTS.md`, `docs/CHANGELOG.md` (`docs/changelog/unreleased.md`), and `docs/ISSUES.md` (regenerated from `issues.json`).
- `docs/ai/` — Ollama benchmarks and AI recommendations (reference).
- `docs/guides/` — troubleshooting, native builds, GPU fixes (reference).
- `docs/implementations/` — security model and cleanup notes (reference).
## How to verify status quickly

1. This file + `CHANGELOG.md` → `[Unreleased]` for the latest state.
2. Feature completeness → `docs/archive/FEATURE_GAP_ANALYSIS.md` (detailed rows are authoritative;
   the summary table is derived — regenerate it with `python docs/generate_status_summary.py --write`).
3. Open work → `issues.json` (filter `status:"open"`; mostly UI/UX polish). The `ISSUES.md`
   counts table is also derived from `issues.json` by the same script.
4. Before any automation/cleanup change → `ARCHITECTURE_DECISIONS.md` §8 (on-hold rule).
5. Catch drift before committing → `python docs/generate_status_summary.py --check` (exits 1 on mismatch).

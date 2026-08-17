# Documentation Index — Space Analyzer Pro

> **Agent entry point.** Read `AGENTS.md` (repo root) first for behavioral rules and
> build commands. This file tells you **what each doc is and whether it reflects current
> status**, so you don't waste time on stale material.

## Project Status (as of 2026-08-16)

- **What this is:** Space Analyzer Pro — a disk-space analysis tool. Core is Rust
  (`src/`); the active desktop app is **WinUI 3 (C#)** in `gui-winui/`.
- **Second GUI — do not touch unless asked:** `gui-egui/` is an eframe/egui Rust GUI
  kept side-by-side for comparison only. Per `AGENTS.md`, exclude egui from any work.
- **Feature status:** The WinUI app is feature-complete except one item. Scan, dedup,
  AI assistant, settings, semantic Smart Search, USN Journal, bloat/forecast, and export
  formats are all implemented and build clean. See `FEATURE_GAP_ANALYSIS.md`.
- **ON HOLD (important):** Workflow triggers/scheduler (LowDiskSpace, FileSystemChange,
  OnStartup). Only the **Manual** trigger exists. Deliberately blocked until every other
  system is proven stable, because misconfiguration could cause **destructive changes**
  on the user's machine. See `ARCHITECTURE_DECISIONS.md` §8 before proposing automation.
- **Deprecated / ignore:** The Vue/Tauri web frontend under `archive/web-era/` is
  historical and is **not** the current app. Do not use it to infer current behavior.

## Active documentation (read these for current status)

- `CHANGELOG.md` — version history; `[Unreleased]` holds the latest fixes (e.g. Settings
  Store/ViewModel hardening, 2026-08-11).
- `FEATURE_GAP_ANALYSIS.md` — WinUI features vs README promises. Most rows ✅; the only
  ❌ is workflow triggers/scheduler (on hold, see above).
- `ARCHITECTURE_DECISIONS.md` — key decisions + on-hold rules (GPU toggle placeholder,
  workflow triggers). **Read this before any automation/cleanup change.**
- `ISSUES.md` + `issues.json` — open-issue tracker (29 open, almost all UI/UX/layout
  polish). `issues.json` is the authoritative structured source.
- `IMPROVEMENTS.md` — Ollama module improvement log (historical; items mostly applied).
- `../assets/diagrams/architecture.md`, `../assets/diagrams/workflow.md` — current
  architecture and data-flow diagrams.
- `gui-winui/README.md` — WinUI 3 build & architecture (active GUI).

## Generated state (machine-written — do NOT hand-edit, not status)

- `archive/state/issues.db*` and `archive/state/.loop_state.json` — produced by tooling;
  ignore when assessing status.

## Archive (historical — do NOT rely on for current status)

- `archive/web-era/` — deprecated Vue/Tauri web frontend (40+ files). Superseded by WinUI.
- `archive/reports/` — 80+ historical status reports from prior agent runs.
- `archive/guides/`, `archive/trackers/` — old build instructions and issue CSVs.
- `archive/scripts/` — legacy Python helper scripts (some superseded by the Rust CLI).
- `archive/ux-pipeline/` — one-off UX analysis artifacts (report, screenshots, links).
- `ai/`, `architecture/`, `guides/`, `implementations/` — supplementary/reference docs.

## How to verify status quickly

1. This file + `CHANGELOG.md` → `[Unreleased]` for the latest state.
2. Feature completeness → `FEATURE_GAP_ANALYSIS.md` (detailed rows are authoritative;
   the summary table is derived — regenerate it with `python docs/generate_status_summary.py --write`).
3. Open work → `issues.json` (filter `status:"open"`; mostly UI/UX polish). The `ISSUES.md`
   counts table is also derived from `issues.json` by the same script.
4. Before any automation/cleanup change → `ARCHITECTURE_DECISIONS.md` §8 (on-hold rule).
5. Catch drift before committing → `python docs/generate_status_summary.py --check` (exits 1 on mismatch).

# Data Flow & File Locator — Space Analyzer Pro

> **Audience:** AI agents and contributors working in this repo.
> **Purpose:** (1) show how data moves between the subsystems, and (2) give a
> fast "I need X → go to `<path>`" map so you spend less time searching.
> Read `AGENTS.md` (repo root) first for behavioral rules and build commands,
> and `docs/INDEX.md` for the doc-status hub.

---

## 1. Systems at a glance

| Subsystem | Language / Stack | Root(s) | Role |
|-----------|------------------|---------|------|
| **Rust core** | Rust (Cargo workspace) | `src/`, `scan-engine/`, `gpu-compute/`, `native/` | Disk scanning, CLI (`space-analyzer-cli`), SQLite persistence, Ollama client, system monitor, semantic/embeddings. |
| **WinUI 3 GUI** | C# / .NET 10 + Windows App SDK | `gui-winui/` | Active desktop app. Calls the Rust CLI as a subprocess and renders results. |
| **Macro Dashboard server** | Python (stdlib `http.server`) | `scripts/utility/live_progress_server.py` + `ux_server_*.py` | Live progress / UX-analysis / agent-trace web dashboard. Serves `live_progress.html`, `screenshot_gallery.html`, reports. |
| **Vision / UX pipeline** | Python + Ollama vision | `scripts/utility/analyze_ux_screenshots.py`, `ux-pipeline/src/ux_pipeline/` | Captures screenshots and classifies UX issues via local vision models. |
| **Utility scripts** | PowerShell 7 + Python + Node | `scripts/utility/*.ps1`, `*.py`, `vision.mjs` | Packaging, capture, update checks, vision checks. **Require PowerShell 7** (`#Requires -Version 7`). |

---

## 2. Data-flow maps

### 2.1 Scan → WinUI 3 GUI (primary path)
```
space-analyzer-cli scan --path <p> --format json [--stream] [--save-history]
        │  (subprocess, stdout = NDJSON when --stream)
        ▼
ScannerService.ScanDirectoryAsync / ScanDirectoryStreamingAsync   (gui-winui/.../Services/ScannerService.cs)
        │  deserializes snake_case JSON with System.Text.Json (unknown members ignored)
        ▼
C# models in gui-winui/SpaceAnalyzer/Models/  (ScanResult, StreamEvent, ScanHistoryRecord, DiskVolume, …)
        │
        ▼
ViewModels / Views  (gui-winui/SpaceAnalyzer/ViewModels/*, Views/*)
```
- Non-streaming: one `ScanResult` JSON object.
- Streaming: NDJSON `StreamProgress` / `StreamComplete` events (`scan-engine` accumulates
  `file_type_counts`, `extension_sizes`, `category_sizes` during the walk).
- Cancellation: `ScannerService.StopScan()` kills the scanner process tree.
- Persistence: `--save-history` writes to the embedded SQLite DB; read back via
  `history --id <n>` → `ScanHistoryRecord`.

### 2.2 CLI ↔ C# JSON contract (the interop boundary)
- **Wire format is `snake_case`.** C# applies `JsonNamingPolicy.SnakeCaseLower` where the
  Rust shape uses it (e.g. `duplicate_groups_json` → `DuplicateAnalysisRecord.Groups`).
- `System.Text.Json` is configured to **ignore unknown members**, so additive companion
  fields (e.g. `total_human`, `potential_cleanup_human`) are safe to add without breaking
  the GUI.
- `disk-info --format json` returns a **JSON array** of `DiskVolume` (GUI deserializes
  directly into `List<DiskVolume>`).
- The Rust scanner is rebuilt and copied into the WinUI output dir by the csproj
  `CopyRustTools` target (`space-analyzer-cli.exe`, `node_modules_cleaner.exe` from
  `target/release/`).

### 2.3 Macro Dashboard server ↔ Rust / CLI / logs
```
live_progress_server.py  ──/api/scan──►  space-analyzer-cli (triggers a scan)
        │  renders live_progress.html / screenshot_gallery.html / /report
        │  reads macro_logs/ for run state
        ├──/api/agent/*──►  Ollama (chat_with_tools)  ──►  macro_logs/agent_traces.jsonl
        └──/theme.css /nav.css /dashboard.css /dashboard.js /agent.js  (static assets served from scripts/utility/)
```
- The server only **reads** `dashboard.css` / `dashboard.js` / `agent.js` / `theme.css` /
  `nav.css`; they are static source files that must exist next to it (do not delete).
- Agent tool-calling surface lives in `ux_server_agent.py`; stateful run/loop control in
  `ux_server_core.py`; HTML rendering in `ux_server_render.py`; shared helpers in
  `ux_server_lib.py`.

### 2.4 Vision / UX analysis pipeline
```
capture_winui3_screenshots.py  (PrintWindow + UIA tab nav)  ──►  macro_logs/<run>__winui3-capture__ui-pages/
   ──OR──  Playwright capture of the dashboard (live_progress_server.py)  ──►  scripts/utility/ (png)
        │
        ▼
analyze_ux_screenshots.py  (Ollama vision: VISION_SYSTEM → ANALYSIS_SYSTEM → AGGREGATE_SYSTEM)
        │  writes
        ▼
ux_issues.json  +  per-shot JSON/HTML  ──►  scripts/utility/ux_analysis/  (generated; gitignored)
        │  consolidated
        ▼
docs/issues.json  (authoritative structured tracker)  →  ISSUES.md (derived)
```
- The vision model id is injected by the `vision-mcp` MCP server env as `gemma4:e2b-it-qat`
  (`VISION_MODEL` / `OCR_MODEL` are unset at the user level).

### 2.5 Issue / status data
```
docs/issues.json            ← authoritative structured open-issue tracker (hand-edit or via migrate script)
docs/ISSUES.md              ← derived counts table (gitignored; regenerate: python docs/generate_status_summary.py --write)
ux_issues.json             ← runtime vision output (regenerated; gitignored)
docs/changelog/unreleased.md ← latest fixes; docs/CHANGELOG.md has the released history
docs/INDEX.md              ← doc-status hub; ARCHITECTURE_DECISIONS.md ← key decisions + on-hold rules
docs/archive/             ← gitignored historical/analysis docs (IMPROVEMENTS.md, FEATURE_GAP_ANALYSIS.md, prior changelogs); on-disk only
```

---

## 3. File locator (I need X → go to Y)

| I need to… | Canonical path |
|------------|----------------|
| Change scanner / CLI behavior | `src/cli/` (`scan.rs`, `history.rs`, `dedup.rs`, `app_inventory.rs`, `semantic.rs`, `mod.rs`); core libs in `src/*.rs`, `scan-engine/src/` |
| Touch the Windows scanner | `native/win-usn/` |
| Build / run the Rust CLI | `cargo run --bin space-analyzer-cli -- <subcommand>` (workspace root) |
| Change the WinUI UI | `gui-winui/SpaceAnalyzer/Views/*.xaml`, `ViewModels/*.cs` |
| Change WinUI↔Rust glue | `gui-winui/SpaceAnalyzer/Services/ScannerService.cs`, `ToolExecutor.cs` |
| Edit a C# data model | `gui-winui/SpaceAnalyzer/Models/*.cs` (match Rust snake_case wire shape) |
| Change WinUI app build/packaging | `gui-winui/SpaceAnalyzer/SpaceAnalyzer.csproj` (`CopyRustTools`, `BuildRustScanner` targets) |
| Run the live dashboard | `pwsh scripts/utility/dashboard_server.ps1` → `http://localhost:8777` |
| Change dashboard server logic | `scripts/utility/live_progress_server.py`, `ux_server_{render,lib,core,agent}.py` |
| Change dashboard styling | `scripts/utility/theme.css`, `nav.css`, `dashboard.css` (+ `live_progress.html`) |
| Run a UX/vision analysis | `pwsh scripts/utility/capture.ps1` / `analyze_ux_screenshots.py` / `scripts/vision.mjs` |
| Read current open issues | `docs/issues.json` (not the HTML/MD — those are derived) |
| Find where a feature is documented | `docs/INDEX.md` → then the named doc |
| Understand architecture / on-hold rules | `docs/ARCHITECTURE_DECISIONS.md` (read §8 before any automation/cleanup) |
| Check the latest changes | `docs/changelog/unreleased.md` (then `CHANGELOG.md`) |
| Run unit tests (C#) | `dotnet test` in `gui-winui/SpaceAnalyzer.Tests` (build GUI with VS MSBuild, not `dotnet build`) |
| Run workspace tests (Rust) | `cargo test --workspace` |

---

## 4. Runtime artifacts (gitignored — do NOT edit, do NOT commit)

These are generated by tooling and intentionally excluded from git:
- `.playwright-cli/`, `ux_issues/`, `report_snap.yml`
- `scripts/utility/analysis_history/`, `scripts/utility/ux_analysis/`, `scripts/utility/docs/`, `scripts/utility/*.log`
- `macro_logs/` (agent traces, run logs), `ux-pipeline/analysis_history/`, `loop_feedback/`
- Stray root screenshots (`dash-*.png`, `nav-*.png`, `report_*.png`, `full_dash.png`,
  `header-check.png`) — convention is to save captures under `docs/screenshots/ux-audit-<YYYY-MM-DD>/` instead.
- Build outputs: `target/`, `**/obj/`, `**/bin/`, `*.db`, `*.sqlite`.

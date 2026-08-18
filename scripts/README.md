# Scripts Directory

Python utility scripts for Space Analyzer Pro. All build/test/lint tasks are in the **justfile** — run `just help` to see them.

## Directory Structure

```
scripts/
├── test/        # GUI testing (Win32 API)
├── debug/       # Native binary testing
├── utility/     # Ollama benchmarks, analysis, vision tools
└── temporary/   # One-shot patches, test scripts (archived, not actively used)
```

## Scripts

### test/gui_macro_test.py
Win32 `PrintWindow` API GUI testing — captures app window content without screen interference. Pre-seeds scan data, launches minimized, uses `PostMessage` for input (cursor never moves).

```bash
just test-gui
```

### debug/test_native_gui.py
Automated test suite for the native binary — verifies binary integrity, process lifecycle, CLI scan output (JSON schema v2.0), and AI compatibility.

```bash
just test-native
```

### utility/analyze_ux_screenshots.py
PIL feature extraction + Ollama vision model analysis of macro screenshots. Tracks quality scores across runs. Writes `macro_logs/ux_analysis_*.json` + `*.html` and **persists each completed report to the SQLite database** (`macro_logs/ux_reports.db`) for easy retrieval by the self-improvement loop.

```bash
python scripts/utility/analyze_ux_screenshots.py
```

### utility/ux_reports_db.py
SQLite store (`ReportsStore`) for UX analysis reports — `macro_logs/ux_reports.db`. Persists the full report JSON + rendered HTML plus queryable metadata (model, screenshot set, severity tallies, issue/recommendation counts). Supports upsert, list (filter by model/set), search, and idempotent file→DB migration (`migrate_files`) of existing `ux_analysis_*.json`/`*.html`.

### utility/live_progress_server.py
Live dashboard + screenshot gallery + **report browser** for `analyze_ux_screenshots.py`. Serves `/report` and `/api/report` from the database (with file fallback) and accepts `?id=<report_key>` to fetch any specific report. New endpoints: `GET /api/reports` (list/search) and `GET /reports` (HTML listing). Restart the server after deploying changes (it hosts the analyzer subprocess).

```bash
python scripts/utility/live_progress_server.py        # http://127.0.0.1:8777/  (+ /reports)
```

### utility/consolidate_benchmarks.py
Consolidates Ollama GPU/CPU benchmark results into CSV and markdown reports. Deduplicates to latest run per model.

```bash
python scripts/utility/consolidate_benchmarks.py
```

### utility/model_management.py
Ollama model management — list, analyze, pull, remove models based on benchmark results and Space Analyzer use cases.

```bash
python scripts/utility/model_management.py --list
python scripts/utility/model_management.py --analyze
python scripts/utility/model_management.py --cleanup
```

### utility/check_updates.ps1
Comprehensive update checker with three modes: portable apps (checked against GitHub/Mozilla APIs), winget packages, and code dependencies (npm/pip/cargo on E: drive).

```bash
just check-updates              # Full check: portable + winget + dependencies
just check-deps                 # Dependencies only (npm, pip, cargo)
just check-updates-fast         # Portable apps + winget (skip deps)
just check-updates-json         # JSON output
just dashboard                  # Open interactive HTML dashboard in browser
just dashboard-server           # Start server at localhost:3847 for live updates
powershell scripts/utility/check_updates.ps1 -ScanPaths "E:\Tools"
powershell scripts/utility/check_updates.ps1 -SkipPortable  # winget + deps only
powershell scripts/utility/check_updates.ps1 -DependencyPaths "E:\MyProjects"
powershell scripts/utility/check_updates.ps1 -Dashboard      # Generate + open HTML dashboard
```

### Live Update Server

The dashboard supports live dependency updates via a local HTTP server:

```bash
just dashboard-server           # Start server on http://localhost:3847
```

Then open `http://localhost:3847` in your browser. The dashboard will:
- Auto-detect the server and show a green "Live" indicator
- Show "Run" buttons instead of "Copy" — click to execute updates directly
- "Update All Outdated" button runs all updates with a progress bar
- Live log output streams via Server-Sent Events (SSE)

Without the server, the dashboard works as a static file (copy commands only).

## Archived Scripts

One-shot fix scripts, stale build scripts, and web-era tooling are in `scripts/temporary/` and `docs/archive/scripts-*/`.

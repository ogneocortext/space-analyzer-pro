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

### utility/analyze_screenshots.py
PIL feature extraction + Ollama vision model analysis of macro screenshots. Tracks quality scores across runs. Generates `macro_logs/screenshots_*/ux_analysis_*.json`.

```bash
python scripts/utility/analyze_screenshots.py
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

## Archived Scripts

One-shot fix scripts, stale build scripts, and web-era tooling are in `scripts/temporary/` and `docs/archive/scripts-*/`.

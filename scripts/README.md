# Scripts Directory

Python utility scripts for Space Analyzer Pro. All build/test/lint tasks are in the **justfile** — run `just help` to see them.

## Directory Structure

```
scripts/
├── test/        # GUI testing (Win32 API)
├── debug/       # Native binary testing
└── utility/     # Ollama benchmarks, analysis, vision tools
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
PIL feature extraction + Ollama vision model analysis of macro screenshots. Tracks quality scores across runs.

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

### utility/vision-analysis/
GPU-accelerated vision analysis pipeline (PyTorch CUDA + Ollama). Requires conda environment setup via `setup-cuda-env.ps1`.

```bash
# Setup (one-time)
pwsh scripts/utility/vision-analysis/setup-cuda-env.ps1

# Run
python scripts/utility/vision-analysis/gpu_vision_analyzer.py --benchmark
python scripts/utility/vision-analysis/gpu_vision_analyzer.py PATH_TO_SCREENSHOTS
```

## Archived Scripts

One-shot fix scripts, stale build scripts, and web-era tooling are in `docs/archive/scripts-*/`.

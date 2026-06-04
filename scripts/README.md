# Scripts Directory

Development, build, test, and utility scripts for the Space Analyzer Pro desktop application.

## Directory Structure

```
scripts/
├── build/       # Build and Rust environment setup
├── test/        # Test scripts (Python)
├── setup/       # Environment setup
├── fix/         # Quick fixes and repairs
├── debug/       # Debugging tools and instrumentation
└── utility/     # Benchmarks, analysis, and general utilities
```

## Build Scripts

| Script | Description |
|--------|-------------|
| `build-rust-apps.bat` | Build all Rust workspace members |
| `setup-rust-permanent.bat` | Setup permanent Rust build environment |
| `rust-env.bat` | Configure Rust environment variables |
| `set-cargo-target-dir.ps1` | Set custom Cargo target directory |
| `cleanup-path-permanent.bat` | Clean up PATH environment variable |

## Test Scripts

| Script | Description |
|--------|-------------|
| `gui_macro_test.py` | GUI macro testing via Win32 API |

## Setup Scripts

| Script | Description |
|--------|-------------|
| `add-system32-to-path.ps1` | Add System32 to PATH (Windows) |

## Fix Scripts

| Script | Description |
|--------|-------------|
| `fix_ollama_checking.py` | Fix Ollama connectivity issues |
| `fix_mojibake.py` | Fix character encoding issues |
| `fix_escape_html.py` | Fix HTML escaping |
| `fix_line_continuations.py` | Fix line continuation issues |
| `fix.py` | General fix script |
| `fix-comspec-and-path.ps1` | Fix COMSPEC and PATH issues |
| `fix-path-manual.cmd` | Manual PATH fix (batch) |

## Debug Scripts

| Script | Description |
|--------|-------------|
| `test_native_gui.py` | Test native GUI components |
| `instrument_ux.py` | UX instrumentation |
| `instrument_ux_save.py` | Save UX instrumentation data |
| `sample-analysis-data.json` | Sample data for debugging |

## Utility Scripts

| Script | Description |
|--------|-------------|
| `model_management.py` | Manage Ollama models |
| `consolidate_benchmarks.py` | Consolidate benchmark results |
| `analyze_screenshots.py` | Analyze screenshots via Ollama |
| `vision-analysis/` | GPU-accelerated vision analysis tools |

## Usage

Most scripts are standalone and can be run directly:

```bash
# Python scripts
python scripts/test/gui_macro_test.py
python scripts/utility/analyze_screenshots.py

# PowerShell scripts
pwsh scripts/build/set-cargo-target-dir.ps1

# Batch scripts
scripts\build\build-rust-apps.bat
```

For standard build/test/format operations, use `just` instead:
```bash
just help            # Show all commands
just build           # Build workspace
just test            # Run tests
just verify          # Format + lint + tests
```

## Archived Scripts

Scripts that depended on the `ai-service/` directory (now in `Space-Analyzer-Web`) are in `docs/archive/python-scripts-ai-service/`:
- `test_ollama_simple.py`, `ollama_cuda_benchmark.py`, `model_benchmark.py`, `vision_analyze.py`
- `check-status.ps1` (checked Vite dev server)

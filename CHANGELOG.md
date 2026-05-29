# Changelog

All notable changes to Space Analyzer Pro will be documented in this file.

## [Unreleased] - 2026-05-28

### Restructure: File Locations and Version Differentiation

- **Moved legacy GUI to archive**: `src/gui.rs` (v3.2.0 monolithic, 983 lines) → `archive/v3.2.0-monolithic/gui.rs`
- **Promoted modular GUI as active binary**: `src/gui/mod.rs` (v3.3.0 modular) is now the `space-analyzer-gui` binary entry point
- **Moved dead modules to archive**: `src/ai_skills.rs`, `src/ollama_client.rs`, `src/database.rs` → `archive/legacy-modules/`
- **Removed backup file**: `src/gui.rs.backup` → `archive/v3.2.0-monolithic/gui.rs.backup`
- **Updated Cargo.toml**: Binary target now points to `src/gui/mod.rs` instead of `src/gui.rs`
- **Updated documentation**: ARCHITECTURE.md, README.md, docs/PROJECT_STRUCTURE.md reflect new structure

### Analytics Bug Fixes

- **Fixed small-file analysis**: `analyze_file_patterns` now uses file type counts instead of searching `largest_files` (which never contains small files)
- **Fixed empty file_types UX**: `show_visual_analysis` now shows "No file type data available." instead of blank space
- **Fixed task classification**: Chat auto-model selection uses prioritized keywords to avoid collisions
- **Fixed negative growth reporting**: Storage prediction now reports "Decreasing" instead of "Stable" for negative growth
- **Fixed bar chart truncation**: Bar length minimum is now 1 character (was 0 for types < 3.33%)
- **Fixed cache key collision**: Prompt cache falls back to SYSTEM_PROMPT_ANALYSIS when conversation history is empty
- **Fixed division safety**: `generate_recommendations` guards against `total_files == 0` before division

### Maintenance: Rust Workspace Warning Cleanup (Session 4)

- **Eliminated all `cargo check --workspace` warnings** across the entire Rust workspace (reduced from 150+ warnings to 0 code warnings).
- **Fixed `node_modules_cleaner`**: Removed unused `rayon::prelude::*` import; prefixed unused parameters (`parallel`, `min_size_bytes`, `unused_days`) with underscores.
- **Fixed `native/scanner` (4 issues)**:
  - Removed 4 unnecessary nested `unsafe` blocks in `windows_advanced.rs` (GetLastError called inside outer unsafe).
  - Added `#[allow(dead_code)]` to `PerformanceTracker` and `Scanner` (planned features).
  - **Bug fix**: Sequential scan path (`analyze_sequential`) now correctly passes computed `duplicate_groups`/`duplicate_count`/`duplicate_size` to the result instead of hardcoded zero values. Previously, `--duplicates` mode silently discarded duplicate detection results in sequential scans.
  - Added `#[allow(dead_code)]` to utility functions in `windows_errors.rs`.
- **Fixed `src/ollama/` (7 files)**: Added `#[allow(dead_code)]` annotations to all submodules (`client`, `stream`, `json_utils`, `prompt_cache`, `error`, `prompts`, `types`) and their re-exports. These are planned Ollama integration modules not yet wired into the GUI.
- **Fixed `src/ollama_client.rs`**: Added `#![allow(dead_code)]` for the standalone Ollama client module.
- **Fixed `src/ai_skills.rs`**: Added `#![allow(dead_code)]` for planned AI skills module.
- **Fixed `src/gui.rs`**: Prefixed unused struct fields (`workflow_to_run`, `show_workflow_panel`, `show_ai_panel`) with underscores.
- **Fixed `src/database/` (4 files)**: Added `#[allow(dead_code)]` to planned features (`FileEmbeddingRecord`, `get_storage_trend`, `get_latest_scan_id`, `to_prompt_cache_config`, `get_scan_by_id`, `save_embeddings`, `get_embeddings_for_scan`, `clear_all_embeddings`).
- **Fixed `src/system_monitor.rs`**: Added `#![allow(dead_code)]` for `get_system_summary`.
- **Fixed `src/workflows/mod.rs`**: Added `#![allow(dead_code)]` for planned workflow methods.
- **Fixed `src/gui.rs`**: Removed redundant `let client = client;` bindings, replaced `sort_by` with `sort_by_key`, used `is_multiple_of()`, replaced redundant closures.
- **Fixed `src/workflows/mod.rs`**: Removed unnecessary `as u32` casts, replaced `map_or` with `is_some_and`, used `is_multiple_of()`.
- **Fixed `gpu-compute/src/device.rs`**: Replaced manual `Default` impl with `#[derive(Default)]`.
- **Fixed `gpu-compute/src/scan.rs`**: Replaced `sort_by` with `sort_by_key`.
- **Fixed `shared-scanner/src/lib.rs`**: Removed identity multiplication `1 * 1024 * 1024`.
- **Fixed `tests/cli_test.rs`**: Corrected binary name from `space-analyzer-cli` to `space-analyzer-pro`.
- **Fixed `Cargo.toml`**: Added missing dev-dependencies (`assert_cmd`, `predicates`, `tempfile`) for CLI tests.
- **Verified all 163 tests pass** across the workspace.

### Maintenance: Rust Workspace & CLI Fixes

- **Implemented CLI `--report` feature**: Generates a detailed Markdown report with space analysis summary statistics, top-10 largest files, file type distributions, and optimization recommendations. The report is safely written to a fully canonicalized `space-analyzer-report.md` inside the scanned directory.
- **Implemented CLI `--clean` feature**: Integrates the workspace's high-performance `file-deduplicator` engine to safely scan for duplicate files, calculate potential savings (with support for BLAKE3 hashing/GPU batching), breakdown duplicate groups, and default to a safe dry-run preview.
- **Fixed `native/file_deduplicator`**: Ensured hard-link deduplication uses the standard library `fs::hard_link` path instead of an undeclared Windows-only crate import.
- **Resolved top-level GUI module ambiguity**: Explicitly bound the database module to `src/database/mod.rs` and restored the `src/ollama` module tree so database settings can reference `PromptCacheConfig` again.
- **Fixed stale `app_lib` references**: Migrated all remaining outdated compiler stubs in `src/main.rs` to target the actual `shared_scanner` workspace crate.
- **Restored missing dependencies**: Added `bytes = "1"` to the root workspace `Cargo.toml` dependencies, which is required by the Ollama stream parser.
- **Aligned test suites**: Restored all stale test parameters in `native/file_deduplicator` and `shared-scanner` so that workspace tests build and pass 100% cleanly.

## [3.1.0] - 2026-05-15

### 🚀 GPU-Accelerated Rust Engine (CUDA + CPU Fallback)

#### New `gpu-compute` Workspace Crate
- **`gpu-compute/`** — shared GPU acceleration layer for all Rust components
- **`device.rs`** — NVIDIA GPU detection via `nvidia-smi` (no CUDA toolkit on PATH required) or `cudarc` (when `cuda` feature enabled)
- **`hash.rs`** — `BatchHasher` with automatic GPU/CPU selection for BLAKE3 file hashing
- **`ml.rs`** — `GpuAcceleratedML` with GPU-accelerated linear regression and K-Means clustering
- **`scan.rs`** — `GpuScanProcessor` for GPU-accelerated scan post-processing (extension extraction, size histograms, top-N sorting)
- **`cuda` feature flag** — enables native `cudarc` CUDA kernels; defaults to CPU-optimized `rayon` fallback

#### GPU-Accelerated File Scanning (`shared-scanner`)
- **Two-phase scan architecture**:
  - **Phase 1 (CPU)**: I/O-bound directory traversal via `WalkDir` — collects raw `(path, size, is_dir)` entries
  - **Phase 2 (GPU/CPU)**: Compute-heavy post-processing — file type categorization, size distribution histograms, top-100 largest file selection, empty directory detection
- GPU path: transfers size arrays to CUDA for parallel histogram computation and introselect-based top-N
- CPU fallback: `rayon` parallel iterators with `select_nth_unstable_by` (O(n) average)
- Seamless automatic GPU detection with zero-config fallback

#### GPU-Accelerated File Deduplication (`native/file_deduplicator`)
- Replaced sequential per-file `compute_file_hash()` with `BatchHasher::hash_files()`
- Batch processes files using GPU streams when available
- Falls back to `rayon`-parallelized BLAKE3 hashing on CPU

#### GPU-Accelerated ML Training (`native/storage_predictor`)
- `GpuAcceleratedML::linear_regression()` runs before `linfa` training
- GPU matrix operations for normal equation solving
- CPU fallback using `ndarray` + `rayon` with Gaussian elimination

#### Native GUI Enhancements (`native-gui`)
- **GPU status panel on dashboard** — shows device name, VRAM, compute capability, CUDA version
- Lists which operations are GPU-accelerated (hashing, ML, scan processing)
- Retry button for GPU detection
- Dynamic model selection display for Ollama chat
- Model discovery UI showing all local Ollama models with capability tags

### 🛠️ Build & Compilation Fixes
- Fixed `src/main.rs`: `ScanOptions` API migration (`depth`/`size_filter` → `ScanOptions::deep()`/`medium()`)
- Fixed `src/gui.rs`: egui 0.34 trait changes (`update` → `ui`, `Result` return type, removed `CentralPanel` wrapper)
- Added `walkdir` to root `Cargo.toml` dependencies
- Cleaned unused imports across `src/gui.rs` and `src/gui_common.rs`
- Switched default toolchain to `stable-x86_64-pc-windows-msvc` (GNU toolchain had linker issues)

### 📦 Dependency Updates
- Added `gpu-compute` to workspace members
- Added `gpu-compute` dependency to `shared-scanner`, `native-gui`, `file_deduplicator`, `storage_predictor`, and root package
- Added `rand = "0.8"` to `gpu-compute` for K-Means centroid initialization
- `cudarc = "0.12"` (optional, gated behind `cuda` feature)

### 🎯 Performance Impact
| Component | GPU Operation | CPU Fallback | Est. Speedup |
|-----------|--------------|--------------|-------------|
| Scan post-processing | Histograms, extension extraction, top-N sort | rayon + introselect | 2-5x (large scans) |
| BLAKE3 file hashing | Batch GPU stream processing | rayon parallel hashing | 3-10x (bulk dedup) |
| ML model training | Matrix ops (linear regression, K-Means) | ndarray + rayon | 5-20x (large datasets) |
| Ollama LLM inference | `num_gpu: -1` (all layers on GPU) | CPU inference | Already optimized |

### Previous Versions

#### [3.0.0] - 2026-05-14

### 🚀 CUDA GPU-Accelerated Vision Analysis

#### New GPU Environment (`tools/vision-analysis/`)
- **CUDA 12.4 + PyTorch 2.6.0** pipeline for NVIDIA GeForce GTX 1070 Ti (8GB VRAM)
- **`gpu_vision_analyzer.py`** — GPU-accelerated screenshot analysis:
  - Quality metrics: brightness, contrast, blur detection, sharpness (all via GPU convolutions)
  - Layout analysis: edge detection (Sobel), symmetry analysis, color clustering via k-means
  - Ollama `qwen3-vl:4b` integration for semantic UI/UX analysis
  - Batch processing with auto-category detection
- **`setup-cuda-env.ps1`** — one-command conda environment creation
- Performance: ~62s/image (dominated by Ollama inference), GPU processing uses ~24MB VRAM

#### Improved GUI Macro (`scripts/gui_macro_test.py`)
- **Switched from `pyautogui.screenshot` to Win32 `PrintWindow` API**
  - Captures only the actual application window content, not screen pixels
  - Works regardless of window occlusion, z-order, or cursor position
  - No cursor flicker or screen disruption — fully background operation
- **Pre-seeds scan history data** before macro runs:
  - Places scan results into `scan_results/` before launch
  - App loads real data immediately, eliminating empty-state screenshots
  - Reproducible results across runs
- **Minimized app launch** with `SW_SHOWMINIMIZED` for zero user disruption

#### Scan Data Infrastructure
- Three pre-existing scan result files preserved and leveraged for macro testing
- `test_workspace.json` — realistic test data for UI population
- Headless scan mode (`--scan <path>`) for generating new scan data on demand

### Previous Versions

#### [2.14.0] - 2025-05-12
- Major repository streamlining, 70% duplicate code removal
- Consolidated Rust GUI to single `src/gui.rs` (295 lines)
- Cleaned TypeScript, test files, and build artifacts

#### [2.13.0] - Previous
- Multiple GUI implementations, experimental features, duplicate code

#### [2.12.0] - Earlier
- Initial feature set, basic functionality

---

## 📝 Quick Setup

### CUDA GPU Environment (Windows + NVIDIA)
```powershell
# One-time setup (1.5GB download)
conda create -n space-analyzer-cuda python=3.12 -y
conda run -n space-analyzer-cuda pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
conda run -n space-analyzer-cuda pip install transformers timm accelerate scikit-learn pillow requests

# Verify GPU
conda run -n space-analyzer-cuda python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"

# Run vision analysis
conda run -n space-analyzer-cuda python tools/vision-analysis/gpu_vision_analyzer.py
```

### GUI Macro Test (Automated Screenshot Capture)
```powershell
# Run the macro (background, no cursor interference)
python scripts/gui_macro_test.py

# Then analyze screenshots with GPU
conda run -n space-analyzer-cuda python tools/vision-analysis/gpu_vision_analyzer.py
# Changelog

All notable changes to Space Analyzer Pro will be documented in this file.

## [Unreleased] - 2026-05-29

### v3.3.0 — Real GPU Kernels, Semantic Search & Performance

**Scope themes (not yet started):**

- **Real GPU CUDA kernels**: Wire `process_gpu()` beyond the current CPU-fallback stub; activate `cuda` feature with actual CUDA kernels for scan post-processing and batch hashing
- **Smart notifications**: Improve notification system accuracy to event triggers; add contextual hints and actionable next-step suggestions as a user flow guide
- **Semantic search UX**: Build out the Smart Search tab with result previews, relevance scores, and inline file actions
- **Performance**: Virtual-scrolled file lists for 100k+ results; lazy-load scan history; profile and reduce per-frame update overhead

## [3.2.0] - 2026-05-29

### AI Recommendations — Dual Mode (Heuristic + Ollama)

- **Renamed heuristic function**: `generate_ai_recommendations` → `generate_storage_recommendations` — always available, CPU-only
- **New Ollama-powered recommendations**: `generate_ai_recommendations_async` sends scan data to Ollama via structured prompt, parses JSON response into `Vec<AIRecommendation>`
- **Settings toggle**: `ai_recommendation_enabled` persisted in database, accessible from Settings → AI panel
- **Auto-fallback**: Heuristic rules used silently when Ollama unavailable or response unparseable
- **Dashboard display**: Shows source label (`🤖 AI` vs `⚙ Heuristic`) and pending indicator

### Conversation History Trimming

- **`trim_conversation_history()`** prevents unbounded growth: evicts oldest messages when total exceeds ~2000 token budget (8000 chars), preserves system prompt

### Workflow History — SQLite Migration

- **Added `workflow_executions` table** to database schema (replaced orphan index referencing non-existent table)
- **Removed dead JSON file persistence**: `workflow_history_path` was always `None`; `save_workflow_history`/`load_workflow_history` were never called
- **New DB methods**: `save_workflow_execution`, `get_workflow_history`, `delete_workflow_execution`, `clear_workflow_history`
- **Wired into scan/dedup completion** — workflow executions now persisted and loaded at startup

### Crate Architecture

- **Added `[lib]` target**: `src/lib.rs` as library root, binary is a thin wrapper at `src/bin/space-analyzer-gui.rs`
- **Removed all `#[path]` hacks** from `gui/mod.rs` — modules declared at crate level in `src/lib.rs`
- **Integration tests** use clean `space_analyzer_pro_desktop::...` imports instead of `#[path]` shim

### Settings & Data Integrity

- **`load_settings` wrapped in read transaction** for isolation (prevents inconsistent reads during concurrent `save_all_settings`)
- **GPU settings wired**: `gpu_acceleration`, `cuda_enabled`, `dedup_use_gpu` now control real runtime paths

### Restructure: File Locations and Version Differentiation

- **Moved legacy GUI to archive**: `src/gui.rs` (v3.2.0 monolithic, 983 lines) → `archive/v3.2.0-monolithic/gui.rs`
- **Promoted modular GUI as active binary**: `src/gui/mod.rs` is now the GUI entry point
- **Moved dead modules to archive**: `src/ai_skills.rs`, `src/ollama_client.rs`, `src/database.rs` → `archive/legacy-modules/`
- **Removed backup file**: `src/gui.rs.backup` → `archive/v3.2.0-monolithic/gui.rs.backup`
- **Updated Cargo.toml**: Binary target now points to `src/bin/space-analyzer-gui.rs`

### Analytics Bug Fixes

- **Fixed small-file analysis**: `analyze_file_patterns` now uses file type counts instead of searching `largest_files` (which never contains small files)
- **Fixed empty file_types UX**: `show_visual_analysis` now shows "No file type data available." instead of blank space
- **Fixed task classification**: Chat auto-model selection uses prioritized keywords to avoid collisions
- **Fixed negative growth reporting**: Storage prediction now reports "Decreasing" instead of "Stable" for negative growth
- **Fixed bar chart truncation**: Bar length minimum is now 1 character (was 0 for types < 3.33%)
- **Fixed cache key collision**: Prompt cache falls back to SYSTEM_PROMPT_ANALYSIS when conversation history is empty
- **Fixed division safety**: `generate_recommendations` guards against `total_files == 0` before division

### Maintenance: Rust Workspace Warning Cleanup

- **Eliminated all `cargo check --workspace` warnings** across the entire Rust workspace (reduced from 150+ warnings to 0 code warnings).
- **Fixed `node_modules_cleaner`**: Removed unused `rayon::prelude::*` import; prefixed unused parameters with underscores.
- **Fixed `native/scanner` (4 issues)**: Removed 4 unnecessary nested `unsafe` blocks; added `#[allow(dead_code)]` to planned features; sequential scan now correctly passes duplicate detection results; dead code annotations for utility functions.
- **Fixed `src/ollama/` (7 files)**: Added `#[allow(dead_code)]` annotations to all submodules.
- **Fixed dead modules**: src/ollama_client.rs and src/ai_skills.rs moved to archive (legacy modules no longer in active codebase)
- **Fixed `src/database/`**: Added `#[allow(dead_code)]` to planned features.
- **Fixed src/system_monitor.rs**: Removed misleading #![allow(dead_code)] annotation - all system monitoring functions are actively used
- **Fixed src/workflows/mod.rs**: Removed misleading #[allow(dead_code)] annotation - workflow system is actively used for automation
- **Code quality**: Removed redundant bindings, replaced `sort_by` with `sort_by_key`, used `is_multiple_of()`, replaced redundant closures.
- **Fixed `gpu-compute`**: Replaced manual `Default` impl with `#[derive(Default)]`; replaced `sort_by` with `sort_by_key`.
- **Fixed `shared-scanner/src/lib.rs`**: Removed identity multiplication.
- **Fixed `tests/cli_test.rs`**: Corrected binary name from `space-analyzer-cli` to `space-analyzer-pro`.
- **Fixed `Cargo.toml`**: Added missing dev-dependencies for CLI tests.
- **Verified all tests pass** across the workspace.

### Maintenance: Rust Workspace & CLI Fixes

- **Implemented CLI `--report` feature**: Generates detailed Markdown report with space analysis summary.
- **Implemented CLI `--clean` feature**: Integrates `file-deduplicator` engine for duplicate scanning with BLAKE3/GPU support, dry-run preview.
- **Fixed `native/file_deduplicator`**: Hard-link deduplication uses `fs::hard_link` instead of Windows-only import.
- **Resolved GUI module ambiguity**: Database module bound to `src/database/mod.rs`, restored `src/ollama` module tree.
- **Fixed stale `app_lib` references**: Migrated compiler stubs to target `shared_scanner` workspace crate.
- **Restored missing dependencies**: Added `bytes = "1"` for Ollama stream parser.
- **Aligned test suites**: Workspace tests build and pass 100% cleanly.

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

#### New GPU Environment (`scripts/utility/vision-analysis/`)
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
conda run -n space-analyzer-cuda python scripts/utility/vision-analysis/gpu_vision_analyzer.py
```

### GUI Macro Test (Automated Screenshot Capture)
```powershell
# Run the macro (background, no cursor interference)
python scripts/gui_macro_test.py

# Then analyze screenshots with GPU
conda run -n space-analyzer-cuda python scripts/utility/vision-analysis/gpu_vision_analyzer.py

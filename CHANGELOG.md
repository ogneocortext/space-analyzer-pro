# Changelog

All notable changes to Space Analyzer Pro will be documented in this file.

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
# Changelog

All notable changes to Space Analyzer Pro will be documented in this file.

## [3.4.0] - 2026-06-04

### Visual Identity

- **App icon** — multi-resolution (16, 32, 48, 64, 128, 256 px) gradient disk icon with cyan center dot. `assets/icon/` includes PNG, raw RGBA (for `egui::IconData`), and Windows `.ico`. Embedded at compile time via `include_bytes!` and set via `ViewportBuilder::with_icon()` so the OS taskbar / Alt-Tab show the custom icon.
- **Social preview banner** — 1280×640 PNG + SVG at `assets/banner/social-preview.png`. Features gradient disk icon, gradient "Pro" title, tagline, subtitle, 5 feature pills (`8 GUI TABS`, `12+ LLM TOOLS`, `GPU ACCELERATED`, `SQLITE EMBEDDED`, `WORKFLOW ENGINE`), and a `v3.4.0` badge. Upload this to **Settings → Social preview** on GitHub.
- **Welcome splash screen** — new `show_welcome` app state and `render_welcome_splash()` method. Centered gradient disk icon, fade-in title, 4 feature pills, "Get Started" button, keyboard shortcut hint. Auto-dismisses after 120 frames (~2 s) or on click / Enter / Space.
- **Mermaid diagrams** — `assets/diagrams/architecture.md` (full app architecture as a collapsible graph in the README) and `assets/diagrams/workflow.md` (data flow from scan → categorize → bloat → dashboard → AI / dedup / workflows).
- **README polish** — hero banner, for-the-badge shield row (release, license, stars, CI), "What you get / don't get" comparison table, Prerequisites table, collapsible architecture diagram, Screenshots section.

### Documentation

- **Rewrote root `README.md`**: Comprehensive feature inventory covering all 8 GUI tabs (Dashboard, Scan, History, Smart Search, Workflows, AI Assistant, System, Settings), 5 workflow categories, 7 workflow actions, 4 triggers, 12+ tool registry entries, and full project structure with clickable doc links
- **Added version badges** to README (Rust 1.95+, Windows, MIT license, version)
- **Updated feature list** to reflect all wired-in modules: `category.rs` (12-category file grouping), `offline_ai.rs` (heuristic bloat detection), `file_relations.rs` (destructive-action preview / dependency report), `tool_registry/` (LLM-callable tools), workflow engine, system monitor
- **Updated FEATURE_EVALUATION.md references**: noted that the 3 modules it flagged as "not compiled" are in fact declared in `src/lib.rs` and wired into the GUI

### Code Quality

- **Fixed clippy `field_reassign_with_default` errors** in `src/gui/dedup.rs` (lines 22-37): refactored two `DeduplicationConfig::default()` + field assignment patterns to use struct initializer with `..Default::default()`
- **Applied rustfmt** to `src/gui/dedup.rs` (import ordering, chained method formatting)
- **Verified release build**: `cargo build --workspace --release` succeeds in 7m48s
- **Verified CI suite**: `just verify` passes (fmt-check + clippy -D warnings + all tests)

### Version

- **Bumped**: `3.3.0` → `3.4.0` in `Cargo.toml`

## [Unreleased]

### Web/Desktop Separation

- **Moved web app to sibling directory**: `server/`, `ai-service/`, `styles/`, `public/`, `.github/workflows/playwright-tests.yml`, web configs, web tests, and web-only scripts moved to `E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer-Web`
- **Archived stale web-era docs**: 13 guides (Tauri, Vue, Docker, deployment) moved to `docs/archive/`
- **Archived broken Python scripts**: `test_ollama_simple.py`, `ollama_cuda_benchmark.py`, `model_benchmark.py`, `vision_analyze.py`, `check-status.ps1` moved to `docs/archive/python-scripts-ai-service/` (all imported from now-removed `ai-service/`)
- **Deleted 67 web-only scripts**: Node.js/Vite/Playwright test scripts, service starters, and web build scripts removed from `scripts/`

### Agent-Friendliness Improvements

- **Rewrote `AGENTS.md`**: Rewritten for Rust desktop app (accurate quick start, directory structure, conventions)
- **Rewrote `CONTRIBUTING.md`**: Updated for Rust workflow (fmt, clippy, test, verify)
- **Created root `README.md`**: Project overview for the desktop app
- **Rewrote `.clinerules`**: Removed Vue/React/Node.js references, now Rust-only
- **Updated `opencode.json`**: Changed commands to `cargo build/test/check`, `just verify`
- **Rewrote `justfile`**: Desktop-only (removed broken `shared/` lint target, server commands; added `build`, `test`, `fmt`, `clippy`, `verify`, `run-gui`, `run-cli`)
- **Created `.github/workflows/rust-ci.yml`**: CI pipeline for format check, clippy, test, build (Windows)

### Documentation Cleanup

- **Updated `docs/development/DEVELOPMENT.md`**: Complete rewrite from React/NestJS to Rust
- **Replaced `docs/development/TESTING.md`**: Replaced 985-line Playwright doc with Rust testing guide
- **Updated `docs/architecture/ARCHITECTURE.md`**: Removed `server/`/`ai-service/` refs, removed "Web Mode" section
- **Updated `docs/architecture/PROJECT_STRUCTURE.md`**: Removed `server/`/`ai-service/` from tree
- **Updated `docs/architecture/ARCHITECTURE_DIAGRAMS.md`**: Removed Python AI Services subgraph
- **Updated `docs/ISSUES.md`** and **`docs/FEATURE_EVALUATION.md`**: Added historical reference headers
- **Rewrote `config/.editorconfig`**: Removed JS/Vue sections
- **Updated `tests/README.md`**: Rewritten for Rust tests
- **Updated `scripts/README.md`**: Updated to reflect current script inventory

### Repo Hygiene

- **Cleaned `.gitignore`**: Removed web-era patterns (`.env`, `dist/`, `.next/`, etc.); added `.devin/`, `.kilo/`
- **Fixed `.gitattributes`**: Removed `*.vue` entry
- **Fixed git tracking**: `git rm --cached` 21 phantom config files tracked from deleted web dirs
- **Removed stale files**: `.bak`/`.orig` in `src/gui/`, build artifacts in `native/scanner/`, stale Tauri build scripts, `.husky/`, `nul` file, `node_modules/` at root, `.playwright-mcp/`, Prettier config files
- **Removed deprecated crates**: `archive_manager`, `storage_predictor`, `file_monitor`, `design-screenshot` (all from `Cargo.toml` workspace members)

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

### GPU-Accelerated Rust Engine (CUDA + CPU Fallback)

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

### Build & Compilation Fixes
- Fixed `src/main.rs`: `ScanOptions` API migration (`depth`/`size_filter` → `ScanOptions::deep()`/`medium()`)
- Fixed `src/gui.rs`: egui 0.34 trait changes (`update` → `ui`, `Result` return type, removed `CentralPanel` wrapper)
- Added `walkdir` to root `Cargo.toml` dependencies
- Cleaned unused imports across `src/gui.rs` and `src/gui_common.rs`
- Switched default toolchain to `stable-x86_64-pc-windows-msvc` (GNU toolchain had linker issues)

### Dependency Updates
- Added `gpu-compute` to workspace members
- Added `gpu-compute` dependency to `shared-scanner`, `native-gui`, `file_deduplicator`, `storage_predictor`, and root package
- Added `rand = "0.8"` to `gpu-compute` for K-Means centroid initialization
- `cudarc = "0.12"` (optional, gated behind `cuda` feature)

### Performance Impact
| Component | GPU Operation | CPU Fallback | Est. Speedup |
|-----------|--------------|--------------|-------------|
| Scan post-processing | Histograms, extension extraction, top-N sort | rayon + introselect | 2-5x (large scans) |
| BLAKE3 file hashing | Batch GPU stream processing | rayon parallel hashing | 3-10x (bulk dedup) |
| ML model training | Matrix ops (linear regression, K-Means) | ndarray + rayon | 5-20x (large datasets) |
| Ollama LLM inference | `num_gpu: -1` (all layers on GPU) | CPU inference | Already optimized |

## [3.0.0] - 2026-05-14

### CUDA GPU-Accelerated Vision Analysis

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

## [2.14.0] - 2025-05-12
- Major repository streamlining, 70% duplicate code removal
- Consolidated Rust GUI to single `src/gui.rs` (295 lines)
- Cleaned TypeScript, test files, and build artifacts

## [2.13.0] - Previous
- Multiple GUI implementations, experimental features, duplicate code

## [2.12.0] - Earlier
- Initial feature set, basic functionality

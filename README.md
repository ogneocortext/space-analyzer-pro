# Space Analyzer Pro

> A native, self-contained Windows desktop application for disk space analysis, deduplication, and AI-assisted file management. Single binary, no backend servers, no external runtime dependencies.

[![Rust](https://img.shields.io/badge/rust-1.95%2B-orange.svg)](https://www.rust-lang.org)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/ogneocortext/space-analyzer-pro)
[![Version](https://img.shields.io/badge/version-3.4.0-green.svg)](#changelog)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why Space Analyzer Pro?

Unlike web-based space analyzers, Space Analyzer Pro runs as a **native Windows binary** with direct filesystem access, embedded SQLite, optional GPU acceleration, and an optional local LLM (Ollama) — all without spinning up servers, exposing ports, or sending data off-device.

## Quick Start

```bash
# Build the GUI
cargo build --release --bin space-analyzer-gui
./target/release/space-analyzer-gui.exe

# Or use the task runner
just run-gui
```

### Prerequisites

- **Rust 1.95+** ([rustup.rs](https://rustup.rs))
- **Windows 10/11** (uses Windows-specific APIs in `native/scanner/`)
- **NVIDIA GPU** (optional, for GPU-accelerated dedup and hashing)
- **Ollama** (optional, for AI Assistant and Smart Search)

## Command Line Interface

```bash
# Basic scan
cargo run --bin space-analyzer-pro -- --path . --verbose

# Export results to JSON
cargo run --bin space-analyzer-pro -- --path . --export results.json

# Deep scan with extended metadata
cargo run --bin space-analyzer-pro -- --path . --deep

# Filter by file type
cargo run --bin space-analyzer-pro -- --path . --type "Documents" "Images"
```

## Features

### Core Scanning
- **Recursive directory scanning** with real-time progress, cancellation, and performance metrics
- **Multi-volume disk support** (3+ drives) with usage gauges
- **NTFS USN Journal scanner** for incremental change tracking (Windows)
- **Hard-link detection** via MFT parsing (Windows)
- **Scan history** with comparison, filtering, and SQLite-backed persistence

### Analysis
- **File categorization** into 12 human-readable groups (Documents, Images, Videos, Audio, Archives, Code, Development, Config, Logs, Backups, Database, Other) — [`src/category.rs`](src/category.rs)
- **Bloat detection** via heuristic pattern classifier (large videos, cache files, build artifacts, dev dependencies) — [`src/offline_ai.rs`](src/offline_ai.rs)
- **Storage trend prediction** based on historical scan data
- **AI recommendations** for cleanup, organization, and optimization
- **Largest files & directories** ranking

### File Management
- **Duplicate finder** with parallel hashing and **optional GPU acceleration**
- **Hard-link deduplication** to reclaim space without re-encoding
- **Destructive-action preview** — `DependencyReport` shows related files (hardlinks, symlinks, siblings, paired extensions) before deletion — [`src/file_relations.rs`](src/file_relations.rs)
- **Export** to JSON, CSV, HTML, and PDF

### AI Integration (Optional)
- **Ollama-powered AI Assistant** with chat, streaming, and tool-calling
- **Smart Search** using semantic embeddings for natural-language file queries
- **12+ tool registry** exposing scan/history/volumes/resources/storage_trend/workflows/file_type_breakdown/predict/patterns/search/largest_files/dependencies to the LLM
- **100% local** — no cloud APIs, no telemetry

### Workflow Automation
- **5 workflow categories**: Maintenance, Optimization, Organization, Monitoring, Custom
- **4 trigger types**: Manual, LowDiskSpace, FileSystemChange, OnStartup
- **7 action types**: Scan, FindDuplicates, PredictStorage, GenerateRecommendations, Export, Notify, AIAnalyze
- **Pre-configured templates** for common cleanup tasks
- **Execution history** with status tracking and cancellation

### System Monitoring
- **CPU, RAM, GPU, and disk** real-time gauges
- **Per-volume usage** with free/total breakdowns
- **Storage trend** line chart (when ≥2 scans in history)
- **Background refresh** without UI blocking

## Architecture

| Component | Implementation | Notes |
|-----------|---------------|-------|
| **GUI** | egui/eframe 0.34 (native Rust) | Single window, 8 tabs |
| **Database** | SQLite via `rusqlite` (bundled) | No external DB server |
| **File Scanner** | `shared-scanner` (rayon-parallel) | CPU mode default |
| **GPU Acceleration** | `gpu-compute` crate (optional) | Auto-detects NVIDIA, falls back to CPU |
| **AI Backend** | Ollama (HTTP, local-only) | Off by default; opt-in via Settings |
| **Workflow Engine** | `src/workflows/` | Native Rust, no external scheduler |
| **System Monitor** | `sysinfo` crate | Cross-platform base + Windows-specific NTFS APIs |

### Tabs

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Hero stats, file categories, bloat candidates, disk volumes, system resources, storage trend, AI recommendations |
| **Scan** | Configure paths, run scans, watch progress, view results |
| **History** | Browse past scans, compare, delete, export |
| **Smart Search** | Semantic search via local embeddings (requires Ollama) |
| **Workflows** | Create, edit, schedule, and run automated cleanup/analysis workflows |
| **AI Assistant** | Chat with local LLM; the LLM can call tools to scan, analyze, and act on your behalf |
| **System** | CPU/RAM/GPU/disk monitor with real-time gauges |
| **Settings** | Configure Ollama endpoint, default scan paths, theme, GPU toggle |

## Development

### Build & Test

```bash
just build         # Build debug workspace
just build-release # Build optimized release
just test          # Run all tests
just verify        # Format check + clippy + tests
just run-gui       # Start the GUI
just run-cli       # Run the CLI scanner
just clippy        # Run lints only
just fmt           # Format all code
just help          # Show all commands
```

### Project Structure

```
src/                       # Rust application source
  bin/                     # Binary entry points (space-analyzer-gui, space-analyzer-pro)
  gui/                     # egui desktop GUI (8 tabs, dashboard, system, etc.)
    ai/                    # AI Assistant chat interface
  ollama/                  # Ollama LLM client (chat, embeddings, streaming, tool calls)
  database/                # SQLite layer (scans, embeddings, settings, workflows)
  workflows/               # Analysis workflow engine (5 categories, 7 actions, 4 triggers)
  tool_registry/           # 12+ tools exposed to the LLM
  category.rs              # File extension → 12-category mapping
  offline_ai.rs            # Heuristic bloat pattern classifier
  file_relations.rs        # Dependency report (hardlinks, symlinks, siblings)
  system_monitor.rs        # CPU/RAM/GPU/disk monitoring
  embedding_service.rs     # Semantic search via Ollama embeddings
  session_logger.rs        # Opt-in diagnostic logging
  utils.rs                 # Shared utilities (formatting, paths, etc.)

native/                    # Standalone Rust binaries
  scanner/                 # Windows NTFS scanner (USN Journal, MFT, hardlinks)
  file_deduplicator/       # GPU-accelerated duplicate file finder
  node_modules_cleaner/    # Node.js dev-dependency cleanup tool

shared-scanner/            # Shared scanning logic (used by GUI + CLI + dedup)
gpu-compute/               # Optional CUDA kernels (parallel hashing, dedup)

docs/                      # Documentation
  architecture/            # Design decisions, diagrams, project structure
  development/             # Setup, testing, database migration guides
  ai/                      # Ollama setup, ML integration, benchmarks
  guides/                  # User guides (troubleshooting, native builds, GPU fixes)
  performance/             # Performance docs
  implementations/         # Security, localhost tools, clean.md
  archive/                 # Historical web-era docs (Vue, Tauri, Docker)

tests/unit/                # Rust unit + integration tests
scripts/                   # Python utility scripts (test/, debug/, utility/)
config/                    # Tool configuration (non-secret)
```

### Code Conventions

- `rustfmt` + `clippy -D warnings` enforced via `just verify`
- `thiserror` for library error types, `anyhow` for application errors
- `///` doc comments on all public items
- Workspace dependencies in root `Cargo.toml`; member crates pin versions from there

## Documentation

- [Full README](docs/README.md) — comprehensive project documentation
- [Architecture](docs/architecture/) — design decisions, diagrams, project structure
- [Development Guide](docs/development/) — setup, testing, database migrations
- [AI Integration](docs/ai/) — Ollama setup, embeddings, ML integration, benchmarks
- [Troubleshooting](docs/guides/TROUBLESHOOTING.md) — common issues
- [Performance](docs/performance/PERFORMANCE.md) — optimization notes
- [Security](docs/implementations/SECURITY.md) — security model
- [Changelog](docs/CHANGELOG.md) — release notes
- [Contributing](CONTRIBUTING.md) — how to contribute
- [Agent Guide](AGENTS.md) — for AI coding agents

## Versioning

**v3.4.0** — See [CHANGELOG.md](docs/CHANGELOG.md) for full release notes.

- **v3.x** — Self-contained Rust desktop application (active development)
- **v2.x and earlier** — Web-based Vue 3 + Node.js implementation (archived at [space-analyzer-pro-web](https://github.com/ogneocortext/space-analyzer-pro-web))

## License

MIT — see [LICENSE](LICENSE) for details.

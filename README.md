> **For AI agents:** Primary issue tracker is **`docs/issues.json`** (schema v1).
> Quick reference: **`docs/ISSUES.md`** (~80 lines, token-efficient). Do not use `docs/CONSOLIDATED_ISSUE_TRACKER.csv` as source of truth.
> Update workflow: find by `id:MAIN-XXX` tag in `tags[]` → fix code → update status in `issues.json` → `python docs/export_issues_to_csv.py`
<p align="center">
  <img src="assets/banner/social-preview.svg" alt="Space Analyzer Pro — native Windows disk space analyzer with AI and GPU acceleration" width="800">
</p>

<p align="center">
  <a href="https://github.com/ogneocortext/space-analyzer-pro/releases/latest"><img src="https://img.shields.io/github/v/release/ogneocortext/space-analyzer-pro?style=for-the-badge&color=6366f1&logo=github" alt="Latest Release"/></a>
  <a href="https://github.com/ogneocortext/space-analyzer-pro/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ogneocortext/space-analyzer-pro?style=for-the-badge&color=a855f7" alt="License"/></a>
  <a href="https://github.com/ogneocortext/space-analyzer-pro/stargazers"><img src="https://img.shields.io/github/stars/ogneocortext/space-analyzer-pro?style=for-the-badge&color=06b6d4" alt="Stars"/></a>
</p>

<p align="center">
  <a href="#why-space-analyzer-pro">Why?</a> &nbsp;·&nbsp;
  <a href="#quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#features">Features</a> &nbsp;·&nbsp;
  <a href="#architecture">Architecture</a> &nbsp;·&nbsp;
  <a href="#screenshots">Screenshots</a> &nbsp;·&nbsp;
  <a href="#development">Development</a> &nbsp;·&nbsp;
  <a href="#documentation">Docs</a>
</p>

---

## Why Space Analyzer Pro?

Space Analyzer Pro is available in one mode:

- **Desktop** — native Windows binary with direct filesystem access, embedded SQLite, optional GPU acceleration, and optional local LLM (Ollama). No servers, no ports, no telemetry.

| What you get | What you don't |
|---|---|
| Single ~16 MB desktop binary | No Node.js runtime required for desktop mode |
| Embedded SQLite database | No PostgreSQL, no Redis, no cloud DB |
| Optional local Ollama AI | No OpenAI API, no telemetry, no tracking |
| Optional NVIDIA GPU accel | No vendor lock-in, CPU fallback works fine |
| Recursive multi-volume scan | No browser limitations, no upload size limits |
| Hardlink-based dedup | No re-encoding, no data loss |

---

## Quick Start

```bash
# Build the egui GUI (Rust)
cargo build --release -p space-analyzer-gui-egui
./gui-egui/target/release/space-analyzer-gui.exe

# Or use the task runner
just run-gui
```

### WinUI 3 GUI (C#/.NET)

> **Note:** The WinUI 3 GUI requires Visual Studio 2022 MSBuild. `dotnet build` fails with WMC9999 on non-English Windows.

```powershell
# Build using Visual Studio MSBuild
& "D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64

# Run
dotnet run --project gui-winui/SpaceAnalyzer
```

**WinUI 3 state (v3.7.0+):**
- **Stable build** against Windows App SDK 2.3 / .NET 10
- **All pages implemented:** Dashboard, Scan, History, Smart Search, Workflows (stub), AI Assistant, Duplicates, System, Cleanup, Settings, About
- **Dashboard stat cards** populated from scan history with 3-second live system resource refresh
- **MVVM pattern** with `Helpers/`, `ViewModels/`, `Models/`, `Services/` separation
- **Ollama integration** via `OllamaClient.cs` for local AI chat
- **Scan page:** Stop scan button, path validation, scan errors display, file type distribution chart, largest files with filter, export results, deep/shallow/custom depth modes, scan speed metrics

### Prerequisites

| Requirement | Required? | Notes |
|---|---|---|
| **Rust 1.95+** | ✅ Yes | [rustup.rs](https://rustup.rs) |
| **Windows 10/11 x64** | ✅ Yes | Uses Win32 APIs in `native/scanner/` |
| **NVIDIA GPU** | ⚠️ Optional | For GPU-accelerated dedup; CPU fallback works |
| **Ollama** | ⚠️ Optional | For AI Assistant and Smart Search tabs |

### Command Line Interface

The CLI uses subcommands for structured JSON output (used by the WinUI 3 GUI):

```bash
# Basic scan
cargo run --bin space-analyzer-cli -- scan --path . --verbose

# Export results to JSON
cargo run --bin space-analyzer-cli -- scan --path . --export results.json

# Deep scan with extended metadata
cargo run --bin space-analyzer-cli -- scan --path . --deep

# Show disk space info — prints a JSON array of every mounted volume
# (the --path arg is accepted but ignored in JSON output)
cargo run --bin space-analyzer-cli -- disk-info --format json
# Example: [{"mount_point":"C:\\","label":"SSD","file_system":"NTFS",
#   "total_bytes":...,"used_bytes":...,"available_bytes":...,"usage_percent":64.6}]

# Show scan history
cargo run --bin space-analyzer-cli -- history --limit 10

# Run duplicate-file analysis
cargo run --bin space-analyzer-cli -- dedup --path .

# Global flags (apply to all subcommands)
--format {text,json,csv,jsonl,md}  Output format (default: text)
--top N                            Number of top items (default: 20)
--no-animation                     Suppress animations
```

---

## Features

### Core Scanning
- **Recursive directory scanning** with real-time progress, cancellation, and performance metrics
- **Multi-volume disk support** (3+ drives) with usage gauges
- **NTFS USN Journal scanner** for incremental change tracking
- **Hard-link detection** via MFT parsing
- **Scan history** with comparison, filtering, and SQLite-backed persistence
- **Path validation** before scan starts — invalid paths are rejected with a clear message
- **Scan cancellation** — Stop button kills the scanner process tree immediately
- **Scan errors** — per-scan error list displayed in the results panel
- **File type distribution** — top 10 extensions with percentage breakdown
- **Largest files** with live filter by filename substring
- **Export results** to JSON file from the scan page
- **Deep/shallow/custom depth** scan modes

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
- **14+ tool registry** exposing scan/history/volumes/resources/storage_trend/workflows/file_type_breakdown/predict/patterns/search/largest_files/dependencies/stop_scan/export_results to the LLM
- **Dynamic tool choice** — the assistant resolves which tools to call based on the user's message content, mirroring the Rust backend's `resolve_tool_choice` logic
- **Enriched ChatRequest** — `Options`, `Think`, and `KeepAlive` fields supported for fine-grained model control
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

---

## Architecture

Two GUI implementations exist side-by-side for comparison:

| GUI | Path | Stack | Status |
|-----|------|-------|--------|
| **egui** | `gui-egui/` | Rust + eframe/egui 0.34 | Feature-complete, archived for comparison |
| **WinUI 3** | `gui-winui/` | C# + Windows App SDK | Active development |

The core Rust library (`src/`) provides the database, Ollama integration, system monitoring, and CLI. Both GUIs consume this library — egui directly as a Rust crate, WinUI 3 via subprocess calls to the CLI.

### Tabs

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Hero stats, file categories, bloat candidates, disk volumes, system resources, storage trend, AI recommendations |
| **Scan** | Configure paths, run scans, watch progress, view results |
| **History** | Browse past scans, compare, delete, export |
| **Smart Search** | Semantic search via local embeddings (requires Ollama) |
| **Workflows** | Create, edit, schedule, and run automated cleanup/analysis workflows |
| **AI Assistant** | Chat with local LLM; the LLM can call tools to scan, analyze, and act on your behalf |
| **Duplicates** | Find and remove duplicate files with parallel hashing |
| **System** | CPU/RAM/GPU/disk monitor with real-time gauges |
| **Cleanup** | Analyze and clean node_modules directories to reclaim disk space |
| **About** | Version, license, and core technologies |
| **Settings** | Configure Ollama endpoint, default scan paths, theme, GPU toggle |

### Stack

| Component | Implementation | Notes |
|---|---|---|
| **GUI (egui)** | eframe 0.34 (native Rust) | Single window, 8 tabs |
| **GUI (WinUI 3)** | Windows App SDK 2.2 (C#/.NET 8) | Fluent Design, Mica backdrop, 11 pages |
| **Database** | SQLite via `rusqlite` (bundled) | No external DB server |
| **File Scanner** | `shared-scanner` (rayon-parallel) | CPU mode default |
| **GPU Acceleration** | `gpu-compute` crate (optional) | Auto-detects NVIDIA, falls back to CPU |
| **AI Backend** | Ollama (HTTP, local-only) | Off by default; opt-in via Settings |
| **Workflow Engine** | `src/workflows/` | Native Rust, no external scheduler |
| **System Monitor** | `sysinfo` crate | Cross-platform base + Windows-specific NTFS APIs |

---

## Screenshots

> Screenshots below are from the actual Rust desktop GUI (egui). For more, see [`assets/screenshots/docs/`](assets/screenshots/docs/).

| Dashboard | AI Assistant |
|---|---|
| <img src="assets/screenshots/dashboard.png" alt="Dashboard" width="400"> | <img src="assets/screenshots/ai-chat.png" alt="AI Assistant" width="400"> |

_To capture fresh screenshots, run `just test-gui` which uses the Win32 PrintWindow API to capture the actual GUI window._

---

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
just package       # Build release + create distributable zip
just help          # Show all commands
```

### Project Structure

```
  src/                       # Core Rust library (no GUI)
   main.rs                  # CLI entry point
   lib.rs                   # Library exports
   cli/                     # CLI module (subcommands: scan, disk-info, history, dedup)
     args.rs                # Clap subcommand definitions
     mod.rs                 # Subcommand dispatch
     scan.rs                # Directory scanning logic
     dedup.rs               # Duplicate analysis logic
     helpers.rs             # Shared helpers (get_disk_info, parse_size)
     types.rs               # Shared types (DiskInfo)
   ollama/                  # Ollama LLM client (chat, embeddings, streaming, tool calls)
  database/                # SQLite layer (scans, embeddings, settings, workflows)
  workflows/               # Analysis workflow engine (5 categories, 7 actions, 4 triggers)
  tool_registry/           # 12+ tools exposed to the LLM
  category.rs              # File extension → 12-category mapping
  offline_ai.rs            # Heuristic bloat pattern classifier
  file_relations.rs        # Dependency report (hardlinks, symlinks, siblings)
  system_monitor.rs        # CPU/RAM/GPU/disk monitoring
  embedding_service.rs     # Semantic search via Ollama embeddings
  disk_monitor.rs          # Background disk space monitor
  gui_common.rs            # Shared types for GUI implementations

gui-egui/                  # egui desktop GUI (archived for comparison)
  Cargo.toml               # Depends on root crate
  src/
    main.rs                # GUI binary entry point
    lib.rs                 # Re-exports gui module
    gui/                   # egui GUI modules (8 tabs, dashboard, system, etc.)
      ai/                  # AI Assistant chat interface
    thumbnails.rs          # Image thumbnail cache

gui-winui/                 # WinUI 3 desktop GUI (active development)
  SpaceAnalyzer.sln        # Visual Studio solution
  SpaceAnalyzer/
    SpaceAnalyzer.csproj   # .NET 8 + Windows App SDK
    App.xaml(.cs)          # Application entry
    MainWindow.xaml(.cs)   # NavigationView shell
    Views/                 # XAML pages (Dashboard, Scan, Settings, etc.)
    ViewModels/            # MVVM view models
    Services/
      ScannerService.cs    # Rust CLI interop (subprocess + JSON)
    Models/                # Data models
    Assets/                # Icons, images

native/                    # Standalone Rust binaries
  scanner/                 # Windows NTFS scanner (USN Journal, MFT, hardlinks)
  file_deduplicator/       # GPU-accelerated duplicate file finder
  node_modules_cleaner/    # Node.js dev-dependency cleanup tool

shared-scanner/            # Shared scanning logic (used by GUI + CLI + dedup)
gpu-compute/               # Optional CUDA kernels (parallel hashing, dedup)

assets/                    # Visual assets
  banner/                  # Social preview (1280×640 PNG + SVG)
  icon/                    # App icon (multi-resolution .ico + 6 PNG sizes)
  diagrams/                # Mermaid source (architecture.md, workflow.md)
  screenshots/             # GUI captures (design/ for prototypes, docs/ for real app)

docs/                      # Documentation
  architecture/            # Design decisions, diagrams, project structure
  development/             # Setup, testing, database migration guides
  ai/                      # Ollama setup, ML integration, benchmarks
  guides/                  # User guides (troubleshooting, native builds, GPU fixes)
  performance/             # Performance docs
  implementations/         # Security, localhost tools, clean.md

tests/unit/                # Rust unit + integration tests
scripts/                   # Python/PowerShell utility scripts (test/, debug/, utility/)
config/                    # Tool configuration (non-secret)
```

### Code Conventions

- `rustfmt` + `clippy -D warnings` enforced via `just verify`
- `thiserror` for library error types, `anyhow` for application errors
- `///` doc comments on all public items
- Workspace dependencies in root `Cargo.toml`; member crates pin versions from there

---

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

---

## Versioning

**v3.8.0** — See [CHANGELOG.md](docs/CHANGELOG.md) for full release notes.
- Scan page hardening (Stop, path validation, errors, file type distribution, largest files filter, export, depth modes, speed metrics).
- AI Assistant expansion (14 tools, dynamic tool choice, enriched ChatRequest).

**v3.7.0** — See [CHANGELOG.md](docs/CHANGELOG.md) for full release notes.

- **v3.x** — Rust desktop application (active development)
- **v2.x and earlier** — Web-based Vue 3 + Node.js implementation (archived at [space-analyzer-pro-web](https://github.com/ogneocortext/space-analyzer-pro-web))

---

## License

MIT — see [LICENSE](LICENSE) for details.



# Space Analyzer Pro

A powerful, self-contained disk space analysis tool with embedded database, GPU acceleration, and optional local AI. Available as a **native Windows desktop app**.

## Quick Start

### WinUI 3 Desktop Application (Primary Interface — Active)

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

### Rust egui GUI (Legacy — Kept for Comparison)

```bash
# Build the egui GUI (legacy)
cargo build --release -p space-analyzer-gui-egui
./gui-egui/target/release/space-analyzer-gui.exe
```

### Command Line Interface

The CLI uses subcommands for structured JSON output (primarily used by the WinUI 3 GUI):

```bash
# Basic scan
cargo run --bin space-analyzer-cli -- scan --path . --format json

# Disk info — prints a JSON array of every mounted volume
# (the --path arg is accepted but ignored in JSON output)
space-analyzer-cli disk-info --path "C:\Users" --format json
# Example: [{"mount_point":"C:\\","label":"SSD","file_system":"NTFS",
#   "total_bytes":...,"used_bytes":...,"available_bytes":...,"usage_percent":64.6}]

# Scan history
space-analyzer-cli history --limit 50 --format json

# Duplicate detection
space-analyzer-cli dedup --path "C:\Users" --format json
```

## Architecture

Space Analyzer Pro has **two GUI implementations** for comparison:

| GUI | Stack | Status |
|-----|-------|--------|
| **WinUI 3** | C# / .NET 10 + Windows App SDK 2.3 | **Active development** |
| **egui** | Rust / eframe | Legacy, preserved for comparison |

### Self-Contained Design

| Component | Implementation | Required? |
|-----------|---------------|-----------|
| **GUI** | WinUI 3 (C#/.NET) OR egui (Rust) | Yes |
| **Database** | SQLite (embedded, via Rusqlite) | Yes |
| **File Scanner** | Native Rust + WalkDir | Yes |
| **AI Assistant** | Ollama (optional, local) | No |
| **Workflows** | Rust-native orchestration | Yes |
| **System Monitor** | sysinfo crate + Win32 P/Invoke | Yes |
| **GPU Acceleration** | CUDA optional; CPU fallback via rayon | No |

### What This Means
- **No Node.js backend needed** - everything runs in Rust
- **No Python services needed** - ML categorization is rule-based in Rust
- **No separate database server** - SQLite is embedded
- **No cloud dependencies** - Ollama is optional and runs locally
- **One executable** - download and run, that's it

## GPU Acceleration

Space Analyzer Pro automatically detects and uses your NVIDIA GPU:

| Component | GPU Operation | Fallback |
|-----------|--------------|----------|
| **File Scanning** | Post-processing (histograms, sorting) | rayon parallel CPU |
| **File Deduplication** | BLAKE3 batch hashing | rayon parallel hashing |
| **ML Predictions** | Linear regression, K-Means | ndarray + rayon |

GPU detection is automatic via `nvidia-smi`. No CUDA toolkit installation required.

## Project Structure

```
Space-Analyzer/
├── src/                          # Rust core library
│   ├── main.rs                   # CLI binary (space-analyzer-cli)
│   ├── ollama/                   # Ollama AI client
│   ├── database/                 # Embedded SQLite persistence
│   ├── system_monitor.rs         # Disk/CPU/memory/GPU monitoring
│   ├── workflows/                # Native workflow orchestration
│   └── ...
├── gui-egui/                     # egui GUI (legacy, preserved for comparison)
│   └── src/gui/
│       ├── mod.rs                # Binary entry
│       ├── types.rs              # Shared UI types
│       └── ...
├── gui-winui/                    # WinUI 3 GUI (ACTIVE)
│   └── SpaceAnalyzer/
│       ├── SpaceAnalyzer.csproj  # .NET 10 + Windows App SDK 2.3
│       ├── App.xaml(.cs)         # Application entry
│       ├── MainWindow.xaml(.cs)  # NavigationView shell
│       ├── Helpers/              # ByteFormatter, UiHelper, Converters
│       ├── Views/                # Page XAML + code-behind
│       ├── ViewModels/           # MVVM view models
│       ├── Services/             # ScannerService, OllamaClient
│       └── Models/               # Data models
├── native/                       # Standalone Rust binaries
│   ├── scanner/                  # High-performance file scanner
│   ├── file_deduplicator/        # GPU-accelerated duplicate finder
│   └── node_modules_cleaner/     # Node.js dev-dependency cleanup
├── shared-scanner/               # Shared scanning logic
├── gpu-compute/                  # Optional CUDA kernels
└── docs/                         # Documentation
```

## Features

### Core Analysis
- **Deep Scans**: Recursive multi-volume directory scanning with progress tracking
- **File Type Distribution**: Automatic categorization by extension
- **Largest Files**: Quick identification of space hogs
- **Scan History**: Persistent history via embedded SQLite
- **Export Results**: Save analysis to JSON
- **Smart Search**: Find files/folders by name and size

### System Monitoring
- **Live Resource Monitors**: CPU, memory, disk usage bars (refreshes every 3s)
- **Disk Volume Overview**: Per-drive usage with color-coded thresholds
- **Process Inspection**: Top resource-consuming processes

### AI Assistant (Optional)
- **Local Ollama Integration**: Chat with your disk data
- **No Cloud Required**: All processing stays on your machine
- **Context-Aware**: AI has access to scan results
- **Natural Language Queries**: "What's taking up the most space?"
- **Cleanup Recommendations**: AI-powered suggestions

### Automation Workflows
- **Weekly Cleanup**: Scheduled scan + duplicate detection
- **Large Files Finder**: Identifies oversized files
- **Disk Space Monitor**: Alerts on low disk space
- **Dev Environment Cleanup**: Cleans node_modules, target, .git
- **Project Archive Analysis**: Analyzes archives for optimization
- **Startup Scan**: Quick scan on application launch
- **AI-Powered Analysis**: Deep scan + AI recommendations

## Development

### Prerequisites
- **Rust 1.95+** (required)
- **Windows 10/11 x64** (required)
- **.NET 10 SDK** (required for WinUI 3 GUI)
- **Visual Studio 2022 17.8+** with MSBuild (required for WinUI 3 XAML compilation)
- **NVIDIA GPU** (optional, for GPU acceleration)
- **Ollama** (optional, for AI chat features)

### Setup

```bash
# Clone repository
git clone https://github.com/ogneocortext/space-analyzer-pro.git
cd Space-Analyzer

# Build Rust workspace
cargo build
cargo test --workspace
```

### Build Commands

```bash
# Build egui GUI (legacy)
cargo build --release -p space-analyzer-gui-egui

# Build WinUI 3 GUI (active)
# Requires Visual Studio MSBuild:
& "D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64

# Build Rust CLI
cargo build --bin space-analyzer-cli

# Enable CUDA (optional)
cargo build --features cuda -p gpu-compute
```

## Troubleshooting

### WMC9999 XAML Compiler Error
Use Visual Studio MSBuild instead of `dotnet build`. The WinUI 3 XAML compiler requires the full VS toolchain on non-English Windows.

### Build Errors
```bash
cargo clean && cargo build
```

### GPU Not Detected
```bash
# Verify NVIDIA driver
nvidia-smi
```

### Ollama Not Connecting
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags
```

## Version History

### [3.8.0] - 2026-08-01 - Scan Page Hardening & AI Assistant Expansion
- **Scan page enhancements** — Stop scan button, path validation, scan errors display, file type distribution chart, largest files with live filter, JSON export, deep/shallow/custom depth modes, scan speed metrics.
- **ScannerService** — added `StopScan()`, `ExportScanResultAsync()`, and process tracking (`_currentScannerProcess`) for cancellation support.
- **AI Assistant** — expanded tool registry from 3 to 14 tools, dynamic `ResolveToolChoice()`, enriched `ChatRequest` with `Options`/`Think`/`KeepAlive` fields.
- **Converters** — added `BoolToErrorBrushConverter` and `BoolToScanButtonTextConverter`.
- **New model** — `FileTypeDistribution` for the scan page file type chart.
- **New helper** — `UiHelper.OpenPath()` for opening files/folders in Explorer.

### [3.7.0] - 2026-07-31 - WinUI 3 Stabilization & Page Completion
- **Fixed build against Windows App SDK 2.3 / .NET 10**
- **Implemented Smart Search page** (file/folder search by name + size)
- **Implemented Workflows page** (stub with creation form)
- **Populated Dashboard stat cards** from scan history with 3-second live system resource refresh
- **Refactored Helpers/**, ViewModels/, Services/, Models/ for clean MVVM separation
- **Added OllamaClient.cs** for local AI chat integration
- Created `Helpers/Converters.cs` with reusable visibility converters
- Fixed WinUI 3 API compatibility issues (`Window.RequestedTheme`, `Colors` class, `ApplicationData`)
- All WinUI 3 pages now have complete XAML + ViewModel + navigation

### [3.6.0] - 2026-05-29 - AI Recommendations & Architectural Fixes
- **Consolidated to Rust core** with dual GUI frontends (egui legacy + WinUI 3 active)
- **Embedded SQLite database** for scan history persistence
- **Optional Ollama AI integration** - fully local, no cloud
- **Native Rust workflow orchestration** - replaced Python orchestrator
- **System monitoring** - CPU, memory, disk, GPU status
- **Archived experimental GUIs** - native-gui, rust-tauri moved to archive/
- **Archived Python orchestrator** - replaced by Rust-native workflows

### [3.5.0] - 2026-05-15 - GPU Acceleration
- GPU-accelerated Rust engine with CUDA + CPU fallback
- Two-phase scan architecture
- GPU-accelerated file deduplication and ML training

### [3.0.0] - 2026-05-14 - CUDA Vision Analysis
- CUDA GPU-accelerated vision analysis pipeline
- Improved GUI macro for screenshot capture

### [2.14.0] - Major repository streamlining, 70% duplicate code removal

---

**Space Analyzer Pro v3.7.0** — Native Windows desktop app with dual GUI frontends (WinUI 3 active, egui preserved for comparison)

└── tools/                        # Development tools
```

### Important: Active vs Archived

**Active (develop here):**
- `src/` - The primary application. All new features go here.
- `src/gui/` - The active GUI (v3.3.0 modular). Binary entry point.
- `shared-scanner/` - Core scanning library
- `gpu-compute/` - GPU acceleration layer
- `native/` - Standalone tools

**Archived (reference only, DO NOT develop here):**
- `archive/v3.2.0-monolithic/` - Legacy monolithic GUI superseded by `src/gui/`
- `archive/legacy-modules/` - Dead modules removed from active code
- `archive/vue-frontend/` - Vue.js frontend from pre-v3.0
- `archive/native-gui/` - Experimental egui GUI superseded by `src/gui/`
- `archive/rust-tauri/` - Failed Tauri desktop build
- `archive/python-orchestrator/` - Python orchestrator replaced by Rust-native workflows

## Features

### Desktop GUI
- **Directory Analysis**: Scan any folder with real-time progress
- **Visual Charts**: File type distribution with bar charts
- **Largest Files**: Identify space-consuming files
- **Export Results**: Save analysis to JSON
- **Deep Scan Mode**: Thorough directory traversal
- **Scan History**: Persistent history via embedded SQLite
- **AI Recommendations**: Rule-based insights from scan data
- **Workflow Automation**: Preconfigured and custom workflows
- **System Monitor**: CPU, memory, disk, and GPU status
- **GPU Status Dashboard**: See acceleration status at a glance

### AI Assistant (Optional)
- **Local Ollama Integration**: Chat with your disk data
- **No Cloud Required**: All processing stays on your machine
- **Context-Aware**: AI has access to scan results
- **Natural Language Queries**: "What's taking up the most space?"
- **Cleanup Recommendations**: AI-powered suggestions

### Automation Workflows
- **Weekly Cleanup**: Scheduled scan + duplicate detection
- **Large Files Finder**: Identifies oversized files
- **Disk Space Monitor**: Alerts on low disk space
- **Dev Environment Cleanup**: Cleans node_modules, target, .git
- **Project Archive Analysis**: Analyzes archives for optimization
- **Startup Scan**: Quick scan on application launch
- **AI-Powered Analysis**: Deep scan + AI recommendations

## Development

### Prerequisites
- **Rust 1.70+** (required)
- **NVIDIA GPU** (optional, for GPU acceleration)
- **Ollama** (optional, for AI chat features)

### Setup
```bash
git clone <repository-url>
cd Space-Analyzer
cargo build
```

### Development Commands
```bash
# Run GUI
cargo run --bin space-analyzer-gui

# Run CLI
cargo run --bin space-analyzer-cli -- --path . --verbose

# Run tests
cargo test

# Check code
cargo clippy
cargo fmt
```

### Enable Native CUDA (Optional)
```bash
cargo build --features cuda -p gpu-compute
```

### Local AI (Ollama) Setup (Optional)
```bash
# Install Ollama from https://ollama.com
# Pull a model (optional - app auto-detects installed models)
ollama pull phi4-mini

# The app will auto-detect Ollama at http://localhost:11434
# Configure in Settings > AI Settings
```

## Troubleshooting

### Build Errors
```bash
cargo clean && cargo build
```

### GPU Not Detected
```bash
# Verify NVIDIA driver
nvidia-smi
```

### Ollama Not Connecting
```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags
```

## Version History

### [3.2.0] - 2026-05-29 - AI Recommendations & Architectural Fixes
- **Consolidated to single Rust binary** - no external services required
- **Embedded SQLite database** for scan history persistence
- **Optional Ollama AI integration** - fully local, no cloud
- **Native Rust workflow orchestration** - replaced Python orchestrator
- **System monitoring** - CPU, memory, disk, GPU status
- **Archived experimental GUIs** - native-gui, rust-tauri moved to archive/
- **Archived Python orchestrator** - replaced by Rust-native workflows

### [3.1.0] - 2026-05-15 - GPU Acceleration
- GPU-accelerated Rust engine with CUDA + CPU fallback
- Two-phase scan architecture
- GPU-accelerated file deduplication and ML training

### [3.0.0] - 2026-05-14 - CUDA Vision Analysis
- CUDA GPU-accelerated vision analysis pipeline
- Improved GUI macro for screenshot capture

### [2.14.0] - Major repository streamlining, 70% duplicate code removal

---

**Space Analyzer Pro v3.7.0** - Self-Contained, GPU-Accelerated, AI-Ready

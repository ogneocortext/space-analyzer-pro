# Space Analyzer Pro

A powerful, self-contained disk space analysis tool with embedded database, GPU acceleration, and optional local AI - all in a single binary. No backend servers, no external dependencies required.

## Quick Start

### Desktop Application (Primary Interface)
```bash
# Build and run the GUI
cargo run --bin space-analyzer-gui

# Or build for release
cargo build --release --bin space-analyzer-gui
./target/release/space-analyzer-gui
```

### Command Line Interface
```bash
# Basic scan
cargo run --bin space-analyzer-pro -- --path . --verbose

# Export results
cargo run --bin space-analyzer-pro -- --path . --export results.json

# Deep scan
cargo run --bin space-analyzer-pro -- --path . --deep
```

## Architecture: Self-Contained

Space Analyzer Pro is designed as a **single binary application** that requires zero external services:

| Component | Implementation | Required? |
|-----------|---------------|-----------|
| **GUI** | egui/eframe (native Rust) | Yes |
| **Database** | SQLite (embedded via rusqlite) | Yes |
| **File Scanner** | WalkDir + GPU post-processing | Yes |
| **AI Assistant** | Ollama (optional, local) | No |
| **Workflows** | Rust-native orchestration | Yes |
| **System Monitor** | sysinfo crate | Yes |

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
├── src/                          # PRIMARY APPLICATION
│   ├── gui.rs                    # Main GUI (egui) - the active desktop app
│   ├── main.rs                   # CLI binary
│   ├── gui_common.rs             # Shared types and scanning utilities
│   ├── database.rs               # Embedded SQLite persistence
│   ├── ollama_client.rs          # Optional Ollama AI integration
│   ├── system_monitor.rs         # Disk/CPU/memory/GPU monitoring
│   ├── ai_skills.rs              # AI analysis skills
│   └── workflows/mod.rs          # Native workflow orchestration
├── shared-scanner/               # Shared scanner library
├── gpu-compute/                  # GPU acceleration layer
├── native/                       # Standalone native tools
│   ├── scanner/                  # High-performance file scanner
│   ├── file_deduplicator/        # GPU-accelerated duplicate finder
│   ├── storage_predictor/        # Storage prediction (GPU-accelerated)
│   └── file_monitor/             # File system monitoring
├── server/                       # Node.js backend (optional, for web mode)
├── ai-service/                   # Python AI service (optional, for web mode)
├── archive/                      # Archived/experimental components
│   ├── vue-frontend/             # Archived Vue.js frontend
│   ├── native-gui/               # Archived experimental egui GUI
│   ├── rust-tauri/               # Archived failed Tauri build
│   └── python-orchestrator/      # Archived Python orchestrator
└── tools/                        # Development tools
```

### Important: Active vs Archived

**Active (develop here):**
- `src/` - The primary application. All new features go here.
- `shared-scanner/` - Core scanning library
- `gpu-compute/` - GPU acceleration layer
- `native/` - Standalone tools

**Archived (reference only, DO NOT develop here):**
- `archive/vue-frontend/` - Vue.js frontend from pre-v3.0. Archived for reference.
- `archive/native-gui/` - Experimental egui GUI superseded by `src/gui.rs`
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
cargo run --bin space-analyzer-pro -- --path . --verbose

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

### [3.2.0] - 2026-05-16 - Self-Contained Architecture
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

**Space Analyzer Pro v3.2.0** - Self-Contained, GPU-Accelerated, AI-Ready

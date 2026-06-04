# Space Analyzer Pro

A powerful, self-contained disk space analysis tool with embedded database, GPU acceleration, and optional local AI - all in a single binary. No backend servers, no external dependencies required.

## Quick Start

```bash
# Build and run the GUI
cargo run --bin space-analyzer-gui

# Or build for release
cargo build --release --bin space-analyzer-gui
./target/release/space-analyzer-gui
```

## Command Line Interface

```bash
# Basic scan
cargo run --bin space-analyzer-pro -- --path . --verbose

# Export results
cargo run --bin space-analyzer-pro -- --path . --export results.json

# Deep scan
cargo run --bin space-analyzer-pro -- --path . --deep
```

## Architecture

| Component | Implementation | Required? |
|-----------|---------------|-----------|
| **GUI** | egui/eframe (native Rust) | Yes |
| **Database** | SQLite (embedded via rusqlite) | Yes |
| **File Scanner** | WalkDir + GPU post-processing | Yes |
| **AI Assistant** | Ollama (optional, local) | No |
| **Workflows** | Rust-native orchestration | Yes |
| **System Monitor** | sysinfo crate | Yes |

## Features

- **Directory Analysis**: Scan any folder with real-time progress
- **Visual Charts**: File type distribution with bar charts
- **GPU Acceleration**: Automatic NVIDIA GPU detection (optional)
- **AI Assistant**: Local Ollama integration, no cloud required
- **Scan History**: Persistent history via embedded SQLite
- **Workflow Automation**: Preconfigured and custom workflows
- **System Monitor**: CPU, memory, disk, and GPU status
- **Duplicate Finder**: GPU-accelerated file deduplication

## Development

### Prerequisites
- **Rust 1.70+** (required)
- **NVIDIA GPU** (optional, for GPU acceleration)
- **Ollama** (optional, for AI chat features)

### Commands
```bash
just help            # Show all available commands
just build           # Build workspace
just test            # Run tests
just verify          # Format check + clippy + tests
just run-gui         # Start the GUI
just run-cli         # Run the CLI scanner
```

## Project Structure

```
src/                    # Rust application source
  gui/                  # egui desktop GUI
  ollama/               # Ollama LLM client
  database/             # SQLite database layer
  workflows/            # Analysis workflow engine
native/                 # Rust native modules
  scanner/              # File system scanner
  file_deduplicator/    # Duplicate file finder
  node_modules_cleaner/ # Node.js cleanup tool
shared-scanner/         # Shared scanning logic crate
gpu-compute/            # GPU-accelerated compute crate
docs/                   # Documentation
```

## Documentation

- [Full README](docs/README.md) - Comprehensive project documentation
- [Architecture](docs/architecture/) - Design decisions and patterns
- [Development Guide](docs/development/) - Setup and workflow
- [AI Integration](docs/ai/) - Ollama setup and usage
- [Contributing](CONTRIBUTING.md) - How to contribute

## Version

**v3.3.0** - Self-Contained, GPU-Accelerated, AI-Ready Desktop Application

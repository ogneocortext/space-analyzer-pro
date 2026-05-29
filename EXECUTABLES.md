# Space Analyzer Pro - Executables Documentation

## Overview

This project produces two main executables with distinct purposes:

## Executables

### 1. space-analyzer-cli
- **Path**: `src/main.rs`
- **Purpose**: Command-line interface for space analysis
- **Features**:
  - Directory scanning with configurable depth
  - Multiple output formats (text, JSON, CSV)
  - Export results to file
  - ML categorization support
  - Deep scan mode
- **Usage**: `cargo run --bin space-analyzer-cli -- [options]`
- **Output**: `target/debug/space-analyzer-cli.exe` (debug) or `target/release/space-analyzer-cli.exe` (release)

### 2. space-analyzer-gui
- **Path**: `src/gui.rs`
- **Purpose**: Full-featured GUI application with AI integration
- **Features**:
  - Interactive file scanning visualization
  - Embedded SQLite database for persistence
  - AI-powered insights via Ollama (local, no cloud)
  - Workflow orchestration (ai_skills, workflows modules)
  - System monitoring (disk, CPU, memory, GPU)
  - GPU-accelerated scanning
  - Scan history and reporting
- **Usage**: `cargo run --bin space-analyzer-gui`
- **Output**: `target/debug/space-analyzer-gui.exe` (debug) or `target/release/space-analyzer-gui.exe` (release)

## Building

### Debug Build
```bash
cargo build --bin space-analyzer-cli
cargo build --bin space-analyzer-gui
```

### Release Build
```bash
cargo build --release --bin space-analyzer-cli
cargo build --release --bin space-analyzer-gui
```

### Build All
```bash
cargo build --release
```

## Module Organization

- **src/main.rs**: CLI entry point (minimal dependencies)
- **src/gui.rs**: GUI entry point (full feature set)
- **src/ai_skills.rs**: AI-powered analysis features (used by GUI)
- **src/workflows/mod.rs**: Workflow orchestration (used by GUI)
- **src/database.rs**: SQLite persistence (used by GUI)
- **src/ollama_client.rs**: Ollama AI client (used by GUI)
- **src/system_monitor.rs**: System resource monitoring (used by GUI)

## Notes

- The CLI is a lightweight tool for quick scans and automation
- The GUI is the primary application with all features
- AI features (ai_skills, workflows) are only available in the GUI
- Both executables share the core scanning library (shared-scanner)

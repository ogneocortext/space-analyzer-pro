# Space Analyzer Pro - Executables Documentation

## Overview

This project produces two main executables with distinct purposes:

## Executables

### 1. space-analyzer-pro (CLI)
- **Source**: `src/main.rs`
- **Purpose**: Command-line interface for space analysis
- **Features**:
  - Directory scanning with configurable depth
  - Multiple output formats (text, JSON, CSV)
  - `--report`: Generate Markdown analysis report
  - `--clean`: Find and manage duplicate files
  - Deep scan mode
- **Usage**: `cargo run --bin space-analyzer-pro -- [options]`
- **Output**: `target/debug/space-analyzer-pro.exe` (debug) or `target/release/space-analyzer-pro.exe` (release)

### 2. space-analyzer-gui
- **Source**: `src/bin/space-analyzer-gui.rs` (thin wrapper calling `gui::run_gui()`)
- **Purpose**: Full-featured GUI application with AI integration
- **Features**:
  - Interactive file scanning visualization (egui)
  - Embedded SQLite database for persistence
  - AI-powered insights via Ollama (local, no cloud)
  - Workflow orchestration and automation
  - System monitoring (disk, CPU, memory, GPU)
  - GPU-accelerated scanning and deduplication
  - Semantic file search via embeddings
  - Scan history and reporting
  - Heuristic + AI-powered storage recommendations
- **Usage**: `cargo run --bin space-analyzer-gui`
- **Output**: `target/debug/space-analyzer-gui.exe` (debug) or `target/release/space-analyzer-gui.exe` (release)

## Building

### Debug Build
```bash
cargo build --bin space-analyzer-pro
cargo build --bin space-analyzer-gui
```

### Release Build
```bash
cargo build --release --bin space-analyzer-pro
cargo build --release --bin space-analyzer-gui
```

### Build All
```bash
cargo build --release
```

## Module Organization (GUI)

The GUI is organized as a library crate with a thin binary wrapper:

- **src/bin/space-analyzer-gui.rs**: Binary entry point (3 lines) — calls `gui::run_gui()`
- **src/gui/mod.rs**: Main GUI module — `SpaceAnalyzerApp` struct, tab dispatch, `run_gui()`
- **src/gui/scan.rs**: File scanning logic and progress tracking
- **src/gui/dashboard.rs**: Dashboard UI with storage chart and insights
- **src/gui/settings.rs**: Settings panel with database persistence
- **src/gui/workflow_render.rs**: Workflow editor, execution, and AI recommendations
- **src/gui/dedup.rs**: File deduplication UI
- **src/gui/embeddings.rs**: Semantic file search and embedding index
- **src/gui/history.rs**: Scan history viewer
- **src/gui/system.rs**: System resource monitoring display
- **src/gui/ai/chat.rs**: Ollama chat and tool calling
- **src/gui/ai/rendering.rs**: Chat bubble rendering
- **src/gui/ai/quick_actions.rs**: One-click AI actions
- **src/gui/ai/model_discovery.rs**: Ollama model listing and selection
- **src/gui/ai/ollama.rs**: Ollama process management

### External Modules (crate-level)
- **src/database/mod.rs**: SQLite persistence layer
- **src/ollama/mod.rs**: Ollama API client
- **src/tool_registry/mod.rs**: Tool calling registry
- **src/workflows/mod.rs**: Workflow definitions and execution
- **src/embedding_service.rs**: Embedding API for semantic search
- **src/gui_common.rs**: Shared types (`ScanResult`, `formatting`)
- **src/system_monitor.rs**: System resource monitoring
- **src/session_logger.rs**: Session activity logging
- **src/utils.rs**: Utility functions

## Notes

- The CLI is a lightweight tool for quick scans and automation
- The GUI is the primary application with all features
- Both executables share the core scanning library (`shared-scanner`)

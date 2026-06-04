# Development Guide

This document provides guidelines for developing the Space Analyzer Pro desktop application.

## Prerequisites

- **Rust 1.70+** (required)
- **Git** for version control
- **NVIDIA GPU** (optional) - for GPU acceleration
- **Ollama** (optional) - for AI chat features

### Installing Rust

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add required components
rustup component add rustfmt clippy
```

## Project Structure

```
src/                    # Rust application source
  gui/                  # egui desktop GUI
    ai/                 # AI chat interface
    dashboard.rs        # Main dashboard
    scan.rs             # Scan configuration UI
    history.rs          # Scan history
    settings.rs         # App settings
    system.rs           # System monitor
    dedup.rs            # Duplicate finder UI
    embeddings.rs       # Semantic search UI
    workflow_render.rs  # Workflow visualization
  ollama/               # Ollama LLM client
  database/             # SQLite database layer
  workflows/            # Analysis workflow engine
  bin/                  # Binary entry points
  main.rs               # CLI entry point
  lib.rs                # Library root

native/                 # Rust native modules
  scanner/              # File system scanner
  file_deduplicator/    # Duplicate file finder
  node_modules_cleaner/ # Node.js cleanup tool

shared-scanner/         # Shared scanning logic crate
gpu-compute/            # GPU-accelerated compute crate

tests/unit/             # Rust unit tests
docs/                   # Documentation
scripts/                # Development scripts
config/                 # Tool configuration
```

## Development Commands

### Building

```bash
# Build all workspace members
cargo build --workspace

# Build for release
cargo build --workspace --release

# Build specific binary
cargo build --bin space-analyzer-gui
cargo build --bin space-analyzer
```

### Running

```bash
# Run the GUI
cargo run --bin space-analyzer-gui

# Run the CLI
cargo run --bin space-analyzer -- --path . --verbose

# Run CLI with export
cargo run --bin space-analyzer -- --path . --export results.json
```

### Testing

```bash
# Run all tests
cargo test --workspace

# Run with output
cargo test --workspace -- --nocapture

# Run specific test
cargo test test_name

# Run tests for specific crate
cargo test -p shared-scanner
```

### Code Quality

```bash
# Format code
cargo fmt --all

# Check formatting
cargo fmt --all -- --check

# Run Clippy lints
cargo clippy --all-targets --all-features -- -D warnings

# Verify everything (recommended after every change)
just verify
```

### Using just (Task Runner)

```bash
just help            # Show all available commands
just build           # Build workspace
just test            # Run tests
just fmt             # Format code
just clippy          # Run lints
just verify          # Format check + clippy + tests
just run-gui         # Start the GUI
just run-cli         # Run the CLI scanner
just clean           # Remove build artifacts
just setup           # Setup Rust toolchain
```

## Architecture

### Core Components

| Component | Implementation | Location |
|-----------|---------------|----------|
| **GUI** | egui/eframe (native Rust) | `src/gui/` |
| **CLI** | clap argument parsing | `src/bin/` |
| **Database** | SQLite via rusqlite | `src/database/` |
| **AI Client** | Ollama HTTP client | `src/ollama/` |
| **File Scanner** | WalkDir + GPU post-processing | `native/scanner/` |
| **GPU Compute** | Optional CUDA via cudarc | `gpu-compute/` |
| **Workflows** | Rust-native orchestration | `src/workflows/` |
| **System Monitor** | sysinfo crate | `src/system_monitor.rs` |

### Data Flow

1. **User** interacts with GUI or CLI
2. **Scanner** traverses file system using WalkDir
3. **GPU Compute** accelerates post-processing (optional)
4. **Database** stores scan results in embedded SQLite
5. **Workflows** analyze data and generate recommendations
6. **AI Client** provides natural language insights via Ollama (optional)

### Adding a New Feature

1. **Identify the right crate**:
   - `src/` for application code
   - `native/` for standalone modules
   - `shared-scanner/` for shared scanning logic
   - `gpu-compute/` for GPU-accelerated operations

2. **Follow existing patterns**:
   - Check neighboring files for conventions
   - Use `thiserror` for error types
   - Use `anyhow` for application-level error handling
   - Document public items with `///` doc comments

3. **Add tests** in `tests/unit/`:
   - Test both success and error cases
   - Use descriptive test names
   - Follow existing test patterns

4. **Update documentation** in `docs/` if behavior changes

### Common Patterns

#### Error Handling

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ScanError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },
}

// In application code, use anyhow for flexibility
use anyhow::Result;

fn scan_directory(path: &Path) -> Result<ScanResults> {
    // ...
}
```

#### Module Organization

```rust
// src/lib.rs - declare all public modules
pub mod database;
pub mod gui;
pub mod ollama;
pub mod workflows;
// ...
```

#### Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_empty_directory() {
        let temp_dir = create_temp_dir();
        let results = scan_directory(&temp_dir).unwrap();
        assert_eq!(results.file_count, 0);
    }
}
```

## GPU Acceleration

### Automatic Detection

GPU acceleration is automatically detected via `nvidia-smi`. No CUDA toolkit installation required.

### GPU-Accelerated Operations

| Operation | GPU Method | CPU Fallback |
|-----------|-----------|--------------|
| File post-processing | CUDA kernels | rayon parallel |
| BLAKE3 batch hashing | CUDA parallel | rayon parallel |
| ML predictions | CUDA matrix ops | ndarray + rayon |

### Enabling Native CUDA

```bash
# Build with CUDA support
cargo build --features cuda -p gpu-compute
```

## AI Integration (Optional)

### Ollama Setup

```bash
# Install Ollama from https://ollama.com
# Pull a model (optional - app auto-detects installed models)
ollama pull phi4-mini

# The app auto-detects Ollama at http://localhost:11434
# Configure in Settings > AI Settings
```

### Using AI Features

- **Chat**: Ask questions about your disk usage
- **Recommendations**: Get cleanup suggestions
- **Natural Language**: "What's taking up the most space?"
- **Context-Aware**: AI has access to scan results

## Troubleshooting

### Build Errors

```bash
cargo clean && cargo build --workspace
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

### Test Failures

```bash
# Run with verbose output
cargo test --workspace -- --nocapture

# Run specific failing test
cargo test test_name -- --nocapture
```

## Performance Tips

- Use `--release` flag for benchmarks
- GPU acceleration is automatic when NVIDIA GPU is detected
- rayon parallelism is used as CPU fallback
- SQLite queries are optimized for scan history

## Further Reading

- [Architecture Documentation](../architecture/)
- [AI Integration Guide](../ai/)
- [Contributing Guidelines](../../CONTRIBUTING.md)

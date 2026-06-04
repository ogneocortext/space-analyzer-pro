# Space Analyzer Pro - Agent Guide

This document helps coding agents (AI assistants, linters, IDE tools) understand the project structure and conventions.

## Quick Start for AI Agents

```bash
# 1. Ensure Rust toolchain is installed
rustup component add rustfmt clippy

# 2. Build the workspace
cargo build --workspace

# 3. Verify everything works (run after every change)
just verify
```

All available commands: `just help`

## Project Overview

Space Analyzer Pro is a **native Windows desktop application** built in Rust:
- **GUI**: egui/eframe native desktop GUI (in `src/gui/`)
- **CLI**: Command-line scanner interface (in `src/bin/`)
- **AI Integration**: Local Ollama LLM client (in `src/ollama/`)
- **Database**: Embedded SQLite via rusqlite (in `src/database/`)
- **Scanning**: File system scanner with GPU acceleration (in `native/`, `shared-scanner/`, `gpu-compute/`)
- **GPU Compute**: Optional CUDA kernels for parallel processing (in `gpu-compute/`)

## Directory Structure

```
├── src/                    # Rust application source
│   ├── gui/               # egui desktop GUI
│   │   ├── ai/            # AI chat interface
│   │   ├── dashboard.rs   # Main dashboard
│   │   ├── scan.rs        # Scan configuration UI
│   │   ├── history.rs     # Scan history
│   │   ├── settings.rs    # App settings
│   │   ├── system.rs      # System monitor
│   │   ├── dedup.rs       # Duplicate finder UI
│   │   ├── embeddings.rs  # Semantic search UI
│   │   └── workflow_render.rs # Workflow visualization
│   ├── ollama/            # Ollama LLM client
│   ├── database/          # SQLite database layer
│   ├── workflows/         # Analysis workflow engine
│   ├── bin/               # Binary entry points
│   ├── main.rs            # CLI entry point
│   └── lib.rs             # Library root
│
├── native/                # Rust native modules
│   ├── scanner/           # File system scanner
│   ├── file_deduplicator/ # Duplicate file finder
│   └── node_modules_cleaner/ # Node.js cleanup tool
│
├── shared-scanner/        # Shared scanning logic crate
├── gpu-compute/           # GPU-accelerated compute crate
│
├── scripts/               # Python utility scripts (justfile = main entry point)
│   ├── test/              # GUI testing (Win32 API)
│   ├── debug/             # Native binary testing
│   └── utility/           # Ollama benchmarks, analysis, vision tools
│
├── tests/                 # Test files
│   └── unit/              # Rust unit tests
│
├── config/                # Tool configuration
│   ├── secrets/           # Secrets (gitignored, NOT tracked)
│   └── .editorconfig      # Editor formatting
│
├── docs/                  # Documentation
│   ├── architecture/      # Architecture docs
│   ├── development/       # Developer guides
│   ├── guides/            # User guides
│   ├── ai/                # AI/Ollama docs
│   └── implementations/   # Implementation notes
│
├── assets/                # Static assets (images, screenshots)
├── Cargo.toml             # Rust workspace root
├── Cargo.lock             # Dependency lock file
├── justfile               # Task runner commands
├── clippy.toml            # Clippy configuration
├── rustfmt.toml           # Rust formatting config
└── rust-toolchain.toml    # Pinned Rust toolchain
```

## Key Conventions

### Rust

- **Workspace root**: `Cargo.toml` with shared `[workspace.dependencies]`
- **Member crates**: `shared-scanner/`, `gpu-compute/`, `native/scanner/`, `native/file_deduplicator/`, `native/node_modules_cleaner/`
- **Format**: `cargo fmt --all`
- **Lint**: `cargo clippy --all-targets --all-features -- -D warnings`
- **Build**: `cargo build --workspace`
- **Test**: `cargo test --workspace`
- **Verify**: `just verify` (format check + clippy + tests)

### Code Style

- Use `rustfmt` defaults (configured in `rustfmt.toml`)
- Follow existing patterns in neighboring files
- Use `thiserror` for error types
- Use `anyhow` for application-level error handling
- Document public items with `///` doc comments

### Configuration Hierarchy

1. **Code defaults** → in source files
2. **Config files** → `config/` directory
3. **Environment variables** → runtime config
4. **Secrets** → `config/secrets/` (gitignored, NEVER commit)

### Test Organization

- **Rust unit tests**: `tests/unit/*.rs`
- **Rust integration tests**: `tests/integration/` (when added)
- **Test command**: `cargo test --workspace`
- **Results**: `target/` (gitignored)

### Security Rules

**NEVER commit:**
- `config/secrets/` (all files)
- `.env` files
- API keys, tokens, or credentials
- Database files with sensitive data

**ALWAYS add to .gitignore before creating:**
- New secret files
- Local configuration overrides
- Build artifacts in new directories

## Common Tasks for Agents

### Adding a new feature
1. Identify the right crate: `src/` for app code, `native/` for standalone modules, `shared-scanner/` for shared logic
2. Follow existing patterns in that crate
3. Add tests in `tests/unit/`
4. Update docs in `docs/` if behavior changes

### Fixing a bug
1. Check `docs/ISSUES.md` for known issues
2. Look for related test files in `tests/unit/`
3. Fix in source, add regression test
4. Update docs if behavior changes

### Refactoring
1. Keep directory structure intact
2. Update imports/paths in moved files
3. Update `.gitignore` if adding artifact directories
4. Update this `AGENTS.md` if structure changes

## Important Notes

- **This is a Rust desktop app** - no web server, no Node.js, no Python
- **Do NOT modify files in `archive/`** - it's historical reference only
- **Do NOT delete `docs/`** without explicit permission
- **Always run tests** after structural changes: `just verify`
- **Check `.gitignore`** before adding new directories with generated files
- **Preserve git history** - use `git mv` for renames when possible
- **Follow existing code style** - Rust uses rustfmt + clippy

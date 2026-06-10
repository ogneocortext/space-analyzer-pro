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

> The Python utility scripts under `scripts/` require a dedicated
> PyTorch+CUDA environment at `D:\conda-envs\space-analyzer-cuda\python.exe`.
> See **[docs/development/PYTHON_ENV_SETUP.md](docs/development/PYTHON_ENV_SETUP.md)**
> before running any script that requires GPU vision analysis.

## Project Overview

Space Analyzer Pro is a **native Windows desktop application** built in Rust:
- **GUI**: egui/eframe native desktop GUI (in `src/gui/`)
- **CLI**: Command-line scanner interface (in `src/main.rs` and `src/bin/`)
- **AI Integration**: Local Ollama LLM client (in `src/ollama/`)
- **Database**: Embedded SQLite via rusqlite (in `src/database/`)
- **Scanning**: File system scanner with GPU acceleration (in `native/`, `shared-scanner/`, `gpu-compute/`)
- **GPU Compute**: Optional CUDA kernels for parallel processing (in `gpu-compute/`)

## Directory Structure

```
├── src/                    # Rust application source
│   ├── bin/                # Binary entry points
│   │   ├── space-analyzer-gui.rs  # GUI binary
│   │   ├── space-analyzer-pro.rs  # CLI binary (alias)
│   │   ├── ollama-test.rs         # Ollama testing binary
│   │   └── flow-test-harness.rs   # Integration test binary
│   ├── gui/               # egui desktop GUI (8 tabs)
│   │   ├── ai/            # AI chat interface
│   │   ├── dashboard.rs   # Main dashboard
│   │   ├── scan.rs        # Scan configuration UI
│   │   ├── history.rs     # Scan history
│   │   ├── settings.rs    # App settings
│   │   ├── system.rs      # System monitor
│   │   ├── dedup.rs       # Duplicate finder UI
│   │   ├── embeddings.rs  # Semantic search UI
│   │   └── workflow_render.rs # Workflow visualization
│   ├── ollama/            # Ollama LLM client (chat, embeddings, tools)
│   ├── database/          # SQLite layer (scans, embeddings, workflows, settings)
│   ├── workflows/         # Analysis workflow engine
│   ├── tool_registry/     # LLM tool registry (12+ callable tools)
│   ├── category.rs        # File extension → category mapping
│   ├── offline_ai.rs      # Heuristic bloat detection
│   ├── file_relations.rs  # Dependency report preview
│   ├── system_monitor.rs  # CPU/RAM/GPU/disk monitoring
│   ├── embedding_service.rs # Semantic search
│   ├── session_logger.rs  # Diagnostic logging
│   ├── thumbnails.rs      # Image preview cache
│   ├── utils.rs           # Shared utilities
│   └── lib.rs             # Library root
│
├── native/                # Standalone Rust binaries (not workspace members)
│   ├── scanner/           # Windows NTFS scanner (USN Journal, MFT, hardlinks)
│   ├── file_deduplicator/ # GPU-accelerated duplicate finder
│   └── node_modules_cleaner/ # Node.js cleanup tool
│
├── shared-scanner/        # Shared scanning logic (workspace member)
├── gpu-compute/           # GPU-accelerated compute (workspace member)
│
├── ux-pipeline/           # Standalone Python UX pipeline package
│   ├── src/ux_pipeline/   # Main package modules
│   ├── tests/             # Python tests (pytest)
│   ├── pyproject.toml     # Package config
│   └── README.md          # Package documentation
│
├── scripts/               # Python utility scripts
│   ├── test/              # GUI testing (Win32 API)
│   ├── debug/             # Native binary testing
│   ├── utility/           # Ollama tools, screenshot analysis
│   └── temporary/         # One-shot patches, test scripts (archived)
│
├── tests/                 # Test files
│   └── unit/              # Rust unit tests
│
├── config/                # Tool configuration
│   └── secrets/           # Secrets (gitignored, NOT tracked)
│
├── docs/                  # Documentation
│   ├── architecture/      # Design decisions, diagrams
│   ├── development/       # Setup, testing, migration guides
│   ├── guides/            # User guides
│   ├── ai/                # Ollama setup, ML integration
│   └── implementations/   # Security, localhost tools
│
├── assets/                # Visual assets (icons, screenshots)
├── Cargo.toml             # Rust workspace root
├── Cargo.lock             # Dependency lock file
├── justfile               # Task runner commands
├── clippy.toml            # Clippy configuration
├── rustfmt.toml           # Rust formatting config
└── rust-toolchain.toml    # Pinned Rust toolchain
```

## File Lookup Quick Reference

Looking for something specific? Use these paths:

| Purpose | Primary File(s) |
|---------|-----------------|
| GUI Structure | `src/gui/mod.rs` - main app struct with 60+ state fields |
| Scan Logic | `shared-scanner/src/lib.rs` - `scan_directory_sync()`, `format_bytes()` |
| GPU Compute | `gpu-compute/src/scan.rs` - `GpuScanProcessor` |
| Database Schema | `src/database/mod.rs` - tables for scans/embeddings/workflows |
| AI Chat | `src/gui/ai/chat.rs` + `src/ollama/client/chat.rs` |
| Issue Tracker | `docs/issues.json` (source) + `src/flow_test/` (embedded) |
| Ollama Client | `src/ollama/client/` - HTTP client implementation |
| UI Components | `src/gui/ui_helpers.rs` - reusable card, gauge, badge helpers |
| Date Formatting | `src/gui/mod.rs` - `SpaceAnalyzerApp::format_timestamp()` |
| Category Labels | `src/category.rs` - `CATEGORIES` hashmap (12 categories) |
| Tool Registry | `src/tool_registry/` - `ToolRegistry`, `ToolCall` types |
| Workflow Engine | `src/workflows/mod.rs` - `Workflow`, `WorkflowTemplates` |

## Issue Tracker

All known issues are tracked in **`docs/issues.json`** (JSON, schema v1).
Do NOT use the old `docs/CONSOLIDATED_ISSUE_TRACKER.csv` — it is a legacy export only.

### Quick lookup (run these first when user says "fix issues")

```bash
# List all open issues
python docs/export_issues_to_csv.py --filter open

# List open issues by category
python docs/export_issues_to_csv.py --filter open --category architecture
python docs/export_issues_to_csv.py --filter open --category performance
python docs/export_issues_to_csv.py --filter open --category "code-quality"
python docs/export_issues_to_csv.py --filter open --category "error-handling"
python docs/export_issues_to_csv.py --filter open --category compatibility
python docs/export_issues_to_csv.py --filter open --category "build-&-deployment"
python docs/export_issues_to_csv.py --filter open --category functionality
```

### Issue ID format

IDs look like `mainissuetracker:34af6f76922f` (SHA-based, stable across runs).
Human-readable source IDs are in `tags` (e.g. `id:MAIN-021`).

### After fixing an issue

Update its status in `docs/issues.json`:
- `open` → `in_progress` when starting
- `in_progress` → `done` when fixed
- Update `last_seen` to today's date
- Add a resolution note in `extra.resolution`

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
1. Read `docs/issues.json` and filter for `open` issues in the relevant category
2. Use `python docs/export_issues_to_csv.py --filter open --category <category>` to see candidates
3. Match the issue by `issue_id` or `tags` (e.g. `id:MAIN-021`)
4. Fix in source, add regression test
5. Update the issue status in `docs/issues.json` and re-export CSV

### Refactoring
1. Keep directory structure intact
2. Update imports/paths in moved files
3. Update `.gitignore` if adding artifact directories
4. Update this `AGENTS.md` if structure changes

## Important Notes

- **This is a Rust desktop app** - no web server, no Node.js. The Python UX pipeline lives in `ux-pipeline/` (standalone, installable via `pip install -e ux-pipeline/`). Legacy utility scripts remain in `scripts/` and require a dedicated PyTorch+CUDA env.
- **Do NOT modify files in `archive/`** - it's historical reference only
- **Do NOT delete `docs/`** without explicit permission
- **Always run tests** after structural changes: `just verify`
- **Check `.gitignore`** before adding new directories with generated files
- **Preserve git history** - use `git mv` for renames when possible
- **Follow existing code style** - Rust uses rustfmt + clippy

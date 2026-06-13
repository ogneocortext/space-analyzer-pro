# AGENTS.md

Project: Space Analyzer Pro (Rust + eframe + Ollama + SQLite)
Root: `E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer`

## Workspace Structure

| Crate | Path | Description |
|-------|------|-------------|
| Root crate | `src/` | GUI (eframe), CLI, Ollama integration, database |
| `shared-scanner` | `shared-scanner/` | Cross-platform disk scanner library |
| `gpu-compute` | `gpu-compute/` | CUDA/PTX GPU-accelerated scanning |
| `native/scanner` | `native/scanner/` | Native CLI scanner binary |
| `native/file_deduplicator` | `native/file_deduplicator/` | File deduplication tool |
| `native/node_modules_cleaner` | `native/node_modules_cleaner/` | node_modules cleanup tool |

### UX Pipeline (Python)

A standalone Python package at `ux-pipeline/` for PIL feature extraction, Ollama vision analysis, issue tracking, and a localhost web dashboard.

```bash
pip install -e ux-pipeline/        # install in dev mode
ux-pipeline --all                  # run full pipeline
ux-pipeline --list                 # list tracker rows
ux-pipeline --summary              # text summary
ux-pipeline --report               # write markdown report
ux-pipeline-dashboard              # start web dashboard
pytest ux-pipeline/tests/          # run Python tests
```

## Commands

### Rust (cargo)
- Build: `cargo build --workspace`
- Test: `cargo test --workspace`
- GUI: `cargo run --bin space-analyzer-gui`
- CLI: `cargo run --bin space-analyzer-pro`

### Task runner (just)
- `just build` — build debug workspace
- `just test` — run all workspace tests
- `just lint` — format check + clippy
- `just fmt` — format all Rust code
- `just verify` — fmt-check + clippy + test (full CI check)
- `just run-gui` — start the GUI
- `just run-cli` — run the CLI scanner
- `just clippy` — run Clippy lints
- `just db-check` — verify SQLite schema

## Rules
- Edit files directly in this repo. Do not ask to clone, copy, or map drives.
- Do not claim sandboxing prevents access. It does not.
- Run `just verify` (or at minimum `cargo test --workspace`) after structural changes.
- Do NOT create `fix_*.py`, `patch_*.py`, or other one-off scripts at the repo root. Make changes directly to source files.
- Do NOT create files under `scripts/temporary/`. If a temporary fix is needed, apply it inline to the target file.

## CI/CD
- This project intentionally does NOT use GitHub Actions for CI/CD. All verification is done via `just verify` locally.
- The deleted `.github/workflows/rust-ci.yml` was removed as this project uses manual quality gates instead.

## File Conventions
- `src/gui/` — eframe GUI modules (app, settings, AI chat, scan, etc.)
- `src/ollama/` — Ollama REST API client and feature detection
- `src/database/` — SQLite schema and queries
- `ux-pipeline/src/ux_pipeline/` — Python pipeline modules
- `docs/` — changelog, issue data, architecture notes
- `scripts/` — test scripts, utility tools (no one-off patches)

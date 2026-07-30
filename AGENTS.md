# AGENTS.md

Project: Space Analyzer Pro
Root: `E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer`

Two GUI implementations exist side-by-side for comparison:

## Workspace Structure

### Core (Rust)
| Crate | Path | Description |
|-------|------|-------------|
| Root crate | `src/` | Core library: database, Ollama, system monitor, CLI |
| `shared-scanner` | `shared-scanner/` | Cross-platform disk scanner library |
| `gpu-compute` | `gpu-compute/` | CUDA/PTX GPU-accelerated scanning |
| `native/scanner` | `native/scanner/` | Native CLI scanner binary |
| `native/file_deduplicator` | `native/file_deduplicator/` | File deduplication tool |
| `native/node_modules_cleaner` | `native/node_modules_cleaner/` | node_modules cleanup tool |

### GUI — egui (Rust)
| Crate | Path | Description |
|-------|------|-------------|
| `space-analyzer-gui-egui` | `gui-egui/` | Desktop GUI built with eframe/egui |

### GUI — WinUI 3 (C# / .NET)
| Project | Path | Description |
|---------|------|-------------|
| `SpaceAnalyzer` | `gui-winui/` | Desktop GUI built with WinUI 3 + Windows App SDK 2.2 |

## Commands

### Rust (cargo)
- Build core: `cargo build --workspace`
- Test core: `cargo test --workspace`
- CLI: `cargo run --bin space-analyzer-pro`
- Build egui GUI: `cargo build -p space-analyzer-gui-egui`
- Run egui GUI: `cargo run -p space-analyzer-gui-egui`

### WinUI 3 (.NET)
- Build with VS MSBuild (required — `dotnet build` fails with WMC9999 XAML compiler error on non-English Windows):
  ```
  "D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64
  ```
- Run: `dotnet run --project gui-winui/SpaceAnalyzer`
- NOTE: WinUI 3 XAML compiler requires Visual Studio MSBuild (not just dotnet CLI). Use VS 2022+ Build Tools or full VS.
- Known issue: `dotnet msbuild` (Core runtime) triggers WMC9999 due to a resource name mismatch in `XamlCompiler.exe`. Full Visual Studio is unaffected.

### Task runner (just)
- `just build` — build debug workspace
- `just test` — run all workspace tests
- `just lint` — format check + clippy
- `just fmt` — format all Rust code
- `just verify` — fmt-check + clippy + test (full CI check)
- `just run-gui` — start the egui GUI
- `just run-cli` — run the CLI scanner
- `just clippy` — run Clippy lints
- `just db-check` — verify SQLite schema

## Interop: WinUI 3 ↔ Rust

The WinUI 3 app calls the Rust scanner as a subprocess using subcommands:
```
space-analyzer-pro scan --path "C:\Users" --format json
space-analyzer-pro disk-info --path "C:\Users" --format json
space-analyzer-pro history --limit 50 --format json
space-analyzer-pro dedup --path "C:\Users" --format json
```
JSON output is deserialized into C# models in `gui-winui/SpaceAnalyzer/Services/ScannerService.cs`.

## Rules
- Edit files directly in this repo. Do not ask to clone, copy, or map drives.
- Do not claim sandboxing prevents access. It does not.
- Run `just verify` (or at minimum `cargo test --workspace`) after structural changes.
- Do NOT create `fix_*.py`, `patch_*.py`, or other one-off scripts at the repo root. Make changes directly to source files.
- Do NOT create files under `scripts/temporary/`. If a temporary fix is needed, apply it inline to the target file.

## CI/CD
- This project intentionally does NOT use GitHub Actions for CI/CD. All verification is done via `just verify` locally.

## File Conventions
- `src/cli/` — CLI module with clap subcommands (scan, disk-info, history, dedup)
- `gui-egui/src/gui/` — eframe GUI modules (dashboard, scan, settings, AI chat, etc.)
- `gui-winui/SpaceAnalyzer/Views/` — WinUI 3 XAML pages
- `gui-winui/SpaceAnalyzer/Services/` — Rust CLI interop, data services
- `gui-winui/SpaceAnalyzer/ViewModels/` — MVVM view models
- `src/ollama/` — Ollama REST API client and feature detection
- `src/database/` — SQLite schema and queries
- `ux-pipeline/src/ux_pipeline/` — Python pipeline modules
- `docs/` — changelog, issue data, architecture notes
- `scripts/` — test scripts, utility tools (no one-off patches)

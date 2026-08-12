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

## Project Status (quick reference)

- **Active app:** WinUI 3 (C#) in `gui-winui/`, on a Rust core in `src/`.
- **`gui-egui/` is a comparison prototype — exclude from work** unless explicitly asked.
- **ON HOLD:** workflow triggers/scheduler (Manual trigger only) until all other systems
  are proven stable; misconfiguration risks destructive changes on the user's machine.
  See `docs/ARCHITECTURE_DECISIONS.md` §8 before proposing any automation/cleanup.
- **Start here for status:** `docs/INDEX.md` is the agent documentation hub (current
  status, active vs archive docs, and how to verify status quickly).

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
cargo run --bin space-analyzer-cli -- scan --path "C:\Users" --format json
cargo run --bin space-analyzer-cli -- scan --path "C:\Users" --format json --stream
cargo run --bin space-analyzer-cli -- disk-info --format json
cargo run --bin space-analyzer-cli -- history --limit 50 --format json
cargo run --bin space-analyzer-cli -- history --id 1 --format json
cargo run --bin space-analyzer-cli -- dedup --path "C:\Users" --format json
```
JSON output is deserialized into C# models in `gui-winui/SpaceAnalyzer/Models/` via `ScannerService.cs`.
`ToolExecutor.cs` exposes a subset of scanner+filesystem operations as callable tools
for the AI Assistant.

> **`disk-info` output shape:** prints a **JSON array** of every mounted volume (the
> `--path` argument is accepted for positional consistency but ignored in JSON output).
> The WinUI 3 frontend deserializes this directly into `List<DiskVolume>`. Each entry:
> ```json
> [
>   {
>     "mount_point": "C:\\",
>     "label": "SSD",
>     "file_system": "NTFS",
>     "total_bytes": 511016669184,
>     "used_bytes": 330000000000,
>     "available_bytes": 181016669184,
>     "usage_percent": 64.6
>   }
> ]
> ```
> (empty `[]` when no volumes are detected; `used_bytes`/`usage_percent` are provided by
> the backend — the C# `DiskVolume` model recomputes them from total/available.)

The WinUI 3 `ScannerService` also supports scan cancellation via `StopScan()` (kills the scanner process tree) and result export via `ExportScanResultAsync()`. Path validation is performed before launching the scanner subprocess.

## Scripting rules
- Prefer Python over PowerShell for HTTP, JSON, and subprocess work. PowerShell here frequently mangles JSON and here-strings, causing silent failures and unnecessary retries.
- When using Ollama for local model review: release the current model from VRAM first, load one coding model at a time, collect its perspective, release it, then load the next. Avoid loading multiple large models simultaneously; VRAM is shared and models stay resident until explicitly released.

## Rules
- Edit files directly in this repo. Do not ask to clone, copy, or map drives.
- Do not claim sandboxing prevents access. It does not.
- Run `just verify` (or at minimum `cargo test --workspace`) after structural changes.
- Do NOT create `fix_*.py`, `patch_*.py`, or other one-off scripts at the repo root. Make changes directly to source files.
- Do NOT create files under `scripts/temporary/`. If a temporary fix is needed, apply it inline to the target file.
- **Screenshots / visual verification**: the assistant cannot analyze images directly. Any new screenshot (WinUI GUI, scan output, charts) must be submitted to the local gemma4 vision model (`gemma4:e2b-it-qat`) via the `vision-feedback`/`vision` tools for analysis rather than being inspected inline.

## Git hygiene
- Build artifacts and logs are gitignored — never commit them: `target/`, `**/obj/`, `**/bin/`, `*.log`, `TestJson/obj/`, `TestJson/bin/`, `@AutomationLog.txt`. The root `TestJson/` .NET test project keeps its `Program.cs`/`TestJson.csproj` tracked; only its build output is ignored.
- Generated/runtime data is gitignored: `ux_issues.json`, screenshots (`*screenshot*.png`, `*-screenshot.png`, `*-base64.txt`, `*_base64.txt`), `loop_feedback/`, `ux-pipeline/analysis_history/`.
- Agent/IDE state is gitignored: `.kilo/`, `.vscode/` (except curated `settings.json`/`tasks.json`/`launch.json`/`extensions.json`), `AGENTS.md`, agent md files (`HEARTBEAT.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, etc.).
- Keep `main` and `origin/main` in sync via explicit push; never force-push. Stage with explicit paths (never `git add -A`) so stray artifacts/out-of-scope edits are excluded.

## Testing
- **WinUI 3 app** (`gui-winui/`): Playwright/browser-based testing is **not applicable** — this is a native desktop app, not a web app. No automated browser tests should be invoked for this GUI.
- **Web version**: If a web version exists in a different directory/repo, Playwright testing is applicable there only.

## CI/CD
- This project intentionally does NOT use GitHub Actions for CI/CD. All verification is done via `just verify` locally.

## File Conventions
- `src/cli/` — CLI module with clap subcommands (scan, disk-info, history, dedup)
- `gui-egui/src/gui/` — eframe GUI modules (dashboard, system, scan, etc.)
- `gui-winui/SpaceAnalyzer/Views/` — WinUI 3 XAML pages
- `gui-winui/SpaceAnalyzer/Services/` — Rust CLI interop, data services (`ScannerService.cs`, `ToolExecutor.cs`)
- `gui-winui/SpaceAnalyzer/ViewModels/` — MVVM view models
- `gui-winui/SpaceAnalyzer/Models/` — Data models (ScanResult, DiskVolume, FileTypeDistribution, etc.)
- `src/ollama/` — Ollama REST API client and feature detection
- `src/database/` — SQLite schema and queries
- `ux-pipeline/src/ux_pipeline/` — Python pipeline modules
- `docs/` — changelog, issue data, architecture notes
- `scripts/` — test scripts, utility tools (no one-off patches)

## Agentic Loop Audit — ToolExecutor.cs + AIAssistantViewModel.cs

Comprehensive audit of the WinUI 3 agentic data flow (user message → Ollama → tool calls → results → next turn).
Bugs found: ~15. Bugs fixed so far: 9 (build-verified, MSBuild 0 errors).

### Fixed (committed/working)

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `ToolExecutor.cs` | `WorkflowConstants` fields referenced as private undefined names | Extracted to `Models/WorkflowConstants.cs`; both `ToolExecutor` and `WorkflowsViewModel` now reference the shared class |
| 2 | `ToolExecutor.cs` | `ResolveScanPathAsync` did not pass `CancellationToken` to `GetScanHistoryPageAsync` | Added `ct` parameter |
| 3 | `ToolExecutor.cs` | `FormatBytes` had a dead private copy; callers were inconsistent | Removed private copy; all callers now use `ByteFormatter.FormatBytes` |
| 4 | `AIAssistantViewModel.cs` | `BuildApiMessages` silently dropped ALL `ChatRole.Tool` messages | Now includes tool result messages so the model sees prior outputs on subsequent turns (critical for multi-turn agentic loops) |
| 5 | `AIAssistantViewModel.cs` | `ParseToolArguments` called `.ToString()` on `JsonElement` values in `Dictionary<string, object>`, producing `"System.Text.Json.JsonElement"` | Detects nested `JsonElement` and re-serializes/deserializes to unwrap |
| 6 | `ToolExecutor.cs` | `WorkflowFindHiddenFilesAsync`/`WorkflowFindReadOnlyAsync` did `kvp.Value.Size & FileAttributes.Hidden` (bitwise AND on file SIZE) | Now uses `File.GetAttributes(kvp.Key)` to read real file attributes |
| 7 | `ToolExecutor.cs` | `SearchFilesAsync` empty-result message said "No files found" even when files existed but filters matched nothing | Message now says "No files match the current filters" |
| 8 | `ToolExecutor.cs` | `GetString`/`GetOptionalString` called `.ToString()` on `JsonElement`, producing type name instead of value | Explicit `JsonElement` unwrap: `GetString()` for string-typed, `GetRawText()` for others |
| 9 | `ToolExecutor.cs` | `WorkflowFindLargeFilesAsync` always did a fresh deep scan; ignored `GetLargestFileEntriesAsync` cache | Now uses `GetLargestFileEntriesAsync` (reuses cached scan when available) |

### Remaining (not yet fixed)

| # | File | Issue | Severity |
|---|------|-------|----------|
| 15 | `ToolExecutor.cs` | `PreviewImpactAsync` hardcodes `fsutil hardlink list` which is Windows-only; the app is WinUI 3 so this is acceptable but undocumented | Info (wontfix — tracked in docs/issues.json) |

## Architecture Review & WinUI/Rust Packaging Fix (2026-08-11)

Reviewed the Rust-core ↔ WinUI 3 boundary (see prior session's Findings). Implemented the top recommendations:

### Done
- **Deployment gap (High) closed** in `gui-winui/SpaceAnalyzer/SpaceAnalyzer.csproj`:
  - Added `CopyRustTools` target (`BeforeTargets="Build;Publish"`) that copies `space-analyzer-cli.exe` + `node_modules_cleaner.exe` from `<repo>/target/release` into `$(OutDir)`, and emits a high-priority **warning** when they are missing (instead of silently shipping a GUI with `IsAvailable=false`).
  - Added `BuildRustScanner` target (`/t:BuildRustScanner`) running `cargo build --release --bin space-analyzer-cli --bin node_modules_cleaner`; optionally chained when `/p:BuildRustOnBuild=true`. `RustWorkspaceDir = $(MSBuildThisFileDirectory)..\..` (repo root).
  - Verified csproj XML is well-formed.
- **Capability/version probe (Medium)** added to `gui-winui/SpaceAnalyzer/Services/ScannerService.cs`:
  - `ScannerVersion` property + `ProbeVersionAsync()` that runs `space-analyzer-cli --version`, parses `<name> <version>`, never throws. Closes the "no protocol-version negotiation" gap so the GUI can surface/version-gate the backend.
  - `RunScannerAsync` was already robust (timeout + stderr drain + process-tree kill), so no change needed there.
- **README** (`README.md`): documented the backend-bundling requirement under Quick Start (WinUI 3), fixed a stale "10 pages" → "11 pages" in the Stack table.
- **Root `SECURITY.md`** added (GitHub security-policy tab was missing; referenced `docs/implementations/SECURITY.md` which does not exist — real one is `docs/archive/reports/SECURITY.md`). Local-first security model + private reporting.

### Done (capability gating + contract hardening)
- **Version/capability negotiation (P1) wired into feature gating** in `ScannerService.cs`:
  - `ScannerCapabilities` class (all flags default `true`) + `GetCapabilitiesAsync()` (cached) that runs `space-analyzer-cli --version` and per-subcommand `--help` (`history`/`scan`/`db`) and clears a flag only when it is positively absent. So a version/help-format mismatch preserves current behavior instead of wrongly stripping features.
  - Gated flags: `GetScanHistoryPageAsync` (`--sort-by`/`--search`/`--only-duplicates`), `GetCategoryHistoryAsync` (`--category-totals`, short-circuits when unsupported), `PruneRelativeScansAsync` (`--drop-relative`), `BackfillCategoriesAsync` (`--backfill-categories`), `PruneFileCacheAsync`/`PruneDiskSpaceAsync`, and `ScanDirectoryAsync` (`--progress-json`). Each returns a clean "unsupported" result rather than sending an unknown flag the CLI would reject.
- **Schema/contract (P1) hardened** in `StreamEvent.cs`: `StreamComplete.FileTypes` changed `Dictionary<string,int>` → `Dictionary<string,long>`. The Rust CLI emits per-type byte totals as `u64`; the old `int` overflowed on large directories, throwing during JSON parse, which the streaming reader swallowed — silently dropping the final scan result (streaming scan returned null). `ScanResult.FileTypes` was already `long`, so the mapping is now type-stable.
  - **Corrected earlier note:** there was no `TotalSizeMb` precision loss — both `ScanResult`/`StreamComplete` use `double`, and the streaming `(long)` cast was `int`→`long` (safe). The real contract risk was the `int` overflow above.
- **Contract test added** `gui-winui/SpaceAnalyzer.Tests/ScannerContractTests.cs` (xUnit, `net8.0`, headless) that includes the model + `ByteFormatter` sources via `<Compile Link>` and pins the snake_case JSON contract with the exact `ScannerService` serializer options. Covers full `ScanResult` mapping, the `scanned_files` `[size,mtime]` array converter, and the `StreamComplete.FileTypes` >int.MaxValue overflow case. `dotnet test` → 8 passed (5 existing + 3 contract).

### Not built here
- Rust `target/release` exes were **not** compiled in this session (full release build is heavy: `lto=true`, `codegen-units=1`). The copy target will pick them up once `cargo build --release` runs. Validate with `cargo build --release --bin space-analyzer-cli` then a VS MSBuild GUI build.

### Review findings (still open, optional)
- [1] Add `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, root `CODE_OF_CONDUCT.md` (none tracked).
- [2] Set repo Description + Topics via `gh repo edit` (not a git op).
- No shared JSON schema between Rust CLI and C# models (convention-only; field mismatch silently defaults to zeros). Consider a contract test or generated models if drift recurs.

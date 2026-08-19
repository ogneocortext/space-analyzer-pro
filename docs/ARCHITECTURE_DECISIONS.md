# Architecture Decisions & Management Strategy

**Date:** 2026-08-11
**Scope:** WinUI 3 frontend + Rust core architecture decisions and management guidelines

---

## 1. Process Invocation Security

**Decision:** All subprocess invocations use `ProcessStartInfo.ArgumentList` instead of string interpolation.

**Rationale:** String-interpolated paths can inject arbitrary CLI arguments if a path contains `"`.
`ArgumentList` handles escaping automatically and eliminates the injection vector.

**Affected files:**
- `gui-winui/SpaceAnalyzer/Services/ScannerService.cs` — all RunScannerAsync callers
- `gui-winui/SpaceAnalyzer/Services/ToolExecutor.cs` — RunCliAsync + PreviewImpactAsync

**Rule:** Never use `ProcessStartInfo.Arguments` with string interpolation in this project.
Always use `ArgumentList.Add()` for each individual argument.

---

## 2. ViewModel Base Class

**Decision:** All WinUI 3 ViewModels inherit from `ViewModelBase` (in `Helpers/ViewModelBase.cs`)
instead of directly implementing `INotifyPropertyChanged`.

**Rationale:** Eliminates ~20 lines of duplicated INotifyPropertyChanged boilerplate per ViewModel
(12 ViewModels = ~240 lines removed). The base class also provides `SetField<T>` for
property change notification with automatic equality checking.

**Rule:** New ViewModels must inherit from `ViewModelBase`. Do not re-implement
`INotifyPropertyChanged` in individual ViewModels.

---

## 3. ScannerService Lifetime Management

**Decision:** Each ViewModel owns its own `ScannerService` instance and disposes it in its
`Dispose()` method. `ScannerService` is registered with `ViewModelRegistry` for cleanup
on window close.

**Rationale:** ScannerService tracks per-instance process state (_currentScannerProcess,
_stopCts). Sharing a single instance across pages would cause conflicts when multiple
pages attempt concurrent scans. Instance-per-ViewModel isolation prevents this.

**Disposal chain:**
1. `MainWindow.OnWindowClosed` → `ViewModelRegistry.DisposeAll()`
2. Each ViewModel's `Dispose()` → `_scanner.Dispose()`
3. `ScannerService.Dispose()` → cancels stop token, disposesCTS, kills process if running

**Rule:**
- ViewModels that own a `ScannerService` field must implement `IDisposable`
- The `Dispose()` method must call `_scanner.Dispose()` before `GC.SuppressFinalize`
- New ViewModels that need scanning must register with `ViewModelRegistry.Register(VM)`
  in their page constructor (see `SettingsPage.xaml.cs`)

---

## 4. GUI Crate Separation

**Decision:** The egui GUI lives exclusively in the `gui-egui/` crate. The core library
(`src/`) contains no GUI-related code.

**Rationale:** Core library (database, Ollama, system monitor, CLI) must be GUI-agnostic
to support multiple frontend implementations. The old `src/gui/` and `src/thumbnails.rs`
were dead code (not declared in `lib.rs`) and have been archived.

**Rule:**
- `src/` must not contain GUI framework dependencies (egui, WinUI, etc.)
- GUI-specific code goes in the appropriate crate (`gui-egui/` or `gui-winui/`)
- `gui_common.rs` is the shared types module between Rust core and GUI frontends

---

## 5. Rust ↔ WinUI 3 Interop Protocol

**Decision:** WinUI 3 calls the Rust CLI as a subprocess using structured subcommands
with JSON output. The CLI binary is `space-analyzer-cli` (built from `src/`).

**Subcommands:**
| Command | Purpose |
|---------|---------|
| `scan --path X --format json [--stream]` | Directory scanning (streaming for live progress) |
| `disk-info --format json` | All mounted volumes |
| `history --limit N --format json` | Scan history with pagination |
| `dedup --path X --format json [--apply] [--yes]` | Duplicate file analysis |
| `dependencies X --format json` | File relationship analysis |
| `embed X --format json` | Semantic embedding generation |
| `semantic-search Q --scan-id N --format json` | Natural-language file search |
| `usn volumes --format json` | NTFS USN journal volumes |
| `settings get/set --format json` | Persistent settings |
| `db --info/--vacuum/--prune-* --format json` | Database maintenance |

**Rule:** All subcommands emit JSON to stdout. The C# side deserializes via
`ScannerService.s_jsonOptions` (snake_case policy + string enum converter).

---

## 6. Documentation Management

**Decision:** Active documentation lives at the root and in `gui-winui/README.md`.
Historical web-era docs are archived to `docs/archive/web-era/`.

**Active docs:**
- `README.md` — project entry point (root)
- `AGENTS.md` — AI agent reference (commands, interop, conventions)
- `CHANGELOG.md` — version history (in `docs/`)
- `docs/archive/FEATURE_GAP_ANALYSIS.md` — WinUI feature parity tracker
- `gui-winui/README.md` — WinUI 3 build & architecture

**Rule:** Do not create documentation describing the old web/Tauri architecture outside
of `docs/archive/web-era/`. All new documentation must reflect the current Rust-core +
WinUI-3-frontend architecture.

---

## 7. GPU Acceleration Status

**Decision:** GPU compute crate exists (`gpu-compute/`) but `process_gpu` is a stub that
calls `process_cpu`. The Settings → GPU toggle is wired end-to-end and passes `--no-gpu`
to the CLI when disabled, but actual CUDA acceleration is not implemented.

**Rule:** Do not claim "GPU acceleration" in README feature lists without qualification.
The toggle is a forward-compatible placeholder. Implementing actual CUDA scanning is
tracked as a future enhancement.

---

## 8. Workflow Triggers (On Hold)

**Decision:** Workflow scheduling/triggers (LowDiskSpace, FileSystemChange, OnStartup)
are **on hold** due to risk of unintended consequences from destructive actions
triggered without user confirmation.

**Current state:** Only Manual trigger is implemented. All 7 action types and 22 templates
are runnable from the UI.

**Rule:** Do not implement background schedulers or trigger-based automation until
a confirmation/safety mechanism is designed and approved.

**Status update (2026-08-11):** Workflow triggers/scheduler remain on hold **until
everything else is fixed**. The feature depends on other systems working correctly
to be trustworthy — if configured improperly it can trigger destructive changes on
the user's system (e.g. automatic cleanup/dedup/deletion), so it must not ship
before the surrounding scan, settings, and workflow-execution paths are proven stable.

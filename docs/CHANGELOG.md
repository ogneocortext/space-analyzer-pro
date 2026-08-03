# Changelog

## [Unreleased]

### CLI ↔ WinUI 3 Integration Gap Fixes

- **Added `potential_cleanup_bytes` and `timestamp` to AI tool responses** — `ToolExecutor.GetScanSummaryAsync` and `ToolExecutor.RunScanAsync` now surface reclaimable bytes and scan timestamp to the AI assistant, matching the data available in `ScanResult`.
- **Fixed `SearchFilesAsync` JSON property mismatch** — was querying `large_files` / `size_bytes` (which don't exist in Rust output); corrected to `largest_files` / `size` with a `JsonValueKind.Number` guard. File search from the AI assistant now returns results instead of silently failing.
- **Fixed `GetLargestFilesAsync` client-side result limiting** — the `--top` CLI flag has no effect on JSON output, so the C# tool was returning all 50 files regardless of the requested count. Rewrote to parse JSON and apply `.Take(count)` client-side.
- **Exposed `PotentialCleanupDisplay` and `ResultTimestampDisplay` to the Scan page UI** — added computed properties to `ScanViewModel` with `OnPropertyChanged` notifications in all 4 UI-update locations (progress callback, `LastResult` setter, `IsStreaming` setter, `ScanAsync` finally block).
- **Added `PotentialCleanupBytes`, `Timestamp`, and `PotentialCleanupDisplay` to `ScanResult.cs` model** — enables non-streaming scan results to display cleanup estimates and scan time.

### Data Streaming — Real-time File Type & Category Distribution

- **Streaming accumulators** — `shared-scanner` `ScanProgress` now carries `file_type_counts`, `extension_sizes`, and `category_sizes` HashMaps that are updated during the scan loop, enabling the WinUI frontend to display live file-type and storage-by-category breakdowns without waiting for the scan to complete.
- **CLI `--stream` NDJSON protocol** — `StreamEvent::Progress` and `StreamEvent::Complete` now include `file_types`, `extension_sizes`, and `category_sizes` fields; the CLI emits these as cumulative stats on every progress line.
- **WinUI streaming display** — `ScannerService.ScanDirectoryStreamingAsync` deserializes the new fields into `StreamProgress`/`StreamComplete`; `ScanViewModel.UpdatePartialResult` now reads accumulators directly from the stream instead of recomputing from `LiveFiles`.
- **Storage by Category panel** — new ItemsRepeater on `ScanPage.xaml` showing real-time category sizes with progress bars and formatted size labels, driven by the `CategoryDistributions` property on `ScanViewModel`.
- **Pre-existing ScannerService fixes** — fixed `StreamReader` wrapping (`process.StandardOutput` is already a `StreamReader`), `Dictionary<string,int>` → `long` cast for `FileTypes` in `StreamComplete` → `ScanResult` mapping, and `timeoutCts` variable scoping (moved outside `try` block for `catch` accessibility).
- **Category accumulator** — `extension_to_category()` helper in `shared-scanner` maps file extensions to high-level categories (Documents, Images, Videos, Audio, Archives, Code, Databases, Executables, System, Development, Games, Other).
- **Quick scan targets** — `ScanPage.xaml` now has a "Quick Targets" section with a ComboBox of preset directories (User Profile, Desktop, Documents, Downloads, Pictures, Local AppData, Temp). Selecting a target auto-fills the path textbox; the standalone "Scan" button triggers the scan — no manual address entry needed for testing.

### WinUI 3 — Scan Page Enhancements

- **Stop Scan button** — cancels the running scanner process tree via `ScannerService.StopScan()`.
- **Path validation** — invalid or non-existent scan paths are rejected before the scanner is launched, with a clear error message displayed inline.
- **Scan errors display** — per-scan error list shown in the results panel when the Rust scanner reports errors.
- **File type distribution** — top 10 extensions with percentage breakdown rendered as a chart (`FileTypeDistribution` model).
- **Largest files with filter** — file list with live substring filter by filename.
- **Export results** — JSON export button on the scan page via `ScannerService.ExportScanResultAsync()`.
- **Deep/shallow/custom depth modes** — scan depth selector with preset and custom options.
- **Scan speed metrics** — files/second display in the results panel.
- **Scanner process tracking** — `ScannerService` now tracks `_currentScannerProcess` for cancellation support.

### WinUI 3 — AI Assistant Enhancements

- **Expanded tool registry** — `GetToolDefinitions()` grew from 3 tools to 14, mirroring the Rust backend's full tool set with safety gates.
- **Dynamic tool choice** — `ResolveToolChoice()` uses domain-keyword heuristic matching the Rust `resolve_tool_choice` logic.
- **Enriched ChatRequest** — `Options`, `Think`, and `KeepAlive` fields now populated in `OllamaClient.SendChatRequestAsync()`.

### WinUI 3 — Converters & Helpers

- **New converters** — `BoolToErrorBrushConverter` (red brush for error states) and `BoolToScanButtonTextConverter` ("Stop Scan" / "Start Scan").
- **`UiHelper.OpenPath()`** — helper to open a file or folder in Windows Explorer.
- **`FileTypeDistribution` model** — new data model for the file type chart on the scan page.

### Rust — Scan Page Improvements

- **Path validation** added to `gui-egui/src/gui/scan.rs` `start_scan()` — invalid paths are rejected before scanning starts.
- **Removed unsafe Copy button** from egui scan page (no clipboard crate available in egui dependencies).

- **Fixed build against Windows App SDK 2.3 / .NET 10** — resolved API compatibility issues:
  - Removed `Window.RequestedTheme` / `ApplicationTheme.Unspecified` usage (not supported in WinAppSDK 2.3); theme persistence remains in `SettingsViewModel` but no longer applies at runtime.
  - Fixed `Colors` class references (`Microsoft.UI.Colors`) and `SolidColorBrush` construction in `UiHelper.GetUsageBrush()`.
  - Added missing `Windows.Storage` and `Windows.Storage.Pickers` usings for `ApplicationData` in ViewModels.
  - Fixed `Application.Current.GetWindow()` → `Microsoft.UI.Xaml.Window.Current` (correct WinUI 3 API).
  - Fixed folder picker hwnd resolution to use `WindowNative.GetWindowHandle(window)`.
- **Fixed SettingsPage.xaml.cs duplicate `VM` property** — removed the code-behind `VM` field that conflicted with the XAML `Page.DataContext` named `VM`.
- **Fixed AIAssistantPage.xaml** — removed invalid `VerticalScrollBarVisibility` on `TextBox`; simplified message list layout to a single `Border` per message.
- **Fixed SmartSearchPage.xaml** — removed `Style="{StaticResource DashboardCardBorder}"` from inner `Border` elements to eliminate "duplicate Child property" compiler error; removed unsupported `Opacity` attribute on `Run` elements; added `HasResults` ViewModel property for visibility binding.
- **Refactored converters** — split `BoolToVisibilityConverter` into separate `BoolToVisibilityConverter` and `InverseBoolToVisibilityConverter` classes (WinUI XAML compiler does not support `ConverterParameter` on value converters).

### WinUI 3 — New Pages

- **Implemented `SmartSearchPage`** — full UI for searching files by name and size with path picker, size filter, exact/hidden options, and results list.
- **Implemented `WorkflowsPage`** — stub page with workflow creation form (name, type selector, auto-run checkbox) and saved workflows section.

### WinUI 3 — Code Cleanup

- **Moved `SmartSearchResult` model** from `SmartSearchViewModel.cs` to `Models/SmartSearchResult.cs` for proper XAML `x:DataType` resolution.
- **Added `HasResults` computed property** to `SmartSearchViewModel` for clean visibility binding on the results container.
- **Created `Helpers/Converters.cs`** with reusable visibility converters.
- **Simplified `App.xaml.cs`** — removed broken `ApplySavedTheme()` method that used non-existent WinUI 3 APIs.

### Rust — CLI Refactor

- **New `src/cli/render.rs`** — shared formatting module with helpers: `pct_of()`, `is_installer()`, `build_csv()`, `categorize_installers()`, `build_recommendations()`, plus text/markdown render functions for recommendations and installer inventory.
- **`src/cli/types.rs`** — added `Recommendation`, `InstallerCategory`, `InstallerGroup` structs so installer classification and recommendations are typed.
- **`src/cli/output.rs`** — deduplicated CSV generation and installer inventory rendering; now delegates to `render.rs` helpers instead of inline logic.
- **`src/cli/report.rs`** — removed duplicated CSV generation, installer categorization, and recommendation building; all now use shared `render.rs` helpers.
- **`src/cli/recommendations.rs`** — unified recommendation data model through `render::build_recommendations`; `print_cleanup_recommendations` retains its distinct logic.
- **`src/cli/mod.rs`** — broke down the ~399-line `main()` into command handlers (`handle_scan`, `handle_disk_info`, `handle_history`, `output_results`, `run_ai_question`) and utilities (`depth_label`).
- **`src/cli/scan.rs`** — removed unused `_no_animation` parameter.
- All workspace tests verified passing after refactor.

### Rust — Shared Scanner Cleanup

- **Eliminated duplicate `format_bytes`** implementations across `main.rs`, `system_monitor.rs`, and `workflows/mod.rs`; single canonical `shared_scanner::format_bytes` used everywhere.
- **Added `total_dirs` and `top_directories`** to `gui_common::ScanResult`; removed hardcoded empty arrays in database persistence.
- **`shared-scanner/src/lib.rs`** — removed identity multiplication dead code; added `top_directories` reporting.

### Rust — Build & Dependency Updates

- **Fixed `Cargo.toml`** version and metadata for workspace alignment.
- **Updated 30+ dependencies** across all 6 workspace crates.
- **API migration**: rusqlite u64→i64 casts, sysinfo method renames, rand 0.9 API.
- **All tests verified** — 179+ workspace tests pass cleanly.

### GUI — Visual Redesign

- **New unified design system** across all 8 GUI tabs (Dashboard, Scan, History, Smart Search, Workflows, AI Assistant, System, Settings): layered near-black navy/slate surfaces, blue primary accent, green/amber/coral semantic colors, rounded cards with subtle borders, and an 8 px spacing system.
- **`src/gui/colors.rs`** — added `BG_APP`, `BG_HEADER`, `SURFACE_1/2/3`, refined text colors, accent colors, and semantic colors; preserved legacy aliases; converted `ACCENT_SOFT` to a function because `Color32::from_rgba_unmultiplied` is not `const` in egui 0.34.
- **`src/gui/theme.rs`** — new refined dark theme with improved widget states (noninteractive/inactive/hovered/active), 8 px spacing, updated text styles; replaced deprecated `ctx.set_style()` with `ctx.set_global_style()`.
- **`src/gui/ui_helpers.rs`** — new reusable primitives: `Tone` enum, `app_card`, `section_header`, `status_badge`, `primary_button`, `secondary_button`, `danger_button`, `empty_state`, `inline_alert`, plus kept existing `card_frame`, `section_heading`, `stat_card`, `badge`, `gauge_bar`, `labeled_gauge`, `icon_text`.
- **App shell (`mod.rs`)** — distinct header surface with branding/version/AI model status, compact horizontal-scrolling tab bar with active tab styling (blue-tinted fill, border, brighter text), improved status message bar with context-aware recovery actions.
- **Dashboard** — page header with subtitle/actions, critical disk pressure alert (>=90% used), balanced responsive two-column layout on wide windows, metric cards, improved volume rows with color-coded progress bars and usage thresholds, quick actions, system resources, file type distribution, categories, bloat candidates, recommendations, storage trend.
- **Scan** — guided form layout with "Scan a location" header, scan target card with path input and browse, scan options card with deep scan toggle, action row with Start/Stop/Export buttons and validation text, progress display with files/sec and MB/s, results section with stat cards, errors, file distribution, file types, largest files.
- **History** — page header, toolbar with refresh and clear all, purposeful empty state ("No scans yet" with primary action), structured history records with badges and hover actions, detail view with export options.
- **Smart Search (`embeddings.rs`)** — disabled state warning when semantic indexing is off with action to open settings, disabled search field with explanatory text, search input with keyboard Enter support, indexing progress display, indexed files counter with limit info, results grid, rebuild index button.
- **Workflows (`workflow_render.rs`)** — active workflow execution status card, responsive workflow cards with category badge, enabled/disabled status badge, action count, last run, enable-workflow action for disabled workflows, run/edit/delete actions, execution history, workflow editor modal with trigger configuration (Manual, Scheduled with presets, Low Disk Space, On Startup) and action management.
- **Notifications** — new notification system component for contextual app messages.

### WinUI 3 — Bug Fixes (June 2026)

- **Removed duplicate Settings nav item** — `IsSettingsVisible="True"` on `NavigationView` was showing a built-in Settings item alongside the explicit footer Settings item; removed the XAML attribute.
- **Fixed Results section null-reference crashes** — `ScanPage`, `DuplicatesPage`, and `CleanupPage` bound directly to `VM.LastResult.xxx` before any scan ran. Replaced with null-safe ViewModel properties (`TopDirectories`, `DuplicateGroups`, `CleanupCandidates`, etc.) so pages load cleanly.
- **Fixed Cleanup numeric TwoWay bindings** — `MinSizeMb`/`UnusedDays` were `ulong`; WinUI `x:Bind TwoWay` on `TextBox` requires `int`/`double`. Changed ViewModel types to `int` and cast to `ulong` only when calling the scanner.
- **Reused `PerformanceCounter` instances** — `DashboardViewModel` and `SystemViewModel` were allocating a new counter every 2–3 seconds. Now reused and disposed properly.
- **Fixed redundant Frame navigation** — Dashboard Quick Action buttons set `NavigationView.SelectedItem`, which fired `SelectionChanged` and caused a second navigation. Added a guard so `MainWindow` skips `Navigate` when the target page is already active.

### GUI — Phosphor Icon Migration

- **Replaced emoji icons with Phosphor font icons** across the entire GUI (dashboard, scan, history, settings, system, AI panels, tool results). Removed macro-generated icon functions returning `(codepoint, "emoji")` in favor of typed `&str` constants from `egui_phosphor::regular`.
- **Restructured `icons.rs`** — constants live at module top level (no nested `pub mod icons`); added 30+ Phosphor constants (TIMER, REFRESH, CIRCLE, DASHBOARD, SMART_SEARCH, etc.).
- **Fixed `section_heading()` signature** — `Option<char>` → `Option<&'static str>` to accept Phosphor icon strings instead of emoji chars.
- **Fixed `tool_result_parser.rs`** — return type changed from `Option<(u32, &str)>` to `Option<&str>` to match new constant scheme.
- **Fixed `icon_text()` call sites** — removed stale 4-arg invocations that were passing codepoint + family name.
- **Fixed `badge()` and button-label type mismatches** — `.to_string()` / `&` conversions where `format!()` returns `String` but the target expects `&str`.
- **Fixed double-wrapped `format!()` calls** in scan timer and dashboard date formatter (leftover from bulk fix script).
- **Removed duplicate `use` imports** in `mod.rs` and `features_panel.rs`.
- **Exported `labeled_gauge`** from `ui_helpers` (was private, causing build errors in dashboard and system panels).

### Scanner Performance

- Removed the duplicate pre-scan used only to estimate progress. Progress now adapts while the active traversal runs, avoiding a second directory walk and reducing startup I/O on large profiles.


## [4.0.0] - 2026-08-02

### WinUI 3 Design System

- **Token-based design system** in `App.xaml` — introduced spacing tokens (`Space.XXL`…`Space.XS`), typography styles (`Type.PageTitle`, `Type.SectionTitle`, `Type.CardTitle`, `Type.SubTitle`, `Type.Body`, `Type.Caption`, `Type.Hint`, `Type.Dim`, `Type.Tiny`, `Type.StatValue`, `Type.StatLabel`), icon-size tokens (`Icon.Hero`, `Icon.Button`, `Icon.Card`, `Icon.Small`, `Icon.Tiny`, `Icon.EmptyState`), and card/button/progress-bar styles (`ItemCard`, `CompactItemCard`, `EmptyStateCard`, `PrimaryButton`, `SecondaryButton`, `SmallButton`, `TinyButton`, `StandardProgressBar`, `CompactProgressBar`, `MinimalProgressBar`). All XAML pages refactored to consume these resources.
- **New converter**: `BoolToHorizontalAlignmentConverter` — maps `bool` → `HorizontalAlignment.Right/Left`.
- **Null-safe converters**: `BoolToVisibilityConverter` and `InverseBoolToVisibilityConverter` now return `Collapsed`/`Visible` respectively when the input is `null`, preventing binding crashes on uninitialized properties.
- **`ErrorTextBrush`** resource for consistent error-color text across the UI.

### WinUI 3 — Bug Fixes

- **Settings-loss on startup (SettingsViewModel)** — `Load()` called property setters that triggered `Save()`, overwriting not-yet-loaded settings with defaults on every app launch. Fixed by setting backing fields directly and firing `OnPropertyChanged` for all properties at the end of `Load()`.
- **Same cascade bug in ScanViewModel** — `DepthValue`, `IncludeHidden`, and `ScanPath` setters all called `Save()`, overwriting `CustomMaxDepth` with the default. Fixed by setting backing fields directly in `Load()`.
- **Duplicate catch block** in `SettingsViewModel.cs` — removed.
- **Cancellation token never cancelled** — `CancellationTokenSource` instances in `AIAssistantViewModel`, `CleanupViewModel`, `SmartSearchViewModel`, and `WorkflowsViewModel` were `readonly` and never disposed between operations, causing stale tokens. Made non-readonly; each async entry point now disposes and recreates the CTS.
- **ScannerService CTS not cancelling** — `ScanDirectoryStreamingAsync` and `CleanupAsync` disposed the stop token without calling `Cancel()` first, leaving orphaned scanner processes. Added `_cts?.Cancel()` before `Dispose()`.
- **ScannerService stderr deadlock** — async stderr reading used `while (!stderr.EndOfStream) await stderr.ReadLineAsync()` but discarded the result; replaced with `while (await stderr.ReadLineAsync(ct) is not null)`.
- **MainWindow navigation double-fire** — `SelectionChanged` caused a redundant second `Navigate`; switched to `ItemInvoked` with a `_isNavigating` guard. Added `NavigationFailed` and `Navigated` diagnostics.
- **MainWindow resource leak** — none of the 8 page ViewModels were disposed on close. `OnWindowClosed` now disposes `DashboardViewModel`, `SmartSearchViewModel`, `WorkflowsViewModel`, `AIAssistantViewModel`, `CleanupViewModel`, `DuplicatesViewModel`, `HistoryViewModel`, and `SystemViewModel`.
- **MainWindow `Window.Current` usage** — page code-behind used `Window.Current` to access the window; replaced with a static `MainWindow.Current` property set in the constructor.
- **SystemPage namespace syntax** — malformed `namespace` declaration caused a compilation error; fixed to proper `namespace SpaceAnalyzer.Views;` form.
- **SystemPage `OnNavigatedFrom`** — timer `Stop()` was called after `base.OnNavigatedFrom(e)` (which can dispose the page); reordered to stop timer first.
- **DashboardViewModel self-notify** — `QuickScanPath` and `IsQuickScanning` setters called `OnPropertyChanged(nameof(IsQuickScanning))` on themselves (self-referencing); removed redundant self-notification.
- **DashboardViewModel.IsLoading** — wasn't notifying `IsNotLoading` or `IsLoadingVisibility`; added those notifications plus `IsNotLoading` and `IsLoadingVisibility` computed properties.
- **DashboardViewModel history lists** — changed from `List<double>` to `IReadOnlyList<double>` to prevent external mutation of internal history buffers.
- **SmartSearchViewModel MatchExact** — exact-match searches used `Contains()` with a lowercased query (case-correct but semantically wrong); now uses `string.Equals(..., OrdinalIgnoreCase)`.
- **UiHelper.GetUsageBrush** — `double.IsNaN`/`Infinity` from unavailable disk metrics crashed the brush; added guard returning `BrushGreen` for non-finite values.
- **ScanViewModel LiveFilesDisplay** — showed file count + path; now shows the current filename being scanned for better UX during live streaming.
- **ScanViewModel FileTypeDistribution Count** — was `ActiveResult?.FileTypes.Count ?? 0` (count of distinct extensions, not file count); now correctly shows `0` (count per-extension is not tracked in streaming).
- **ScanViewModel ResultSpeedDisplay** — shows `"—"` instead of empty string when no active result; **ResultDepthDisplay** uses `DepthInt` instead of removed `MaxDepth`.
- **AIAssistantViewModel constructor client leak** — `LoadSettings()` triggered `OllamaUrl` setter → `RefreshOllamaClient()` creating a client, then the constructor created a second client. Fixed by using the `_ollamaUrl` backing field directly in both places.

### WinUI 3 — New Features

- **v4.0.0 release** — app window title updated to reflect the design-system overhaul.
- **AppLog diagnostic logger** (`Helpers/AppLog.cs`) — lightweight file logger writing to `%LOCALAPPDATA%/SpaceAnalyzer/ui-actions.log` with `NAV`, `PAGE`, `ACTION`, and `ERROR` categories and a monotonically incrementing sequence number.
- **Dashboard v2** — redesigned with token-based styling, three-zone layout (stat cards → disk usage + quick actions → system resources → quick scan → resource history), 3 canvas-based resource history charts, and 3 new quick-action buttons (Smart Search, Workflows, Settings). Added `Refresh` button.
- **ScanPage depth modes** — replaced the single depth slider with radio buttons for Quick (depth 1), Default (depth 5), and Deep (unlimited), plus a conditional custom-depth slider. Added `Open Folder` button, `x:Name` on path textbox, and navigation-parameter support for pre-filling a scan path.
- **HistoryPage file explorer** — full redesign with column-sortable largest-files list (Name, Size, Path with sort indicators), live filter by name/path, and per-file `Open`/`Folder` buttons.
- **WorkflowsPage** — fully implemented (was a stub): results list with `Open`/`Folder` buttons, empty state (`EmptyStateCard`), `VM` property pattern, `AppLog` tracing, and depth radio buttons matching ScanPage.
- **SettingsPage** — added `Open Scanner Folder` button; migrated from `DataContext` casts to explicit `VM` property pattern.
- **SmartSearchPage** — added `Open` and `Folder` buttons for search results, a Tips section, and explicit `VM` property.
- **AboutPage** — added `View License (MIT)` and `Open Project Folder` buttons; new Build Information, Credits, and Resources sections.
- **AIAssistantPage** — chat messages now display a timestamp (`HH:mm`); suggestions panel collapses when more than 2 messages exist; `AddMessage` made public for external injection; `_disposed` guard on `SendMessageAsync`.
- **Model enhancements** — `FileSizeEntry.Name`, `.Extension`, `.ParentPath` convenience properties; `ScanHistoryRecord.PotentialCleanupDisplay`; `CleanupCandidate.RiskLevelBrush`.

### WinUI 3 — GUI Macro Test Rewrite

- **Complete rewrite of `scripts/test/gui_macro_test.py`** — migrated from `SendInput` cursor-positioning (which hijacked the system cursor) to **Windows UI Automation (UIA) `Invoke()` pattern** for all button clicks and `SetValue()` pattern for text input. Zero cursor movement, zero focus stealing.
- **Button registry** — declarative `BUTTON_REGISTRY` mapping each of the 10 tabs to its interactive buttons; each button is found by accessible name and invoked via UIA.
- **Expanded test phases** — added Button Functionality Tests (Phase 3) and test all 10 tabs (was 8).
- **Path resolution** — binary path candidates updated to WinUI 3 `bin/x64/{Release|Debug}/net10.0-windows10.0.22621.0/` layout.

### Documentation

- **AGENTS.md** — added Testing section clarifying that Playwright/browser testing is not applicable to the native WinUI 3 GUI.

## [3.7.0] - 2026-07-28

### Architecture

- **CLI module refactor** — split monolithic `src/cli.rs` (1,643 lines) and `src/main.rs` (1,570 lines) into 9 focused modules under `src/cli/` (args, types, helpers, scan, output, recommendations, report, dedup). `src/main.rs` reduced to 9 lines.

- **Unified `ScanResult` type** — CLI and GUI now share the same `gui_common::ScanResult` struct. Added `total_dirs`, `top_directories`, `empty_dirs` fields; `extension_sizes` changed from `Vec<(String, u64)>` to `HashMap<String, u64>`. Backward-compatible via `#[serde(default)]`.

- **Deduplicated `format_bytes`** — removed 3 duplicate implementations (main.rs, system_monitor.rs, workflows/mod.rs). Single canonical `shared_scanner::format_bytes` used everywhere.

### Dependency Updates

- Updated 30+ dependencies across all 6 workspace crates (thiserror 2, dirs 6, which 8, rusqlite 0.40, reqwest 0.13, sysinfo 0.39, trash 5, and many more)
- API migration: rusqlite u64→i64 casts, sysinfo method renames, rand 0.9 API

### CLI Improvements

- **New flags**: `--max-size`, `--include-hidden`, `--no-animation`
- **Fixed `--min-size`** — was parsed but never applied in WalkDir filtering
- **Fixed `node_modules` estimation** — now uses actual directory size instead of hardcoded 1GB
- **Fixed CSV export** — double-quotes now properly escaped as `""`
- **Full text export** — `--export results.txt` now generates the complete report instead of a one-line summary
- **Improved cache/temp detection** in cleanup recommendations

### GUI

- **Dedup tab** — added to GUI navigation with dedicated icon and tab parsing
- **Move to Trash** — now uses `trash::delete()` (OS Recycle Bin) instead of permanent delete
- **Removed 22 `#[allow(dead_code)]` annotations** across ollama/, database/, gui/

### Database

- `save_scan()` now serializes `top_directories` to DB instead of hardcoded `[]`
- `clear_history()` cascades to `workflow_executions` table

### Cleanup

- Deleted 140 archived web-era docs (Vue, Tauri, Docker, old issue trackers)
- Added `.cline/` to `.gitignore`
- Updated justfile with system utility tasks (check-updates, dashboard)
- Added `scripts/utility/check_updates.ps1` and `dashboard_server.ps1`

### Web Frontend (Svelte + Axum)

- **New `web/` Axum backend** — workspace member `space-analyzer-web` serving the Svelte SPA on port 3000. Exposes `/api/scan`, `/api/dedup`, `/api/ai/chat`, `/api/large-files`, `/api/cleanup/suggestions`, `/api/system`, `/api/health`.
- **New `frontend/` Svelte 5 app** — hash-routed SPA with 8 pages: Dashboard, Scan, Results, Duplicates, System, Large Files, Cleanup, AI Chat. Uses Vite 8 with build output to `web/static/`.
- **Shared scanning core** — web backend reuses `shared-scanner` and `file-deduplicator` workspace crates so the web and desktop apps share the same scan/dedup logic.
- **Dev workflow** — `npm run dev` starts Vite on `:5173` with `/api` proxied to `:3000`; `npm run build` outputs to `web/static/`.

### Version

- **Bumped**: `3.6.0` → `3.7.0` in `Cargo.toml`


## [3.6.0] - 2026-06-13

### CLI Improvements

- **Added `--max-depth` flag** — replaces the coarse `--deep` boolean with explicit depth control. Accepts any positive integer (e.g. `--max-depth 10`). `--deep` still forces unlimited depth. Default remains 5 when neither is set.

- **Windows-aware category breakdown** — the CLI text output now prints a "📂 SPACE BY CATEGORY" section that classifies top directories by path, not just file extension. Recognizes `C:\Windows\...` → **Windows**, `Program Files` → **Program Files**, `AppData\Local\Temp\...` → **Temp/Cache**, `node_modules\` → **Development**, and `.ollama` paths → **AI Models**.

- **`src/category.rs`**: extended `get_category()` with an optional `path_hint` parameter and new `path_based_category()` helper so the scanner can surface system-folder context without relying on extension heuristics alone.

### Code Quality

- **Fixed build**: `cargo build --bin space-analyzer-cli` compiles cleanly.

### Version

- **Bumped**: `3.5.0` → `3.6.0` in `Cargo.toml`


## [3.4.0] - 2026-06-04

### Visual Identity

- **App icon** — multi-resolution (16, 32, 48, 64, 128, 256 px) gradient disk icon with cyan center dot. `assets/icon/` includes PNG, raw RGBA (for `egui::IconData`), and Windows `.ico`. Embedded at compile time via `include_bytes!` and set via `ViewportBuilder::with_icon()` so the OS taskbar / Alt-Tab show the custom icon.
- **Social preview banner** — 1280×640 PNG + SVG at `assets/banner/social-preview.png`. Features gradient disk icon, gradient "Pro" title, tagline, subtitle, 5 feature pills (`8 GUI TABS`, `12+ LLM TOOLS`, `GPU ACCELERATED`, `SQLITE EMBEDDED`, `WORKFLOW ENGINE`), and a `v3.4.0` badge. Upload this to **Settings → Social preview** on GitHub.
- **Welcome splash screen** — new `show_welcome` app state and `render_welcome_splash()` method. Centered gradient disk icon, fade-in title, 4 feature pills, "Get Started" button, keyboard shortcut hint. Auto-dismisses after 120 frames (~2 s) or on click / Enter / Space.
- **Mermaid diagrams** — `assets/diagrams/architecture.md` (full app architecture as a collapsible graph in the README) and `assets/diagrams/workflow.md` (data flow from scan → categorize → bloat → dashboard → AI / dedup / workflows).
- **README polish** — hero banner, for-the-badge shield row (release, license, stars, CI), "What you get / don't get" comparison table, Prerequisites table, collapsible architecture diagram, Screenshots section.

### Documentation

- **Rewrote root `README.md`**: Comprehensive feature inventory covering all 8 GUI tabs (Dashboard, Scan, History, Smart Search, Workflows, AI Assistant, System, Settings), 5 workflow categories, 7 workflow actions, 4 triggers, 12+ tool registry entries, and full project structure with clickable doc links
- **Added version badges** to README (Rust 1.95+, Windows, MIT license, version)
- **Updated feature list** to reflect all wired-in modules: `category.rs` (12-category file grouping), `offline_ai.rs` (heuristic bloat detection), `file_relations.rs` (destructive-action preview / dependency report), `tool_registry/` (LLM-callable tools), workflow engine, system monitor
- **Updated FEATURE_EVALUATION.md references**: noted that the 3 modules it flagged as "not compiled" are in fact declared in `src/lib.rs` and wired into the GUI

### Code Quality

- **Fixed clippy `field_reassign_with_default` errors** in `src/gui/dedup.rs` (lines 22-37): refactored two `DeduplicationConfig::default()` + field assignment patterns to use struct initializer with `..Default::default()`
- **Applied rustfmt** to `src/gui/dedup.rs` (import ordering, chained method formatting)
- **Verified release build**: `cargo build --workspace --release` succeeds in 7m48s
- **Verified CI suite**: `just verify` passes (fmt-check + clippy -D warnings + all tests)

### Version

- **Bumped**: `3.3.0` → `3.4.0` in `Cargo.toml`

## [3.5.0] - 2026-06-04

### Capability-Driven Ollama Features

- **New `src/ollama/features.rs` module** (~620 lines, 20 inline unit tests) — five first-class features that exercise distinct Ollama 0.30+ capabilities end-to-end. Each feature has a typed `*Input` / `*Output` struct and posts tokens + duration back to the caller, so the data flow is visible in the chat scrollback.
  - **`semantic_search`** (embedding) — batches up to 8 files into a single `POST /api/embed` roundtrip, returns top-K by cosine similarity. Sub-second warm with `nomic-embed-text:latest`.
  - **`summarize_scan`** (completion) — compresses a scan to a 419-byte payload (top-5 files + 5 type buckets = 200:1 compression), asks the chat model for a 2-3 sentence summary. ~10 s, ~100 completion tokens.
  - **`cleanup_plan`** (thinking) — sends a `think: true` chat request, captures the model's hidden reasoning in a separate `thinking` field, returns the numbered plan in `content`. ~3 min, ~5,000 completion tokens.
  - **`describe_screenshot`** (vision) — reads a PNG/JPEG from disk, resizes to ≤1024 px, base64-encodes (~33% overhead), sends as `images: [b64]` multimodal message. ~60 s, ~1,400 prompt + ~1,400 completion tokens.
  - **`agentic_question`** (tools) — multi-round loop with a `ToolExecutor` closure and `max_rounds` cap; the model calls only the tools it needs and results are appended as `tool` messages. ~30 s, 1-3 rounds.

### Ollama Client Hardening

- **New `OllamaClient::post_chat(&ChatRequest)`** and **`post_chat_raw(&ChatRequest) -> (status, body)`** methods — feature code can now send custom chat requests (thinking, vision, tools) without re-implementing HTTP plumbing.
- **New public getters** `base_url()` and `operation_timeouts()` on `OllamaClient` so feature code and tests can read client config.
- **`post_chat_and_parse` and `post_with_timeout` changed to `pub(crate)`** so the features module can use them.
- **Fixed `ToolCall` parse regression**: `call_type` is now `#[serde(rename = "type", default = "default_call_type")]` with `default_call_type() -> "function"`. Models like `qwen3.5:4b`, `llama3.1:8b`, and `qwen2.5-coder:7b` omit the `type` field, which was breaking `/api/chat` deserialization.

### Two New CLI Bins

- **`src/bin/ollama-test.rs`** — read-only smoke test for any local Ollama server. Probes `/api/version`, lists `/api/tags` (filters cloud models with `remote_host` set), lists `/api/ps`, and exercises each local model with `/api/embeddings` (if capability=embedding) or `/api/chat`. 5/5 models passed on this machine.
- **`src/bin/ollama-features.rs`** — runs all 5 features end-to-end and prints a metrics table. 5/5 features passed on this machine (qwen3.5:4b, qwen2.5-coder:7b, gemma3:4b, llama3.1:8b, nomic-embed-text:latest, total 5m48s).

### AI Tools Panel in the GUI

- **New `src/gui/ai/features_panel.rs`** (~360 lines) — 4 capability-driven quick-action buttons rendered between the Quick Actions toolbar and the chat scrollback in `render_ai_chat`:
  - `🔎 Semantic Search` (TextEdit + button) — runs `semantic_search` over the current scan's largest files.
  - `📝 Summarize Scan` (button) — runs `summarize_scan` over the current scan.
  - `🧠 Cleanup Plan` (TextEdit + button) — runs `cleanup_plan` with a user question; thinking mode is force-on.
  - `📷 Describe Screenshot` (file picker + button) — opens a PNG/JPEG via `rfd::FileDialog` and runs `describe_screenshot`.
- **New `AppSettings::ai_features_panel_visible: bool`** (default `true`) — load/save key `ai_features_panel_visible` in `database/settings.rs`; toggle in `gui/settings.rs` with hover-text describing the four capabilities.
- **New `SpaceAnalyzerApp` state**: `semantic_search_query`, `cleanup_plan_question`, `pending_screenshot_path`.
- **Helper `push_ai_tool_error(msg: &str)`** writes to the chat as an `Error` message — `&str` signature avoids the `String` → `&str` dance at every call site.
- **Type alias `FeatureReply = (String, Option<String>, u32, u32, u128, u64, u64)`** keeps clippy's `type_complexity` lint quiet at the runner call sites.

### Tests

- **98 tests pass, 4 ignored** (was 78 / 4) — added 20 inline tests in `src/ollama/features.rs` `mod tests`:
  - Input struct construction (semantic / scan summary / cleanup plan / screenshot)
  - `ToolCall` regression: with and without `type` field, string vs object `arguments`, wire serialization of `ToolDefinition`
  - `ChatResponse`: with and without `thinking`, with `tool_calls` (qwen3.5/llama3.1/gemma3 payload shapes)
  - `split_thinking` helper
  - `encode_image_for_ollama`: PNG / JPEG pass-through, unknown format rejected
  - `cosine_similarity` sanity (orthogonal / identical / opposite), `file_to_description`
  - 4 network tests gated with `#[ignore = "requires local Ollama"]`

### Code Quality

- **Final clippy clean**: `cargo clippy --all-targets --all-features -- -D warnings` passes (fixed `useless_conversion`, `len_zero`, `explicit_into_iter`, `sort_by_key`, `type_complexity` from new code; `Skipped` enum variant and doc-list indentation in `ollama-test.rs`).
- **Format clean**: `cargo fmt --all -- --check` passes.

### Version

- **Bumped**: `3.4.0` → `3.5.0` in `Cargo.toml`



## [3.2.0] - 2026-05-29

### AI Recommendations — Dual Mode (Heuristic + Ollama)

- **Renamed heuristic function**: `generate_ai_recommendations` → `generate_storage_recommendations` — always available, CPU-only
- **New Ollama-powered recommendations**: `generate_ai_recommendations_async` sends scan data to Ollama via structured prompt, parses JSON response into `Vec<AIRecommendation>`
- **Settings toggle**: `ai_recommendation_enabled` persisted in database, accessible from Settings → AI panel
- **Auto-fallback**: Heuristic rules used silently when Ollama unavailable or response unparseable
- **Dashboard display**: Shows source label (`🤖 AI` vs `⚙ Heuristic"`) and pending indicator

### Conversation History Trimming

- **`trim_conversation_history()`** prevents unbounded growth: evicts oldest messages when total exceeds ~2000 token budget (8000 chars), preserves system prompt

### Workflow History — SQLite Migration

- **Added `workflow_executions` table** to database schema (replaced orphan index referencing non-existent table)
- **Removed dead JSON file persistence**: `workflow_history_path` was always `None`; `save_workflow_history`/`load_workflow_history` were never called
- **New DB methods**: `save_workflow_execution`, `get_workflow_history`, `delete_workflow_execution`, `clear_workflow_history`
- **Wired into scan/dedup completion** — workflow executions now persisted and loaded at startup

### Crate Architecture

- **Added `[lib]` target**: `src/lib.rs` as library root, binary is a thin wrapper at `src/bin/space-analyzer-gui.rs`
- **Removed all `#[path]` hacks** from `gui/mod.rs` — modules declared at crate level in `src/lib.rs`
- **Integration tests** use clean `space_analyzer_pro_desktop::...` imports instead of `#[path]` shim

### Settings & Data Integrity

- **`load_settings` wrapped in read transaction** for isolation (prevents inconsistent reads during concurrent `save_all_settings`)
- **GPU settings wired**: `gpu_acceleration`, `cuda_enabled`, `dedup_use_gpu` now control real runtime paths

### Restructure: File Locations and Version Differentiation

- **Moved legacy GUI to archive**: `src/gui.rs` (v3.2.0 monolithic, 983 lines) → `archive/v3.2.0-monolithic/gui.rs`
- **Promoted modular GUI as active binary**: `src/gui/mod.rs` is now the GUI entry point
- **Moved dead modules to archive**: `src/ai_skills.rs`, `src/ollama_client.rs`, `src/database.rs` → `archive/legacy-modules/`
- **Removed backup file**: `src/gui.rs.backup` → `archive/v3.2.0-monolithic/gui.rs.backup`
- **Updated Cargo.toml**: Binary target now points to `src/bin/space-analyzer-gui.rs`

### Analytics Bug Fixes

- **Fixed small-file analysis**: `analyze_file_patterns` now uses file type counts instead of searching `largest_files` (which never contains small files)
- **Fixed empty file_types UX**: `show_visual_analysis` now shows "No file type data available." instead of blank space
- **Fixed task classification**: Chat auto-model selection uses prioritized keywords to avoid collisions
- **Fixed negative growth reporting**: Storage prediction now reports "Decreasing" instead of "Stable" for negative growth
- **Fixed bar chart truncation**: Bar length minimum is now 1 character (was 0 for types < 3.33%)
- **Fixed cache key collision**: Prompt cache falls back to SYSTEM_PROMPT_ANALYSIS when conversation history is empty
- **Fixed division safety**: `generate_recommendations` guards against `total_files == 0` before division

### Maintenance: Rust Workspace Warning Cleanup

- **Eliminated all `cargo check --workspace` warnings** across the entire Rust workspace (reduced from 150+ warnings to 0 code warnings).
- **Fixed `node_modules_cleaner`**: Removed unused `rayon::prelude::*` import; prefixed unused parameters with underscores.
- **Fixed `native/scanner` (4 issues)**: Removed 4 unnecessary nested `unsafe` blocks; added `#[allow(dead_code)]` to planned features; sequential scan now correctly passes duplicate detection results; dead code annotations for utility functions.
- **Fixed `src/ollama/` (7 files)**: Added `#[allow(dead_code)]` annotations to all submodules.
- **Fixed dead modules**: src/ollama_client.rs and src/ai_skills.rs moved to archive (legacy modules no longer in active codebase)
- **Fixed `src/database/`**: Added `#[allow(dead_code)]` to planned features.
- **Fixed src/system_monitor.rs**: Removed misleading #![allow(dead_code)] annotation - all system monitoring functions are actively used
- **Fixed src/workflows/mod.rs**: Removed misleading #[allow(dead_code)] annotation - workflow system is actively used for automation
- **Code quality**: Removed redundant bindings, replaced `sort_by` with `sort_by_key`, used `is_multiple_of()`, replaced redundant closures.
- **Fixed `gpu-compute`**: Replaced manual `Default` impl with `#[derive(Default)]`; replaced `sort_by` with `sort_by_key`.
- **Fixed `shared-scanner/src/lib.rs`**: Removed identity multiplication.
- **Fixed `tests/cli_test.rs`**: Corrected binary name from `space-analyzer-pro` to `space-analyzer-cli`.
- **Fixed `Cargo.toml`**: Added missing dev-dependencies for CLI tests.
- **Verified all tests pass** across the workspace.

### Maintenance: Rust Workspace & CLI Fixes

- **Implemented CLI `--report` feature**: Generates detailed Markdown report with space analysis summary.
- **Implemented CLI `--clean` feature**: Integrates `file-deduplicator` engine for duplicate scanning with BLAKE3/GPU support, dry-run preview.
- **Fixed `native/file_deduplicator`**: Hard-link deduplication uses `fs::hard_link` instead of Windows-only import.
- **Resolved GUI module ambiguity**: Database module bound to `src/database/mod.rs`, restored `src/ollama` module tree.
- **Fixed stale `app_lib` references**: Migrated compiler stubs to target `shared_scanner` workspace crate.
- **Restored missing dependencies**: Added `bytes = "1"` for Ollama stream parser.
- **Aligned test suites**: Workspace tests build and pass 100% cleanly.

## [3.1.0] - 2026-05-15

### GPU-Accelerated Rust Engine (CUDA + CPU Fallback)

#### New `gpu-compute` Workspace Crate
- **`gpu-compute/`** — shared GPU acceleration layer for all Rust components
- **`device.rs`** — NVIDIA GPU detection via `nvidia-smi` (no CUDA toolkit on PATH required) or `cudarc` (when `cuda` feature enabled)
- **`hash.rs`** — `BatchHasher` with automatic GPU/CPU selection for BLAKE3 file hashing
- **`ml.rs`** — `GpuAcceleratedML` with GPU-accelerated linear regression and K-Means clustering
- **`scan.rs`** — `GpuScanProcessor` for GPU-accelerated scan post-processing (extension extraction, size histograms, top-N sorting)
- **`cuda` feature flag** — enables native `cudarc` CUDA kernels; defaults to CPU-optimized `rayon` fallback

#### GPU-Accelerated File Scanning (`shared-scanner`)
- **Two-phase scan architecture**:
  - **Phase 1 (CPU)**: I/O-bound directory traversal via `WalkDir` — collects raw `(path, size, is_dir)` entries
  - **Phase 2 (GPU/CPU)**: Compute-heavy post-processing — file type categorization, size distribution histograms, top-100 largest file selection, empty directory detection
- GPU path: transfers size arrays to CUDA for parallel histogram computation and introselect-based top-N
- CPU fallback: `rayon` parallel iterators with `select_nth_unstable_by` (O(n) average)
- Seamless automatic GPU detection with zero-config fallback

#### GPU-Accelerated File Deduplication (`native/file_deduplicator`)
- Replaced sequential per-file `compute_file_hash()` with `BatchHasher::hash_files()`
- Batch processes files using GPU streams when available
- Falls back to `rayon`-parallelized BLAKE3 hashing on CPU

#### GPU-Accelerated ML Training (`native/storage_predictor`)
- `GpuAcceleratedML::linear_regression()` runs before `linfa` training
- GPU matrix operations for normal equation solving
- CPU fallback using `ndarray` + `rayon` with Gaussian elimination

#### Native GUI Enhancements (`native-gui`)
- **GPU status panel on dashboard** — shows device name, VRAM, compute capability, CUDA version
- Lists which operations are GPU-accelerated (hashing, ML, scan processing)
- Retry button for GPU detection
- Dynamic model selection display for Ollama chat
- Model discovery UI showing all local Ollama models with capability tags

### Build & Compilation Fixes
- Fixed `src/main.rs`: `ScanOptions` API migration (`depth`/`size_filter` → `ScanOptions::deep()`/`medium()`)
- Fixed `src/gui.rs`: egui 0.34 trait changes (`update` → `ui`, `Result` return type, removed `CentralPanel` wrapper)
- Added `walkdir` to root `Cargo.toml` dependencies
- Cleaned unused imports across `src/gui.rs` and `src/gui_common.rs`
- Switched default toolchain to `stable-x86_64-pc-windows-msvc` (GNU toolchain had linker issues)

### Dependency Updates
- Added `gpu-compute` to workspace members
- Added `gpu-compute` dependency to `shared-scanner`, `native-gui`, `file_deduplicator`, `storage_predictor`, and root package
- Added `rand = "0.8"` to `gpu-compute` for K-Means centroid initialization
- `cudarc = "0.12"` (optional, gated behind `cuda` feature)

### Performance Impact
| Component | GPU Operation | CPU Fallback | Est. Speedup |
|-----------|--------------|--------------|-------------|
| Scan post-processing | Histograms, extension extraction, top-N sort | rayon + introselect | 2-5x (large scans) |
| BLAKE3 file hashing | Batch GPU stream processing | rayon parallel hashing | 3-10x (bulk dedup) |
| ML model training | Matrix ops (linear regression, K-Means) | ndarray + rayon | 5-20x (large datasets) |
| Ollama LLM inference | `num_gpu: -1` (all layers on GPU) | CPU inference | Already optimized |

## [3.0.0] - 2026-05-14

### CUDA GPU-Accelerated Vision Analysis

#### New GPU Environment (`scripts/utility/vision-analysis/`)
- **CUDA 12.4 + PyTorch 2.6.0** pipeline for NVIDIA GeForce GTX 1070 Ti (8GB VRAM)
- **`gpu_vision_analyzer.py`** — GPU-accelerated screenshot analysis:
  - Quality metrics: brightness, contrast, blur detection, sharpness (all via GPU convolutions)
  - Layout analysis: edge detection (Sobel), symmetry analysis, color clustering via k-means
  - Ollama `qwen3-vl:4b` integration for semantic UI/UX analysis
  - Batch processing with auto-category detection
- **`setup-cuda-env.ps1`** — one-command conda environment creation
- Performance: ~62s/image (dominated by Ollama inference), GPU processing uses ~24MB VRAM

#### Improved GUI Macro (`scripts/gui_macro_test.py`)
- **Switched from `pyautogui.screenshot` to Win32 `PrintWindow` API**
  - Captures only the actual application window content, not screen pixels
  - Works regardless of window occlusion, z-order, or cursor position
  - No cursor flicker or screen disruption — fully background operation
- **Pre-seeds scan history data** before macro runs:
  - Places scan results into `scan_results/` before launch
  - App loads real data immediately, eliminating empty-state screenshots
  - Reproducible results across runs
- **Minimized app launch** with `SW_SHOWMINIMIZED` for zero user disruption

#### Scan Data Infrastructure
- Three pre-existing scan result files preserved and leveraged for macro testing
- `test_workspace.json` — realistic test data for UI population
- Headless scan mode (`--scan <path>`) for generating new scan data on demand

## [2.14.0] - 2025-05-12
- Major repository streamlining, 70% duplicate code removal
- Consolidated Rust GUI to single `src/gui.rs` (295 lines)
- Cleaned TypeScript, test files, and build artifacts

## [2.13.0] - Previous
- Multiple GUI implementations, experimental features, duplicate code

## [2.12.0] - Earlier
- Initial feature set, basic functionality

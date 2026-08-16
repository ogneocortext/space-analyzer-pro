# [Unreleased]

### Settings Store & ViewModel Robustness

- **Fixed `ResetToDefaults` missing `DefaultScanPaths` reset** — "Reset to Defaults" previously left the default scan paths populated; `SettingsViewModel.ResetToDefaults()` now also clears `DefaultScanPaths`.
- **Eliminated `SettingsStore.EnsureLoadedAsync()` load race** — concurrent callers could both pass the `s_loaded` guard and re-read the DB. Rewrote it to cache a single load `Task` so all callers await one load.
- **Made the LocalSettings→DB migration authoritative** — migrated values are now flushed back to the embedded DB (a no-op when the scanner CLI is unavailable), so the DB is actually the source of truth rather than only LocalSettings.
- **Re-applied saved theme on Settings load** — `LoadFromStore()` now calls `ApplyTheme(_theme)` after restoring values, so the live root matches the picker even if the startup-time apply was skipped.
- **Removed duplicated theme logic** — extracted `Helpers/ThemeHelper.cs` (`ResolveTheme` / `DetectSystemTheme`) and pointed both `App.ApplySavedTheme()` and `SettingsViewModel.ApplyTheme()` at it, deleting the copy-pasted `DetectSystemTheme` in both.

### History, Duplicates & Dashboard Resource-Correlation (this session)

- **History → Delete Duplicate Scans** — added `ScannerService.PruneDuplicateScansAsync` (CLI `history --prune`) and `HistoryViewModel.PruneDuplicateScansAsync`; wired a DangerButton + confirmation `ContentDialog` on `HistoryPage`. Keeps the newest record per (path, size, file count).
- **History detail Pivot + per-scan breakdown** — added `TopDirectoriesView` / `ExtensionBreakdown` (with `ExtensionStat`), Overview / Largest Files / Folders / File Types tabs, file-list sort (size/name) and live filter, copy-path button, and an Escape-to-back `KeyboardAccelerator`.
- **History multi-select comparison** — `CompareCardModel` computes baseline deltas (size / files / duration) across up to N selected scans with side-by-side cards.
- **Duplicates UX** — sort (Wasted / Size / Copies via `SortKey` / `SortIndex` / `SortedGroups`), per-group selection + Select All, and "Remove Selected (N)" with confirmation; deletion keeps one copy per group, then auto re-runs analysis. Fixed `SelectAll` so per-group checkboxes visually refresh (the model has no `INotifyPropertyChanged`).
- **Dashboard "Scanner Impact" panel** — new `ScanActivityMonitor` singleton lets any scan (Quick Scan, Scan page, dedup, cleanup, AI assistant) be correlated with live CPU / memory / GPU / disk samples; a translucent band marks scan windows on the sparklines and a panel shows scan-vs-idle averages per resource.
- Added `ScanImpactInfo` model; wired `ScannerService.ScanDirectoryAsync` / `ScanDirectoryStreamingAsync` / `RunDedupAnalysisAsync` / `RunCleanupAnalysisAsync` to open/close scan windows.

### CLI ↔ WinUI 3 Integration Gap Fixes

- **Added `potential_cleanup_bytes` and `timestamp` to AI tool responses** — `ToolExecutor.GetScanSummaryAsync` and `ToolExecutor.RunScanAsync` now surface reclaimable bytes and scan timestamp to the AI assistant, matching the data available in `ScanResult`.
- **Fixed `SearchFilesAsync` JSON property mismatch** — was querying `large_files` / `size_bytes` (which don't exist in Rust output); corrected to `largest_files` / `size` with a `JsonValueKind.Number` guard. File search from the AI assistant now returns results instead of silently failing.
- **Fixed `GetLargestFilesAsync` client-side result limiting** — the `--top` CLI flag has no effect on JSON output, so the C# tool was returning all 50 files regardless of the requested count. Rewrote to parse JSON and apply `.Take(count)` client-side.
- **Exposed `PotentialCleanupDisplay` and `ResultTimestampDisplay` to the Scan page UI** — added computed properties to `ScanViewModel` with `OnPropertyChanged` notifications in all 4 UI-update locations (progress callback, `LastResult` setter, `IsStreaming` setter, `ScanAsync` finally block).
- **Added `PotentialCleanupBytes`, `Timestamp`, and `PotentialCleanupDisplay` to `ScanResult.cs` model** — enables non-streaming scan results to display cleanup estimates and scan time.

### Dashboard Analysis Panels (bloat / recommendations / forecast)

- **Bloat Detection panel (gap 2.2)** — `Helpers/AnalysisEngine.GetBloatFindings()` mirrors the Rust `offline_ai.rs` classifier (large videos >500 MB, cache/temp, installers, AI model weights, node_modules) and renders a card on the Dashboard from the latest scan's largest files / top directories.
- **Cleanup Recommendations panel (gap 2.4)** — `AnalysisEngine.GetRecommendations()` mirrors `cli/recommendations.rs` (cache/temp folders, old installers, AI models, pip cache, node_modules) and renders a prioritized card with estimated reclaimable bytes per action.
- **Storage Forecast panel (gap 2.3)** — `AnalysisEngine.PredictStorage()` runs linear regression over scan history and shows current size, projected size in 30 days, and GB/day growth rate; shows a "not enough history" note until ≥2 scans exist.
- New models `AnalysisModels.cs` (`Recommendation`, `BloatFinding`, `StoragePrediction`) and `Helpers/PriorityToBrushConverter` (priority → badge color); all three panels live on `DashboardPage.xaml`, populated by `DashboardViewModel.LoadAnalysisPanels()`.

### GPU Acceleration & Deduplication Controls

- **GPU acceleration is now a real toggle (Rust CLI)** — added `--no-gpu` to `scan` and `dedup` subcommands. `DeduplicationConfig.use_gpu` gates `BatchHasher::with_gpu()`, so the Settings → Advanced "GPU acceleration" switch actually forces CPU hashing when off.
- **Real hard-link deduplication from the CLI** — `dedup` gained `--apply` (create hard links instead of dry-run), `--min-size`, and `--max-size`. The JSON output now reports `files_processed`, `space_saved_bytes`, and `errors` on apply.
- **WinUI GPU toggle wired end-to-end** — `ScanViewModel` reads the global `gpu_acceleration` setting into `ScannerService.GpuAcceleration`; both streaming and non-streaming scans pass `--no-gpu` when disabled. `ScannerService.RunDedupAnalysisAsync` accepts `apply`/`useGpu` and maps the new result fields into `DedupResult` (`FilesProcessed`, `SpaceSavedBytes`, `Errors`).
- **Export format selector extended** — added `html` to the export formats; `ScannerService.ExportScanResultAsync` now produces a styled self-contained HTML report (joining the existing json/csv/md options already wired to the Scan page ComboBox).

### Data Streaming — Real-time File Type & Category Distribution

- **Streaming accumulators** — `scan-engine` `ScanProgress` now carries `file_type_counts`, `extension_sizes`, and `category_sizes` HashMaps that are updated during the scan loop, enabling the WinUI frontend to display live file-type and storage-by-category breakdowns without waiting for the scan to complete.
- **CLI `--stream` NDJSON protocol** — `StreamEvent::Progress` and `StreamEvent::Complete` now include `file_types`, `extension_sizes`, and `category_sizes` fields; the CLI emits these as cumulative stats on every progress line.
- **WinUI streaming display** — `ScannerService.ScanDirectoryStreamingAsync` deserializes the new fields into `StreamProgress`/`StreamComplete`; `ScanViewModel.UpdatePartialResult` now reads accumulators directly from the stream instead of recomputing from `LiveFiles`.
- **Storage by Category panel** — new ItemsRepeater on `ScanPage.xaml` showing real-time category sizes with progress bars and formatted size labels, driven by the `CategoryDistributions` property on `ScanViewModel`.
- **Pre-existing ScannerService fixes** — fixed `StreamReader` wrapping (`process.StandardOutput` is already a `StreamReader`), `Dictionary<string,int>` → `long` cast for `FileTypes` in `StreamComplete` → `ScanResult` mapping, and `timeoutCts` variable scoping (moved outside `try` block for `catch` accessibility).
- **Category accumulator** — `extension_to_category()` helper in `scan-engine` maps file extensions to high-level categories (Documents, Images, Videos, Audio, Archives, Code, Databases, Executables, System, Development, Games, Other).
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

- **Eliminated duplicate `format_bytes`** implementations across `main.rs`, `system_monitor.rs`, and `workflows/mod.rs`; single canonical `scan_engine::format_bytes` used everywhere.
- **Added `total_dirs` and `top_directories`** to `gui_common::ScanResult`; removed hardcoded empty arrays in database persistence.
- **`scan-engine/src/lib.rs`** — removed identity multiplication dead code; added `top_directories` reporting.

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

### CLI JSON Output — Curated Display Consistency

- **`disk-info --format json`** now emits additive `total_human`/`used_human`/`available_human` (`DiskInfo` + `disk_info_from`). The WinUI `DiskVolume` (`List<DiskVolume>`) ignores unknown members, so this is non-breaking.
- **`settings get --format json`** now pretty-prints (`to_string_pretty`) instead of compact, matching every other JSON surface.
- **`dedup --format json`** now emits additive `potential_savings_human` (all four construction sites: empty, apply-error, apply-success, dry-run).
- **`app-inventory --format json`** now emits additive `total_wasted_human` (both Windows and non-Windows `build_inventory_report` arms).
- Reshaping was limited to additive companion fields for any JSON the WinUI `ScannerService` deserializes (`disk-info`, `dedup`, `app-inventory`).

### Smart Search / Embeddings (`nomic-embed-text`)

- **Pinned the default embedding model** — `embedding_model` default changed from the floating `nomic-embed-text:latest` to `nomic-embed-text:v1.5`. `:latest` can silently shift underlying weights/dimensions and invalidate stored embeddings; the pinned tag is reproducible. User-overridden settings are untouched.
- **Added asymmetric task prefixes for `nomic-embed-text`** — file descriptions are now tagged `search_document: ` (`embedding_service::file_to_description`) and queries `search_query: ` (`embed_query` and `semantic_search`). nomic-embed-text trains documents and queries in different subspaces; without the prefixes both collapse into the document space and query relevance degrades sharply. This is the single biggest semantic-search quality fix.
- **Re-index after upgrade** — embeddings stored by a prior build (prefixless) are inconsistent with new prefixed queries. Rebuild the semantic index (Smart Search "Rebuild Index" / re-run a scan) once after upgrading; mismatched-dimension vectors already fall back to 0.0 similarity, so there is no crash.
- **Added a dimension-mismatch guard in `semantic-search`** — `src/cli/semantic.rs::run_search` now compares the freshly-embedded query dimension against the stored index dimension before running `search_files`. A stale index built with a different model/version previously degraded every cosine similarity to `0.0` and silently returned empty results; it now returns a clear `Validation` error telling the user to re-run `embed`. (The `cosine_similarity` fallback of `0.0` on length mismatch is retained for individual bad vectors.)
- **Stripped the `\\?\` UNC long-path prefix from embedded paths** — `collect_files` in `src/cli/semantic.rs` now stores the friendly `C:\…` form instead of walkdir's `\\?\C:\…`, so the Smart Search results list in the GUI shows clean, copy-pasteable paths.
- **Made `save_embeddings` idempotent** — `src/database/embeddings.rs` now `DELETE`s a scan's existing vectors before inserting, so repeated `embed` runs / GUI "Rebuild Index" clicks no longer append duplicate rows (previously each rebuild doubled the vectors for a scan, bloating the table and producing duplicate results).
- **Integration test (2026-08-12)** — end-to-end `embed` → `semantic-search` verified on `nomic-embed-text`. Natural-language queries rank the right file type at the top every time (e.g. "tax and invoice documents" → PDFs first; "videos of my holiday" → `.mp4` first; "computer programming source code" → `.rs` first). The dimension guard was validated live by truncating a stored vector's dimension: it returns the expected "re-run `embed`" error. Re-index idempotency confirmed (12 rows after a double `embed`, was 24 before the fix).
- Updated the live `live_semantic_search` test and the AI Tools panel doc comment to reference `nomic-embed-text:v1.5`.
  - **GUI `--min-score` threshold for semantic search** — the Smart Search page now exposes a "Minimum similarity" slider (0–100%, 0 = off) in semantic mode. `SmartSearchViewModel.MinScorePercent` passes a 0..1 `min_score` through `ScannerService.SemanticSearchAsync` → the Rust `semantic-search --min-score` flag, so users can drop mid-pack "central-document" noise directly from the UI.

### AI Assistant — Capability-Aware Model Auto-Selection & UX (this session)

- **Default model is now benchmark-driven, not a hardcoded literal** — `AppSettings.OllamaModel` default changed from `gemma3:1b` (absent from rankings) to an empty "auto" sentinel. When the user has not explicitly chosen a model, `ModelPreferences.PickRecommended()` ranks the installed models by a benchmark-derived code/reasoning ranking (`qwen3.5:4b` → `deepseek-r1:7b` → `gemma4:e2b-it-qat` → `llama3.2:3b`), with tool-capability and size as tie-breakers; the chosen model is persisted to Settings and highlighted ("default" badge) in the installed-model list. Explicit selection still wins.
- **Connection status badge + manual Retry** — `AIAssistantPage` shows a themed status badge (green connected / red offline / gray disabled) with a glyph; a Retry button re-probes Ollama immediately instead of waiting for the 30s auto-refresh tick.
- **Transcript auto-scroll tail** — new `followTail` tracking keeps new messages in view only while the user is at the bottom; a "Jump to latest" button appears when scrolled up so reading history is never yanked away by an incoming reply.
- **Enter to send** — Enter (or Ctrl+Enter) sends; Shift+Enter inserts a newline. Send is gated on `CanSend` (idle + non-empty input).
- Added `OllamaModelInfo.IsDefault` (UI-only, `[JsonIgnore]`) so the assistant page can highlight the configured default model.

### WinUI 3 — Timestamp Timezone Correctness (this session)

- **Fixed UTC wall-clock vs local wall-clock bug in date-based workflows** — `ToolExecutor.Workflows` (`find_old_files`, `find_recently_modified`, `find_by_date_range`, `find_files_older_than`, `downloads_folder_bloat`) and `WorkflowsViewModel` partials (`AgeAndSize`, `Older`, `Specialized`) compared `DateTimeOffset.FromUnixTimeSeconds(mtime).DateTime` (UTC wall-clock) against local `DateTime.Now`/cutoff, so results were off by the machine timezone offset (Arizona MST UTC-7). All comparison/display sites now use `.LocalDateTime`.
- **Fixed Smart Search timestamp display** — `SmartSearchViewModel.DateKey` (group-by month) and `FormatUnixSeconds` (result timestamp) now render local time via `.LocalDateTime` instead of UTC wall-clock.
- **Removed redundant double-fetch** in `HistoryViewModel.SelectRecordByIdAsync` (no longer re-fetches the same record by id).

### Rust — Package Rename, USN & App-Inventory Fixes (this session)

- **Renamed workspace packages** — root crate `space-analyzer-pro-desktop` → `space-analyzer`; native scanner `space-analyzer` → `win-usn` (to avoid a name clash with the root). Updated `gui-egui/Cargo.toml` dep key and `Cargo.lock`; the `win_usn` path dependency now points at `win-usn`. Validated via `cargo check`/`clippy`/`test` on all three crates.
- **Fixed Scoop install `drive` attribution** — `app_inventory::collect_scoop_apps` was calling `drive_of(&app_name)` (the app display name) instead of `drive_of(&loc)` (the install location), so Scoop apps were filed under the wrong drive. Now uses the real install path.
- **Fixed USN `to_volume_path`** — previously stripped the colon, producing `\\.\C` (invalid for `CreateFile`); now emits `\\.\C:` (retains the drive letter + colon), matching the Win32 volume-open API.
- **Made Ollama `PromptCache` opt-in** — `OllamaClientBuilder` no longer builds a default cache unless `with_cache` was called; `chat_with_tools` doc corrected to return `(content, thinking, tool_calls, usage)`.

### Database Bug Fixes & Duplicate-Analysis Retrieval (2026-08-16)

- **Fixed `get_scan_history` / `get_scan_history_page` column-mapping off-by-one** — the SELECTs end at `timestamp` (idx 15) but the row mapping read `potential_cleanup_bytes` from the wrong index, shifting every later column so `potential_cleanup_bytes` read the TEXT `timestamp` as i64 (`InvalidColumnType`). Every `get_scan_history` call (including the AI `get_scan_history` tool) errored. Mapping now matches the shared 16-column order.
- **Unified all three scan-history SELECTs to one column order** (so this class of bug can't recur): `id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, category_sizes_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp`.
- **Fixed `save_file_cache` parameter-count mismatch** — the INSERT had 5 `?` placeholders but 6 params were bound (`InvalidParameterCount`); it runs on every scan, so file-cache saves silently failed. Changed the SQL to `?6` and bound the computed RFC3339 `now`.
- **Added `duplicate_analysis` to the `table_row_count` allow-list** so the table can be counted.
- **Duplicate-analysis retrieval + exact scan linkage** — added `get_duplicate_analysis(scan_id)`, `get_latest_scan_id_for_path`, `normalize_path_for_match`, and `DuplicateAnalysisRecord`. `dedup` persists with a caller-supplied `--scan-id` (verified via `get_scan_by_id`), else falls back to the most-recent scan of the same path, and is skipped when no match. The C# GUI gained `Models/DuplicateAnalysisRecord.cs`, `ScannerService.GetDuplicateAnalysisAsync`, a `HistoryDuplicateAnalysis` capability gate, the History "Duplicates" PivotItem, and `ScannerService.DedupInventory.RunDedupAnalysisAsync(scanId?)` which appends `--scan-id` — so "Run analysis" on a viewed scan reliably attaches results.
- **WinUI `DuplicateAnalysisRecord.Groups` fix** — stored `duplicate_groups_json` uses the Rust `dedup::DuplicateGroup` snake_case wire shape (`hash`/`size`/`file_count`/`files`/`wasted_bytes`), but `Groups` deserialized with default options, so every group came back empty/zero. Now applies `JsonNamingPolicy.SnakeCaseLower`, caches the result, and returns an empty list on corrupt JSON instead of throwing. Added `DuplicateAnalysisRecordTests` (15/15 pass).
- **Verification** — `cargo test --workspace` green (109 lib tests); release Rust CLI + `node_modules_cleaner` rebuilt and copied into the WinUI output dir (clears the `CopyRustTools` missing-binary warning); WinUI MSBuild Debug/x64 `Build succeeded` (0 errors, 0 warnings).

### WinUI 3 — Backend Connection Gaps Closed (2026-08-16)

- **Wired incremental file cache into scans** — added a global `use_file_cache` setting (default off) and pass `--cache` to `scan` (both streaming and non-streaming paths) when enabled, so re-scans of the same path skip unchanged files and actually exercise the previously-unused `save_file_cache`/`load_file_cache` path.
- **Exposed `db --prune-workflows` in the History maintenance panel** — new "Prune Workflow History" button plus `ScannerService.PruneWorkflowsAsync` and `HistoryViewModel.PruneWorkflowsAsync`, parsing the backend's `{"pruned_workflows":N,"retention_limit":K}` response.
- **Unified cleanup recommendations on the Rust rule engine** — added a `recommend <scan_id>` CLI subcommand that reconstructs a `ScanReport` from the stored scan and runs the shared `render::build_recommendations` (the same ~10 rules powering `scan --cleanup-recommendations` and the report). `ScannerService.GetRecommendationsAsync` now consumes it (with `AnalysisEngine.GetRecommendations` kept only as the offline fallback), wired into both the Dashboard recommendations card and the `cleanup-recommendations` workflow — so the GUI and CLI no longer show divergent advice.
- **Removed the dead `scan --channel` flag** — `scan --channel <dir>` wrote a `scan-channel.json` that nothing in the WinUI app ever read (the GUI uses the streaming / `--format json` contract, not a side-file). Dropped the flag, its `ScanArgs` field, and the writer in `src/cli/args.rs` / `src/cli/mod.rs`.
- **Added an offline-analysis transparency badge** — `DashboardViewModel` now tracks when any analysis panel (bloat / recommendations / forecast) falls back from the Rust backend to the built-in C# heuristics (`AnalysisUsingOfflineFallback` + `AnalysisUsingOfflineFallbackVisibility`), and `DashboardPage` shows a banner so users know the figures are local best-effort derivations rather than the authoritative Rust classifier/predictor.

### Scripts — Benchmark Tooling

- **`model_management.py` reads a benchmark directory** — `_load_benchmark_scores` now loads per-run `ollama_gpu_benchmark_*.json` files (deduped to the latest run per model) instead of a single file, feeding the AI model auto-selection ranking.
  - **`consolidate_benchmarks.py` robustness** — timestamp-aware dedup (`_parse_timestamp` normalizes epoch + ISO-8601 on equal footing), correct `md_path`/`json_path` derivation, and `nvidia-smi` GPU name/VRAM detection for the consolidated report.

### Scripts — Cleanup, Rename & Bug Fixes (2026-08-16)

- **Renamed 5 confusingly-named scripts** (no behavior change): `scripts/utility/analyze_screenshot.py` → `analyze_single_screenshot.py`, `analyze_screenshots.py` → `analyze_ux_screenshots.py`, `screenshot_technical.py` → `technical_screenshot_analysis.py`, `rename_screenshot_files.py` → `normalize_screenshot_filenames.py`, `refactor_screenshot_folders.py` → `organize_screenshot_folders.py`. Updated all dependents (`scripts/README.md`, `scripts/utility/_common.py`, `scripts/utility/ollama_vision.py`, `ux-pipeline/pyproject.toml`, internal docstrings/usage).
- **Portability — removed hardcoded absolute repo paths.** `prune_macro_logs.py` (`MACRO_LOGS`), `capture_winui3_screenshots.py` (`REPO`), `gallery_server.py` / `gallery_macro_logs.py` (`ROOT_DEFAULT`) now derive locations from `__file__`; `export_issues_to_csv.py` resolves `docs/issues.json` / `docs/issues_export.csv` instead of a non-existent `scripts/` path.
- **Bug fixes across scripts:** `analyze_ux_screenshots.py` (`_parse_model_text` `NameError` → `parse_model_text` + fallback grounding image), `technical_screenshot_analysis.py` (context-manager `Image.open`), `analyze_single_screenshot.py` (renamed shadowing `tech` → `tech_report`), `organize_screenshot_folders.py` (skip image files in `relocate_leftovers`), `normalize_screenshot_filenames.py` (removed dead branch), `improvement_loop.py` (batch-skipping deadlock in `open_issues` — now excludes processed/failed so all open issues are reachable across iterations), `benchmark_models.py` (removed `or Path()` that inflated the written-file count with CWD), `analyze_design_feedback.py` (`is_dir` guard before `iterdir()`), `prune_macro_logs.py` (`_is_session` slice bug that never pruned `YYYYMMDD_HHMMSS` sessions).
- **`agent_loop_regression.py` (agentic-loop regression harness):** replaced the dead `python -m src.tools.cli workflow run` / `search` invocations (no such module or scanner subcommand exists) with real scanner-CLI-backed equivalents where available (`find_duplicate_files` → `dedup`; `find_large_files` / `find_largest_*` → scan `largest_files` / `top_directories`); in-process-only workflows return an explicit "no CLI backend" error instead of invoking a phantom module.
- **Repo hygiene:** moved 17 stray root-level `.log` files into an ignored `logs/` directory; hardened `.gitignore` (`benchmark_results/`, `browser-test/`, `gallery_b64.txt`, `gallery_page.png`); removed the dead empty `.github/.github.workflows.bak`. All `scripts/**/*.py` pass `py_compile`.


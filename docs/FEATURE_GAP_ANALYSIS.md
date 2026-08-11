# Space Analyzer Pro — Feature Gap Analysis

**Date:** 2026-08-03 (status re-verified and corrected 2026-08-10)
**Scope:** WinUI 3 frontend (`gui-winui/`) + Rust core (`src/`) vs README feature claims
**Source of truth for promises:** `README.md` "Features" and "Tabs" sections

> **2026-08-10 re-verification note:** The original 2026-08-03 table below was stale. Several
> rows were re-checked against source and corrected, and 10 new confirmed defects (D-1…D-10) were
> found and fixed the same day. Corrected rows and the new findings are flagged `⟳FIXED` below.
> Net movement since the original pass: +12 implemented, 10 new defects found & fixed.

> **Maintenance rule (2026-08-11):** The **Summary: Gap Count by Severity** table is *derived*
> from the per-feature rows above — it is **not** hand-edited. After any row change, regenerate
> it from the rows with `python docs/generate_status_summary.py --write` (also validates
> `ISSUES.md` counts from `issues.json`). Run `… --check` in review to fail on drift. The old
> stale-summary drift (31/7 vs 39/0/2/1) must not recur.

---

## How to Read This Document

Each feature from the README is listed under its category. The status column reflects the **WinUI 3 frontend** (the active GUI), with notes on Rust core availability.

| Status | Meaning |
|--------|---------|
| ✅ Implemented | Fully wired in WinUI 3 UI + backend |
| ⚠️ Partial | Exists in Rust core or partially wired, but gap in WinUI UI or behavior vs README claim |
| ❌ Missing | Promised in README, not present in either frontend or backend |
| 🔵 Backend-only | Rust core has it, WinUI 3 frontend does not expose it |

---

## 1. Core Scanning

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 1.1 | Recursive directory scanning with real-time progress, cancellation, performance metrics | ✅ | `ScanPage.xaml` + `ScanViewModel.ScanAsync()` + `ScannerService.ScanDirectoryStreamingAsync()` — live progress bar, Stop button, speed metrics |
| 1.2 | Multi-volume disk support (3+ drives) with usage gauges | ✅ | `DashboardPage.xaml` + `DashboardViewModel.DiskVolumes` + `ScannerService.GetDiskVolumesAsync()` |
| 1.3 | NTFS USN Journal scanner for incremental change tracking | ✅ ⟳ADDED | New `UsnPage.xaml` + `UsnJournalViewModel` + `MainWindow` nav entry expose USN Journal status (volumes, journal id/next-usn/lowest-usn/max-usn) and recent change records via the new `usn` Rust CLI subcommand (Windows-only). Added `space_scanner` (`native/scanner`) as a Windows-gated dependency of `src/` so `usn_journal_scanner` is reachable from the CLI. |
| 1.4 | Hard-link detection via MFT parsing | 🔵 | Rust `native/scanner/` + `file_relations.rs` have hardlink detection. WinUI exposes only via AI tool `preview_impact`; no direct UI for viewing hardlinks |
| 1.5 | Scan history with comparison, filtering, SQLite-backed persistence | ✅ | `HistoryPage.xaml` + `HistoryViewModel` — list, search, sort, compare, delete; Rust `database/scans.rs` persists to SQLite |
| 1.6 | Path validation before scan starts | ✅ | `ScanViewModel.PathExists` + inline error in `ScanPage.xaml` |
| 1.7 | Scan cancellation — Stop button kills scanner process tree | ✅ | `ScanViewModel.StopScan()` → `ScannerService.StopScan()` → `process.Kill(entireProcessTree: true)` |
| 1.8 | Scan errors — per-scan error list displayed in results panel | ✅ | `ScanPage.xaml` has `ScanErrors` section; `ScanResult.Errors` populated from Rust scanner |
| 1.9 | File type distribution — top 10 extensions with percentage breakdown | ✅ | `ScanPage.xaml` `FileTypes` + `CategoryDistributions` ItemsRepeaters; Rust emits `file_types` + `extension_sizes` |
| 1.10 | Largest files with live filter by filename substring | ✅ | `ScanPage.xaml` `FilteredLargestFiles` + `LargestFilesFilter` TextBox |
| 1.11 | Export results to JSON file | ✅ ⟳FIXED | `ScanPage.xaml` Export button → `ScannerService.ExportScanResultAsync()`. **Was broken:** the format `ComboBox` (json/csv/md/html) was discarded and always wrote `.json`, and the picker column overlapped the status row (D-3a). Fixed 2026-08-10: `Export_Click` honors the selected format + extension; grid expanded to 6 columns. |
| 1.12 | Deep/shallow/custom depth scan modes | ✅ ⟳FIXED | `ScanPage.xaml` radio buttons + custom slider; `ScannerService.DepthMode` enum. **Was broken:** the `Custom` option was unreachable — no `Custom` radio and no handler branch (D-3b). Fixed 2026-08-10: `Custom` radio + `ScanViewModel.CustomScan` + `DepthRadio_Click` mapping. |
| 1.13 | Empty directories detection | ✅ | `ScanPage.xaml` `EmptyDirs` section; `ScanResult.EmptyDirs` populated from Rust scanner |

---

## 2. Analysis

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 2.1 | File categorization into 12 human-readable groups | ✅ | `ScanViewModel.CategorizeExtension()` maps extensions to 12 categories; rendered in `CategoryDistributions` on Scan page |
| 2.2 | Bloat detection via heuristic pattern classifier | ✅ | Dashboard "Bloat Detection" card is sourced from the Rust `bloat` CLI subcommand (offline_ai::FilePatternClassifier over the latest scan's largest files + top directories, 2026-08-10) with the `AnalysisEngine.GetBloatFindings()` heuristic as fallback when the CLI is unavailable |
| 2.3 | Storage trend prediction based on historical scan data | ✅ | Dashboard "Storage Forecast" card is sourced from the Rust `predict` CLI subcommand (linear regression over scan-history sizes, 2026-08-10) with `AnalysisEngine.PredictStorage()` as fallback; shows a "not enough history" note until ≥2 scans |
| 2.4 | AI recommendations for cleanup, organization, optimization | ✅ | `AnalysisEngine.GetRecommendations()` mirrors `cli/recommendations.rs` (cache/temp dirs, installers, AI models, pip cache, node_modules) and renders a prioritized "Cleanup Recommendations" card on the Dashboard with estimated reclaimable bytes |
| 2.5 | Largest files & directories ranking | ✅ | `ScanPage.xaml` shows `LargestFiles` and `TopDirectories` |

---

## 3. File Management

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 3.1 | Duplicate finder with parallel hashing and optional GPU acceleration | ✅ ⟳FIXED | `DuplicatesPage.xaml` + `DuplicatesViewModel` + `ScannerService.RunDedupAnalysisAsync()` → Rust `dedup` subcommand. **Was broken:** duplicate removal permanently deleted files via `System.IO.File.Delete`, with no recovery (D-2). Fixed 2026-08-10: removals now go to the Recycle Bin via `FileOperations.SendToRecycleBin`; after a removal the page offers to empty the Recycle Bin. A "Hardlink Duplicates" apply button was also added (D-8/D-9). |
| 3.2 | Hard-link deduplication to reclaim space without re-encoding | ✅ ⟳FIXED | `dedup --apply` creates hard links. **Was broken:** no caller ever passed `apply:true`, and `ScannerService` never passed `--yes`, so the backend refused. Fixed 2026-08-10: Duplicates page now has a "Hardlink Duplicates" apply button (`DuplicatesViewModel.ApplyHardlinksAsync` → `RunDedupAnalysisAsync(apply:true)` which adds `--yes`); the `hardlink_duplicates` AI tool now passes `--apply --yes`. |
| 3.3 | Destructive-action preview — DependencyReport before deletion | ✅ ⟳ADDED | Duplicates page now has a "Preview impact before delete" panel: pick a target path → `DuplicatesViewModel.AnalyzeImpactAsync` calls the new `dependencies` Rust CLI subcommand → `file_relations::analyze_file_dependencies` returns a `DependencyReport` (siblings, hardlink count, symlink sources, related files) shown in the UI. `ScannerService.GetDependencyReportAsync` added. |
| 3.4 | Export to JSON, CSV, HTML, and PDF | ✅ | WinUI Scan page `ExportFormat` ComboBox offers json/csv/md/html; `ScannerService.ExportScanResultAsync` serializes all four (HTML added this pass). CSV/MD were already wired |

---

## 4. AI Integration (Optional)

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 4.1 | Ollama-powered AI Assistant with chat, streaming, and tool-calling | ✅ ⟳FIXED | `AIAssistantPage.xaml` + `AIAssistantViewModel.SendMessageAsync()` — full agentic loop with streaming, tool execution, max 10 iterations. **Was broken:** no Stop button, so a runaway loop couldn't be cancelled (D-4). Fixed 2026-08-10: `Abort()` + Stop button on `AIAssistantPage`. |
| 4.2 | Smart Search using semantic embeddings for natural-language file queries | ✅ ⟳ADDED | Smart Search page now has a "Semantic" mode toggle + Index button. `SmartSearchViewModel` indexes a folder via the new `embed` Rust CLI subcommand (`embedding_service.rs` + Ollama `nomic-embed-text`) persisted to SQLite, then runs natural-language queries via the new `semantic-search` subcommand (cosine similarity over stored vectors). `ScannerService.EmbedDirectoryAsync` / `SemanticSearchAsync` added. The original filename/substring search path is unchanged. |
| 4.3 | 14+ tool registry exposing scan/history/volumes/resources/storage_trend/workflows/file_type_breakdown/predict/patterns/search/largest_files/dependencies/stop_scan/export_results | ✅ ⟳FIXED | Re-verified: 15 tools defined & all 15 executable in `ToolExecutor`. Document's own list had 15 entries. No mismatch. |
| 4.4 | Dynamic tool choice — assistant resolves which tools to call based on user message | ✅ | `AIAssistantViewModel.ResolveToolChoice()` — domain-keyword heuristic matching Rust `resolve_tool_choice` |
| 4.5 | Enriched ChatRequest — Options, Think, KeepAlive fields | ✅ | `OllamaClient.SendChatMessageAsync()` populates `options`, `think`, `keep_alive` |
| 4.6 | 100% local — no cloud APIs, no telemetry | ✅ | All Ollama calls are to `localhost`; no external network calls in WinUI frontend |

---

## 5. Workflow Automation

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 5.1 | 5 workflow categories: Maintenance, Optimization, Organization, Monitoring, Custom | ✅ | `WorkflowsViewModel` now groups all 22 templates into the five README categories via a `WorkflowCategory` enum + `WorkflowCategoryGroup` class; `WorkflowsPage` renders one labelled section per category (icon, description, template count) with real, clickable workflow cards. `BuildCategories()` maps each template id to a category and reuses the same `WorkflowTemplate` instances as the master list, so selection state stays in sync |
| 5.2 | 4 trigger types: Manual, LowDiskSpace, FileSystemChange, OnStartup | ❌ | WinUI only supports **Manual** trigger (Run button). No LowDiskSpace, FileSystemChange, or OnStartup triggers implemented. No background scheduler |
| 5.3 | 7 action types: Scan, FindDuplicates, PredictStorage, GenerateRecommendations, Export, Notify, AIAnalyze | ✅ | All seven action types are now runnable workflows on the Workflows page. Scan (16 file-finding templates) and FindDuplicates were already wired; 2026-08-10 added five new templates — Predict Storage (`ScannerService.GetStorageForecastAsync` / `AnalysisEngine.PredictStorage` fallback), Cleanup Recommendations (`AnalysisEngine.GetRecommendations` over the latest scan), Export Results (writes current results to a JSON file), Notify Results (`AppNotifications` toast), and AI Analyze Results (one-shot Ollama call over the results). Path-less actions hide the target-directory editor. |
| 5.4 | Pre-configured templates for common cleanup tasks | ✅ | `WorkflowsViewModel` constructor registers 16 templates: large-files, empty-dirs, duplicate-files, zero-byte, temp-cache, old-files, recent-files, largest-dirs, largest-single, by-extension, size-range, date-range, older-than, hidden-files, read-only, orphaned-projects, downloads-bloat |
| 5.5 | Execution history with status tracking and cancellation | ✅ | The Workflows page now persists every run (workflow name, action type, result count, status, timestamp) to `workflow-history.json` in the app's `LocalFolder` and reloads it on startup, so past runs survive app restarts. Rendered as the "Execution History" list with the action type shown in parentheses. The in-run status message and Cancel button are unchanged. |
| 5.6 | Workflow scheduling (implied by triggers) | ❌ | No scheduler. No background execution. No trigger-based automation |

---

## 6. System Monitoring

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 6.1 | CPU, RAM, GPU, and disk real-time gauges | ✅ ⟳FIXED | Re-verified: GPU gauge is real (`GpuMonitor` Windows perf counters, consumed by Dashboard:491 + System:181). The 2026-08-03 list had wrongly filed this under "⚠️ Partial / GPU hardcoded 0%"; that was already corrected. |
| 6.2 | Per-volume usage with free/total breakdown | ✅ | `DashboardPage.xaml` Disk Usage section + `SystemPage.xaml` Disk Volumes section |
| 6.3 | Storage trend line chart (when ≥2 scans in history) | ✅ | `HistoryPage.xaml` `TrendChartGrid` — visible when `HasHistoryVisibility` is true |
| 6.4 | Background refresh without UI blocking | ✅ | `DispatcherTimer` on Dashboard (3s) and System (2s) pages; heavy work (process enumeration, drive reads) dispatched to `Task.Run` |

---

## 7. Settings

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 7.1 | Configure Ollama endpoint | ✅ | `SettingsPage.xaml` + `SettingsViewModel.OllamaUrl` |
| 7.2 | Default scan paths | ✅ ⟳FIXED | `SettingsViewModel` persists `default_scan_paths`. **Was broken:** the saved value was never consumed, so the setting was cosmetic (D-7). Fixed 2026-08-10: `ScanViewModel.ApplyDefaultScanPath()` now pre-fills the scan path from the setting when non-empty. |
| 7.3 | Theme configuration | ✅ ⟳FIXED | `SettingsPage.xaml` Theme ComboBox (Dark/Light/System) + `SettingsViewModel.ApplyTheme()`. **Was broken:** `ApplyTheme` set `Application.Current.RequestedTheme` (ignored after content loads) and startup ignored "System" (D-5). Fixed 2026-08-10: theme now set via `ElementTheme` on `MainWindow.Current.Content`; "System" maps to the live OS theme. |
| 7.4 | GPU toggle | ✅ ⟳FIXED | `SettingsViewModel.GpuAcceleration` persisted + read by `ScanViewModel` → `ScannerService.GpuAcceleration`; scans/dedup pass `--no-gpu` when disabled. **Was broken:** `ScanViewModel` read the toggle once at construction, so changing it in Settings had no effect on an open Scan page (D-6). Fixed 2026-08-10: `SettingsStore.SettingsChanged` now live-updates `GpuAcceleration` + `IncludeHidden` in `ScanViewModel`. |

---

## 8. Additional Findings Not Explicitly in README

| # | Finding | Status | Evidence / Gap |
|---|---------|--------|----------------|
| 8.1 | AppLog diagnostic logger | ✅ | README mentions `%LOCALAPPDATA%/SpaceAnalyzer/ui-actions.log` with NAV/PAGE/ACTION/ERROR categories |
| 8.2 | Token-based design system (App.xaml resource dictionaries) | ✅ | `App.xaml` defines spacing, typography, icon-size, card, button, progress-bar resource dictionaries |
| 8.3 | Dashboard quick actions (9 buttons) | ✅ | `DashboardPage.xaml` has 9 quick-action buttons: New Scan, History, Duplicates, AI Chat, Cleanup, System, Search, Workflows, Settings |
| 8.4 | Cleanup page (node_modules cleaner) | ✅ | `CleanupPage.xaml` + `CleanupViewModel` + `ScannerService.RunCleanupAnalysisAsync()` calls `node_modules_cleaner.exe` |
| 8.5 | About page | ✅ | `AboutPage.xaml` exists (not inspected in detail, but present in Views/) |
| 8.6 | Smart Search wildcard support (`*`) | ✅ ⟳FIXED | Re-verified: full glob matcher including `|` OR-patterns lives at `SmartSearchViewModel.cs:265-299`. The 2026-08-03 ⚠️ mark was already fixed. |
| 8.7 | History page file explorer with sort/filter | ✅ | `HistoryPage.xaml` has sortable columns (Size, Name), filter TextBox, Open/Folder buttons |
| 8.8 | Scan page drag-and-drop folder support | ✅ | `ScanPage.xaml` has `DragOver` + `Drop` handlers |
| 8.9 | Dashboard resource history charts (canvas) | ✅ | `DashboardPage.xaml` has `CpuChartGrid`, `MemChartGrid`, `DiskChartGrid` driven by `_cpuHistory`, `_memoryHistory`, `_diskHistory` |
| 8.10 | Dashboard donut/pie charts | ✅ | `DashboardPage.xaml` has `DiskUsageDonutGrid` + `FileTypePieGrid` |

---

## Defects Discovered & Fixed (2026-08-10)

Eleven UX/functional defects were found during the manual-test risk review and fixed the same day. All fixes compiled clean (MSBuild: 0 errors, 0 warnings).

| ID | Component | Defect | Fix |
|----|-----------|--------|-----|
| D-1 | Settings | Six boolean settings (`IncludeHiddenFiles`, `IncludeSystemFiles`, `UseGpu`, `AutoRefresh`, `ConfirmBeforeDelete`, `EnableAnimations`) could never be turned **off** — `SettingsStore` wrote C# `bool.ToString()` (`"True"`/`"False"`) but read via `value.ToLower() == "true"`, and the read happened to also mis-handle the casing, so once enabled a setting was stuck on. | Added `SettingsStore.GetBool`/`SetBool` (store lowercase `"true"`/`"false"`); migrated `SettingsViewModel`, `AIAssistantViewModel`, `ScanViewModel` to the new helpers. |
| D-2 | Duplicates / AI | Duplicate removal used `System.IO.File.Delete` — files were **permanently** erased with no recovery path. | Added `FileOperations.SendToRecycleBin` (SHFileOperation to Recycle Bin) as the single delete primitive; `DuplicatesViewModel.RemoveSelectedAsync` now sends to Recycle Bin and raises `FilesSentToRecycleBin`; `DuplicatesPage` then offers to empty the Recycle Bin. `ToolExecutor.MoveToTrashPreviewAsync` likewise uses the Recycle Bin. |
| D-3a | Scan export | The Export format `ComboBox` (json/csv/md/html) was discarded — `Export_Click` always hardcoded `.json` and the picker column overlapped the status row. | `Export_Click` now honors the selected format and writes the matching extension; `ScanPage` grid expanded to 6 columns so the format picker no longer overlaps. |
| D-3b | Scan depth | The "Custom" scan-depth option was unreachable — no `Custom` radio button existed and `DepthRadio_Click` had no `Custom` branch. | Added a `Custom` radio button + `CustomScan` property/`_customScan` field; `DepthRadio_Click` now maps `Custom` to the slider value. |
| D-4 | AI Assistant | No Stop button — a runaway agentic loop (e.g. a model that keeps calling tools) could not be cancelled. | Added `AIAssistantViewModel.Abort()` plus a Stop button on `AIAssistantPage` wired to `Abort()`. |
| D-5 | Theme | `SettingsViewModel.ApplyTheme` set `Application.Current.RequestedTheme`, which WinUI ignores after content loads, and `App` startup only honored Light/Dark (System theme silently did nothing). | `ApplyTheme` now sets `ElementTheme` on `MainWindow.Current.Content` (live switch); `App.ApplySavedTheme` maps `"System"` → current OS theme via `DetectSystemTheme`. |
| D-6 | Settings sync | Two independent "Include hidden files" settings existed (Settings page vs Scan page) and the GPU toggle was read once at `ScanViewModel` construction, so toggling in Settings had no effect on an already-open Scan page. | Added `SettingsStore.SettingsChanged` event; `ScanViewModel` subscribes in its constructor and `OnSettingsChanged` re-reads `IncludeHidden` + `GpuAcceleration` live; removed the duplicate Scan-page `IncludeHidden` persistence. |
| D-7 | Settings | `default_scan_paths` was cosmetic — persisted but never consumed. | Added `ScanViewModel.ApplyDefaultScanPath()` which pre-fills the scan path when the saved value is non-empty. |
| D-8 | AI Assistant | `move_to_trash` tool told users to use a "Destructive-Action Preview" screen that does not exist, and `hardlink_duplicates` never applied (no `--apply --yes`). | `MoveToTrashPreviewAsync` now performs a real Recycle-Bin delete; `HardlinkDuplicatesPreviewAsync` applies with `--apply --yes` (safe — hardlinks never destroy data). A "Hardlink Duplicates" button was added to the Duplicates page (`DuplicatesViewModel.ApplyHardlinksAsync`). |
| D-9 | ScannerService | `RunDedupAnalysisAsync(apply:true)` did not append `--yes`, so the backend refused to apply hardlinks. | `--yes` is now appended when `apply` is true. |
| D-10 | Build | `DedupResult.SpaceSavedBytes` is `ulong?`; passing it to `ByteFormatter.FormatBytes` failed to compile, and `SettingsViewModel.ApplyTheme` used `Application.Current` (not a `Window`) with a mismatched `ApplicationTheme`/`ElementTheme` enum. | `?? 0UL` fallback + `MainWindow.Current.Content` with `ElementTheme` mapping. |

> Net effect: the remaining open items in this tracker are the **workflow-automation** gaps that need a background scheduler — **triggers** (Manual is implemented; LowDiskSpace, FileSystemChange, OnStartup are not) and **scheduling** (5.6). The three previously-backend-only items (USN Journal, destructive-action preview, semantic Smart Search), the **feature-gap analysis cards** (Bloat Detection + Storage Forecast), the **action types** (5.3), the **category grouping** (5.1), and **execution history** (5.5) are now fully implemented and exposed in the WinUI UI as of 2026-08-10.

---

## Summary: Gap Count by Severity

> **Reconciled 2026-08-11** against the detailed rows above (the rows are authoritative;
> the previous summary table here was stale and has been corrected to match them).

<!--GAP_SUMMARY_START-->
| Category | ✅ Implemented | ⚠️ Partial | ❌ Missing | 🔵 Backend-only |
|----------|--------------|-----------|-----------|-----------------|
| Core Scanning | 12 | 0 | 0 | 1 |
| Analysis | 5 | 0 | 0 | 0 |
| File Management | 4 | 0 | 0 | 0 |
| AI Integration | 6 | 0 | 0 | 0 |
| Workflow Automation | 4 | 0 | 2 | 0 |
| System Monitoring | 4 | 0 | 0 | 0 |
| Settings | 4 | 0 | 0 | 0 |
| **Total (§1–7)** | **39** | **0** | **2** | **1** |
<!--GAP_SUMMARY_END-->

> Additional findings (§8) add 10 more implemented items (8.1–8.10).
> The only remaining ❌ items are the two **workflow-automation** gaps (5.2 triggers,
> 5.6 scheduling), which are **on hold** per `ARCHITECTURE_DECISIONS.md` §8.

### Critical Gaps (❌ Missing — README promises with no implementation)

1. ~~**Smart Search is not semantic**~~ **RESOLVED 2026-08-10** (`README.md:189`): Smart Search now has a semantic mode (embed + cosine-similarity query via the new `embed`/`semantic-search` Rust CLI subcommands). The filename/substring path remains for non-semantic queries.
2. **Workflow triggers not implemented** (`README.md:158-159`): Claims 4 trigger types (Manual, LowDiskSpace, FileSystemChange, OnStartup). Only Manual is implemented. No background scheduler. **ON HOLD** — per `ARCHITECTURE_DECISIONS.md` §8, blocked until all other systems are proven stable because misconfiguration could cause destructive changes on the user's machine.
3. ~~**Workflow action types incomplete**~~ **RESOLVED 2026-08-10** (`README.md:159`): All 7 action types (Scan, FindDuplicates, PredictStorage, GenerateRecommendations, Export, Notify, AIAnalyze) are now runnable workflows on the Workflows page.

### High-Priority Partial Gaps (⚠️ Partial — behavior does not match README claim)

> Re-verified 2026-08-11 against the detailed rows above. Most items originally listed here
> were already fixed; the only genuinely remaining partial gap is **PDF export** (#6).

4. ~~**GPU monitoring is a placeholder**~~ **RESOLVED** (`6.1`): GPU gauge is real — `GpuMonitor` Windows perf counters; the "hardcoded 0%" claim was incorrect.
5. ~~**GPU acceleration toggle is cosmetic**~~ **RESOLVED** (`7.4`, D-6): `SettingsStore.SettingsChanged` live-updates `GpuAcceleration` in `ScanViewModel`/`DedupViewModel`.
6. **Export formats** (`README.md:146`): Claims "JSON, CSV, HTML, and PDF". **JSON/CSV/MD/HTML are implemented** (`3.4`); **PDF is still not** exported from the WinUI UI. Minor gap — keep low priority.
7. ~~**Smart Search wildcard not implemented**~~ **RESOLVED** (`8.6`): full glob matcher incl. `|` OR-patterns lives in `SmartSearchViewModel`.
8. ~~**NTFS USN Journal not exposed**~~ **RESOLVED** (`1.3`): `UsnPage` exposes USN status via the `usn` CLI subcommand.
9. ~~**Storage trend prediction not surfaced**~~ **RESOLVED** (`2.3`): Dashboard "Storage Forecast" card driven by `predict` CLI.
10. ~~**Bloat detection not surfaced**~~ **RESOLVED** (`2.2`): Dashboard "Bloat Detection" card driven by `bloat` CLI.
11. ~~**Workflow execution history missing**~~ **RESOLVED** (`5.5`): persisted to `workflow-history.json`.
12. ~~**Default scan paths not configurable**~~ **RESOLVED** (`7.2`, D-7): `default_scan_paths` persisted + consumed by `ScanViewModel.ApplyDefaultScanPath()`.

### Backend-Only Gaps (🔵 Rust core has it, WinUI does not expose it)

13. ~~**Hard-link deduplication UI**~~ **RESOLVED** (`3.2`, D-8/D-9): "Hardlink Duplicates" apply button on Duplicates page + `hardlink_duplicates` AI tool passes `--apply --yes`.
14. ~~**Destructive-action preview UI**~~ **RESOLVED** (`3.3`): "Preview impact before delete" panel backed by `file_relations::analyze_file_dependencies`.
> Note: `1.4` (hard-link *detection* via MFT) remains 🔵 backend-only — exposed only via the `preview_impact` AI tool, not a dedicated WinUI view.

---

## Recommendations

1. ~~**Fix Smart Search to actually use embeddings**~~ DONE (`4.2`).
2. **Implement workflow triggers** — LowDiskSpace, FileSystemChange, OnStartup + background scheduler. **ON HOLD** (see `ARCHITECTURE_DECISIONS.md` §8): blocked until all other systems are proven stable, because misconfiguration could cause destructive changes.
3. ~~**Wire GPU acceleration**~~ DONE (`7.4`, D-6).
4. **Add PDF export** — JSON/CSV/MD/HTML already wired (`3.4`); PDF still needs a Rust output formatter. Low priority.
5. ~~**Implement wildcard expansion**~~ DONE (`8.6`).
6. ~~**Add workflow execution history**~~ DONE (`5.5`).
7. ~~**Surface bloat detection**~~ DONE (`2.2`).
8. ~~**Add hardlink dedup action**~~ DONE (`3.2`, D-8).

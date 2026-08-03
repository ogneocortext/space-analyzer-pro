# Space Analyzer Pro — Feature Gap Analysis

**Date:** 2026-08-03
**Scope:** WinUI 3 frontend (`gui-winui/`) + Rust core (`src/`) vs README feature claims
**Source of truth for promises:** `README.md` "Features" and "Tabs" sections

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
| 1.3 | NTFS USN Journal scanner for incremental change tracking | ⚠️ | Rust `native/scanner/` has USN Journal support. WinUI frontend always launches fresh scans; no incremental/diff scan mode exposed in UI |
| 1.4 | Hard-link detection via MFT parsing | 🔵 | Rust `native/scanner/` + `file_relations.rs` have hardlink detection. WinUI exposes only via AI tool `preview_impact`; no direct UI for viewing hardlinks |
| 1.5 | Scan history with comparison, filtering, SQLite-backed persistence | ✅ | `HistoryPage.xaml` + `HistoryViewModel` — list, search, sort, compare, delete; Rust `database/scans.rs` persists to SQLite |
| 1.6 | Path validation before scan starts | ✅ | `ScanViewModel.PathExists` + inline error in `ScanPage.xaml` |
| 1.7 | Scan cancellation — Stop button kills scanner process tree | ✅ | `ScanViewModel.StopScan()` → `ScannerService.StopScan()` → `process.Kill(entireProcessTree: true)` |
| 1.8 | Scan errors — per-scan error list displayed in results panel | ✅ | `ScanPage.xaml` has `ScanErrors` section; `ScanResult.Errors` populated from Rust scanner |
| 1.9 | File type distribution — top 10 extensions with percentage breakdown | ✅ | `ScanPage.xaml` `FileTypes` + `CategoryDistributions` ItemsRepeaters; Rust emits `file_types` + `extension_sizes` |
| 1.10 | Largest files with live filter by filename substring | ✅ | `ScanPage.xaml` `FilteredLargestFiles` + `LargestFilesFilter` TextBox |
| 1.11 | Export results to JSON file | ✅ | `ScanPage.xaml` Export button → `ScannerService.ExportScanResultAsync()` |
| 1.12 | Deep/shallow/custom depth scan modes | ✅ | `ScanPage.xaml` radio buttons + custom slider; `ScannerService.DepthMode` enum |
| 1.13 | Empty directories detection | ✅ | `ScanPage.xaml` `EmptyDirs` section; `ScanResult.EmptyDirs` populated from Rust scanner |

---

## 2. Analysis

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 2.1 | File categorization into 12 human-readable groups | ✅ | `ScanViewModel.CategorizeExtension()` maps extensions to 12 categories; rendered in `CategoryDistributions` on Scan page |
| 2.2 | Bloat detection via heuristic pattern classifier | 🔵 | Rust `offline_ai.rs` has bloat pattern classifier. WinUI does **not** expose this in the Scan page or any dedicated UI. Only accessible indirectly through AI Assistant prompts |
| 2.3 | Storage trend prediction based on historical scan data | ⚠️ | Rust `disk_monitor.rs` + history DB support trends. WinUI History page shows a trend chart (`TrendChartGrid`) when ≥2 records exist. AI Assistant has `predict_storage` tool. No dedicated "Predictions" UI section |
| 2.4 | AI recommendations for cleanup, organization, optimization | ⚠️ | Rust `cli/recommendations.rs` generates recommendations. WinUI AI Assistant can surface these via `get_scan_summary` / `analyze_file_patterns` tools, but there is no dedicated "Recommendations" panel in the Scan or History pages |
| 2.5 | Largest files & directories ranking | ✅ | `ScanPage.xaml` shows `LargestFiles` and `TopDirectories` |

---

## 3. File Management

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 3.1 | Duplicate finder with parallel hashing and optional GPU acceleration | ✅ | `DuplicatesPage.xaml` + `DuplicatesViewModel` + `ScannerService.RunDedupAnalysisAsync()` → Rust `dedup` subcommand |
| 3.2 | Hard-link deduplication to reclaim space without re-encoding | 🔵 | Rust `native/file_deduplicator/` + `file_relations.rs` support hardlink dedup. WinUI exposes only as AI tool `hardlink_duplicates` (preview only). No direct UI for running hardlink dedup |
| 3.3 | Destructive-action preview — DependencyReport before deletion | 🔵 | Rust `file_relations.rs` has `DependencyReport`. WinUI exposes via AI tool `preview_impact`. No direct UI button for "Preview before delete" on scan results |
| 3.4 | Export to JSON, CSV, HTML, and PDF | ⚠️ | Rust CLI `--format` supports `json`, `csv`, `md`. WinUI Scan page only exposes JSON export (`ExportScanResultAsync`). CSV/HTML/PDF export not wired in WinUI UI |

---

## 4. AI Integration (Optional)

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 4.1 | Ollama-powered AI Assistant with chat, streaming, and tool-calling | ✅ | `AIAssistantPage.xaml` + `AIAssistantViewModel.SendMessageAsync()` — full agentic loop with streaming, tool execution, max 10 iterations |
| 4.2 | Smart Search using semantic embeddings for natural-language file queries | ❌ | README claims "semantic search via local embeddings". WinUI `SmartSearchPage.xaml` + `SmartSearchViewModel` is a **filename/substring search**, not semantic embedding search. Rust `embedding_service.rs` + `ollama/client/embeddings.rs` exist but are **not consumed** by the WinUI Smart Search page |
| 4.3 | 14+ tool registry exposing scan/history/volumes/resources/storage_trend/workflows/file_type_breakdown/predict/patterns/search/largest_files/dependencies/stop_scan/export_results | ✅ | `AIAssistantViewModel.GetToolDefinitions()` returns 14 tools: `get_disk_volumes`, `get_system_resources`, `get_storage_trend`, `list_workflows`, `predict_storage`, `preview_impact`, `move_to_trash`, `hardlink_duplicates`, `run_scan`, `analyze_file_patterns`, `get_scan_summary`, `get_file_type_breakdown`, `search_files`, `get_largest_files`, `run_workflow` |
| 4.4 | Dynamic tool choice — assistant resolves which tools to call based on user message | ✅ | `AIAssistantViewModel.ResolveToolChoice()` — domain-keyword heuristic matching Rust `resolve_tool_choice` |
| 4.5 | Enriched ChatRequest — Options, Think, KeepAlive fields | ✅ | `OllamaClient.SendChatMessageAsync()` populates `options`, `think`, `keep_alive` |
| 4.6 | 100% local — no cloud APIs, no telemetry | ✅ | All Ollama calls are to `localhost`; no external network calls in WinUI frontend |

---

## 5. Workflow Automation

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 5.1 | 5 workflow categories: Maintenance, Optimization, Organization, Monitoring, Custom | ⚠️ | WinUI `WorkflowsViewModel` has 16 workflow **templates** but no category grouping in UI. The XAML shows 3 hardcoded category cards (Find Large Files, Find Empty Dirs, Find Duplicates) that are not clickable — they're decorative |
| 5.2 | 4 trigger types: Manual, LowDiskSpace, FileSystemChange, OnStartup | ❌ | WinUI only supports **Manual** trigger (Run button). No LowDiskSpace, FileSystemChange, or OnStartup triggers implemented. No background scheduler |
| 5.3 | 7 action types: Scan, FindDuplicates, PredictStorage, GenerateRecommendations, Export, Notify, AIAnalyze | ⚠️ | WinUI implements: Scan (via `RunFindLargeFilesAsync` etc.), FindDuplicates (`RunFindDuplicatesAsync`). PredictStorage/GenerateRecommendations/Export/Notify/AIAnalyze are **not** exposed as workflow actions. The `run_workflow` AI tool can trigger some of these but the Workflows page itself only runs file-finding workflows |
| 5.4 | Pre-configured templates for common cleanup tasks | ✅ | `WorkflowsViewModel` constructor registers 16 templates: large-files, empty-dirs, duplicate-files, zero-byte, temp-cache, old-files, recent-files, largest-dirs, largest-single, by-extension, size-range, date-range, older-than, hidden-files, read-only, orphaned-projects, downloads-bloat |
| 5.5 | Execution history with status tracking and cancellation | ⚠️ | WinUI shows current run results with status message and Cancel button. No persistent execution history log of past workflow runs |
| 5.6 | Workflow scheduling (implied by triggers) | ❌ | No scheduler. No background execution. No trigger-based automation |

---

## 6. System Monitoring

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 6.1 | CPU, RAM, GPU, and disk real-time gauges | ⚠️ | Dashboard + System page show **CPU** and **Memory** gauges. `GpuUsage` is hardcoded to `0` in `DashboardViewModel.RefreshSystemResources()` — no real GPU monitoring. Disk usage shows aggregated used/total across all drives |
| 6.2 | Per-volume usage with free/total breakdown | ✅ | `DashboardPage.xaml` Disk Usage section + `SystemPage.xaml` Disk Volumes section |
| 6.3 | Storage trend line chart (when ≥2 scans in history) | ✅ | `HistoryPage.xaml` `TrendChartGrid` — visible when `HasHistoryVisibility` is true |
| 6.4 | Background refresh without UI blocking | ✅ | `DispatcherTimer` on Dashboard (3s) and System (2s) pages; heavy work (process enumeration, drive reads) dispatched to `Task.Run` |

---

## 7. Settings

| # | Feature (from README) | Status | Evidence / Gap |
|---|----------------------|--------|----------------|
| 7.1 | Configure Ollama endpoint | ✅ | `SettingsPage.xaml` + `SettingsViewModel.OllamaUrl` |
| 7.2 | Default scan paths | ⚠️ | `SettingsViewModel.ScanDepth` and `IncludeHidden` are persisted. No explicit "default scan paths" list in Settings — paths are entered per-scan |
| 7.3 | Theme configuration | ✅ | `SettingsPage.xaml` Theme ComboBox (Dark/Light/System) + `SettingsViewModel.ApplyTheme()` |
| 7.4 | GPU toggle | ⚠️ | `SettingsViewModel.GpuAcceleration` is persisted but **never read or acted upon** by `ScannerService` or any scan code. The toggle is cosmetic |

---

## 8. Additional Findings Not Explicitly in README

| # | Finding | Status | Evidence / Gap |
|---|---------|--------|----------------|
| 8.1 | AppLog diagnostic logger | ✅ | README mentions `%LOCALAPPDATA%/SpaceAnalyzer/ui-actions.log` with NAV/PAGE/ACTION/ERROR categories |
| 8.2 | Token-based design system (App.xaml resource dictionaries) | ✅ | `App.xaml` defines spacing, typography, icon-size, card, button, progress-bar resource dictionaries |
| 8.3 | Dashboard quick actions (9 buttons) | ✅ | `DashboardPage.xaml` has 9 quick-action buttons: New Scan, History, Duplicates, AI Chat, Cleanup, System, Search, Workflows, Settings |
| 8.4 | Cleanup page (node_modules cleaner) | ✅ | `CleanupPage.xaml` + `CleanupViewModel` + `ScannerService.RunCleanupAnalysisAsync()` calls `node_modules_cleaner.exe` |
| 8.5 | About page | ✅ | `AboutPage.xaml` exists (not inspected in detail, but present in Views/) |
| 8.6 | Smart Search wildcard support (`*`) | ⚠️ | `SmartSearchPage.xaml` tips mention "Use * as a wildcard" but `SmartSearchViewModel.WalkDirectory` uses `string.Contains(query)` — no wildcard expansion |
| 8.7 | History page file explorer with sort/filter | ✅ | `HistoryPage.xaml` has sortable columns (Size, Name), filter TextBox, Open/Folder buttons |
| 8.8 | Scan page drag-and-drop folder support | ✅ | `ScanPage.xaml` has `DragOver` + `Drop` handlers |
| 8.9 | Dashboard resource history charts (canvas) | ✅ | `DashboardPage.xaml` has `CpuChartGrid`, `MemChartGrid`, `DiskChartGrid` driven by `_cpuHistory`, `_memoryHistory`, `_diskHistory` |
| 8.10 | Dashboard donut/pie charts | ✅ | `DashboardPage.xaml` has `DiskUsageDonutGrid` + `FileTypePieGrid` |

---

## Summary: Gap Count by Severity

| Category | ✅ Implemented | ⚠️ Partial | ❌ Missing | 🔵 Backend-only |
|----------|--------------|-----------|-----------|-----------------|
| Core Scanning | 11 | 2 | 0 | 0 |
| Analysis | 2 | 3 | 0 | 0 |
| File Management | 2 | 1 | 0 | 2 |
| AI Integration | 4 | 0 | 1 | 0 |
| Workflow Automation | 1 | 3 | 2 | 0 |
| System Monitoring | 2 | 1 | 0 | 0 |
| Settings | 2 | 2 | 0 | 0 |
| **Total** | **24** | **12** | **3** | **2** |

### Critical Gaps (❌ Missing — README promises with no implementation)

1. **Smart Search is not semantic** (`README.md:189`): Claims "semantic search via local embeddings (requires Ollama)". The WinUI Smart Search page is a plain filename substring search. The Rust embedding service exists but is not consumed by the WinUI frontend.
2. **Workflow triggers not implemented** (`README.md:158-159`): Claims 4 trigger types (Manual, LowDiskSpace, FileSystemChange, OnStartup). Only Manual is implemented. No background scheduler.
3. **Workflow action types incomplete** (`README.md:159`): Claims 7 action types. WinUI Workflows page only runs file-finding workflows; PredictStorage, GenerateRecommendations, Export, Notify, AIAnalyze are not exposed.

### High-Priority Partial Gaps (⚠️ Partial — behavior does not match README claim)

4. **GPU monitoring is a placeholder** (`README.md:164`): Claims "CPU, RAM, GPU, and disk real-time gauges". GPU gauge is hardcoded to 0% in `DashboardViewModel.cs:320`.
5. **GPU acceleration toggle is cosmetic** (`README.md:206`): Settings page has a "GPU acceleration" checkbox but it is persisted and never consumed by scan or dedup code.
6. **Export formats limited** (`README.md:146`): Claims export to "JSON, CSV, HTML, and PDF". WinUI only exports JSON. CSV/HTML/PDF export not wired in the UI.
7. **Smart Search wildcard not implemented** (`SmartSearchPage.xaml:85`): UI tip says "Use * as a wildcard" but search logic uses `string.Contains()` without wildcard expansion.
8. **NTFS USN Journal not exposed** (`README.md:124`): Rust core supports incremental USN Journal scanning but WinUI always performs fresh scans.
9. **Storage trend prediction not surfaced** (`README.md:139`): Rust core + AI tool exist, but no dedicated prediction UI.
10. **Bloat detection not surfaced** (`README.md:137`): Rust `offline_ai.rs` classifier exists but no WinUI panel shows bloat candidates directly.
11. **Workflow execution history missing** (`README.md:161`): No persistent log of past workflow runs.
12. **Default scan paths not configurable** (`README.md:196`): Settings does not expose a list of default scan paths; users must type or browse each time.

### Backend-Only Gaps (🔵 Rust core has it, WinUI does not expose it)

13. **Hard-link deduplication UI** (`README.md:144`): Rust `file_deduplicator` + `file_relations.rs` have full support. WinUI exposes only as AI Assistant tool preview.
14. **Destructive-action preview UI** (`README.md:145`): Rust `DependencyReport` is comprehensive. WinUI exposes only via AI tool `preview_impact`, not as a direct UI action on scan results.

---

## Recommendations

1. **Fix Smart Search to actually use embeddings** — either rename the page to "File Search" or wire up `embedding_service.rs` + Ollama `/api/embeddings` to make it truly semantic.
2. **Implement workflow triggers** — add a background scheduler (e.g. `Timer` or `BackgroundService`) for LowDiskSpace, FileSystemChange, and OnStartup triggers.
3. **Wire GPU acceleration** — read `GpuAcceleration` setting in `ScannerService` and pass `--gpu` flag to Rust dedup/scanner when enabled.
4. **Add CSV/HTML/PDF export** — expose format selector in `ScanPage.xaml` and route to Rust CLI `--format csv|md` (HTML/PDF would need new Rust output formatters).
5. **Implement wildcard expansion** in `SmartSearchViewModel.WalkDirectory` — convert `*` to `Contains` logic or regex.
6. **Add workflow execution history** — persist workflow runs to SQLite (`database/workflows.rs` already exists) and display in `WorkflowsPage`.
7. **Surface bloat detection** — add a "Bloat Candidates" section to Scan page using Rust `offline_ai.rs` output.
8. **Add hardlink dedup action** — add a "Hardlink Duplicates" button to Duplicates page that calls the Rust dedup with hardlink mode.

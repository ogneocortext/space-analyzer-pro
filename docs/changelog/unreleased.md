# [Unreleased]

## Agentic Assistant — search tool, loop guard, streaming

### Added
- **Rust `search` subcommand** (`src/cli/search.rs`, wired in `src/cli/mod.rs`) — real
  bounded filesystem search with `--path`, `--extension`, `--keyword`, `--min-size <N>M`,
  `--max-size <N>M`, `--include-hidden`, `--limit`, `--format json`. Reuses the existing
  `scan-engine` walk; returns matches with size + mtime.
- **`search_files` agentic tool** now forwards `size_min_mb` / `size_max_mb` /
  `include_hidden` to the Rust `search` CLI (`ToolExecutor.ScanAnalysis.cs`,
  `AIAssistantViewModel.Tools.cs`). New `ToolExecutor.Helpers.GetBool` unwraps
  `JsonElement` / `bool` / `int` / `long` / string argument values.
- **`semantic_search` agentic tool** — connects the AI Assistant to the existing
  embeddings backend. The agentic loop previously had *only* lexical search
  (`search_files`); it is now also able to answer natural-language queries
  ("large video files from last year", "my tax documents from 2023") via the
  Rust `embed` + `semantic-search` subcommands. The first query for a folder
  auto-builds a semantic index on demand (one-time, via `ScannerService.EmbedDirectoryAsync`),
  then reuses it for later queries in the session (`ToolExecutor._semanticIndexByPath`).
  Tool def in `AIAssistantViewModel.Tools.cs`; handler `SemanticSearchFilesAsync`
  in `ToolExecutor.ScanAnalysis.cs`; dispatch added to `ToolExecutor.ExecuteAsync`.
- **Duplicate tool-call guard** (`AIAssistantViewModel.Chat.cs`) — a per-turn
  `HashSet<(toolName|serializedArgs)>` detects an identical repeated tool call and appends a
  `[System note: …]` nudge to the model-facing result (not the on-screen message) so the
  model converges on an answer instead of looping until the iteration cap.
- **Token-by-token streaming** of assistant responses (`OllamaClient.SendChatMessageStreamAsync`,
  `IAsyncEnumerable<ChatStreamChunk>`) — the chat bubble grows live as text arrives; `ThinkingStatus`
  clears on the first token so the answer appears immediately instead of after a full round-trip.
  Tool turns and the final-answer path are unchanged; a partial text bubble is dropped if a tool
  call arrives mid-stream. Candidate/fallback + transient-retry behavior is preserved via
  `GetStreamingResponseAsync`.

### Changed
- `OllamaClient` request building consolidated into a shared `BuildChatRequest` helper used by both
  the streaming and non-streaming chat paths.

- **Live tool-progress text streaming into the chat bubble** (`AIAssistantViewModel.Chat.cs`) —
  each tool call now spawns a `Tool`-role chat bubble that fills in with streamed progress text
  (e.g. `Running run_scan — 45% · 12,345 files…`) as the tool runs, mirroring the final-answer
  token streaming. The bubble swaps to the truncated tool result when execution finishes. Instant
  tools show a `Running…` placeholder, then the result.

- **Optimized tool-progress streaming** (follow-up to the live bubble work):
  - Removed the duplicated tool name from the bubble: `[run_scan] Running run_scan — …`
    now renders as `[run_scan] Running — …` (the bubble header already shows the
    tool name). The status bar keeps the full `Running <tool> — …` text.
  - Extended live progress to the **`search_files`** tool. The Rust `search`
    subcommand now emits `__PROGRESS__` lines (every 8192 files) when called with
    the new `--progress-json` flag, and `ToolExecutor.RunCliAsync` parses them via a
    `ReadStderrWithProgressAsync` helper (mirroring `ScannerService`). So
    `search_files` bubbles stream `Running search_files — <N> files…` instead of
    sitting at `Running…` until the (often slow) search returns.

### Verified
- Interactive probe (`SpaceAnalyzer.Tests/StreamingProbeTests.cs`) exercises the REAL
  `run_scan` streaming path and the REAL `search --progress-json` CLI, confirming both
  bubble shapes stream live (run_scan ~32 updates @ ~200ms; search ~7 updates). WinUI
  GUI MSBuild build: 0 errors / 0 warnings. `cargo test --workspace` clean; C# suite 17 passed.
- `cargo build --bin space-analyzer-cli` + `cargo test --workspace` clean; `search` subcommand
  smoke-tested (finds `.log` files including nested subdirectories).
- WinUI GUI MSBuild build: 0 errors / 0 warnings after adding the `semantic_search`
  tool and handler (no Rust changes required — the `embed` / `semantic-search`
  subcommands and their C# wrappers already existed and were simply not exposed
  to the agentic loop).

## Embedding pipeline — hardening & fixes

Reviewed the existing embeddings backend (Rust `embed` / `semantic-search` +
`embedding_service` + SQLite `file_embeddings` + C# wrappers + the new
`semantic_search` agentic tool) end-to-end. It was already DB-connected; this
pass fixed six issues found during the review.

### Added
- **`--if-not-indexed` flag** on the Rust `embed` subcommand (`src/cli/args.rs`,
  `src/cli/mod.rs`, `src/cli/semantic.rs`) and an `ifNotIndexed` parameter on
  `ScannerService.EmbedDirectoryAsync` (`ScannerService.Cleanup.cs`). When set,
  `run_embed` checks `get_embedding_model(scan_id)` against the current model and
  `count_embeddings_for_scan(scan_id)`; if a fresh index already exists it returns
  the existing count (`reused: true`) instead of re-running the whole Ollama job and
  clobbering a GUI-built index. The agentic `SemanticSearchFilesAsync`
  (`ToolExecutor.ScanAnalysis.cs`) passes `ifNotIndexed: true`.
- **`is_index_only` column** on `scan_history` (migration guarded, `user_version = 8`
  in `src/database/mod.rs`; persisted by `save_scan` in `src/database/scans/queries.rs`).
  Index-only placeholder scans created by `embed` with no real scan are tagged so the
  History UI hides them and overflow pruning leaves them alone. C# `ScanHistoryRecord.IsIndexOnly`
  + `HistoryViewModel` filter them from the list; the agentic `FindCachedScanAsync` still
  reaches them via the raw service call so reuse works.
- **`min_score`** optional argument on the `semantic_search` agentic tool
  (`AIAssistantViewModel.Tools.cs`, `ToolExecutor.ScanAnalysis.cs`) — read via the new
  `ToolExecutor.Helpers.GetDouble` helper and forwarded to `SemanticSearchAsync` (floored > 0).
- **`count_embeddings_for_scan`** helper on `Database` (`src/database/embeddings.rs`).

### Changed
- **`collect_files`** (`src/cli/semantic.rs`) now walks up to a bounded `collect_cap`
  (16× `file_limit`) and performs deterministic even-spread sampling to `file_limit`,
  fixing the depth-first sampling bias that previously embedded the first N files in
  directory order instead of a representative slice.
- **`run_embed`** now validates that an explicitly-supplied `--scan-id` belongs to the
  requested path before using it (rejects path mismatches instead of silently embedding
  the wrong tree).
- **`run_embed`** now asserts `records.len() == n_files` after zipping files with
  embeddings and fails loudly on desync instead of silently truncating.

### Fixed
- **Regression: index-only scan dropped by `prune_path_overflow`** (`src/database/scans/queries.rs`).
  The keep-list subquery filtered to `is_index_only = 0`, so for an index-only-only path the
  keep-list was empty and the `NOT IN` deleted the just-created scan row — leaving
  `save_embeddings` with a dangling `scan_id` (FOREIGN KEY constraint failed). The DELETE now
  only targets non-index-only rows, so index-only anchors survive; `prune_empty_scans` also
  excludes them. Verified live: `embed` → 105 files indexed, `semantic-search` returns
  relevant results, `--if-not-indexed` reuses (`reused: true`) instead of re-embedding, and
  a mismatched `--scan-id` is rejected.

### Verified
- Rust: `cargo build --bin space-analyzer-cli` clean; `cargo test --bin space-analyzer-cli`
  34 passed / 0 failed / 1 ignored. Live end-to-end against Ollama (`nomic-embed-text:v1.5`,
  already running): embedded `scripts/` (105 files), ran a semantic query (relevant matches
  returned), confirmed `--if-not-indexed` reuse and path-mismatch rejection.
- WinUI GUI MSBuild build: 0 errors / 0 warnings (no C# change this pass beyond the
  `min_score` / `ifNotIndexed` wiring already verified earlier).

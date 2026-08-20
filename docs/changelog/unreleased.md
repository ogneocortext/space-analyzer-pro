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

### Verified
- WinUI GUI MSBuild build: 0 errors / 0 warnings.
- Headless C# tests (`dotnet test`): 15 passed.
- `cargo build --bin space-analyzer-cli` + `cargo test --workspace` clean; `search` subcommand
  smoke-tested (finds `.log` files including nested subdirectories).

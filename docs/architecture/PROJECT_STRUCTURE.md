# Project Structure Documentation

## Space Analyzer Pro (v3.3.0)

```
Space-Analyzer/
├── src/                          # PRIMARY APPLICATION (develop here)
│   ├── gui/                      # v3.3.0 modular GUI (active binary)
│   │   ├── mod.rs                # Binary entry point, SpaceAnalyzerApp struct
│   │   ├── ai/                   # AI subsystem
│   │   │   ├── mod.rs            # AI module declarations
│   │   │   ├── chat.rs           # Chat handling, tool calling, auto-model selection
│   │   │   ├── model_discovery.rs# Ollama model discovery and classification
│   │   │   ├── ollama.rs         # Ollama process management (start/stop)
│   │   │   ├── quick_actions.rs  # Quick action buttons (Analyze, Cleanup, etc.)
│   │   │   └── rendering.rs      # AI chat UI rendering
│   │   ├── scan.rs               # Scan UI rendering and visual analysis
│   │   ├── dashboard.rs          # Dashboard UI
│   │   ├── embeddings.rs         # Smart search / semantic embeddings UI
│   │   ├── dedup.rs              # Deduplication UI
│   │   ├── history.rs            # Scan history UI
│   │   ├── settings.rs           # Settings UI
│   │   ├── system.rs             # System info UI
│   │   └── workflow_render.rs    # Workflow UI
│   ├── main.rs                   # CLI binary entry point
│   ├── gui_common.rs             # Shared types (ScanResult, DiskVolume, etc.)
│   ├── database/                 # Embedded SQLite persistence
│   │   ├── mod.rs                # Database struct, trend, latest_scan_id
│   │   ├── settings.rs           # AppSettings with to_prompt_cache_config
│   │   ├── scans.rs              # Scan CRUD operations
│   │   └── embeddings.rs         # Embedding persistence
│   ├── ollama/                   # Ollama AI client (modular)
│   │   ├── mod.rs                # Module declarations and re-exports
│   │   ├── client/               # HTTP client (chat, embeddings)
│   │   ├── error.rs              # Error types (OllamaError)
│   │   ├── types.rs              # ChatMessage, ToolCall, request/response types
│   │   ├── prompts.rs            # System prompt constants
│   │   ├── stream.rs             # Streaming response parser
│   │   ├── json_utils.rs         # JSON validation, repair, extraction
│   │   └── prompt_cache.rs       # LRU prompt cache with token budgets
│   ├── tool_registry/            # AI tool definitions and execution
│   │   ├── mod.rs                # ToolRegistry struct
│   │   ├── definitions.rs        # Tool definitions (get_scan_summary, etc.)
│   │   └── execution.rs          # Tool execution logic
│   ├── workflows/                # Native workflow orchestration
│   │   └── mod.rs                # Workflow templates, execution, recommendations
│   ├── session_logger.rs         # Structured JSON session logging
│   ├── system_monitor.rs         # Disk/CPU/memory/GPU monitoring
│   ├── embedding_service.rs      # Embedding generation service
│   ├── utils.rs                  # Error sanitization utilities
│   └── bin/
│       └── flow-test-harness.rs  # Automated flow test binary
├── shared-scanner/               # Shared scanner library
├── gpu-compute/                  # GPU acceleration layer
├── native/                       # Standalone native tools
├── archive/                      # Archived components (DO NOT develop here)
│   ├── v3.2.0-monolithic/        # Legacy monolithic GUI (983 lines)
│   ├── legacy-modules/           # Dead modules removed from active code
│   ├── vue-frontend/             # Archived Vue.js frontend
│   ├── native-gui/               # Archived experimental egui GUI
│   ├── rust-tauri/               # Archived failed Tauri build
│   └── python-orchestrator/      # Archived Python orchestrator
├── tests/                        # Unit tests
│   └── unit/                     # Unit tests
└── docs/                         # Documentation
```

## Version History

| Version | Entry Point | Description |
|---------|-------------|-------------|
| v3.3.0 | `src/gui/mod.rs` | Modular GUI with AI tool calling, model selection, prompt caching |
| v3.2.0 | `archive/v3.2.0-monolithic/gui.rs` | Legacy monolithic GUI (archived) |

## Binary Targets

| Binary | Entry Point | Description |
|--------|-------------|-------------|
| `space-analyzer-gui` | `src/bin/space-analyzer-gui.rs` (→ `gui::run_gui()`) | Desktop GUI (egui/eframe) |
| `space-analyzer-pro` | `src/main.rs` | CLI for headless operation |
| `flow-test-harness` | `src/bin/flow-test-harness.rs` | Automated flow test runner |

## Development Guidelines

- **New features**: Add to `src/gui/` (modular GUI) or `src/ollama/` (AI client)
- **Dead code**: Move to `archive/legacy-modules/` if it was replaced
- **Legacy code**: Move to `archive/v3.2.0-monolithic/` if it was superseded
- **Tests**: Add to `tests/` directory; import from `space_analyzer_pro_desktop::` directly

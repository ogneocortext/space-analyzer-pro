# Space Analyzer Pro - Architecture Overview

## Current Architecture (v3.3.0)

Space Analyzer Pro is a **self-contained Rust application** with an embedded database, optional AI integration, and GPU acceleration - all in a single binary.

## Directory Structure

```
Space-Analyzer/
├── src/                          # PRIMARY APPLICATION (develop here)
│   ├── gui/                      # v3.3.0 modular GUI (active binary entry point)
│   │   ├── mod.rs                # Binary entry point, SpaceAnalyzerApp struct, main()
│   │   ├── ai/                   # AI subsystem (chat, model discovery, quick actions)
│   │   ├── scan.rs               # Scan UI rendering
│   │   ├── dashboard.rs          # Dashboard UI
│   │   ├── embeddings.rs         # Smart search / semantic embeddings UI
│   │   ├── dedup.rs              # Deduplication UI
│   │   ├── history.rs            # Scan history UI
│   │   ├── settings.rs           # Settings UI
│   │   ├── system.rs             # System info UI
│   │   └── workflow_render.rs    # Workflow UI
│   ├── main.rs                   # CLI binary
│   ├── gui_common.rs             # Shared types and scanning utilities
│   ├── database/                 # Embedded SQLite persistence
│   ├── ollama/                   # Ollama AI client (modular)
│   ├── tool_registry/            # AI tool definitions and execution
│   ├── workflows/                # Native workflow orchestration
│   ├── session_logger.rs         # Structured JSON session logging
│   ├── system_monitor.rs         # Disk/CPU/memory/GPU monitoring
│   ├── embedding_service.rs      # Embedding generation service
│   ├── utils.rs                  # Error sanitization utilities
│   └── bin/
│       └── flow-test-harness.rs  # Automated flow test binary
├── archive/                      # Archived/experimental components (DO NOT develop here)
│   ├── v3.2.0-monolithic/        # Legacy monolithic GUI (superseded by gui/)
│   │   ├── gui.rs                # v3.2.0 monolithic GUI (983 lines, all-in-one)
│   │   └── gui.rs.backup         # Old backup
│   ├── legacy-modules/           # Dead modules removed from active code
│   │   ├── ai_skills.rs          # AI skills module (never wired up)
│   │   ├── ollama_client.rs      # Legacy Ollama client (replaced by ollama/)
│   │   └── database.rs           # Legacy single-file database (replaced by database/)
│   ├── vue-frontend/             # Archived Vue.js frontend (pre-v3.0)
│   ├── native-gui/               # Archived experimental egui GUI
│   ├── rust-tauri/               # Archived failed Tauri build
│   └── python-orchestrator/      # Archived Python orchestrator
├── shared-scanner/               # Shared scanner library
├── gpu-compute/                  # GPU acceleration layer
├── native/                       # Standalone native tools
├── server/                       # Node.js backend (optional, for web mode)
├── ai-service/                   # Python AI service (optional, for web mode)
├── tests/                        # Integration tests
└── tools/                        # Development tools
```

## Active Components

### Primary GUI (`src/gui/mod.rs`)

The **only active GUI implementation** (v3.3.0). Modular architecture using egui/eframe for native desktop rendering.

Features:
- Directory scanning with real-time progress
- Embedded SQLite database for persistence
- Ollama AI chat with tool calling and auto-model selection
- Prompt caching for faster responses
- Smart search via semantic embeddings
- Native workflow orchestration
- System monitoring (CPU, memory, disk, GPU)
- Scan history management
- AI recommendations (rule-based + Ollama)
- Session logging for flow test analysis

Module structure:
- `gui/ai/` — AI subsystem (chat, model discovery, quick actions, rendering)
- `gui/scan.rs` — Scan UI rendering
- `gui/embeddings.rs` — Smart search / semantic embeddings
- `gui/workflow_render.rs` — Workflow UI

### CLI (`src/main.rs`)

Command-line interface for headless operation.

### Embedded Database (`src/database/`)

SQLite database embedded via `rusqlite` with bundled SQLite. Stores:
- Scan history (path, files, sizes, timestamps)
- Application settings
- File embeddings for semantic search

No external database server required.

### Ollama Client (`src/ollama/`)

Modular Ollama AI client:
- Chat with tool calling and auto-model selection
- Embedding generation for semantic search
- Prompt caching with LRU eviction
- JSON response repair
- Streaming response parsing

Fully local — no cloud services.

### System Monitor (`src/system_monitor.rs`)

Real-time system information:
- Disk volumes and usage
- CPU and memory utilization
- GPU detection via nvidia-smi

### Workflow System (`src/workflows/mod.rs`)

Native Rust workflow orchestration:
- Preconfigured workflow templates
- Execution tracking
- AI-powered analysis workflows
- No external orchestrator needed

### GPU Compute (`gpu-compute/`)

Shared GPU acceleration layer:
- GPU detection (nvidia-smi / cudarc)
- BLAKE3 batch hashing
- ML regression and K-Means
- Scan post-processing

### Shared Scanner (`shared-scanner/`)

Core file scanning library used by all components.

## Archived Components

The following components have been **archived** and should NOT be used for new development. They are kept for reference only.

### Vue.js Frontend (`archive/vue-frontend/`)
- **Archived:** v2.14.0 cleanup
- **Reason:** Replaced by native Rust GUI
- **Contents:** 447 Vue.js/TypeScript files, Tauri config

### Experimental egui GUI (`archive/native-gui/`)
- **Archived:** 2026-05-16
- **Reason:** Superseded by `src/gui/mod.rs` which has more features
- **Contents:** Standalone egui app with GPU dashboard

### Tauri Desktop Build (`archive/rust-tauri/`)
- **Archived:** 2026-05-16
- **Reason:** Failed experiment, required archived Vue frontend
- **Contents:** Tauri configuration and build files

### Python Orchestrator (`archive/python-orchestrator/`)
- **Archived:** 2026-05-16
- **Reason:** Replaced by Rust-native workflow system in `src/workflows/`
- **Contents:** FastAPI orchestrator with Celery, APScheduler

## Communication Flow

### Self-Contained Mode (Primary)
```
User -> egui GUI (src/gui/mod.rs)
         ├── Embedded SQLite (rusqlite)
         ├── File Scanner (walkdir + shared-scanner)
         ├── GPU Compute (gpu-compute)
         ├── System Monitor (sysinfo)
         ├── Workflow Engine (workflows/mod.rs)
         └── Ollama Client (optional, reqwest -> localhost:11434)
```

### Web Mode (Optional - requires external services)
```
Vue.js Frontend (archived) -> Node.js Backend (server/) -> Python AI Service (ai-service/)
```

## Technology Stack

### Core
- **Rust** - Systems programming language
- **egui/eframe** - Immediate mode GUI framework
- **rusqlite** - Embedded SQLite database
- **walkdir** - File system traversal
- **tokio** - Async runtime

### Optional
- **reqwest** - HTTP client for Ollama
- **cudarc** - CUDA integration (feature-gated)
- **sysinfo** - System resource monitoring

### Native Tools
- **blake3** - Fast file hashing
- **rayon** - Parallel CPU processing

## Development Workflow

### Adding New Features
1. Add logic to appropriate module in `src/`
2. Update GUI in `src/gui/` (modular architecture)
3. If persistent, add to `src/database/`
4. If AI-related, update `src/ollama/` or `src/gui/ai/`

### NEVER
- Create new GUI implementations
- Add Python/Node.js dependencies for core features
- Use external services for core functionality

## Performance

### Rust GUI
- Single-pass file scanning
- Memory-conscious processing
- Rate-limited progress updates (20/sec max)
- Async/await for non-blocking HTTP calls

### GPU Acceleration
| Component | GPU Operation | CPU Fallback | Est. Speedup |
|-----------|--------------|--------------|-------------|
| Scan post-processing | Histograms, sorting | rayon + introselect | 2-5x |
| BLAKE3 hashing | Batch GPU stream | rayon parallel | 3-10x |
| ML training | Matrix ops | ndarray + rayon | 5-20x |

---

This architecture provides a solid, self-contained foundation with zero external dependencies for core functionality.

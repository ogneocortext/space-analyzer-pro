# Space Analyzer Pro - Architecture Overview

## Current Architecture (v3.2.0)

Space Analyzer Pro is a **self-contained Rust application** with an embedded database, optional AI integration, and GPU acceleration - all in a single binary.

## Directory Structure

```
Space-Analyzer/
├── src/                          # PRIMARY APPLICATION (develop here)
│   ├── gui.rs                    # Main egui GUI - the active desktop app
│   ├── main.rs                   # CLI binary
│   ├── gui_common.rs             # Shared types and scanning utilities
│   ├── database.rs               # Embedded SQLite persistence
│   ├── ollama_client.rs          # Optional Ollama AI integration
│   ├── system_monitor.rs         # Disk/CPU/memory/GPU monitoring
│   ├── ai_skills.rs              # AI analysis skills
│   └── workflows/mod.rs          # Native workflow orchestration
├── shared-scanner/               # Shared scanner library
├── gpu-compute/                  # GPU acceleration layer
├── native/                       # Standalone native tools
├── server/                       # Node.js backend (optional, for web mode)
├── ai-service/                   # Python AI service (optional, for web mode)
├── archive/                      # Archived/experimental components (DO NOT develop here)
│   ├── vue-frontend/             # Archived Vue.js frontend (pre-v3.0)
│   ├── native-gui/               # Archived experimental egui GUI
│   ├── rust-tauri/               # Archived failed Tauri build
│   └── python-orchestrator/      # Archived Python orchestrator
└── tools/                        # Development tools
```

## Active Components

### Primary GUI (`src/gui.rs`)

The **only active GUI implementation**. Uses egui/eframe for native desktop rendering.

Features:
- Directory scanning with real-time progress
- Embedded SQLite database for persistence
- Optional Ollama AI chat integration
- Native workflow orchestration
- System monitoring (CPU, memory, disk, GPU)
- Scan history management
- AI recommendations (rule-based + Ollama)

### CLI (`src/main.rs`)

Command-line interface for headless operation.

### Embedded Database (`src/database.rs`)

SQLite database embedded via `rusqlite` with bundled SQLite. Stores:
- Scan history (path, files, sizes, timestamps)
- Application settings
- Workflow execution records

No external database server required.

### Ollama Client (`src/ollama_client.rs`)

Optional HTTP client for local Ollama LLM integration:
- Chat with scan results
- AI-powered cleanup recommendations
- Natural language queries about disk usage
- Fully local - no cloud services

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
- **Reason:** Superseded by `src/gui.rs` which has more features
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
User -> egui GUI (src/gui.rs)
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
2. Update GUI in `src/gui.rs`
3. If persistent, add to `src/database.rs`
4. If AI-related, update `src/ollama_client.rs` or `src/ai_skills.rs`

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

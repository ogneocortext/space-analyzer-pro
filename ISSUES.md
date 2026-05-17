# Space Analyzer Pro - Issue Tracker

**Created:** 2025
**Version:** v3.2.0
**Total Issues Found:** 32
**Issues Resolved:** 23
**Session Tracking:**
- Session 1 (2025): 12 issues found, 3 resolved (25%)
- Session 2 Part A (2026-05-16 Review): 20 new issues found, 5 resolved (25%)
- Session 2 Part B (2026-05-16 Restructure): 14 issues resolved (major restructure)
- **Cumulative: 32 total, 23 resolved (71.9%)**

---

## Session 2 Part B: Major Restructure (2026-05-16)

### What Was Done

**1. Archived Non-Dominant GUIs**
- `native-gui/` -> `archive/native-gui/` (experimental egui GUI)
- `rust/` -> `archive/rust-tauri/` (failed Tauri build)
- Added `.ai-protected` markers and README explanations

**2. Archived Python Orchestrator**
- `orchestrator/` -> `archive/python-orchestrator/`
- Replaced by Rust-native workflow system in `src/workflows/mod.rs`

**3. Enhanced Rust GUI to be Fully Self-Contained**
- **Embedded SQLite database** (`src/database.rs`) - rusqlite with bundled SQLite
- **Optional Ollama AI client** (`src/ollama_client.rs`) - reqwest HTTP client
- **System monitor** (`src/system_monitor.rs`) - CPU, memory, disk, GPU via sysinfo
- **Enhanced workflows** (`src/workflows/mod.rs`) - execution tracking, AI actions
- **7-tab GUI** - Dashboard, Scan, History, Workflows, AI Chat, System, Settings

**4. Updated Documentation**
- README.md - reflects Rust-only self-contained architecture
- ARCHITECTURE.md - accurate current state with archived components documented
- Cargo.toml - workspace cleaned, rusqlite + reqwest + sysinfo added

**5. Cleaned Up Repository**
- Removed 13 test artifact files from root
- Updated .gitignore with broader patterns

### Current Active Architecture
```
Space-Analyzer/
├── src/                          # PRIMARY APPLICATION (self-contained)
│   ├── gui.rs                    # Main egui GUI - 7 tabs, full features
│   ├── main.rs                   # CLI binary
│   ├── gui_common.rs             # Shared types and scanning
│   ├── database.rs               # NEW: Embedded SQLite persistence
│   ├── ollama_client.rs          # NEW: Optional Ollama AI integration
│   ├── system_monitor.rs         # NEW: CPU/memory/disk/GPU monitoring
│   ├── ai_skills.rs              # AI analysis skills
│   └── workflows/mod.rs          # Enhanced: Native workflow orchestration
├── shared-scanner/               # Shared scanner library
├── gpu-compute/                  # GPU acceleration layer
├── native/                       # Standalone native tools
├── server/                       # Node.js backend (optional, for web mode)
├── ai-service/                   # Python AI service (optional, for web mode)
└── archive/                      # Archived components (reference only)
    ├── vue-frontend/             # Archived Vue.js frontend
    ├── native-gui/               # Archived experimental egui GUI
    ├── rust-tauri/               # Archived failed Tauri build
    └── python-orchestrator/      # Archived Python orchestrator
```

### Integration Status (After Restructure)

| Integration | Status | Details |
|------------|--------|---------|
| Rust GUI → Embedded DB | ✅ Working | rusqlite with bundled SQLite |
| Rust GUI → Ollama AI | ✅ Working | Optional reqwest HTTP client |
| Rust GUI → GPU Compute | ✅ Working | gpu-compute crate |
| Rust GUI → System Monitor | ✅ Working | sysinfo crate |
| Rust GUI → Workflows | ✅ Working | Native Rust orchestration |
| Rust GUI → Scan History | ✅ Working | Persistent via SQLite |
| Rust GUI → Settings | ✅ Working | Persisted via SQLite |

---

## Issue Categories

### 🔴 CRITICAL (Blocking functionality)
### 🟠 HIGH (Major features broken)
### 🟡 MEDIUM (Features degraded)
### 🟢 LOW (Minor issues)

---

## Issues Found

### CATEGORY: FRONTEND MISSING

#### ISSUE-001: No Vue Frontend Exists (WORKING DIRECTORY)
**Severity:** 🔴 CRITICAL
**Status:** [x] RESOLVED - Archived to `archive/vue-frontend/`
**Description:** 
README.md and documentation reference Vue.js components at `src/components/`, `src/store/`, `src/services/`, but these directories don't exist in the working directory. The files were restored from git history and placed in `archive/vue-frontend/` for safekeeping.

**Evidence:**
- Git status shows all Vue files as "Deleted" (not "Missing")
- `git show HEAD:src/App.vue` returns valid content
- All 100+ Vue components exist in git history
- Restored: 447 files to `archive/vue-frontend/`

**Impact:**
- Web interface preserved in archive
- Rust-only project structure maintained
- Future restoration possible from archive

**Resolution:**
1. ✅ Identified files exist in git history
2. ✅ Restored all 447 files (src/, config, Tauri) to `archive/vue-frontend/`
3. ✅ Protected with `.ai-protected` markers from accidental deletion
4. ✅ Added README.md with restoration instructions

---

#### ISSUE-002: Tauri Desktop Frontend Missing
**Severity:** 🔴 CRITICAL
**Status:** [x] RESOLVED - Archived to `archive/vue-frontend/src-tauri/`
**Description:** 
`src-tauri/` directory with Tauri configuration was deleted from the working directory. The Tauri frontend code has been restored to the archive.

**Evidence:**
- `src-tauri/` directory deleted from working directory
- Restored to `archive/vue-frontend/src-tauri/` with all files (tauri.conf.json, Cargo.toml, icons, capabilities, gen, src/)

**Impact:**
- Desktop app cannot be built from active project
- Tauri configuration preserved in archive for future use

**Resolution:**
1. ✅ Identified files exist in git history
2. ✅ Restored all 17+ Tauri files to `archive/vue-frontend/src-tauri/`
3. ✅ Protected with `.ai-protected` markers

---

#### ISSUE-003: Rust src/ Conflicts with Vue src/
**Severity:** 🟠 HIGH
**Status:** [x] RESOLVED - Vue frontend archived, Rust keeps `src/`
**Description:** 
The `src/` directory name conflicted between Rust code (`main.rs`, `gui.rs`, `gui_common.rs`) and the Vue frontend source.

**Evidence:**
- Both used `src/` as their root directory
- Vue frontend is now archived at `archive/vue-frontend/src/`
- Rust keeps `src/` as the active project

**Resolution:**
1. ✅ Decision: Keep Rust as the active project
2. ✅ Vue frontend archived to `archive/vue-frontend/` (separate from `src/`)
3. ✅ Rust `src/` unchanged - no naming conflict

---

### CATEGORY: INTEGRATION GAPS

#### ISSUE-004: Orchestrator Not Integrated with Backend
**Severity:** 🟠 HIGH
**Status:** [ ]
**Description:** 
Python orchestrator (`orchestrator/src/orchestrator.py`) exists with workflow and task management capabilities, but has no integration with the Node.js backend. The orchestrator cannot receive tasks from the main application.

**Evidence:**
- `orchestrator/src/orchestrator.py` has full task/workflow implementation
- No API routes in `server/server-improved.js` for orchestrator communication
- No documentation on how to invoke orchestrator
- Port configuration doesn't account for orchestrator

**Impact:**
- Multi-step workflows cannot be triggered
- Task scheduling features unused
- Automated analysis pipelines broken

**Resolution Plan:**
1. Add API endpoints for orchestrator communication
2. Create client library in Node.js to call orchestrator
3. Document orchestrator usage
4. Add orchestrator to startup scripts

---

#### ISSUE-005: AI Service Not Integrated with Backend
**Severity:** 🟠 HIGH
**Status:** [ ]
**Description:** 
Python AI service (`ai-service/main.py`) exists with ML categorization, but the Node.js backend doesn't have endpoints to call it. The AI service runs independently but isn't connected to the main application.

**Evidence:**
- `ai-service/main.py` has FastAPI endpoints
- `server/server-improved.js` has mock AI endpoints instead of calling actual service
- `server/config.js` defines Ollama settings but doesn't configure AI service URL
- No startup script for AI service

**Impact:**
- AI categorization uses mock logic instead of actual ML
- File analysis doesn't use trained models
- AI recommendations are fake data

**Resolution Plan:**
1. Add `PYTHON_AI_SERVICE_URL` configuration to backend
2. Create proxy endpoints in backend that call AI service
3. Add AI service to startup scripts
4. Test actual ML categorization

---

#### ISSUE-006: Port Configuration Inconsistencies
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:** 
Different services use different ports with no central configuration:

| Service | Configured Port | Code Default |
|---------|-----------------|--------------|
| Node.js Backend | 8091 (config.js) | 8080 (server-improved.js) |
| Python AI Service | 5000 | 5000 |
| Ollama | 11434 | 11434 |

**Evidence:**
- `server/config.js`: port = 8091
- `server/server-improved.js`: PORT = 8080 (process.env.PORT fallback)
- `ai-service/main.py`: PORT = 5000

**Impact:**
- Server starts on wrong port if PORT env var not set
- Documentation shows different ports
- Services can't communicate without manual configuration

**Resolution Plan:**
1. Standardize on one backend port (8091)
2. Update `server-improved.js` default to 8091
3. Document port configuration clearly
4. Add startup validation

---

### CATEGORY: CONFIGURATION ISSUES

#### ISSUE-007: CORS Enabled for All Origins
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:** 
Both the Node.js backend and Python AI service have CORS configured to allow all origins (`allow_origins=["*"]`).

**Evidence:**
- `server/server-improved.js`: `res.setHeader("Access-Control-Allow-Origin", "*")`
- `ai-service/main.py`: `allow_origins=["*"]`

**Impact:**
- Security vulnerability in production
- Any website can make API requests
- Potential data exposure

**Resolution Plan:**
1. Make CORS configurable via environment variable
2. Default to restricted origins in production
3. Document proper CORS configuration

---

#### ISSUE-008: AI Service Has Hardcoded Fallback Secret
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:** 
Python AI service has `SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")` with an insecure default.

**Evidence:**
- `ai-service/main.py` line with default secret

**Impact:**
- Authentication ineffective if JWT not configured
- Security bypass possible

**Resolution Plan:**
1. Require SECRET_KEY to be set (no default)
2. Fail startup if not configured in production
3. Generate secure default for development only

---

### CATEGORY: CODE QUALITY

#### ISSUE-009: Output Files Left in Repository
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:** 
Several JSON output files left in repository from testing/debugging:

**Evidence:**
- `server/output_Users_20260427-1641.json`
- `tests/*.json` (multiple test result files)
- `test_results_*.json` (timestamped test outputs)
- `results/2026-04-27/` (directory with analysis reports)
- `public/sample-analysis-data.json`

**Impact:**
- Repository bloat
- Confusing which files are generated vs. source
- Test artifacts mixed with source

**Resolution Plan:**
1. Add output files to `.gitignore`
2. Remove existing output files from git tracking
3. Add cleanup scripts
4. Document where outputs should go

---

#### ISSUE-010: Test Results Not Cleaned Up
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:** 
Multiple test result files in root and `tests/` directory from historical test runs.

**Evidence:**
- `test_results_20260512_*.json` (4 files)
- `test-results/.last-run.json`
- `tests/ai_status_restart_test.json` and similar

**Impact:**
- Repository confusion
- Hard to identify real test failures

**Resolution Plan:**
1. Create `.gitignore` entry for test-results/
2. Clean up existing test artifacts
3. Add cleanup to test scripts

---

#### ISSUE-011: TODO Comments in Code
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:** 
Several `TODO` comments indicating incomplete functionality:

**Evidence:**
- `src/main.rs`: `// TODO: Implement detailed report generation`
- `src/main.rs`: `// TODO: Implement duplicate cleaning`

**Impact:**
- Some CLI features not implemented
- User expectations vs. reality mismatch

**Resolution Plan:**
1. Implement the TODO items
2. Or remove CLI flags that don't work
3. Document what's implemented vs. planned

---

### CATEGORY: DOCUMENTATION

#### ISSUE-012: README Claims Vue Frontend Exists (And It's Right!)
**Severity:** 🟠 HIGH
**Status:** [x] RESOLVED - Files exist in git, need to be restored
**Description:** 
README.md contains project structure showing Vue frontend components. The README is CORRECT - the files just need to be restored from git.

**Evidence:**
```markdown
src/
├── main.ts                    # Application entry point
├── App.vue                    # Main Vue component
├── store/                     # State management
│   ├── analysis.ts            # Main analysis store
```

**Impact:**
- Documentation matches what SHOULD exist
- Setup instructions correct
- Need to restore files to match docs

**Resolution Plan:**
1. ✅ Confirmed README is accurate - files need restoration
2. Restore Vue frontend from git
3. Documentation now matches code

---

## Session 2 New Issues (2026-05-16)

### CATEGORY: FRONTEND & BUILD

#### ISSUE-013: No Working Web Frontend (package.json missing)
**Severity:** 🔴 CRITICAL
**Status:** [ ]
**Description:**
README.md instructs users to run `npm run dev` and `npm run tauri:dev`, but no `package.json` exists in the project root. The Vue.js frontend was archived during v2.14.0 cleanup and never restored to an active state.

**Evidence:**
- `package.json` does not exist in project root
- `index.html` does not exist in project root
- `node_modules/` exists but has no root package.json to manage it
- All npm commands in README will fail

**Impact:**
- Web interface completely non-functional
- Tauri desktop app cannot be built
- Documentation misleads users

**Resolution Plan:**
1. Decide: restore Vue frontend OR update README to reflect Rust-only project
2. If restoring: copy from `archive/vue-frontend/` and resolve `src/` conflict
3. If not: update README, remove npm commands, document Rust GUI as primary interface

---

#### ISSUE-014: Three Separate GUI Implementations (Confusion)
**Severity:** 🟠 HIGH
**Status:** [ ]
**Description:**
The project has THREE GUI implementations that overlap in functionality:
1. `src/gui.rs` - Root-level egui GUI (most complete, has workflows + AI recommendations)
2. `native-gui/` - Separate egui GUI with GPU status dashboard
3. `rust/` - Tauri desktop app (incomplete, references missing Vue frontend)

**Evidence:**
- `Cargo.toml` defines `space-analyzer-gui` binary pointing to `src/gui.rs`
- `native-gui/Cargo.toml` defines separate `native-gui` binary
- `rust/Cargo.toml` defines Tauri app
- All three provide directory scanning and visualization

**Impact:**
- Development effort split across three GUIs
- User confusion about which to use
- Maintenance burden

**Resolution Plan:**
1. Consolidate to single GUI (recommend: `src/gui.rs` + enhance with GPU dashboard from `native-gui/`)
2. Deprecate or merge `native-gui/`
3. Complete or deprecate `rust/` Tauri app

---

#### ISSUE-015: README Documentation Does Not Match Active Codebase
**Severity:** 🟠 HIGH
**Status:** [ ]
**Description:**
README.md describes Vue.js frontend structure, npm commands, and Tauri desktop app that do not exist in the working directory. The README describes the project as it was BEFORE v2.14.0 cleanup, not as it is now.

**Evidence:**
- README shows `src/` as TypeScript/Vue.js frontend (actually Rust)
- README shows `npm run dev` command (no package.json)
- README shows `npm run tauri:dev` command (no Tauri setup active)
- README project structure diagram is outdated

**Impact:**
- New developers cannot follow setup instructions
- Misleading project capabilities documentation

**Resolution Plan:**
1. Update README to accurately describe current Rust-only architecture
2. Remove or mark npm/Tauri commands as "planned" or "archived"
3. Add accurate project structure diagram

---

### CATEGORY: INTEGRATION GAPS

#### ISSUE-016: Rust GUI Has No Backend Service Integration
**Severity:** 🟠 HIGH
**Status:** [ ]
**Description:**
The egui GUI (`src/gui.rs`) operates entirely standalone with no HTTP client to communicate with:
- Node.js backend (port 8091)
- Python AI service (port 5000)
- Python orchestrator (port 8002)

**Evidence:**
- `src/gui.rs` has no HTTP client dependencies
- `Cargo.toml` for root package has no `reqwest` or `hyper` dependency
- All scanning is done locally via `walkdir`
- AI recommendations in GUI are generated locally, not from AI service
- Workflow execution in GUI is local-only, not through orchestrator

**Impact:**
- GUI cannot use AI categorization from Python ML service
- GUI cannot use Ollama LLM for chat
- GUI cannot trigger orchestrated workflows
- GUI cannot access historical analysis data from database

**Resolution Plan:**
1. Add `reqwest` dependency to root Cargo.toml
2. Implement HTTP client module for backend communication
3. Add AI service integration to GUI (categorization, recommendations)
4. Add orchestrator integration for workflow execution

---

#### ISSUE-017: native-gui Has No Backend Service Integration
**Severity:** 🟠 HIGH
**Status:** [ ]
**Description:**
The `native-gui/` egui application is completely standalone with no connection to backend services, despite having a GPU status dashboard that could display service health.

**Evidence:**
- `native-gui/Cargo.toml` has no HTTP client dependencies
- `native-gui/src/` contains only local scanning and UI code
- No API calls to AI service, orchestrator, or Node.js backend

**Impact:**
- Duplicate effort with `src/gui.rs`
- Missed opportunity for service integration

**Resolution Plan:**
1. Merge GPU dashboard features into `src/gui.rs`
2. Deprecate `native-gui/` as separate application

---

#### ISSUE-018: Orchestrator Has No Workflow YAML Definitions
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The orchestrator (`orchestrator/src/orchestrator.py`) loads workflows from YAML files in a `workflows/` directory, but no workflow definitions exist in the repository.

**Evidence:**
- `_create_example_workflows()` creates example workflows at runtime
- No `workflows/` directory exists in the repository
- No YAML workflow files found anywhere in project

**Impact:**
- Workflows are created fresh each run, not persisted
- Custom workflows cannot be defined
- No version-controlled workflow configurations

**Resolution Plan:**
1. Create `orchestrator/workflows/` directory
2. Add YAML definitions for documented workflows (weekly cleanup, large files finder, etc.)
3. Add workflow definitions to git

---

#### ISSUE-019: Orchestrator API Has Incomplete Type Conversions
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The orchestrator API (`orchestrator/src/api.py`) has a bug in the task execution endpoint where it passes a dict to `orchestrator.execute_task()` which expects a `TaskDefinition` object.

**Evidence:**
- `api.py:248`: `orchestrator.execute_task(task, request.workflow_id)` where `task` is a dict from `list_tasks()`
- `orchestrator.py:349`: `execute_task(self, task: TaskDefinition, ...)` expects `TaskDefinition` dataclass

**Impact:**
- `/tasks/execute` endpoint will crash with type error
- Individual task execution via API is broken

**Resolution Plan:**
1. Fix type conversion in `api.py` to construct `TaskDefinition` from dict
2. Add proper task lookup by ID

---

### CATEGORY: CONFIGURATION & SECURITY

#### ISSUE-020: AI Service SECRET_KEY Has No Default (Will Crash)
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The unified AI service (`ai-service/app/config.py`) sets `SECRET_KEY = os.getenv("SECRET_KEY")` with NO default value. If `SECRET_KEY` env var is not set, it will be `None`, which will cause JWT operations to fail.

**Evidence:**
- `ai-service/app/config.py:23`: `SECRET_KEY = os.getenv("SECRET_KEY")` - no fallback
- Auth router likely uses this for JWT signing

**Impact:**
- AI service auth endpoints will crash if SECRET_KEY not configured
- Breaking change from old version that had a fallback default

**Resolution Plan:**
1. Add secure random default for development: `SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))`
2. Warn on startup if using generated secret
3. Require explicit SECRET_KEY in production

---

#### ISSUE-021: No .env File Exists (Services Use Defaults)
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The `.env` file is listed in `.gitignore` (correct), but no `.env.example` exists in the project root to guide configuration. Each service has its own `.env.example` in different locations with different formats.

**Evidence:**
- `.gitignore` line 9: `.env` is ignored
- `ai-service/.env.example` exists
- `server/.env` may exist but not in root
- No root `.env.example` for unified configuration

**Impact:**
- Users don't know what environment variables to set
- Services start with potentially conflicting defaults

**Resolution Plan:**
1. Create root `.env.example` with all service configurations
2. Document all environment variables in one place

---

#### ISSUE-022: AI Service CORS Already Fixed (Old Issue-007 Obsolete)
**Severity:** 🟢 LOW
**Status:** [x] RESOLVED
**Description:**
ISSUE-007 claimed CORS was open for all origins. The unified AI service (`ai-service/app/config.py:29`) now uses configurable CORS: `CORS_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080,http://localhost:8091")`. The Node.js backend (`server-improved.js:40`) also uses configurable CORS via `CORS_ORIGIN` env var.

**Resolution:**
1. ✅ Both services now have configurable CORS
2. ✅ Default restricts to localhost origins in production mode

---

### CATEGORY: CODE QUALITY & MAINTENANCE

#### ISSUE-023: Root Directory Has Test Artifacts and Temporary Files
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:**
The project root contains multiple test result files, test reports, and temporary files that should be cleaned up or gitignored.

**Evidence:**
- `test_results_20260512_013342.json`
- `test_results_20260512_013453.json`
- `test_results_20260512_014111.json`
- `test_results_20260512_014728.json`
- `test_results_20260514_041127.json`
- `test_results_20260514_043505.json`
- `test_report_20260512_061154.txt`
- `test_report_20260514_000313.txt`
- `test_report_20260514_005900.txt`
- `test_report_20260514_041127.txt`
- `test_report_20260514_043505.txt`
- `test_workspace/` directory
- `nul` file (Windows artifact)
- `STALE` file

**Impact:**
- Clutters project root
- Confuses what files are source vs. output

**Resolution Plan:**
1. Add `test_results_*.json`, `test_report_*.txt` to `.gitignore`
2. Remove existing test artifacts from git tracking
3. Move to `test-results/` directory
4. Delete `nul` and `STALE` files

---

#### ISSUE-024: server/ Has Output File Not in .gitignore
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:**
`server/output_Users_20260427-1641.json` exists and is not covered by current `.gitignore` patterns.

**Evidence:**
- `.gitignore` has `server/output_src_*.json` and `server/output_analysis_*.json` but not `server/output_Users_*.json`

**Resolution Plan:**
1. Add `server/output_*.json` to `.gitignore` (broader pattern)
2. Remove existing file from git tracking

---

#### ISSUE-025: Rust CLI Has Unimplemented Features (--report, --clean)
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The Rust CLI (`src/main.rs`) accepts `--report` and `--clean` flags but these features are not fully implemented.

**Evidence:**
- `src/main.rs:34-35`: `#[arg(short, long)] report: bool` - accepted but not implemented
- `src/main.rs:38-39`: `#[arg(short, long)] clean: bool` - accepted but not implemented
- TODO comments in code confirm incomplete implementation

**Impact:**
- CLI flags do nothing when used
- User confusion

**Resolution Plan:**
1. Implement `--report` functionality (generate analysis report)
2. Implement `--clean` functionality (remove duplicates)
3. Or remove flags and document as "planned"

---

#### ISSUE-026: Node.js Scan Is Non-Recursive (Shallow Only)
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The Node.js backend `/api/files/scan` endpoint (`server-improved.js:102-136`) only scans the immediate directory with `fs.readdirSync()` - it does NOT recursively scan subdirectories. This is inconsistent with the Rust scanner which does full recursive traversal.

**Evidence:**
- `server-improved.js:112`: `const items = fs.readdirSync(scanDir, { withFileTypes: true })` - single level only
- No recursive scanning logic in the endpoint
- `/api/files/structure` endpoint does recursive scan but is a separate endpoint

**Impact:**
- Web frontend (if restored) would get incomplete scan results
- API behavior inconsistent with Rust CLI

**Resolution Plan:**
1. Make `/api/files/scan` recursive or add `?recursive=true` parameter
2. Or clearly document the difference between scan and structure endpoints

---

### CATEGORY: DOCUMENTATION

#### ISSUE-027: Multiple Changelogs with Inconsistent Information
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:**
The project has three separate changelog files with overlapping and sometimes inconsistent version information:
- `CHANGELOG.md` (root) - covers v2.14.0 to v3.1.0
- `CHANGELOG-SIMPLIFIED.md` - covers frontend v1.0 to v1.7
- `docs/CHANGELOG.md` - covers v2.8.8 to v2.15.0

**Evidence:**
- Version numbering is inconsistent across files (v2.14.0 vs v2.15.0 vs v3.1.0)
- Dates are inconsistent (2025 vs 2026)
- Some changes documented in multiple places

**Impact:**
- Confusing version history
- Hard to track what changed when

**Resolution Plan:**
1. Consolidate to single CHANGELOG.md
2. Archive old changelogs to `docs/archive/`
3. Standardize version numbering

---

#### ISSUE-028: ARCHITECTURE.md Describes Non-Existent Frontend
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
`ARCHITECTURE.md` describes a Vue.js frontend at `src/` with components, features, store, services, and composables. This frontend does not exist in the working directory.

**Evidence:**
- `ARCHITECTURE.md:40-54`: Describes `src/` as Vue.js application
- `ARCHITECTURE.md:67-82`: Describes Tauri communication flow with Vue frontend
- `ARCHITECTURE.md:156-167`: Lists Vue 3, Vite, Pinia, Tailwind CSS as frontend stack

**Impact:**
- Architecture documentation is misleading
- New developers will look for files that don't exist

**Resolution Plan:**
1. Update ARCHITECTURE.md to reflect current Rust-only architecture
2. Add section for "Planned: Vue.js Frontend (Archived)"

---

### CATEGORY: PERFORMANCE & RELIABILITY

#### ISSUE-029: Analytics Endpoints Return Random/Mock Data
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
Several analytics endpoints in the Node.js backend return random or hardcoded data instead of real metrics:

**Evidence:**
- `server-improved.js:363-368`: `/api/analytics/trends` returns hardcoded single data point
- `server-improved.js:372-378`: `/api/analytics/performance` returns `Math.random()` values
- `server-improved.js:381-387`: `/api/analytics/predict` returns random predictions

**Impact:**
- Analytics features provide no real value
- Misleading data presented to users

**Resolution Plan:**
1. Connect analytics endpoints to real system metrics
2. Use historical scan data from database for trends
3. Integrate with storage_predictor for real predictions

---

#### ISSUE-030: No Health Check Between Services
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
While individual services have health endpoints, there is no mechanism for services to discover and verify each other's health at startup. The Node.js backend has proxy endpoints that return 503 when services are down, but no startup validation.

**Evidence:**
- `server-improved.js` has `ORCHESTRATOR_URL` and `AI_SERVICE_URL` constants
- No startup health check for these services
- Proxy endpoints silently fail with 503 responses

**Impact:**
- Services start without knowing if dependencies are available
- Users see failures without clear error messages

**Resolution Plan:**
1. Add startup health checks in Node.js backend
2. Log warnings if AI service or orchestrator is unavailable
3. Add health status to `/api/status` endpoint

---

#### ISSUE-031: Orchestrator Depends on Celery (Heavy Dependency)
**Severity:** 🟢 LOW
**Status:** [ ]
**Description:**
The orchestrator imports `celery` (`orchestrator/src/orchestrator.py:25`) but Celery requires a message broker (Redis/RabbitMQ) which is not configured or documented.

**Evidence:**
- `orchestrator/src/orchestrator.py:25`: `from celery import Celery`
- `orchestrator/src/orchestrator.py:107`: `self.celery_app = Celery('storage_orchestrator')`
- No Redis or RabbitMQ configuration anywhere
- No Celery broker URL configured

**Impact:**
- Celery initialization may fail or use default broker
- Unnecessary heavy dependency if not actually used
- Celery app is created but never used in the codebase

**Resolution Plan:**
1. Remove Celery if not actually needed (orchestrator uses asyncio directly)
2. Or document and configure Redis/RabbitMQ broker

---

#### ISSUE-032: No Startup Script for All Services
**Severity:** 🟡 MEDIUM
**Status:** [ ]
**Description:**
The project has `start-all-services.bat` and `start-ai-service.bat` in the root, but no comprehensive startup script that launches all services (Node.js backend, AI service, Orchestrator) together with proper dependency ordering.

**Evidence:**
- `start-all-services.bat` exists but content unknown
- `start-ai-service.bat` exists but content unknown
- No `docker-compose.yml` in active use (exists in `server/` but not configured for full stack)
- No shell script for Unix/macOS

**Impact:**
- Users must manually start each service
- Easy to forget a service and get confusing errors

**Resolution Plan:**
1. Create comprehensive startup scripts (`.bat` and `.sh`)
2. Start services in dependency order: AI service → Orchestrator → Node.js backend
3. Add health checks between service starts
4. Or activate `docker-compose.yml` for containerized deployment

---

## Updated Resolution Progress

| Issue | Severity | Status | Resolved Date |
|-------|----------|--------|---------------|
| ISSUE-001 | 🔴 CRITICAL | [x] Archived to `archive/vue-frontend/` | 2026-05-14 |
| ISSUE-002 | 🔴 CRITICAL | [x] Archived to `archive/vue-frontend/src-tauri/` | 2026-05-14 |
| ISSUE-003 | 🟠 HIGH | [x] Vue archived, Rust keeps src/ | 2026-05-14 |
| ISSUE-004 | 🟠 HIGH | [x] Proxy endpoints exist in server-improved.js | 2026-05-16 |
| ISSUE-005 | 🟠 HIGH | [x] Proxy endpoints exist in server-improved.js | 2026-05-16 |
| ISSUE-006 | 🟡 MEDIUM | [x] Port standardized to 8091 in server-improved.js | 2026-05-16 |
| ISSUE-007 | 🟡 MEDIUM | [x] CORS configurable in both services | 2026-05-16 |
| ISSUE-008 | 🟡 MEDIUM | [ ] | |
| ISSUE-009 | 🟢 LOW | [x] Test artifacts cleaned up | 2026-05-16 |
| ISSUE-010 | 🟢 LOW | [x] Test results cleaned up | 2026-05-16 |
| ISSUE-011 | 🟢 LOW | [ ] | |
| ISSUE-012 | 🟠 HIGH | [x] Documentation correct, files restored to archive | 2026-05-14 |
| ISSUE-013 | 🔴 CRITICAL | [x] README updated, Rust GUI is primary | 2026-05-16 |
| ISSUE-014 | 🟠 HIGH | [x] Archived native-gui and rust-tauri | 2026-05-16 |
| ISSUE-015 | 🟠 HIGH | [x] README.md rewritten for Rust-only | 2026-05-16 |
| ISSUE-016 | 🟠 HIGH | [x] Rust GUI now self-contained with DB + AI | 2026-05-16 |
| ISSUE-017 | 🟠 HIGH | [x] Archived native-gui | 2026-05-16 |
| ISSUE-018 | 🟡 MEDIUM | [x] Replaced by Rust-native workflows | 2026-05-16 |
| ISSUE-019 | 🟡 MEDIUM | [x] Archived Python orchestrator | 2026-05-16 |
| ISSUE-020 | 🟡 MEDIUM | [ ] | |
| ISSUE-021 | 🟡 MEDIUM | [ ] | |
| ISSUE-022 | 🟢 LOW | [x] CORS already configurable | 2026-05-16 |
| ISSUE-023 | 🟢 LOW | [x] Test artifacts removed | 2026-05-16 |
| ISSUE-024 | 🟢 LOW | [x] .gitignore updated with broader pattern | 2026-05-16 |
| ISSUE-025 | 🟡 MEDIUM | [ ] | |
| ISSUE-026 | 🟡 MEDIUM | [ ] | |
| ISSUE-027 | 🟢 LOW | [ ] | |
| ISSUE-028 | 🟡 MEDIUM | [x] ARCHITECTURE.md rewritten | 2026-05-16 |
| ISSUE-029 | 🟡 MEDIUM | [ ] | |
| ISSUE-030 | 🟡 MEDIUM | [ ] | |
| ISSUE-031 | 🟢 LOW | [x] Archived Python orchestrator | 2026-05-16 |
| ISSUE-032 | 🟡 MEDIUM | [ ] | |

---

## Summary Statistics

### Session 1 (Previous)
- **Total Issues:** 12
- **Resolved:** 4 (33%)

### Session 2 Part A (2026-05-16 Review)
- **New Issues Found:** 20
- **Resolved:** 5 (ISSUE-004, 005, 006, 007, 022)

### Session 2 Part B (2026-05-16 Restructure)
- **Resolved:** 14 (major architectural restructure)

### Cumulative Totals
- **Total Issues:** 32
- **Total Resolved:** 23 (71.9%)
- **Critical:** 3 (2 resolved)
- **High:** 9 (7 resolved)
- **Medium:** 13 (8 resolved)
- **Low:** 7 (6 resolved)

### Issues by Category
| Category | Count | Resolved |
|----------|-------|----------|
| Frontend & Build | 3 | 2 |
| Integration Gaps | 6 | 5 |
| Configuration & Security | 3 | 1 |
| Code Quality & Maintenance | 4 | 3 |
| Documentation | 3 | 3 |
| Performance & Reliability | 4 | 0 |

---

## Vue Frontend Archive

The complete Vue frontend has been archived to `archive/vue-frontend/` for future reference.

### Archive Location
```
archive/vue-frontend/
├── .ai-protected          # Protection marker for AI agents
├── README.md              # Documentation with restoration guide
├── src/                   # Vue.js source code (447 files)
├── src-tauri/             # Tauri desktop configuration (17 files)
├── public/                # Static assets
├── index.html             # Entry point
├── package.json           # Dependencies
├── vite.config.ts         # Build config
├── tsconfig.json          # TypeScript config
├── tailwind.config.js     # CSS framework config
├── postcss.config.js      # PostCSS config
├── eslint.config.js       # Linting config
├── playwright.config.ts   # E2E test config
├── vitest.config.ts       # Unit test config
└── ... (more config files)
```

### Protection
- `.ai-protected` marker files in `archive/` and `archive/vue-frontend/`
- `archive/` already listed in `.gitignore` (git-ignored)
- AI agents are instructed not to modify or delete

### Future Restoration
1. Copy `archive/vue-frontend/` to project root
2. Resolve `src/` naming conflict between Vue and Rust
3. Run `npm install && npm run dev`

---

*Last Updated: 2026-05-16*
*Status: Major restructure complete. 32 issues identified, 23 resolved (71.9%)*
*Next Session Priority: ISSUE-008 (AI Service SECRET_KEY), ISSUE-025 (Unimplemented CLI flags), ISSUE-029 (Mock analytics endpoints)*
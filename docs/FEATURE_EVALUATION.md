# Space Analyzer Pro — Feature Evaluation

> **Note:** This is a historical evaluation document. Some references to `server/` and `ai-service/` reflect the legacy web architecture which has been moved to a separate repository. The current project is a Rust desktop application.

**Date:** 2026-06-03
**Scope:** Audit every feature/module under `src/`, `server/`, `ai-service/`, and `native/`, classify them against the project's actual vision, and recommend what to wire, archive, or remove.

---

## 1. The Stated Vision (Baseline for Evaluation)

The user clarified the product is not meant to be a generic space-analyzer clone. The required capabilities are:

| # | Capability | Notes |
|---|-----------|-------|
| A | **Scan files** across multiple drives (3+) | Baseline; tree-walk + size + category. |
| B | **Identify data hogs** | Largest files, growth trends, disk-volume overview. |
| C | **Manage scanned files** (take action) | Delete, move, hard-link dedup, organize. |
| D | **AI agent that takes actions on the user's behalf** | Tool-calling LLM, workflow automation. |
| E | **AI-powered file analysis** to surface: code bloat, unnecessary files, type breakdowns, **provenance** (where the files came from). |
| F | **Destructive-action preview** | Before deleting/moving, show the user what depends on / relates to the file, so they can see consequences. |

Anything that does not serve A–F is overhead. Anything that serves A–F but is not currently reachable from the GUI is "infrastructure sitting on the shelf" and is the highest-leverage wiring target.

---

## 2. Critical Discovery: 3 Modules Are Not Even Compiled

`src/lib.rs` declares the modules included in the library and the GUI binary. Three top-level files exist on disk but are **not declared**, which means they are not compiled and not reachable from any code:

| File | What it does | Vision capability |
|------|--------------|-------------------|
| `src/category.rs` | Maps file extensions → 12 human-readable categories (Documents, Images, Videos, Code, Development, etc.). | **E** (type breakdown) |
| `src/offline_ai.rs` | Heuristic pattern classifier: large videos, cache files, code-build artifacts, etc. | **E** (unnecessary files, code bloat) |
| `src/file_relations.rs` | Builds a `DependencyReport` for a target file: hardlinks, symlinks, sibling files, paired extensions, summary. | **F** (destructive-action preview) |

These are not "almost wired" — they are dead files that already implement three of the user's six stated capabilities. **Wiring them is the single highest-value simplification action available**, because it activates capability E (partial) and capability F (full) without writing new code.

---

## 3. Feature Inventory & Classification

### 3.1 Active Rust egui GUI (`src/gui/` + `src/lib.rs` modules)

| Feature | Location | Status | Vision | Recommendation |
|---------|----------|--------|--------|----------------|
| Multi-tab GUI shell (Dashboard, Scan, History, SmartSearch, Workflows, AIChat, System, Settings) | `src/gui/mod.rs` | ✅ Active | A, B, D | **Keep** — primary user surface. |
| Scan engine (recursive walk, progress, perf metrics, cancellation) | `src/gui/scan.rs`, `shared-scanner/` | ✅ Active | A, B | **Keep** — core. |
| Deduplication (parallel hashing, optional GPU) | `src/gui/dedup.rs`, `native/file_deduplicator/` | ✅ Active | C | **Keep** — directly serves "manage scanned files". |
| History view + clear/delete | `src/gui/history.rs` | ✅ Active | A | **Keep**. |
| Smart Search (semantic embeddings via Ollama) | `src/gui/embeddings.rs`, `src/embedding_service.rs`, `src/database/embeddings.rs` | ✅ Active | E | **Keep** — high-value when Ollama is present. |
| Workflows (templates, scheduled/manual triggers, action chain) | `src/workflows/`, `src/gui/workflow_render.rs` | ✅ Active | C, D | **Keep** — load-bearing for agentic automation. |
| AI Chat with tool-calling | `src/gui/ai/`, `src/ollama/`, `src/tool_registry/` | ✅ Active | D | **Keep** — the user's AI-agent goal lives here. |
| Tool registry (10 tools: scan, history, volumes, resources, storage trend, workflows, file-type breakdown, predict, patterns, search, largest files) | `src/tool_registry/` | ✅ Active | D | **Keep** — the agent's hands. |
| System monitor (3 drives, CPU, RAM, GPU) | `src/gui/system.rs`, `src/system_monitor.rs` | ✅ Active | B | **Keep** — drives requirement. |
| Settings persistence | `src/gui/settings.rs`, `src/database/settings.rs` | ✅ Active | (cross-cutting) | **Keep**. |
| Session logger | `src/session_logger.rs` | ✅ Active | (diagnostics) | **Keep** — opt-in, small, useful. |
| Embedded SQLite (scan history, settings, workflow history, embeddings) | `src/database/` | ✅ Active | (persistence) | **Keep**. |
| **File category table** | `src/category.rs` | ❌ **Not compiled** | E | **WIRE NOW** — declare in `lib.rs`, call from dashboard/scan results to group and label files. |
| **Offline AI heuristics** | `src/offline_ai.rs` | ❌ **Not compiled** | E | **WIRE NOW** — declare in `lib.rs`, run during/after scan to flag bloat/cache/dev-artifact candidates. |
| **File relations / dependency report** | `src/file_relations.rs` | ❌ **Not compiled** | F | **WIRE NOW** — declare in `lib.rs`, add a "Preview impact" action on files that runs `build_dependency_report` and shows a modal before destructive actions. |
| Embedding schema (save/get embeddings for a scan) | `src/database/embeddings.rs` | ✅ Active but marked `#[allow(dead_code)]` "Planned: semantic search" | E | **WIRE NOW** (cosmetic) — remove the dead_code allow; the embeddings tab already calls into it. |

### 3.2 Workspace Rust Crates (`Cargo.toml` `[workspace.members]`)

| Crate | Status | Vision | Recommendation |
|-------|--------|--------|----------------|
| `shared-scanner/` | ✅ Used by GUI + CLI | A, B | **Keep**. |
| `gpu-compute/` (optional CUDA) | ✅ Used by shared-scanner; CPU fallback exists | (performance) | **Keep** — optional feature, no maintenance cost when disabled. |
| `native/scanner/` (CLI `space-analyzer`) | ✅ Used by `src/main.rs` | A, B | **Keep** — useful headless tool. |
| `native/file_deduplicator/` | ✅ Used by `src/main.rs` and `src/gui/dedup.rs` | C | **Keep**. |
| `native/node_modules_cleaner/` | ✅ Workspace member, used standalone | C (niche) | **Keep** — small, useful, no GUI coupling. |

### 3.3 Native Crates on Disk but Excluded from Workspace

All three have a `DEPRECATED.md` and are explicitly not in `Cargo.toml`. They are not built, not tested, not maintained.

| Crate | Status | Recommendation |
|-------|--------|----------------|
| `native/archive_manager/` | Excluded, deprecated | **DELETE from disk** — `archive/` and the deprecated-pattern docs already cover reference. |
| `native/storage_predictor/` | Excluded, deprecated | **DELETE from disk** — superseded by the in-app `WorkflowAction::PredictStorage` + tool registry. |
| `native/file_monitor/` | Excluded, deprecated (migrations dir + sql files) | **DELETE from disk** — the GUI's "watch this directory" need is not part of the user's stated vision. |
| `native/design-screenshot/` (uses `headless_chrome`) | Not even in the deprecated-not-excluded bucket; has nothing to do with disk space | **DELETE from disk** — wrong product; design-review tool, not space analyzer. |

### 3.4 Server (Node.js) — `server/`

The Rust egui GUI does **not** call this service. The previous session's ISSUES.md (Issue 016) confirmed this. As of 2026-06-03, this remains the case — `src/gui/` has no `reqwest` calls to `localhost:8091` and `src/ollama/` talks to Ollama directly, not to this server.

| File | Status | Recommendation |
|------|--------|----------------|
| `server/server-improved.js` (702 LOC, scan/structure/analyze/analytics routes) | Unused by GUI | **INACTIVE** — leave the file but mark as "potential web-mode backend"; do not maintain. |
| `server/analytics.js` (returns `Math.random()` per Issue 029) | Mock data, unused | **INACTIVE** — Issue 029 still open; either fix or document as disabled. |
| `server/EnhancedStreamingService.js` (`require('./OpenSourceAIManager')` — **module does not exist**) | Broken import | **INACTIVE / delete** — broken and unused. |
| `server/SmartAnalysisService.js` (`require('../src/integration/smart-orchestrator.cjs')` — **path does not exist**) | Broken import | **INACTIVE / delete** — broken and unused. |
| `server/speculative-decoder.js` (402 LOC, requires large+small model pairing) | Overkill for current hardware target (GTX 1070 Ti 8GB), unused | **INACTIVE** — document as "future when running on multi-GPU / cloud". |
| `server/SelfLearningMLService.js` (admitted "simplified mode" with no real ML) | Cosmetic, unused | **INACTIVE** — either delete or fold into heuristics the Rust `offline_ai.rs` already has. |
| `server/worker-pool.js` + `worker.js` | Unused by GUI | **INACTIVE** — Rust already does parallel work via `rayon`/`shared-scanner`. |
| `server/scan-cache.js`, `scan-filter.js`, `scan-profiles.js` | Unused by GUI | **INACTIVE** — equivalent logic in Rust (`shared-scanner` options). |
| `server/file-preview.js` | Unused by GUI (would matter for a web UI) | **INACTIVE** — only relevant if a web frontend ever returns. |
| `server/KnowledgeDatabase.js` (9-line re-export) | Layer of indirection | **INACTIVE** — leave as-is; trivial. |
| `server/config/`, `server/controllers/`, `server/db/`, `server/learning/`, `server/middleware/`, `server/modules/`, `server/python-ai-service/`, `server/routes/`, `server/services/`, `server/utils/` | Subtree of supporting modules | **INACTIVE** — verify nothing in `src/` reaches into this tree; if confirmed, this whole tree is the "potential web-mode backend" surface. |

### 3.5 AI Service (Python) — `ai-service/`

Same situation: not called from the active GUI. The Rust `src/ollama/` and `src/offline_ai.rs` are the AI surface.

| File | Status | Recommendation |
|------|--------|----------------|
| `ai-service/main.py` (23 LOC, prints deprecation banner, redirects) | Wrapper | **INACTIVE** — keep as a shim or delete; nothing calls it. |
| `ai-service/app/main.py` ("Unified v3.0.0", FastAPI, 5 routers) | Unused by GUI | **INACTIVE** — would matter only if a web UI ever returns. |
| `ai-service/app/routers/*` (auth, categorizer, health, ollama, predictions) | Unused | **INACTIVE**. |
| `ai-service/app/services/*` (ml_predictions, ml_service, ollama_service) | Unused — Rust reimplements in `src/ollama/` | **INACTIVE**. |
| `ai-service/ml_categorizer/src/{api, categorizer, trainer}.py` | Unused; scikit-learn based | **INACTIVE** — Rust `offline_ai.rs` already does extension-based categorization, which is the right level for the user's "code bloat / unnecessary files" use case. |
| `ai-service/ollama_client.py` | Unused — Rust has its own in `src/ollama/` | **INACTIVE**. |
| `ai-service/models/` | Empty/gitignored | **INACTIVE** — once you commit to Rust-side heuristics + Ollama, no model artifacts are needed. |
| `ai-service/scripts/`, `automated_feedback_loop.py`, `test_api.py` | Test infra | **INACTIVE**. |

### 3.6 archive/ (Gitignored, Historical Reference)

| Directory | What | Recommendation |
|-----------|------|----------------|
| `archive/v3.2.0-monolithic/` | Pre-split snapshot | **Keep as-is** — explicitly historical. |
| `archive/legacy-modules/` | Early Rust experiments | **Keep as-is**. |
| `archive/orphaned-server/` | Pre-Rust Node server | **Keep as-is**. |

---

## 4. The Gap Between Current State and the User's Vision

| Vision | Current State | Gap |
|--------|---------------|-----|
| A — Scan | ✅ Working | None. |
| B — Data hogs / 3 drives | ✅ Working (Dashboard + System tab) | None. |
| C — Manage files | ✅ Workflows + Dedup tab + CLI `--clean` | Could surface a "Preview impact" step (see F). |
| D — AI agent | ✅ Tool registry + Ollama chat | None functional, but tools are read-only. Add **mutating tools** (delete-via-trash, move-to-folder, hardlink-duplicates) behind the destructive-preview gate. |
| E — Code bloat / unnecessary / types / provenance | ⚠️ Partial | `category.rs` and `offline_ai.rs` exist but aren't compiled. **No provenance feature exists at all** — would need a new design (install-time hooks, package-manifest correlation, or accept `npx/pip install` logs as input). |
| F — Destructive-action preview | ❌ Missing | `file_relations.rs` exists and can answer "what depends on this file" via `DependencyReport` (hardlinks, symlinks, paired-extension siblings). It is not compiled and not exposed in any UI. |

The single most leveraged action is to wire `category.rs`, `offline_ai.rs`, and `file_relations.rs` into the GUI and add a "Preview impact" button on file rows. That activates 3/6 capabilities the user explicitly cares about, using code that already exists.

---

## 5. Recommended Action Plan (Priority Order)

### Tier 1 — Wire the dormant code (high value, low risk)

1. **Declare `category`, `offline_ai`, `file_relations` in `src/lib.rs`.** They already compile as standalone files (they have no other internal deps beyond `serde`/`chrono`/filesystem).
2. **Add a "Categories" panel** to the Dashboard that uses `category::FILE_CATEGORIES` to bucket the most recent scan's files.
3. **Run `offline_ai::FilePatternClassifier` after every scan** and surface matches in a new "Bloat candidates" section (cache, node_modules, .log, build artifacts).
4. **Add a "Preview impact" button** to the file list in the History/Dashboard tabs. It calls `file_relations::build_dependency_report(path)` and shows a modal with: hardlink count, symlink sources, sibling files, paired-extension companions, and a confirmation checkbox before any destructive action. This is the destructive-preview capability F.

### Tier 2 — Trim dead/wrong-product code (zero functional loss)

5. **Delete from disk** (after a final `git log` review):
   - `native/archive_manager/`
   - `native/storage_predictor/`
   - `native/file_monitor/`
   - `native/design-screenshot/` (wrong product; uses `headless_chrome`)
6. **Stop building them** is already done — they're not in the workspace. Just remove the directories.

### Tier 3 — Document the inactive-but-kept services (low risk, clarity win)

7. Add a top-level `server/README.md` and `ai-service/README.md` with a single sentence each: "This service is the optional web-mode backend. The active desktop GUI does not call it. Kept for future use; see docs/FEATURE_EVALUATION.md." This makes it explicit to any future contributor that the GUI is the source of truth.
8. In the same README, mark the **broken imports** (`EnhancedStreamingService.js` → `OpenSourceAIManager`, `SmartAnalysisService.js` → `smart-orchestrator.cjs`) as **non-runnable until those modules are written or those files are deleted**.

### Tier 4 — Optional later (only after Tier 1 ships)

9. Add a **mutating tool** to the tool registry: `move_to_trash(path)`, gated by the destructive-preview modal.
10. Add a **deduplicate-now** tool: `hardlink_duplicates(group_id)`, gated by preview.
11. Design the **provenance** feature (E, last gap). This needs new work, not a wiring task.

### Tier 5 — Don't do

- Do not bring back the Vue/Tauri frontends. The user explicitly chose the egui app.
- Do not invest in `speculative-decoder.js`, `SelfLearningMLService.js`, or `server/analytics.js` mock endpoints.
- Do not revive the Python `ml_categorizer` for in-GUI use — `offline_ai.rs` is enough until proven otherwise.

---

## 6. Summary Table

| Bucket | Items | Disposition |
|--------|-------|-------------|
| **WIRE NOW** (already coded, not compiled/reachable) | `src/category.rs`, `src/offline_ai.rs`, `src/file_relations.rs` | Declare in `lib.rs`; expose in GUI; add "Preview impact" modal. |
| **WIRE NOW (cosmetic)** | `src/database/embeddings.rs` `#[allow(dead_code)]` | Remove the allow; the embeddings tab already calls into it. |
| **KEEP** (active, serves the vision) | GUI shell, scan, dedup, history, smart-search, workflows, AI chat, tool registry, system monitor, settings, session logger, SQLite, `shared-scanner`, `gpu-compute`, `native/scanner`, `native/file_deduplicator`, `native/node_modules_cleaner` | No change. |
| **DELETE from disk** | `native/archive_manager/`, `native/storage_predictor/`, `native/file_monitor/`, `native/design-screenshot/` | Already excluded from workspace; remove directories to stop misleading the next contributor. |
| **INACTIVE — document only** | `server/**` (all 13 files + subtrees), `ai-service/**` (all 10 files) | Add READMEs explaining "not called by GUI; potential web-mode backend". Fix or delete the two broken-import files. |
| **DON'T TOUCH** | `archive/v3.2.0-monolithic/`, `archive/legacy-modules/`, `archive/orphaned-server/` | Explicitly historical. |

---

## 7. How to Use This Document

This evaluation is a decision aid, not a refactor plan. The next step is for you to confirm:

1. **Tier 1 wiring targets** — Do you want me to declare the three dormant modules in `src/lib.rs` and add a Dashboard "Categories" panel, a "Bloat candidates" panel, and a "Preview impact" modal? This is the highest-leverage work.
2. **Tier 2 deletion** — Do you want me to remove the four dead `native/` directories? Safe; they're not in the workspace and not used.
3. **Tier 3 documentation** — Do you want me to add the two READMEs that mark the inactive services as "not called by GUI"?
4. **Tier 4 features** — These are new work and should wait until Tier 1 is in your hands and you've used it for a week.

Tell me which tiers to execute and I'll proceed. If you want a different decision on any single row, say so and I'll update the table.

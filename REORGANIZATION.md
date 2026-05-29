# Project Reorganization: Space Analyzer

## File Location Restructure (v3.3.0)

The project had two GUI implementations coexisting:
- `src/gui.rs` (v3.2.0 monolithic, 983 lines) — legacy all-in-one file
- `src/gui/mod.rs` (v3.3.0 modular, 787 lines) — refactored with sub-modules

Additionally, dead modules from earlier development were still in `src/`.

### What Changed

| Before | After |
|--------|-------|
| `src/gui.rs` (active binary) | `archive/v3.2.0-monolithic/gui.rs` |
| `src/gui.rs.backup` | `archive/v3.2.0-monolithic/gui.rs.backup` |
| `src/ai_skills.rs` (dead) | `archive/legacy-modules/ai_skills.rs` |
| `src/ollama_client.rs` (dead) | `archive/legacy-modules/ollama_client.rs` |
| `src/database.rs` (legacy copy) | `archive/legacy-modules/database.rs` |
| `src/gui/mod.rs` (used by tests only) | `src/gui/mod.rs` (active binary entry point) |

### Why

- Eliminates confusion between "which GUI is active"
- Clear version labeling in `archive/v3.2.0-monolithic/`
- Dead modules separated into `archive/legacy-modules/`
- `src/` top-level reduced from 10 files to 6 (only shared modules remain)

## Root-Level Cleanup Summary

The root directory has accumulated many loose files from debugging, testing, and build experiments. These have been organized as follows:

### Moved to `build-tools/`
- All `.bat` and `.ps1` setup/build scripts

### Moved to `docs/screenshots/`
- Debug screenshots (`.png` files)

### Moved to `logs/analysis-reports/`
- Node modules analysis JSON reports

### Moved to `scripts/`
- Debug and test utility scripts from root

### Moved to `config/`
- `.backend-port` file
- `launcher_backend.py` (launcher config)

### Deleted
- `nul` artifact file

### Organized `shared/` and `build-tools/`
- Build tools consolidated
- Scripts deduplicated
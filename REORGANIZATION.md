# Project Reorganization: Space Analyzer

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
# Scripts Directory

This directory contains all development, build, test, and utility scripts for the Space Analyzer Pro project.

## Directory Structure

`
scripts/
+-- build/       # Build and environment setup scripts
+-- test/        # Test runners and test utilities
+-- setup/       # Service startup and environment initialization
+-- fix/         # Quick fixes, cache clearing, and repairs
+-- debug/       # Debugging tools and instrumentation
+-- utility/     # General utilities, benchmarks, and analysis tools
`

## Usage

### Build Scripts
- **Windows (PowerShell):** scripts/build/build-tauri.ps1
- **Windows (Batch):** scripts/build/build-tauri.bat
- **Rust environment setup:** scripts/build/setup-rust-permanent.bat

### Test Scripts
- **Full system test:** scripts/test/run-full-system-test.ps1
- **Playwright tests:** scripts/test/run-playwright-tests.js
- **Security tests:** scripts/test/run-security-tests.js
- **Visual tests:** scripts/test/run-visual-tests.js

### Service Startup
- **Start all services:** scripts/setup/start-all-services.bat (Windows) or scripts/setup/start.sh (Unix)
- **Start server only:** scripts/setup/start-server.ps1
- **Start Vite dev server:** scripts/setup/start-vite.ps1

### Fix Scripts
- **Clear Vite cache:** scripts/fix/fix-vite-cache.ps1
- **Fix path issues:** scripts/fix/fix-comspec-and-path.ps1

### Debug Tools
- **CSS debugger:** scripts/debug/debug-css.js
- **Instrument UX:** scripts/debug/instrument_ux.py

### Utilities
- **Vision analysis:** scripts/utility/vision-analysis/gpu_vision_analyzer.py
- **Benchmarks:** scripts/utility/ollama_cuda_benchmark.py
- **Status checks:** scripts/utility/check-status.ps1

## Notes

- Scripts are organized by purpose, not by language
- Windows users should prefer .ps1 or .bat files
- Unix/macOS users should prefer .sh files
- Python scripts require the appropriate conda/venv environment
- Node.js scripts should be run from the project root

---
**Last updated:** 2026-06-03 (after project reorganization)
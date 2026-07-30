# Space Analyzer Pro - Desktop App Task Runner
# Requires: just (https://github.com/casey/just)
# Install: cargo install just

set shell := ["pwsh", "-Command"]

# Default target
default: help

# ──────────────────────────────────────────────────────────────
#  Help
# ──────────────────────────────────────────────────────────────

# Show all available tasks
help:
    @echo "Space Analyzer Pro (Rust Desktop) — justfile tasks"
    @echo ""
    @echo "Build:"
    @echo "  just build               Build debug workspace"
    @echo "  just build-release       Build optimized release"
    @echo "  just build-gui           Build GUI binary only"
    @echo "  just build-cli           Build CLI binary only"
    @echo ""
    @echo "Test:"
    @echo "  just test                Run all workspace tests"
    @echo "  just test-gui            Run GUI macro test (Win32)"
    @echo "  just test-native         Run native binary test suite"
    @echo ""
    @echo "Lint/Format:"
    @echo "  just fmt                 Format all Rust code"
    @echo "  just fmt-check           Check formatting (CI mode)"
    @echo "  just clippy              Run Clippy lints"
    @echo "  just lint                Format check + Clippy"
    @echo ""
    @echo "Verify (run after every change):"
    @echo "  just verify              fmt-check + clippy + test"
    @echo ""
    @echo "Dev Environment:"
    @echo "  just check-deps          Verify toolchain is complete"
    @echo "  just setup               Install missing components"
    @echo ""
    @echo "Run:"
    @echo "  just run-gui             Start the GUI application"
    @echo "  just run-cli             Run the CLI scanner"
    @echo "  just run-cli-scan PATH   Scan a directory (headless)"
    @echo ""
    @echo "Release:"
    @echo "  just package             Build release + create zip"
    @echo "  just bench               Run criterion benchmarks"
    @echo ""
    @echo "Database:"
    @echo "  just db-check            Verify SQLite schema integrity"
    @echo ""
    @echo "System Utilities:"
    @echo "  just check-updates       Check app updates (portable online + winget + deps)"
    @echo "  just check-code-deps     Check code dependencies only (npm, pip, cargo)"
    @echo "  just check-updates-fast  Check apps only (skip dependency scan)"
    @echo "  just dashboard           Open interactive HTML dashboard"
    @echo "  just dashboard-server    Start server at localhost:3847 for live updates"
    @echo "Code Quality:"
    @echo "  just audit               Check for unused dependencies"
    @echo "  just doc                 Build docs (rustdoc)"
    @echo ""
    @echo "Clean:"
    @echo "  just clean               Remove build artifacts"
    @echo "  just clean-all           Clean + remove target/"

# ──────────────────────────────────────────────────────────────
#  Build
# ──────────────────────────────────────────────────────────────

# Build debug workspace
build:
    cargo build --workspace

# Build optimized release
build-release:
    cargo build --workspace --release

# Build GUI binary only
build-gui:
    cargo build -p space-analyzer-gui-egui

# Build CLI binary only
build-cli:
    cargo build --bin space-analyzer-pro

# ──────────────────────────────────────────────────────────────
#  Test
# ──────────────────────────────────────────────────────────────

# Run all workspace tests
test:
    cargo test --workspace --exclude node_modules_cleaner --exclude gpu-compute

# Run GUI macro test (Win32 PrintWindow API, zero-disruption)
test-gui:
    python scripts/test/gui_macro_test.py

# Run native binary test suite
test-native:
    python scripts/debug/test_native_gui.py

# ──────────────────────────────────────────────────────────────
#  Lint / Format
# ──────────────────────────────────────────────────────────────

# Format all Rust code
fmt:
    cargo fmt --all

# Check formatting (CI mode)
fmt-check:
    cargo fmt --all -- --check

# Run Clippy lints
clippy:
    cargo clippy --all-targets -- -D warnings

# Format check + Clippy
lint: fmt-check clippy

# ──────────────────────────────────────────────────────────────
#  Verify (single command after every change)
# ──────────────────────────────────────────────────────────────

# fmt-check + clippy + all tests
verify:
    cargo fmt --all -- --check
    cargo clippy --all-targets -- -D warnings
    cargo test --workspace --exclude node_modules_cleaner --exclude gpu-compute

# ──────────────────────────────────────────────────────────────
#  Dev Environment
# ──────────────────────────────────────────────────────────────

# Verify toolchain is complete
check-deps:
    @echo "Checking Rust toolchain..."
    @rustc --version
    @cargo --version
    @rustfmt --version 2>$null || (echo "MISSING: rustfmt — run: rustup component add rustfmt" && exit 1)
    @cargo clippy --version 2>$null || (echo "MISSING: clippy — run: rustup component add clippy" && exit 1)
    @echo ""
    @echo "Checking optional tools..."
    @just --version 2>$null || echo "NOTE: just not installed — run: cargo install just"
    @echo ""
    @echo "Checking build targets..."
    @rustup target list --installed | Select-String "msvc"
    @echo ""
    @echo "All checks passed!"

# Install missing components
setup:
    rustup component add rustfmt clippy
    @echo "Components installed. Run 'just check-deps' to verify."

# ──────────────────────────────────────────────────────────────
#  Run
# ──────────────────────────────────────────────────────────────

# Start the GUI application
run-gui:
    cargo run -p space-analyzer-gui-egui

# Run the CLI scanner
run-cli:
    cargo run --bin space-analyzer-pro

# Scan a directory (headless CLI mode)
run-cli-scan PATH:
    cargo run --bin space-analyzer-pro -- --scan {{PATH}}

# ──────────────────────────────────────────────────────────────
#  Release
# ──────────────────────────────────────────────────────────────

# Build release + create distributable zip
package:
    @echo "Building release..."
    cargo build --workspace --release
    @echo "Creating package..."
    @powershell -Command "$v = (cargo metadata --no-deps --format-version 1 | ConvertFrom-Json).packages[0].version; $z = \"space-analyzer-pro-$v-windows-x64.zip\"; if (Test-Path $z) { Remove-Item $z }; 	Compress-Archive -Path 'gui-egui/target/release/space-analyzer-gui.exe','target/release/space-analyzer-pro.exe' -DestinationPath $z; echo \"Package: $z\""

# Run criterion benchmarks
bench:
    cargo bench --workspace

# ──────────────────────────────────────────────────────────────
#  Database
# ──────────────────────────────────────────────────────────────

# Verify SQLite schema integrity
db-check:
    @echo "Checking database schema..."
    @if (Get-Command sqlite3 -ErrorAction SilentlyContinue) { $dbPath = "$env:APPDATA\SpaceAnalyzer\space_analyzer.db"; if (Test-Path $dbPath) { sqlite3 $dbPath ".tables"; $count = sqlite3 $dbPath "SELECT count(*) FROM sqlite_master WHERE type='table';"; echo "Table count: $count" } else { echo "No database found at $dbPath (app creates on first run)" } } else { echo "sqlite3 CLI not found — install from https://www.sqlite.org/download.html" }

# ──────────────────────────────────────────────────────────────
#  Code Quality
# ──────────────────────────────────────────────────────────────

# Check for unused dependencies
audit:
    cargo install cargo-machete 2>$null || true
    cargo machete

# Build docs (rustdoc)
doc:
    cargo doc --workspace --no-deps

# ──────────────────────────────────────────────────────────────
#  Clean
# ──────────────────────────────────────────────────────────────

# Remove build artifacts
clean:
    cargo clean
    @Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts

# Clean everything including target/
clean-all:
    cargo clean
    @Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts
    @Remove-Item -Recurse -Force -ErrorAction SilentlyContinue target

# Continuous optimization loop
loop-start:
    @echo "Starting continuous optimization loop..."
    @if not exist loop_feedback mkdir loop_feedback
    python scripts/loop/continuous_test_loop.py

loop-start-background:
    @echo "Starting loop in background..."
    @if not exist loop_feedback mkdir loop_feedback
    @start /B python scripts/loop/continuous_test_loop.py

loop-stop:
    @echo "Stopping loop..."
    @taskkill /FI "WINDOWTITLE eq Space-Analyzer-Loop*" /F 2>nul
    @if exist loop_feedback\loop.pid taskkill /F /PID $(type loop_feedback\loop.pid) 2>nul
    @echo "Loop stopped."

loop-status:
    @echo "Loop state:"
    @if exist loop_feedback\loop_state.json python -c "import json,sys; d=json.load(open(sys.argv[1])); print(json.dumps(d, indent=2))" loop_feedback\loop_state.json
    @echo ""
    @echo "Recent feedback:"
    @if exist loop_feedback\agent_feedback.jsonl powershell -Command "Get-Content loop_feedback\agent_feedback.jsonl -Tail 5"

loop-feedback:
    @echo "Submitting feedback..."
    python scripts/loop/feedback_collector.py --interactive

loop-report:
    @echo "Generating optimization report..."
    python scripts/loop/feedback_collector.py --report

loop-clear:
    @echo "Clearing loop state..."
    @if exist loop_feedback\loop_state.json del loop_feedback\loop_state.json
    @if exist loop_feedback\loop.lock del loop_feedback\loop.lock
    @if exist loop_feedback\agent_feedback.jsonl del loop_feedback\agent_feedback.jsonl
    @echo "Loop state cleared."

# ──────────────────────────────────────────────────────────────
#  System Utilities
# ──────────────────────────────────────────────────────────────

# Check for app updates (portable apps online + winget + deps)
check-updates:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/check_updates.ps1

# Check only code dependencies (npm, pip, cargo) on E: drive
check-code-deps:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/check_updates.ps1 -SkipPortable -SkipWinget

# Check updates (JSON output)
check-updates-json:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/check_updates.ps1 -OutputFormat json

# Check updates (skip dependency scan)
check-updates-fast:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/check_updates.ps1 -SkipDependencies

# Open update dashboard in browser (generates HTML + opens)
dashboard:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/check_updates.ps1 -SkipPortable -SkipWinget -Dashboard

# Start dashboard server (http://localhost:3847) for live updates
dashboard-server:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/dashboard_server.ps1

# Full Windows package (local only, no CI)
package-full: build-release
	@echo "Packaging for Windows x64..."
	@$ErrorActionPreference='SilentlyContinue'; if (Test-Path dist) { Remove-Item dist -Recurse -Force }
	New-Item -ItemType Directory -Path dist -Force | Out-Null
	$v = (cargo metadata --no-deps --format-version 1 | ConvertFrom-Json).packages[0].version
	$out = "dist/space-analyzer-pro-$v-windows-x64"
	New-Item -ItemType Directory -Path "$out/bin" -Force | Out-Null
	Copy-Item "gui-egui/target/release/space-analyzer-gui.exe" "$out/bin/"
	Copy-Item "target/release/space-analyzer-pro.exe" "$out/bin/"
	if (Test-Path "target/release/*.dll") { Copy-Item "target/release/*.dll" "$out/bin/" }
	New-Item -ItemType Directory -Path "$out/docs" -Force | Out-Null
	Copy-Item docs/* "$out/docs/" -Recurse -ErrorAction SilentlyContinue
	Set-Content -LiteralPath "$out/README.txt" -Value "Space Analyzer Pro v$v`nRun bin/space-analyzer-gui.exe`nDocs in docs/`n"
	Compress-Archive -Path "$out/*" -DestinationPath "dist/space-analyzer-pro-$v-windows-x64.zip"
	@echo "Package ready: dist/space-analyzer-pro-$v-windows-x64.zip"

# Disable Defender false-positive warnings on target/
defender-exclude:
	@echo "Adding Defender exclusion for target/ (requires admin)..."
	@powershell -Command "Start-Process powershell -ArgumentList '-NoProfile','-Command','Add-MpPreference -ExclusionPath ''E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\target''' -Verb RunAs -Wait"

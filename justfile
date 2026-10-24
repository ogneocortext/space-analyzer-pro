# Space Analyzer Pro - Desktop App Task Runner
# Requires: just (https://github.com/casey/just)
# Install: cargo install just
#
# Best practices applied (from just.systems/man):
# - Variadic cargo wrapper: `just cargo <any args>`
# - Aliases: `t`, `c`, `f`, `v` shorthand
# - Private recipes: `_`-prefixed, hidden from `just --list`
# - nextest first, fall back to cargo test
# - cargo watch for continuous testing
# - typecheck & udeps for code quality

set shell := ["pwsh", "-Command"]

# ── Common variables ──────────────────────────────────────────────

cargo-common := "--workspace --exclude node_modules_cleaner --exclude gpu-compute"

# ── Aliases (shorthand) ───────────────────────────────────────────

alias t := test-progress
alias c := clippy
alias f := fmt
alias v := verify

# ── Variadic cargo wrapper (flexible: `just cargo check`, `just cargo build --bin foo`) ─────

cargo +args='':
    $env:CC=$null; $env:CXX=$null; cargo {{args}}

# ── Default ───────────────────────────────────────────────────────

default: help

# ── Help ──────────────────────────────────────────────────────────

help:
    @echo "Space Analyzer Pro (Rust Desktop) — justfile tasks"
    @echo ""
    @echo "Build:"
    @echo "  just build               Build debug workspace"
    @echo "  just build-release       Build optimized release"
    @echo "  just build-cli           Build CLI binary only"
    @echo "  just build-gui           Build WinUI 3 GUI (Release)"
    @echo "  just build-release-cli   Build Rust binaries for WinUI embed"
    @echo ""
    @echo "Test:"
    @echo "  just test                Run all workspace tests (CI mode — buffered)"
    @echo "  just test-progress       Run all tests with live output (--nocapture)"
    @echo "  just t                   Alias for test-progress"
    @echo "  just test-cli            Run CLI integration tests with live output"
    @echo "  just test-scanner        Run scanner integration tests with live output"
    @echo "  just test-engine         Run scan-engine unit tests with live output"
    @echo "  just test-watch          Continuously re-run tests on file changes"
    @echo "  just test-gui            Run GUI macro test (Win32)"
    @echo "  just test-native         Run native binary test suite"
    @echo ""
    @echo "Lint/Format:"
    @echo "  just fmt                 Format all Rust code"
    @echo "  just f                   Alias for fmt"
    @echo "  just fmt-check           Check formatting (CI mode)"
    @echo "  just clippy              Run Clippy lints (warnings allowed)"
    @echo "  just c                   Alias for clippy"
    @echo "  just clippy-strict       Clippy with warnings as errors (CI-strict)"
    @echo "  just lint                Format check + Clippy"
    @echo "  just typecheck           cargo check --all-targets"
    @echo ""
    @echo "Verify (run after every change):"
    @echo "  just verify              fmt-check + clippy + test (live output)"
    @echo "  just v                   Alias for verify"
    @echo "  just ci                  CI pipeline: fmt-check + clippy-strict + test"
    @echo "  just pre-commit          Pre-commit checks: fmt + clippy-strict + test + audit"
    @echo ""
    @echo "Dev Environment:"
    @echo "  just check-deps          Verify toolchain is complete"
    @echo "  just setup               Install missing components"
    @echo ""
    @echo "Run:"
    @echo "  just run-gui             Start WinUI 3 GUI (Debug)"
    @echo "  just run-cli             Run the CLI scanner"
    @echo "  just run-cli-scan PATH   Scan a directory (headless)"
    @echo ""
    @echo "Release:"
    @echo "  just package             Build WinUI 3 release + create zip"
    @echo "  just bench               Run criterion benchmarks"
    @echo ""
    @echo "Database:"
    @echo "  just db-check            Verify SQLite schema integrity"
    @echo ""
    @echo "System Utilities:"
    @echo "  just check-updates       Check app updates (portable + winget + deps)"
    @echo "  just check-code-deps     Check code dependencies only (npm, pip, cargo)"
    @echo "  just check-updates-fast  Check apps only (skip dependency scan)"
    @echo "  just update-dashboard    Open interactive HTML update dashboard"
    @echo "  just update-dashboard-server Start dashboard server at localhost:3847"
    @echo ""
    @echo "Code Quality:"
    @echo "  just audit               Check for unused dependencies (cargo-machete)"
    @echo "  just udeps               Check for unused dependencies (cargo-udeps)"
    @echo "  just doc                 Build docs (rustdoc)"
    @echo ""
    @echo "Clean:"
    @echo "  just clean               Remove build artifacts"
    @echo "  just clean-all           Clean + remove target/"
    @echo ""
    @echo "Ad-hoc:"
    @echo "  just cargo <args>        Run any cargo command (CC/CXX unset)"
    @echo "  e.g. just cargo check --bin space-analyzer-cli"

# ── Build ─────────────────────────────────────────────────────────

# Build debug workspace
build:
    $env:CC=$null; $env:CXX=$null; cargo build --workspace

# Build optimized release
build-release:
    $env:CC=$null; $env:CXX=$null; cargo build --workspace --release

# Build CLI binary only
build-cli:
    $env:CC=$null; $env:CXX=$null; cargo build --bin space-analyzer-cli

# Build only the Rust binaries the WinUI app embeds (fast release path).
build-release-cli:
    $env:CC=$null; $env:CXX=$null; cargo build --release --bin space-analyzer-cli
    $env:CC=$null; $env:CXX=$null; cargo build --release -p node_modules_cleaner

# Build WinUI 3 GUI (Release) via MSBuild
build-gui: build-winui

# Typecheck everything without emitting binaries
typecheck:
    $env:CC=$null; $env:CXX=$null; cargo check --all-targets --workspace

# ── Test ──────────────────────────────────────────────────────────

# Try nextest first (faster), fall back to cargo test
_test_cmd := "if (Get-Command cargo-nextest -ErrorAction SilentlyContinue) { cargo nextest } else { cargo test }"

# Run all workspace tests (CI mode — output buffered per suite)
test:
    $env:CC=$null; $env:CXX=$null; cargo test --workspace --exclude node_modules_cleaner --exclude gpu-compute

# Run all workspace tests with live output (--nocapture so you see which test is running)
test-progress:
    $env:CC=$null; $env:CXX=$null; cargo test --workspace --exclude node_modules_cleaner --exclude gpu-compute -- --nocapture

# Continuously re-run tests on file changes (requires cargo-watch)
test-watch:
    $env:CC=$null; $env:CXX=$null; cargo watch -x 'test --workspace --exclude node_modules_cleaner --exclude gpu-compute -- --nocapture'

# Run CLI integration tests with live output
test-cli:
    $env:CC=$null; $env:CXX=$null; cargo test -p space-analyzer --test cli_test -- --nocapture

# Run scanner integration tests with live output
test-scanner:
    $env:CC=$null; $env:CXX=$null; cargo test -p space-analyzer --test shared_scanner_test -- --nocapture

# Run engine unit tests with live output
test-engine:
    $env:CC=$null; $env:CXX=$null; cargo test -p scan-engine -- --nocapture

# Run GUI macro test (Win32 PrintWindow API, zero-disruption)
test-gui:
    python scripts/test/gui_macro_test.py

# Run native binary test suite
test-native:
    python scripts/debug/test_native_gui.py

# ── Lint / Format ─────────────────────────────────────────────────

# Format all Rust code
fmt:
    cargo fmt --all

# Check formatting (CI mode)
fmt-check:
    cargo fmt --all -- --check

# Run Clippy lints (warnings allowed — pre-existing style nits exist)
clippy:
    $env:CC=$null; $env:CXX=$null; cargo clippy --workspace --all-targets

# Run Clippy lints with warnings as errors (CI-strict)
clippy-strict:
    $env:CC=$null; $env:CXX=$null; cargo clippy --workspace --all-targets -- -D warnings

# Format check + Clippy
lint: fmt-check clippy

# ── Verify (single command after every change) ────────────────────

# fmt-check + clippy + all tests (live output)
verify:
    $env:CC=$null; $env:CXX=$null; cargo fmt --all -- --check
    $env:CC=$null; $env:CXX=$null; cargo clippy --workspace --all-targets -- -D warnings
    $env:CC=$null; $env:CXX=$null; cargo test --workspace --exclude node_modules_cleaner --exclude gpu-compute -- --nocapture

# CI pipeline: fmt-check + clippy-strict + test
ci: fmt-check clippy-strict test

# Pre-commit: fmt + clippy-strict + test + audit
pre-commit:
    @just fmt
    @just clippy-strict
    @just test
    @just audit

# ── Dev Environment ───────────────────────────────────────────────

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

# ── Run ───────────────────────────────────────────────────────────

# Run the WinUI 3 GUI (Debug build)
run-gui: build-winui-debug
    Start-Process "gui-winui/SpaceAnalyzer/bin/x64/Debug/net10.0-windows10.0.22621.0/SpaceAnalyzer.exe"

# Run the CLI scanner
run-cli:
    $env:CC=$null; $env:CXX=$null; cargo run --bin space-analyzer-cli

# Scan a directory (headless CLI mode)
run-cli-scan PATH:
    $env:CC=$null; $env:CXX=$null; cargo run --bin space-analyzer-cli -- scan --path {{PATH}} --format json

# ── Release ───────────────────────────────────────────────────────

# Build release + create distributable WinUI 3 zip
package: package-winui

# Run criterion benchmarks
bench:
    cargo bench --workspace

# ── Database ──────────────────────────────────────────────────────

# Verify SQLite schema integrity
db-check:
    @echo "Checking database schema..."
    @if (Get-Command sqlite3 -ErrorAction SilentlyContinue) { $dbPath = "$env:APPDATA\SpaceAnalyzer\space_analyzer.db"; if (Test-Path $dbPath) { sqlite3 $dbPath ".tables"; $count = sqlite3 $dbPath "SELECT count(*) FROM sqlite_master WHERE type='table';"; echo "Table count: $count" } else { echo "No database found at $dbPath (app creates on first run)" } } else { echo "sqlite3 CLI not found — install from https://www.sqlite.org/download.html" }

# ── Code Quality ──────────────────────────────────────────────────

# Check for unused dependencies (cargo-machete)
audit:
    cargo install cargo-machete 2>$null || true
    cargo machete

# Check for unused dependencies (cargo-udeps)
udeps:
    cargo install cargo-udeps 2>$null || true
    cargo udeps --all-targets

# Build docs (rustdoc)
doc:
    cargo doc --workspace --no-deps

# ── Clean ─────────────────────────────────────────────────────────

# Remove build artifacts
clean:
    cargo clean
    @Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts

# Clean everything including target/
clean-all:
    cargo clean
    @Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts
    @Remove-Item -Recurse -Force -ErrorAction SilentlyContinue target

# ── Continuous optimization loop ──────────────────────────────────

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

# ── System Utilities ──────────────────────────────────────────────

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
update-dashboard:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/check_updates.ps1 -SkipPortable -SkipWinget -Dashboard

# Start update dashboard server (http://localhost:3847) for live updates
update-dashboard-server:
    @pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/update_dashboard_server.ps1

# Full Windows package (local only, no CI) — WinUI 3
package-full: package-winui

# Disable Defender false-positive warnings on target/
defender-exclude:
    @echo "Adding Defender exclusion for target/ (requires admin)..."
    @powershell -Command "Start-Process powershell -ArgumentList '-NoProfile','-Command','Add-MpPreference -ExclusionPath ''E:\Self-Built-Web-and-Mobile-Apps\Space-Analyzer\target''' -Verb RunAs -Wait"

# ── WinUI 3 Release (active GUI — local packaging, no CI) ─────────

# Build the WinUI 3 solution in Release via Visual Studio MSBuild.
build-winui:
    & "D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" gui-winui/SpaceAnalyzer.sln -p:Configuration=Release -p:Platform=x64

# Build the WinUI 3 solution in Debug (for run-gui / iterative dev)
build-winui-debug:
    & "D:\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" gui-winui/SpaceAnalyzer.sln -p:Configuration=Debug -p:Platform=x64

# Full WinUI 3 release package: Rust CLI + cleaner + WinUI exe, no egui build.
package-winui VERSION="": build-release-cli build-winui
    pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/utility/package_winui.ps1 "{{VERSION}}"

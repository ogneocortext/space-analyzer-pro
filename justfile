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
    cargo build --bin space-analyzer-gui

# Build CLI binary only
build-cli:
    cargo build --bin space-analyzer-pro

# ──────────────────────────────────────────────────────────────
#  Test
# ──────────────────────────────────────────────────────────────

# Run all workspace tests
test:
    cargo test --workspace

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
    cargo clippy --all-targets --all-features -- -D warnings

# Format check + Clippy
lint: fmt-check clippy

# ──────────────────────────────────────────────────────────────
#  Verify (single command after every change)
# ──────────────────────────────────────────────────────────────

# fmt-check + clippy + all tests
verify:
    cargo fmt --all -- --check
    cargo clippy --all-targets --all-features -- -D warnings
    cargo test --workspace

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
    cargo run --bin space-analyzer-gui

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
    $version = (cargo metadata --no-deps --format-version 1 | ConvertFrom-Json).packages[0].version
    $zipName = "space-analyzer-pro-$version-windows-x64.zip"
    if (Test-Path $zipName) { Remove-Item $zipName }
    Compress-Archive -Path "target/release/space-analyzer-gui.exe","target/release/space-analyzer-pro.exe" -DestinationPath $zipName
    @echo "Package: $zipName"

# Run criterion benchmarks
bench:
    cargo bench --workspace

# ──────────────────────────────────────────────────────────────
#  Database
# ──────────────────────────────────────────────────────────────

# Verify SQLite schema integrity
db-check:
    @echo "Checking database schema..."
    $dbPath = "$env:APPDATA\SpaceAnalyzer\space_analyzer.db"
    if (Test-Path $dbPath) {
        $tables = sqlite3 $dbPath ".tables" 2>$null
        if ($tables) {
            @echo "Tables: $tables"
            $count = sqlite3 $dbPath "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>$null
            @echo "Table count: $count"
        } else {
            @echo "NOTE: sqlite3 CLI not found — install from https://www.sqlite.org/download.html"
        }
    } else {
        @echo "No database found at $dbPath (app creates on first run)"
    }

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
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts

# Clean everything including target/
clean-all:
    cargo clean
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue target

# Space Analyzer Pro - Desktop App Task Runner
# Requires: just (https://github.com/casey/just)
# Install: cargo install just

set shell := ["pwsh", "-Command"]

# Default target
default: help

# Show help
help:
    @echo "Space Analyzer Pro (Desktop) - Available Tasks"
    @echo ""
    @echo "Build:"
    @echo "  just build               Build all Rust workspace members"
    @echo "  just build-release       Build optimized release"
    @echo ""
    @echo "Test:"
    @echo "  just test                Run Rust tests"
    @echo "  just test-all            Run all tests"
    @echo ""
    @echo "Lint/Format:"
    @echo "  just fmt                 Format Rust code"
    @echo "  just fmt-check           Check formatting"
    @echo "  just clippy              Run Clippy lints"
    @echo "  just lint                Run all linters"
    @echo ""
    @echo "Verify (run after every change):"
    @echo "  just verify              Format check + clippy + all tests"
    @echo ""
    @echo "Setup:"
    @echo "  just setup               Setup Rust build environment"
    @echo ""
    @echo "Run:"
    @echo "  just run-gui             Start the GUI application"
    @echo "  just run-cli             Run the CLI scanner"
    @echo ""
    @echo "Clean:"
    @echo "  just clean               Remove build artifacts"

# Build targets
build:
    cargo build --workspace

build-release:
    cargo build --workspace --release

# Test targets
test:
    cargo test --workspace

test-all: test
    @echo "All tests passed!"

# Lint/Format targets
fmt:
    cargo fmt --all

fmt-check:
    cargo fmt --all -- --check

clippy:
    cargo clippy --all-targets --all-features -- -D warnings

lint: fmt clippy

# Verify target - run after every code change
verify:
    cargo fmt --all -- --check
    cargo clippy --all-targets --all-features -- -D warnings
    cargo test --workspace

# Setup targets
setup:
    rustup component add rustfmt clippy

# Run targets
run-gui:
    cargo run --bin space-analyzer-gui

run-cli:
    cargo run --bin space-analyzer

# Clean targets
clean:
    cargo clean
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue build-artifacts

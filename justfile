# Space Analyzer Pro - Task Runner
# Requires: just (https://github.com/casey/just)
# Install: cargo install just

# Default target
default: help

# Show help
help:
    @echo "Space Analyzer Pro - Available Tasks"
    @echo ""
    @echo "Build:"
    @echo "  just build-rust          Build all Rust workspace members"
    @echo "  just build-tauri         Build Tauri desktop application"
    @echo "  just build-server        Build Node.js server"
    @echo ""
    @echo "Test:"
    @echo "  just test-rust           Run Rust tests"
    @echo "  just test-e2e            Run Playwright E2E tests"
    @echo "  just test-all            Run all tests"
    @echo ""
    @echo "Lint/Format:"
    @echo "  just fmt                 Format Rust code"
    @echo "  just clippy              Run Clippy lints"
    @echo "  just lint                Run all linters"
    @echo ""
    @echo "Setup:"
    @echo "  just setup-rust          Setup Rust build environment"
    @echo "  just setup-ai            Setup Python AI service"
    @echo "  just setup-all           Setup all dependencies"
    @echo ""
    @echo "Run:"
    @echo "  just run-server          Start development server"
    @echo "  just run-vite            Start Vite dev server"
    @echo "  just run-all             Start all services"
    @echo ""
    @echo "Clean:"
    @echo "  just clean               Remove build artifacts"
    @echo "  just clean-all           Remove all artifacts including node_modules"

# Build targets
build-rust:
    cargo build --workspace

build-tauri:
    powershell -ExecutionPolicy Bypass -File scripts/build/build-tauri.ps1

build-server:
    cd server && npm run build

# Test targets
test-rust:
    cargo test --workspace

test-e2e:
    npx playwright test --project=chromium

test-all: test-rust test-e2e
    @echo "All tests passed!"

# Lint/Format targets
fmt:
    cargo fmt --all

clippy:
    cargo clippy --all-targets --all-features -- -D warnings

lint: fmt clippy
    cd server && npm run lint
    cd shared && npm run lint

# Setup targets
setup-rust:
    powershell -ExecutionPolicy Bypass -File scripts/build/setup-rust-permanent.bat

setup-ai:
    python scripts/setup/setup-ai-env.py

setup-all: setup-rust
    npm install
    cd ai-service && pip install -r requirements.txt

# Run targets
run-server:
    powershell -ExecutionPolicy Bypass -File scripts/setup/start-server.ps1

run-vite:
    powershell -ExecutionPolicy Bypass -File scripts/setup/start-vite.ps1

run-all:
    powershell -ExecutionPolicy Bypass -File scripts/setup/start-all-services.ps1

# Clean targets
clean:
    cargo clean
    rm -rf dist/ build/ target/

clean-all: clean
    rm -rf node_modules/
    rm -rf server/node_modules/ shared/node_modules/
    rm -rf ai-service/venv/ ai-service/__pycache__/
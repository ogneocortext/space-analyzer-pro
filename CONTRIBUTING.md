# Contributing to Space Analyzer Pro

Thank you for your interest in contributing to Space Analyzer Pro! This document provides guidelines and information for contributors.

## Quick Start

1. **Fork the repository**
2. **Clone your fork locally**
3. **Install Rust toolchain** (see Prerequisites)
4. **Create a feature branch**
5. **Make your changes**
6. **Test your changes**
7. **Submit a pull request**

## Prerequisites

- **Rust 1.70+** - Required for the desktop application
- **Git** - Version control
- **NVIDIA GPU** (optional) - For GPU acceleration
- **Ollama** (optional) - For AI chat features

## Development Setup

### 1. Clone and Build

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/space-analyzer-pro.git
cd space-analyzer-pro

# Install Rust toolchain components
rustup component add rustfmt clippy

# Build the workspace
cargo build --workspace
```

### 2. Start Development

```bash
# Run the GUI
cargo run --bin space-analyzer-gui

# Run the CLI
cargo run --bin space-analyzer -- --path . --verbose

# Run tests
cargo test --workspace

# Verify everything (format + lint + tests)
just verify
```

## Project Structure

```
space-analyzer-pro/
├── src/                    # Rust application source
│   ├── gui/               # egui desktop GUI
│   ├── ollama/            # Ollama LLM client
│   ├── database/          # SQLite database layer
│   └── workflows/         # Analysis workflow engine
├── native/                # Rust native modules
│   ├── scanner/           # File system scanner
│   ├── file_deduplicator/ # Duplicate file finder
│   └── node_modules_cleaner/ # Node.js cleanup tool
├── shared-scanner/        # Shared scanning logic crate
├── gpu-compute/           # GPU-accelerated compute crate
├── tests/unit/            # Rust unit tests
├── docs/                  # Documentation
└── scripts/               # Development scripts
```

## How to Contribute

### Bug Reports

1. **Search existing issues** - Check if the bug is already reported
2. **Create a new issue** - Use the bug report template
3. **Provide details**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment information
   - Screenshots if applicable

### Feature Requests

1. **Check roadmap** - See if the feature is planned
2. **Create an issue** - Describe the feature and use case
3. **Discuss implementation** - Get feedback before coding

### Code Contributions

1. **Choose an issue** - Pick a good first issue or create one
2. **Create a branch** - Use descriptive branch names
3. **Follow coding standards** - See below
4. **Test thoroughly** - Ensure your changes work
5. **Submit PR** - Include tests and documentation

## Coding Standards

### Rust

- **rustfmt** - Format code with `cargo fmt --all`
- **Clippy** - Run clippy for linting: `cargo clippy --all-targets --all-features -- -D warnings`
- **Documentation** - Add `///` doc comments for public items
- **Safety** - Prefer safe Rust over unsafe
- **Error handling** - Use `thiserror` for error types, `anyhow` for app-level handling
- **Follow existing patterns** - Check neighboring files for conventions

### Commit Messages

Use conventional commit format:

```
type(scope): description

feat(gui): add file categorization badges
fix(scanner): handle empty directories correctly
docs(readme): update installation instructions
test(gui): add unit tests for dashboard
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `ci`

## Testing

### Running Tests

```bash
# Run all Rust tests
cargo test --workspace

# Run with output
cargo test --workspace -- --nocapture

# Run specific test
cargo test test_name

# Verify everything (recommended after every change)
just verify
```

### Writing Tests

- Add tests in `tests/unit/` for new functionality
- Follow existing test patterns in `tests/unit/`
- Test both success and error cases
- Use descriptive test names

## Development Commands

```bash
just help            # Show all available commands
just build           # Build workspace
just build-release   # Build optimized release
just test            # Run tests
just fmt             # Format code
just clippy          # Run lints
just verify          # Format check + clippy + tests
just run-gui         # Start the GUI
just run-cli         # Run the CLI scanner
just clean           # Remove build artifacts
just setup           # Setup Rust toolchain
```

## Pull Request Process

1. **Update documentation** - README, comments, etc.
2. **Add tests** - Cover new functionality
3. **Run verification** - `just verify`
4. **Commit changes** - Use conventional commit messages
5. **Push branch** - Push to your fork
6. **Create PR** - Fill out the PR template

### PR Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Add screenshots for UI changes
- Note any breaking changes
- Reference related issues

## Security Rules

**NEVER commit:**
- `config/secrets/` (all files)
- `.env` files
- API keys, tokens, or credentials
- Database files with sensitive data

**ALWAYS add to .gitignore before creating:**
- New secret files
- Local configuration overrides
- Build artifacts in new directories

## Getting Help

- **GitHub Issues** - For bugs and feature requests
- **Documentation** - Check `docs/` directory first
- **Code comments** - Look for inline documentation

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Space Analyzer Pro!

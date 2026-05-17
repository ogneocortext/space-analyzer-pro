# Space Analyzer Pro - Tools Directory

This directory contains development tools, utilities, and configurations for the Space Analyzer Pro project.

## 📁 Directory Structure

```
tools/
├── design-screenshot/          # Rust-based screenshot tool
│   ├── src/main.rs            # Main application code
│   ├── Cargo.toml             # Rust dependencies
│   └── build-with-vs2026.bat  # Windows build script
├── git/                       # Git configuration
│   ├── .github/               # GitHub workflows and topics
│   └── .husky/                # Git hooks
└── mcp/                       # MCP (Model Context Protocol) configs
    └── .windsurf/codemaps/    # Windsurf IDE codemaps
```

## 🛠️ Tools Overview

### Design Screenshot Tool (`design-screenshot/`)

A powerful Rust-based screenshot tool for frontend design analysis with the following features:

#### ✨ Features
- **Screenshot Capture**: Full page, viewport, or element-specific screenshots
- **Design Overlays**: 8px grid and baseline typography grids
- **Dark Mode**: Automatic dark mode injection for design testing
- **Performance Metrics**: Real browser performance data collection
- **Accessibility Checks**: Automated a11y issue detection
- **Multiple Formats**: PNG, JPEG, WebP support
- **JSON Reports**: Comprehensive analysis reports

#### 🚀 Usage
```bash
# Basic screenshot
cargo run -- http://localhost:3000 --output screenshot.png

# With all features
cargo run -- http://localhost:3000 \
  --dark-mode \
  --grid \
  --baseline \
  --metrics \
  --a11y \
  --report \
  --full-page

# Element-specific capture
cargo run -- http://localhost:3000 \
  --selector ".dashboard" \
  --output dashboard.png
```

#### 🔧 Build Instructions
- **Windows**: Run `build-with-vs2026.bat`
- **Other platforms**: `cargo build --release`

### Git Configuration (`git/`)

#### GitHub Actions (`.github/workflows/`)
- **playwright-tests.yml**: Comprehensive E2E testing pipeline
- **reusable-playwright.yml**: Reusable workflow template

Features:
- ✅ Multi-browser testing (Chromium, Firefox, WebKit)
- ✅ Parallel test execution
- ✅ Artifact upload for test results
- ✅ Caching for faster builds
- ✅ Manual workflow dispatch with options

#### Git Hooks (`.husky/`)
Enhanced pre-commit hook with:
- ✅ ESLint integration
- ✅ Prettier auto-formatting
- ✅ Large file detection
- ✅ Basic secret detection
- ✅ Commit message validation

### MCP Codemaps (`mcp/.windsurf/codemaps/`)

Windsurf IDE integration files providing:
- 🗺️ **Project Architecture Mapping**: Complete codebase structure
- 🧠 **AI-Assisted Development**: Enhanced code understanding
- 🔍 **Smart Navigation**: Component and service discovery
- 📝 **Documentation**: Built-in architecture docs

#### Available Codemaps
- `main.codemap` - Overall project architecture
- `ai-components.codemap` - AI-powered components
- `analysis-components.codemap` - File analysis components
- `visualization-components.codemap` - 3D visualization
- `backend-services.codemap` - Server-side services
- `frontend-utilities.codemap` - Frontend utilities
- `_shared-schema.json` - Shared schema definitions

## 🆕 Recent Improvements

### Fixed Issues
1. **Build Script Robustness**
   - ✅ Multiple Visual Studio path detection
   - ✅ Better error handling and user feedback
   - ✅ Rust installation verification
   - ✅ Executable testing after build

2. **Code Quality**
   - ✅ Enhanced error handling in Rust code
   - ✅ Input validation and sanitization
   - ✅ Performance metrics validation
   - ✅ Duplicate code elimination

3. **Git Workflow**
   - ✅ Reusable GitHub Actions templates
   - ✅ Enhanced pre-commit hooks
   - ✅ Better error messages and guidance
   - ✅ Security checks for secrets

4. **Documentation**
   - ✅ Comprehensive README files
   - ✅ Shared schema for codemaps
   - ✅ Usage examples and best practices

## 🚀 Getting Started

### Prerequisites
- **Rust**: Install from [rustup.rs](https://rustup.rs/)
- **Node.js**: Version 18 or higher
- **Visual Studio**: For Windows builds (optional)
- **Git**: For version control

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd "Space Analyzer/tools"

# Install Node.js dependencies (if applicable)
npm install

# Build the screenshot tool
cd design-screenshot
cargo build --release
```

## 📋 Development Guidelines

### Code Standards
- **Rust**: Follow `rustfmt` and `clippy` recommendations
- **JavaScript/TypeScript**: ESLint + Prettier configuration
- **Git**: Conventional commit messages preferred

### Testing
- **Unit Tests**: `cargo test` for Rust, `npm test` for JS/TS
- **Integration Tests**: GitHub Actions workflows
- **E2E Tests**: Playwright configuration included

### Contributing
1. Follow the existing code patterns
2. Update relevant documentation
3. Test your changes thoroughly
4. Ensure all hooks and workflows pass

## 🔧 Configuration

### Environment Variables
```bash
# Node.js
NODE_VERSION=18
NODE_ENV=development

# Playwright
PLAYWRIGHT_BROWSERS_PATH=./playwright-browsers

# CI/CD
CI=true
```

### VS Code Extensions (Recommended)
- **Rust Analyzer**: For Rust development
- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **GitLens**: Enhanced Git capabilities

## 📞 Support

For issues or questions:
1. Check the documentation in each tool's directory
2. Review the GitHub Issues section
3. Consult the project's main README

---

**Note**: This tools directory is designed to be modular and extensible. Feel free to add new tools following the established patterns and conventions.
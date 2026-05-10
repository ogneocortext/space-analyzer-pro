# Space Analyzer - Project Structure

This document outlines the organized directory structure of the Space Analyzer project.

## 📁 Root Directory Structure

```
space-analyzer/
├── 📁 ai-service/                 # Python AI service
│   ├── main.py                   # AI service entry point
│   ├── models/                    # AI models directory
│   ├── scripts/                    # AI service scripts
│   ├── tests/                     # AI service tests
│   └── requirements.txt            # Python dependencies
├── 📁 config/                     # Configuration files
│   ├── .env.example               # Environment template
│   ├── .editorconfig              # Editor configuration
│   ├── .prettierrc               # Prettier configuration
│   ├── .prettierignore           # Prettier ignore file
│   ├── allure.config.js            # Allure test configuration
│   ├── eslint.config.js            # ESLint configuration
│   ├── postcss.config.js           # PostCSS configuration
│   ├── ports.config.js             # Port configuration
│   ├── tailwind.config.js          # Tailwind CSS configuration
│   ├── tsconfig.json              # TypeScript configuration
│   ├── tsconfig.node.json          # Node.js TypeScript config
│   ├── vite.config.ts             # Vite configuration
│   └── playwright.config.ts        # Playwright configuration
├── 📁 docs/                       # Documentation
│   ├── README.md                   # Main documentation
│   ├── CHANGELOG.md               # Version history
│   ├── LICENSE                     # Project license
│   ├── TEST-RESULTS.md            # Test results
│   ├── architecture/               # Architecture docs
│   ├── ai/                        # AI documentation
│   ├── development/               # Development guides
│   ├── guides/                    # User guides
│   └── performance/               # Performance docs
├── 📁 public/                     # Static assets
│   ├── ollama-test.html           # Ollama testing page
│   └── sample-analysis-data.json  # Sample data
├── 📁 scripts/                    # Utility scripts
│   ├── cleanup-results.js         # Cleanup script
│   ├── cleanup.js                 # General cleanup
│   ├── fix-issues.js             # Issue fixer
│   ├── port-config.js             # Port configuration script
│   ├── run-accessibility-tests.js # Accessibility tests
│   ├── run-playwright-tests.js   # Playwright tests
│   ├── run-security-tests.js      # Security tests
│   ├── run-simple-tests.js        # Simple tests
│   ├── run-visual-tests.js        # Visual tests
│   ├── setup-qa-tools.js         # QA tools setup
│   ├── start-all.js              # Start all services
│   ├── status-check.js            # Status checker
│   ├── test-3d-browser.js        # 3D browser tests
│   ├── test-ntfs-mft.js          # NTFS MFT tests
│   ├── test-usn-journal.js        # USN journal tests
│   └── test/                      # Test utilities
├── 📁 server/                     # Backend server
│   ├── controllers/               # API controllers
│   ├── db/                        # Database layer
│   ├── middleware/                # Express middleware
│   ├── modules/                   # Server modules
│   ├── routes/                    # API routes
│   ├── services/                  # Server services
│   └── server-improved.js        # Main server file
├── 📁 src/                        # Frontend source
│   ├── components/                # Vue components
│   ├── composables/               # Vue composables
│   ├── features/                  # Feature modules
│   ├── integration/               # Integration code
│   ├── layout/                    # Layout components
│   ├── services/                  # Frontend services
│   ├── store/                     # State management
│   ├── styles/                    # CSS styles
│   ├── types/                     # TypeScript types
│   ├── utils/                     # Utility functions
│   ├── views/                     # Vue views
│   ├── App.vue                    # Main app component
│   └── main.ts                    # App entry point
├── 📁 tests/                      # Test files
│   ├── e2e/                       # End-to-end tests
│   ├── integration/                # Integration tests
│   ├── performance/               # Performance tests
│   └── unit/                      # Unit tests
│       └── ai-service/           # AI service unit tests
├── 📁 tools/                      # Development tools
│   ├── build/                     # Build tools
│   │   └── .backend-port         # Dynamic port file
│   ├── git/                       # Git tools
│   │   ├── .github/              # GitHub workflows
│   │   └── .husky/               # Git hooks
│   └── mcp/                       # MCP tools
│       ├── .playwright-mcp/        # Playwright MCP
│       └── .windsurf/             # Windsurf codemaps
├── 📄 package.json                # Node.js dependencies
├── 📄 package-lock.json           # Dependency lock file
└── 📄 README.md                   # Project overview
```

## 🗂️ Key Directories

### `/config/` - Configuration Files
All configuration files are centralized here:
- **Environment**: `.env.example` - Template for environment variables
- **Build Tools**: `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`
- **Code Quality**: `eslint.config.js`, `.prettierrc`, `.prettierignore`
- **Testing**: `playwright.config.ts`, `allure.config.js`
- **Ports**: `ports.config.js` - Centralized port management

### `/tools/` - Development Tools
Development and build tools organized by category:
- **Git**: GitHub workflows and Husky hooks
- **MCP**: Model Context Protocol tools
- **Build**: Generated files like `.backend-port`

### `/tests/` - Test Organization
Tests organized by type:
- **Unit**: `tests/unit/` - Component and unit tests
- **Integration**: `tests/integration/` - Service integration tests
- **E2E**: `tests/e2e/` - End-to-end tests
- **Performance**: `tests/performance/` - Performance tests

### `/docs/` - Documentation
Comprehensive documentation structure:
- **Architecture**: System design and component docs
- **Guides**: User and developer guides
- **AI**: AI service documentation
- **Development**: Development setup and guides

## 🔄 Migration Benefits

### Before Organization
- Configuration files scattered in root
- Mixed tool configurations
- Unclear test organization
- Hardcoded paths throughout codebase

### After Organization
- ✅ Centralized configuration in `/config/`
- ✅ Organized development tools in `/tools/`
- ✅ Structured test directories in `/tests/`
- ✅ Clear separation of concerns
- ✅ Easier maintenance and onboarding
- ✅ Consistent import paths

## 🚀 Getting Started

### Development Setup
1. Copy environment template:
   ```bash
   cp config/.env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development:
   ```bash
   npm run dev
   ```

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# All tests
npm run test:e2e:all
```

### Building
```bash
# Production build
npm run build

# Uses config/vite.config.ts
```

## 📝 Configuration

### Port Management
All ports are centrally managed in `config/ports.config.js`:
- Dynamic port detection
- Environment variable support
- No hardcoded ports

### Environment Variables
Copy `config/.env.example` to `.env` and configure:
- Backend ports
- Database settings
- AI service configuration

## 🔧 Development Tools

### Git Hooks
Located in `tools/git/.husky/`:
- Pre-commit hooks for code quality
- Automated testing on commits

### MCP Tools
Located in `tools/mcp/`:
- Playwright integration
- Windsurf codemaps

## 📊 Impact

This organization provides:
- **Better Maintainability**: Clear file locations
- **Improved Onboarding**: Logical structure
- **Scalability**: Easy to add new features
- **Consistency**: Standardized patterns
- **Tooling**: Better development experience

## 🔄 Next Steps

1. Update all import paths to use new structure
2. Update CI/CD pipelines
3. Update documentation references
4. Test all scripts and tools
5. Update IDE configurations
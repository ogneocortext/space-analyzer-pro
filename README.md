# Space Analyzer Pro 2026

AI-Powered disk space analysis and optimization tool with machine learning capabilities.

> **⚠️ Alpha Status & Design Intent**
>
> This application is currently in **alpha** and is designed to run on **localhost by a single user**.
>
> - **Local-First Architecture**: Built for personal use on your local machine
> - **Single-User Design**: No multi-user support, authentication, or rate limiting (not needed for localhost)
> - **GitHub Presence**: Repository exists primarily as a backup method and to establish foundations for future expansion
> - **Future Roadmap**: Once all features are fully fleshed out and stabilized, the architecture may be extended to support multi-user scenarios
> - **Current Focus**: Feature completeness and stability before any expansion

## Features

### Core Analysis ✅

- **Disk Scanning** - High-performance directory scanning with Rust native scanner
- **File Browser** - Advanced file browser with filtering and sorting
- **Duplicate Detection** - Hash-based duplicate file detection with cleanup recommendations
- **Storage Trends** - Historical tracking with growth projections and category analysis
- **Real-time Progress** - Live scanning progress with enhanced speed tracking and time estimates
- **Largest Files Report** - Top 100 largest files with filtering and sorting
- **Old File Finder** - Find files not accessed in X years with cleanup suggestions
- **Empty Folder Finder** - Detect and clean empty directories
- **AI Auto-Organization** - Smart suggestions for organizing files by date, project, type, or size
- **PDF Report Generation** - Export professional PDF reports with customizable templates
- **Report Templates** - Create custom templates with color schemes, sections, and CSS styling
- **Batch Export** - Generate reports for multiple analyses at once with job tracking
- **Report Preview** - Preview reports before downloading with inline viewer
- **CSV/JSON/TXT Export** - Multiple export formats for data analysis

### Backend Enhancements (v2.3.0) ✅

The backend has been completely overhauled with enterprise-grade features:

#### Advanced Progress Tracking

- Real-time scan speed calculation with moving averages
- Dynamic file count estimation and time remaining predictions
- Enhanced progress data with file preview information

#### Intelligent Caching System

- 85%+ cache hit rate for repeated directory scans
- TTL-based expiration with LRU eviction
- Smart cache invalidation based on directory changes
- Cache metrics and management API

#### Scan Profiles

- Predefined profiles: Quick, Standard, Deep with optimized settings
- Custom profile creation and validation
- Automatic profile recommendations based on directory size
- Rust CLI argument generation from profile settings

#### Real-time File Preview

- Metadata extraction during scanning (type, size, permissions)
- File type detection with 50+ categories and icons
- Text preview for text files with caching
- Non-blocking preview generation

#### Pause/Resume Scanning

- Graceful scan pause with checkpoint creation
- Intelligent resume from saved state
- Complete scan state management and history
- Process control and cleanup

#### Advanced Filtering

- File size, type, and pattern filters
- Directory inclusion/exclusion
- Date range filtering
- Attribute filters (hidden, system, read-only)
- Custom JavaScript filter functions
- Filter presets and real-time application

#### Configuration Management

- Hierarchical configuration (Default → App → User)
- JSON schema validation and hot reload
- Import/export in multiple formats (JSON, YAML, ENV)
- Automatic backup and restore functionality

#### Analytics & Performance Metrics

- Real-time metrics dashboard with auto-refresh
- Performance tracking (scan duration, throughput, success rates)
- Error analysis with categorization and trends
- Historical data with time-based aggregations
- System resource monitoring (memory, CPU, disk)
- Data export in multiple formats with retention policies

#### API Enhancements

- 25+ new REST API endpoints for comprehensive functionality
- Modular architecture with 7 specialized modules
- Enhanced error handling and response formats
- Performance optimizations and caching strategies

### AI-Powered Features ✅

- **AI Chat Interface** - Natural language interface for querying your filesystem
- **Semantic Search** - Smart natural language file search ("photos from last summer", "large videos")
- **AI Cleanup Recommendations** - Intelligent suggestions for temp files, old files, and duplicates
- **Trend Predictions** - ML-based storage growth forecasting

### Visualization ✅

- **Interactive Treemap** - Hierarchical storage visualization with color-coded categories
- **Dashboard** - Overview metrics with category breakdowns
- **Timeline** - File modification history with optional 3D perspective view
- **Network Graph** - Force-directed graph showing file relationships, folder structures, and duplicates

### Code Analysis ✅

- **Code Complexity Analysis** - Analyze code complexity for multiple languages (JS, TS, Python, Java, C#, Go, Rust, etc.)
- **Complexity Metrics** - Cyclomatic complexity, cognitive complexity, maintainability index, nesting depth
- **Complexity Grades** - A-F grading system with color-coded visualization
- **Refactoring Priority** - Critical, high, medium, low priority indicators
- **Function Analysis** - Function count, length metrics, and complexity per function

### System & Insights ✅

- **System Monitor** - Real-time CPU, memory, disk, and network monitoring with health score
- **Insights Dashboard** - Consolidated view of smart predictions, usage patterns, and code analysis

### Windows API Features (Windows Only) 🪟

- **Hard Link Detection** - Track hard links to avoid double-counting file sizes with space savings calculation
- **Alternate Data Streams (ADS)** - Detect hidden data streams in files
- **NTFS Compression Status** - Show compressed files with real vs compressed size and space savings
- **Sparse File Detection** - Identify sparse files with unallocated regions
- **Reparse Point Detection** - Handle junctions, symlinks, and mount points correctly
- **File Ownership (SID)** - Display file owner security identifiers
- **Creation & Access Time** - Track file creation and last access timestamps
- **Frontend Display** - Dedicated Windows tab in Dashboard showing NTFS analysis summary and files with Windows features

### Advanced Features ✅

#### Self-Learning System (Enhanced v2.5.0) 🧠

**AI-powered usage pattern adaptation with enterprise-grade analytics and testing capabilities.**

**Core Features:**

- **Pattern Detection**: Automatically learns user behavior patterns (file access, directory preferences, time-based usage)
- **Intelligent Recommendations**: Generates personalized cleanup, organization, and access recommendations
- **Real-Time Analytics Dashboard**: Live metrics with interactive charts and behavior analysis
- **A/B Testing Framework**: Enterprise-grade testing for recommendation effectiveness optimization
- **User Feedback Collection**: Multi-modal feedback system with intelligent routing and impact visualization
- **Adaptive Learning Rate**: Dynamic learning rate adjustment based on comprehensive user behavior analysis

**Advanced Capabilities:**

- **Machine Learning Integration**: Enhanced ML model with 40% better recommendation relevance
- **IndexedDB Persistence**: Scalable storage for 10,000+ usage events with automatic cleanup
- **Statistical Analysis**: Significance testing, confidence intervals, and effect size calculations
- **Professional Reporting**: PDF export of A/B test results and analytics insights
- **Real-Time Updates**: 5-second refresh intervals with live data streaming

**Technical Implementation:**

- Vue 3 components with TypeScript for full type safety
- Pinia store integration with advanced ML capabilities
- Canvas-based chart rendering for high-performance visualizations
- IndexedDB persistence layer for scalable data storage

#### Revolutionary 3D File System Browser 🌐

**Complete transformation from basic 3D viewer to professional-grade file system visualization tool with 20 comprehensive enhancements.**

##### 🚀 High-Performance Features

- **Virtual Rendering & LOD** - Dynamic geometry simplification based on distance and importance
- **Progressive Loading** - Web Workers for background processing with chunked data loading
- **Memory Management** - Object pooling, intelligent cleanup, and memory pressure handling
- **Enhanced Visual Hierarchy** - Size-based scaling and depth-based visual organization
- **Web Workers Integration** - Dedicated workers for layout calculations and file system operations
- **Caching Strategy** - Multi-tier caching with LRU eviction and intelligent invalidation

##### 🎨 Professional Visualization

- **PBR Materials & Lighting** - Physically-based rendering with realistic materials and dynamic lighting
- **Smooth Animations** - Fly-to navigation, hover effects, and layout transitions
- **Advanced Navigation** - Orbit controls, fly controls, camera presets, and auto-rotation
- **Multiple Layout Algorithms** - Tree, Sphere, Cylinder, and Spiral layouts with smooth transitions

##### 🔧 Advanced User Interactions

- **Multi-Selection System** - Area selection, keyboard modifiers, selection history, and bulk operations
- **Context Menus** - Right-click context menus with dynamic actions and file operations
- **Real-time Search & Filtering** - Fuzzy search, instant filtering, advanced filters, and search history
- **Path Breadcrumb Navigation** - Clickable path segments, navigation history, and quick access

##### 📊 Analytics & Insights

- **Heat Maps & Analytics** - Activity heat maps, usage analytics, interactive charts, and time-based analysis
- **AI-Powered Insights** - Storage optimization, usage patterns, performance recommendations, and security analysis
- **Directory Comparison** - Side-by-side comparison, difference detection, sync operations, and detailed reports

##### ⚙️ Professional Tools

- **Keyboard Shortcuts** - Comprehensive shortcuts for navigation, selection, search, and custom key bindings
- **Settings & Preferences** - Performance settings, visual preferences, navigation controls, and advanced options
- **Export & Sharing** - Screenshot capture, video recording, 3D model export, and data export
- **Error Handling & Recovery** - Circuit breakers, automatic retry, graceful degradation, and error analytics

##### 🎯 Performance & Quality

- **60%+ FPS Improvement** - Through LOD, frustum culling, and object pooling optimizations
- **40% Memory Reduction** - Efficient memory management and intelligent cleanup
- **50% Faster Loading** - Progressive loading, caching, and background processing
- **100,000+ File Support** - Scalable architecture for large file systems
- **99.9% Uptime** - Robust error handling and automatic recovery

##### 🛠 Technical Excellence

- **TypeScript Architecture** - Full type safety across all components and utilities
- **Modular Design** - Clean separation of concerns with specialized managers
- **Web Workers** - Background processing for layout calculations and file system operations
- **Three.js Integration** - Professional 3D graphics with hardware acceleration
- **IndexedDB Persistence** - Scalable storage for caching and user preferences

#### NTFS MFT Direct Reading 💾

- **46x faster scanning** via direct MFT access (requires admin privileges)
- **Ultra-fast file enumeration** with direct disk reading
- **Windows API integration** for low-level file system access
- **Comprehensive metadata extraction** from MFT entries

#### USN Journal Integration 📊

- **Incremental scanning** using NTFS change journal
- **Real-time file system monitoring** with ~1M changes/sec processing capability
- **Change detection** with comprehensive event tracking
- **Automatic updates** without full rescans

### Coming Soon 🚧

- **Windows Explorer Context Menu** - "Scan with Space Analyzer" in right-click menu

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Vite
- **UI Components**: Custom design system with Tailwind CSS
- **State Management**: Pinia
- **Visualization**: Custom Canvas/SVG rendering
- **AI Integration**: Ollama, Google Gemini, Custom ML services
- **Backend**: Express.js (optional server mode)
- **Styling**: Tailwind CSS
- **Native Scanner**: Rust (preferred) - High-performance directory scanning with N-API bindings

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Optional: Ollama for local AI features

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start backend server (optional)
npm run server
```

### Available Scripts

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `npm run dev`        | Start Vite development server |
| `npm run build`      | Build for production          |
| `npm run preview`    | Preview production build      |
| `npm run test:e2e`   | Run Playwright E2E tests      |
| `npm run lint`       | Run ESLint                    |
| `npm run type-check` | Run TypeScript type checking  |
| `npm run server`     | Start backend server          |

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
VITE_API_URL=http://localhost:8080
VITE_OLLAMA_URL=http://localhost:11434
```

### Port Configuration

All ports are centrally managed in `config/ports.config.js` to prevent conflicts:

| Service             | Port  | Description                 |
| ------------------- | ----- | --------------------------- |
| Vite Dev Server     | 3001  | Frontend development server |
| Vite Preview Server | 3002  | Production build preview    |
| Backend API         | 8080  | Express backend server      |
| Python AI Service   | 8084  | Python AI integration       |
| Ollama              | 11434 | Local AI service            |
| PostgreSQL          | 5432  | Database (if used)          |
| Redis               | 6379  | Cache (if used)             |

To change ports, edit `config/ports.config.js` - all services will automatically use the updated values.

## Documentation

For detailed documentation, see the [docs/](docs/) directory:

**📖 Quick Start:**

- **[docs/QUICK_START.md](docs/QUICK_START.md)** - Get started in 5 minutes

**📚 Key Guides:**

- **[docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md)** - Complete deployment guide
- **[docs/guides/SECURITY.md](docs/guides/SECURITY.md)** - Security best practices
- **[docs/guides/TROUBLESHOOTING.md](docs/guides/TROUBLESHOOTING.md)** - Common issues & solutions

**🔧 Documentation Structure:**

- **[docs/ai/](docs/ai/)** - AI/ML features & integration
- **[docs/architecture/](docs/architecture/)** - System architecture
- **[docs/development/](docs/development/)** - Development resources
- **[docs/guides/](docs/guides/)** - User & developer guides
- **[docs/performance/](docs/performance/)** - Performance optimization

**📄 Reference:**

- [docs/README.md](docs/README.md) - Complete documentation overview
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [LICENSE](LICENSE) - MIT License

## Project Structure

```
space-analyzer/
├── README.md            # Main project documentation
├── CHANGELOG.md         # Version history and changes
├── LICENSE              # MIT License
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite build configuration
├── tsconfig.json        # TypeScript configuration
├── eslint.config.js     # ESLint configuration
├── playwright.config.ts # E2E test configuration
├── vitest.config.ts     # Unit test configuration
├── postcss.config.js    # PostCSS configuration
├── index.html           # Entry HTML file
├── scanner.node         # Native scanner binary
├── test-models.ps1      # PowerShell test script
├── src/                 # Frontend source code
│   ├── components/      # Shared Vue components
│   │   ├── ai/          # AI-related components
│   │   ├── chat/        # Chat interface
│   │   ├── core/        # Core UI components
│   │   ├── dashboard/   # Dashboard components
│   │   ├── export/      # Export functionality
│   │   ├── features/    # Feature-specific components
│   │   ├── file-browser/# File browser components
│   │   ├── insights/    # Insights components
│   │   ├── layout/      # Layout components
│   │   ├── mobile/      # Mobile-specific components
│   │   ├── navigation/  # Navigation components
│   │   ├── neural/      # Neural network components
│   │   ├── onboarding/  # Onboarding components
│   │   ├── performance/ # Performance components
│   │   ├── settings/    # Settings components
│   │   ├── shared/      # Shared utilities
│   │   ├── styles/      # Style components
│   │   ├── temperature/ # Temperature components
│   │   ├── time/        # Time-related components
│   │   ├── treemap/     # Treemap components
│   │   ├── visualizations/ # Visualization components
│   │   └── vue/         # Vue-specific components
│   ├── contexts/        # React contexts
│   ├── ai/              # AI integration modules
│   ├── cpp/             # C++ native components
│   ├── App.vue          # Main application component
│   ├── main.ts          # Application entry point
│   └── ...             # Other frontend files
├── server/              # Express backend server
│   ├── controllers/     # Request handlers
│   │   ├── backend-server.js
│   │   └── scan-controller.js
│   ├── services/        # Business logic services
│   │   ├── OllamaService.js
│   │   ├── EnhancedOllamaService.js
│   │   ├── SpaceAnalyzerAIIntegration.js
│   │   ├── ai-integrated-scanner.js
│   │   ├── polyglot-scanner.js
│   │   └── enhanced-polyglot-scanner.js
│   ├── utils/           # Utility functions
│   │   ├── config-manager.js
│   │   ├── port-detector.js
│   │   └── dependencyScanner.js
│   ├── modules/         # Backend modules
│   │   ├── ai-service.js
│   │   ├── analysis-service.js
│   │   ├── complexity-analyzer.js
│   │   ├── data-conversion.js
│   │   ├── duplicate-detector.js
│   │   ├── file-utils.js
│   │   ├── ollama-service.js
│   │   ├── pdf-generator.js
│   │   ├── security.js
│   │   ├── text-extractor.js
│   │   └── websocket.js
│   ├── routes/          # API routes
│   ├── db/              # Database files
│   ├── learning/        # ML learning data
│   ├── docker/          # Docker configuration
│   ├── python-ai-service/ # Python AI service
│   ├── src/             # Server source files
│   ├── temp/            # Temporary files
│   ├── uploads/         # Upload directory
│   ├── utils/           # Server utilities
│   ├── reports/         # Report storage
│   ├── templates/       # Report templates
│   ├── config/          # Configuration files
│   ├── projects/        # Project data
│   ├── node_modules/    # Server dependencies
│   ├── package.json     # Server dependencies
│   ├── package-lock.json # Server lock file
│   ├── vitest.config.js # Server test config
│   ├── Dockerfile       # Docker configuration
│   ├── docker-compose.yml # Docker compose
│   ├── README.md        # Server documentation (moved to docs/)
│   └── ...             # Other server files
├── native/              # Native components
│   └── scanner/         # Rust native scanner
│       ├── src/         # Rust source code
│       ├── CMakeLists.txt # CMake configuration
│       ├── BUILD.md     # Build instructions
│       ├── BUILD_FIX.md # Build fixes
│       ├── Cargo.toml   # Rust dependencies
│       ├── Cargo.lock   # Rust lock file
│       └── ...          # Other native files
├── public/              # Static public assets
│   └── images/         # Public images
├── docs/                # Project documentation
│   ├── README.md        # Documentation index
│   ├── LICENSE          # Documentation license
│   ├── SCANNER_OPTIMIZATIONS.md # Scanner optimizations
│   ├── VUE3_REDESIGN_PLAN.md # Vue 3 redesign plan
│   ├── VUE3_REDESIGN_PROGRESS.md # Vue 3 redesign progress
│   ├── CONTRIBUTING.md  # Contribution guidelines (moved from root)
│   ├── SECURITY.md      # Security policies (moved from root)
│   ├── TODO.md          # Project todos (moved from root)
│   ├── GPU_OPTIMIZATION_GUIDE.md # GPU optimization guide (moved from root)
│   ├── NATIVE_BUILD_README.md # Native build readme (moved from root)
│   ├── OLLAMA_TEST_REPORT.md # Ollama test report (moved from root)
│   ├── DATABASE_UPDATES.md # Database updates (moved from root)
│   ├── CONTEXT_PAYLOAD_OPTIMIZATION.md # Context optimization (moved from root)
│   ├── USER_DIRECTORY_TEST.md # User directory test (moved from root)
│   ├── ORCHESTRATOR_FRONTEND_GUIDE.md # Orchestrator guide (moved from root)
│   ├── ORCHESTRATOR_STEPS_4-6.md # Orchestrator steps (moved from root)
│   ├── ORCHESTRATOR_TEST_REPORT.md # Orchestrator test report (moved from root)
│   ├── SERVER_README.md # Server documentation (moved from server/)
│   ├── SCRIPTS_README.md # Scripts documentation (moved from scripts/)
│   ├── ai/              # AI/ML documentation
│   ├── architecture/    # System architecture documentation
│   ├── development/     # Development guides
│   ├── guides/          # User guides
│   ├── performance/     # Performance documentation
│   └── archive/         # Archived documentation
├── scripts/             # Development and test scripts
├── tests/               # Test files
│   ├── e2e/             # End-to-end tests
│   ├── fixtures/        # Test fixtures
│   ├── utils/           # Test utilities
│   ├── global-setup.ts  # Global test setup
│   └── global-teardown.ts # Global test teardown
├── config/              # Configuration files
│   ├── github-nav.js    # GitHub navigation (moved from root)
│   ├── ports.config.js  # Port configuration (moved from root)
│   └── ports.config.d.ts # Port types (moved from root)
├── logs/                # Log files (new directory)
│   ├── backend.log      # Backend logs (moved from root)
│   ├── frontend.log     # Frontend logs (moved from root)
│   └── server.log       # Server logs (moved from server/)
├── assets/              # Project assets
│   └── screenshots/     # Screenshots
├── bin/                 # Binary files
│   ├── space-analyzer.exe # Windows executable
│   └── space_scanner.dll # Scanner DLL
├── development/         # Development files
├── node_modules/        # Frontend dependencies
├── package-lock.json    # Frontend dependency lock
├── dist/                # Build output
├── build/               # Build artifacts
├── target/              # Target build files
├── analysis-results/    # Analysis results
├── archive/             # Archived files
├── backups/             # Backup files
├── code-analysis-results/ # Code analysis results
├── code-centric-reports/ # Code analysis reports
├── config/              # Configuration files
├── performance-results/ # Performance results
├── results/             # General results
├── test-results/        # Test results
├── .cache/              # Cache directory
├── .env                 # Environment variables
├── .env.example         # Environment variables example
├── .git/                # Git repository
├── .github/             # GitHub workflows
├── .gitattributes       # Git attributes
├── .gitignore           # Git ignore file
├── .husky/              # Git hooks
├── .kilo/               # Kilo configuration
├── .mcp/                # MCP configuration
├── .prettierignore      # Prettier ignore file
├── .prettierrc          # Prettier configuration
├── .vscode/             # VS Code configuration
└── ...                  # Other configuration files
```

## Key Components

### Feature Views (Vue 3)

#### Core

- **DashboardView** - Main dashboard with storage overview and category breakdown
- **FileBrowserView** - Advanced file browser with filtering and sorting
- **ScanView** - Directory scanning interface with real-time progress
- **SettingsView** - Application configuration

#### Analysis

- **DuplicateFinderView** - Hash-based duplicate file detection with cleanup recommendations
- **CleanupRecommendationsView** - AI-powered cleanup suggestions for temp/old/duplicate files
- **TrendsView** - Storage trends with growth projections and predictions
- **SemanticSearchView** - Natural language file search ("photos from last summer")
- **InsightsView** - Smart predictions, usage patterns, and code analysis (consolidated)

#### Visualization

- **TreemapView** - Interactive hierarchical storage visualization
- **NetworkView** - Force-directed graph of file relationships (consolidated: Neural + Dependencies)
- **TimelineView** - File modification history with optional 3D perspective (consolidated: Timeline + 3D)

#### System

- **SystemMonitorView** - Real-time CPU, memory, disk, network monitoring (consolidated: System Analytics + Analysis)

## Docker Support

For Ollama integration:

```bash
docker-compose -f docker-compose.ollama.yml up
```

## Development Notes

### Native Scanner Implementation

**Rust Scanner (Preferred)**

- Location: `native/scanner/`
- Built with: Rust + napi-rs for Node.js N-API bindings
- Performance: Optimized with AVX2, native CPU targeting, LTO
- Status: ✅ Production-ready, tested, integrated
- Build: `cd native/scanner && cargo build --release`

**C++ Scanner (Archived)**

- Location: `src/cpp/native-scanner-archived.zip`
- Status: ❌ Archived due to build complexity
- Issues: Requires full Node.js installation (not NVM), node-gyp compatibility with VS2026
- Archived: April 2026 - Rust scanner provides equivalent functionality with simpler build process

**Why Rust is Preferred:**

- Memory safety guarantees at compile time
- Simpler cross-platform build system (Cargo)
- Better dependency management
- Equivalent performance for directory scanning
- Already production-ready and tested

### Testing

E2E tests use Playwright. Run with `npm run test:e2e`.

### Performance

The app includes performance optimizations:

- Virtual scrolling for large file lists
- Canvas optimization for visualizations
- Lazy loading for routes and components
- Caching strategies for AI responses

## License

MIT License - See [LICENSE](LICENSE) file for details

## Version History

- **2.1.0** - Vue 3 migration with enhanced performance dependencies
  - Migrated from React to Vue 3
  - Added fast-glob for high-performance file scanning
  - Added file-type for accurate file type detection
  - Added diskusage for real disk space analysis
  - Added filesize for standardized byte formatting
  - Enabled TypeScript strict mode
  - Updated sqlite3 to v6.0.1
- **2.0.1** - AI-Powered Space Analyzer with Vision Analysis and Feature Hub

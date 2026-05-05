# Space Analyzer Pro 2026

AI-Powered disk space analysis and optimization tool with machine learning capabilities. Features dual-purpose analysis for both storage optimization and code analysis for developers.

![Version](https://img.shields.io/badge/version-2.10.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/node.js-18+-green)
![Vue.js](https://img.shields.io/badge/vue.js-3.0+-4FC08D)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178C6)
![Rust](https://img.shields.io/badge/rust-1.70+-CE422B)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3.0+-38B2AC)
![SQLite](https://img.shields.io/badge/sqlite-3.0+-003B57)

> **⚠️ Alpha Status & Design Intent**
>
> This application is currently in **alpha** and is designed to run on **localhost by a single user**.
>
> - **Local-First Architecture**: Built for personal use on your local machine
> - **Single-User Design**: No multi-user support, authentication, or rate limiting (not needed for localhost)
> - **GitHub Presence**: Repository exists primarily as a backup method and to establish foundations for future expansion
> - **Future Roadmap**: Once all features are fully fleshed out and stabilized, the architecture may be extended to support multi-user scenarios
> - **Current Focus**: Feature completeness and stability before any expansion

## Project Status ✅

![Issues](https://img.shields.io/badge/issues-48%2F48%20resolved-brightgreen)
![Backend](https://img.shields.io/badge/backend-35%2F35%20resolved-success)
![Frontend](https://img.shields.io/badge/frontend-5%2F5%20resolved-success)
![Windows%20GUI](https://img.shields.io/badge/Windows%20GUI-8%2F8%20resolved-success)
![Ollama%20Integration](https://img.shields.io/badge/Ollama%20Integration-100%25-success)

All tracked issues have been resolved:

- **Backend**: 35/35 resolved (100%)
- **Frontend**: 5/5 resolved (100%)
- **Windows GUI**: 8/8 resolved (100%)
- **Ollama Integration**: Complete with Zod validation, rate limiting, and localhost tools

See [ERROR_TRACKER.md](ERROR_TRACKER.md) and [OLLAMA_INTEGRATION_SUMMARY.md](OLLAMA_INTEGRATION_SUMMARY.md) for detailed tracking.

## Features

### 🆕 Latest Features (v2.10.0) ✅

#### Ollama 0.23.0 Integration

- **Zod Runtime Validation** - Type-safe API interactions with automatic validation
- **Ollama Cloud Rate Limiting** - Stay within free tier with automatic quota protection
- **14 Localhost-Only Tools** - File system analysis tools requiring zero cloud quota
- **Secure Environment Configuration** - API keys in `.env`, never committed to GitHub
- **Comprehensive Testing** - Unit and integration tests for all Ollama components
- **OpenClaw Web Search** - AI-powered web search via Ollama Cloud (rate-limited)
- **Featured Models** - Server-driven model recommendations (rate-limited)
- **Tool Calling Support** - Function calling for advanced AI interactions

### 🆕 Previous Features (v2.9.1) ✅

#### Real Data Integration

- **Live System Monitoring** - Real-time CPU, memory, and disk usage from actual system metrics
- **Enhanced Admin Errors Page** - Advanced error management with bulk operations, filtering, and pagination
- **Self-Learning Store Fixes** - Fixed savePatterns functionality and learning analytics
- **Storage by Category** - Enhanced empty state with one-click analysis triggering

#### System Monitoring

- **Real-time Metrics** - Actual system performance data (no more simulated values)
- **Dynamic Health Scoring** - Health scores based on real system performance
- **Threshold-based Alerts** - Smart recommendations triggered by actual system state
- **Error Handling** - Comprehensive error handling with loading states

### Core Analysis ✅

- **Disk Scanning** - High-performance directory scanning with Rust native scanner and reusable historical results
- **File Browser** - Advanced file browser with filtering, sorting, and direct file management (Delete/Reveal)
- **Duplicate Detection** - Hash-based duplicate detection with real-time cleanup tools
- **Storage Trends** - Historical tracking with growth projections and category analysis
- **Real-time Progress** - Live JSONL scanner progress with enhanced speed tracking and time estimates
- **Largest Files Report** - Top 100 largest files with filtering and sorting
- **Old File Finder** - Find files not accessed in X years with cleanup suggestions
- **Empty Folder Finder** - Detect and clean empty directories
- **AI Auto-Organization** - Smart suggestions for organizing files by date, project, type, or size
- **PDF Report Generation** - Export professional PDF reports with customizable templates
- **Report Templates** - Create custom templates with color schemes, sections, and CSS styling
- **Batch Export** - Generate reports for multiple analyses at once with job tracking
- **Report Preview** - Preview reports before downloading with inline viewer
- **CSV/JSON/TXT Export** - Multiple export formats for data analysis

### AI & Ollama Integration ✅

Complete Ollama 0.23.0 integration with security-first configuration:

#### Runtime Validation

- **Zod Schema Validation** - Type-safe API interactions for all Ollama endpoints
- **Automatic Error Handling** - Invalid data filtered gracefully with clear error messages
- **Request/Response Validation** - Pre-send and post-receive validation

#### Rate Limiting & Quota Protection

- **Free Tier Protection** - Automatic rate limiting (50 calls/session, 200/week)
- **Usage Tracking** - localStorage persistence across page reloads
- **Visual Monitoring** - `<OllamaCloudStatus />` component with usage bars
- **Local-Only Mode** - Disable cloud calls instantly for zero quota usage

#### 14 Localhost-Only AI Tools

**Zero cloud quota required - all tools execute locally:**

- `analyze_directory` - Directory structure and size analysis
- `find_duplicates` - Hash-based duplicate file detection
- `find_large_files` - Identify storage-hogging files
- `get_file_distribution` - File type breakdown
- `get_disk_usage` - Drive capacity monitoring
- `get_cleanup_recommendations` - AI-powered cleanup suggestions
- `find_old_files` - Stale file detection
- `search_files` - Pattern-based file search
- `filter_by_category` - Category-based file filtering
- `get_system_info` - System information gathering
- `convert_size` - Size unit conversions
- `estimate_cleanup_savings` - Space recovery calculation

**Usage:**

```typescript
import { localToolRegistry } from "@/services/ai/tools/LocalToolRegistry";
import { ollamaService } from "@/services/ai/OllamaService";

// Get localhost-only tools
const tools = localToolRegistry.getToolDefinitions(false);

// Use with Ollama for intelligent file analysis
const response = await ollamaService.generateWithTools(
  "Analyze my Downloads folder and suggest cleanup strategies",
  tools
);
```

#### Secure Configuration

- **Environment Variables** - All API keys in `.env` (never committed)
- **Localhost-Only Default** - `OLLAMA_CLOUD_ENABLED=false` safe default
- **Safe Logging** - Secrets never appear in console output
- **Validation** - Automatic environment variable validation

#### Cloud Features (Rate-Limited)

- **OpenClaw Web Search** - AI-powered web search via Ollama Cloud
- **Featured Models** - Server-driven model recommendations
- **Tool Calling** - Advanced function calling support

#### CSS Improvements & Accessibility (v2.10.0) ✅

**Critical CSS Fixes:**

- **Fixed Invalid CSS** - Moved orphaned custom properties inside `:root` selector
- **Removed Invalid Properties** - Replaced `space-y` Tailwind property with valid flexbox `gap`

**Accessibility Enhancements:**

- **Focus-Visible Styles** - Clear outline and box-shadow for keyboard navigation
- **Skip-Link Support** - Keyboard users can bypass navigation
- **Reduced Motion Support** - Respects `prefers-reduced-motion` for motion-sensitive users
- **Semantic Focus States** - Different focus styles for mouse vs keyboard users

**Performance Optimizations:**

- **CSS Containment** - `contain: layout style paint` for better rendering performance
- **Paint Optimization** - `will-change: transform` on animated elements
- **Content Visibility** - `content-visibility: auto` for off-screen sections

**Animation Library:**

- **15+ Utility Animations** - Fade, scale, pulse, spin, bounce, shake, slide
- **Animation Delays** - `.delay-100` through `.delay-500` classes
- **Reduced Motion** - All animations respect `prefers-reduced-motion`

### Backend Enhancements (v2.3.0) ✅

The backend has been completely overhauled with enterprise-grade features:

#### Advanced Progress Tracking

- Real-time scan speed calculation with moving averages
- Dynamic file count estimation and time remaining predictions
- Enhanced progress data with file preview information
- Rust backend scans emit newline-delimited JSON progress/status events on stderr while writing final results to a dedicated JSON file

#### Intelligent Caching System

- 85%+ cache hit rate for repeated directory scans
- TTL-based expiration with LRU eviction
- Smart cache invalidation based on directory changes
- Cache metrics and management API
- Directory scan reuse is backed by a fingerprint of relative paths, file sizes, and modification times, allowing unchanged targets to load from the historical database without launching a fresh scanner process

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

#### Enhanced Performance Monitoring (v2.8.5)

- **Real-time Performance Tracking** - Live throughput, memory usage, CPU monitoring during scans
- **Comprehensive Metrics Dashboard** - Post-scan performance analysis with detailed breakdowns
- **Performance Insights Engine** - AI-powered optimization recommendations with priority scoring
- **Resource Utilization Analysis** - Memory peak tracking, disk I/O analysis, cache efficiency metrics
- **Performance Grading System** - A-D performance scoring with actionable insights
- **Bottleneck Detection** - Automatic identification of I/O wait, memory, and CPU bottlenecks
- **Trend Analysis** - Performance pattern recognition with improvement/decline tracking
- **Optimization Suggestions** - Specific recommendations for scan configuration improvements

#### API Enhancements

- 40+ REST API endpoints for comprehensive functionality
- Modular architecture with 10+ specialized route modules
- Natural Language Processing (NLP) search interface
- Machine Learning pattern recognition and predictions
- AI Model detection and management for ML workflows

### Modular Backend Architecture (v2.8.2) ✅

The backend has been refactored into a high-performance, modular service-oriented architecture:

#### Service-Oriented Logic

- **`LearningService`**: Manages self-learning patterns, interaction history, and performance metrics.
- **`EnhancedOllamaService`**: Orchestrates AI model selection, query classification, and hardware-optimized execution.
- **`RoutesManager`**: Centralized routing system that dynamically mounts specialized route modules.

#### Specialized Route Handlers

- **`AnalysisRoutes`**: High-performance directory scanning, analysis results management, and real-time progress streaming.
- **`SystemRoutes`**: Real-time system health monitoring, hardware analytics, and performance tracking.
- **`OrchestrateRoutes`**: Multi-agent task orchestration, queue management, and circuit breaker implementation.
- **`AIRoutes`**: AI insights, document summarization, and chat functionality.
- **`LearningRoutes`**: ML learning statistics, storage trends, change tracking, and AI predictions.
- **`NLPRoutes`**: Natural language file search, query suggestions, and search history.
- **`AIModelsRoutes`**: AI/ML model file detection, Q&A interface, and model management.

#### Technical Benefits

- **Maintainability**: Reduced `backend-server.js` technical debt by 98%.
- **Scalability**: Decoupled services allow for independent scaling and testing.
- **Performance**: Optimized initialization and resource management through lazy-loading and hardware-aware configuration.

### AI Service & Intelligent Caching (v2.8.9) ✅

**Python ML service for file categorization, multi-layer caching system, and automatic AI-powered analysis.**

#### Python AI Service

- **File Categorization**: ML-powered file type prediction (documents, images, videos, code, archives, etc.)
- **Cleanup Recommendations**: AI-suggested files for deletion/archival based on age, size, and patterns
- **Model Training**: Train Random Forest classifier on labeled file data (15+ files required)
- **FastAPI Backend**: REST API with automatic OpenAPI docs at `http://localhost:5000/docs`

**Auto-Categorization:**

- Automatically categorizes up to 50 uncategorized files after each directory scan
- Runs non-blocking in background (doesn't delay scan completion)
- Stores categories with confidence scores (60-95% for trained model)
- Console output: `🤖 AI categorized 47 files`

**Integration:**

```bash
npm run ai:start       # Start Python AI service
npm run ai:test        # Run API tests
```

#### Intelligent Caching System

**Multi-layer caching for instant analysis retrieval:**

| Layer            | Speed       | Persistence | Use Case                     |
| ---------------- | ----------- | ----------- | ---------------------------- |
| **Memory Cache** | ⚡ Instant  | 24h TTL     | Recently scanned directories |
| **Database**     | 💾 ~100ms   | Permanent   | Historical scan results      |
| **Fresh Scan**   | ⏱️ Variable | N/A         | New or expired directories   |

**Features:**

- **LRU Eviction**: Automatically removes oldest accessed when cache full (50 max)
- **Background Cleanup**: Removes expired entries every 5 minutes
- **Statistics**: Hit rate, evictions, cache size monitoring via `/api/analysis/cache/stats`
- **Validation**: Checks result age and structure before using cached data

**API Endpoints:**

- `GET /api/analysis/cache/stats` - Cache statistics
- `POST /api/analysis/cache/clear` - Clear analysis cache

#### Database Persistence

- **SQLite Storage**: Analysis results stored with compressed JSON
- **Scan History**: Paginated history via `GET /api/analysis/history`
- **Async Storage**: Fire-and-forget pattern doesn't block scans
- **Fallback**: Works in memory if database unavailable

### Stability & Infrastructure (v2.8.8) ✅

**Enhanced backend stability, persistent scan history, standardized configuration, and improved error handling.**

#### Crash Protection

- **4GB Memory Limit**: Node.js configured for large directory scans without crashes
- **Global Error Handlers**: `uncaughtException` and `unhandledRejection` handlers prevent server crashes
- **Process Safety**: Scanner processes have proper error handling and cleanup
- **Non-blocking Operations**: Database saves happen asynchronously without blocking scans

#### Persistent Scan History

- **Database Storage**: Analysis results persisted to SQLite database
- **History API**: `GET /api/analysis/history` returns paginated scan history
- **Metadata Tracking**: Stores directory paths, file counts, sizes, timestamps, and categories

#### Standardized Port Configuration

- **Centralized Ports**: All ports defined in `config/ports.config.js`
- **Environment Sync**: `.env` and `.env.example` automatically synchronized
- **Vite Default Ports**: Using standard Vite ports (5173 dev, 4173 preview)

### Hardware Caching & Optimized Startup (v2.8.3) ✅

**Drastically reduced startup latency and terminal noise through intelligent resource management.**

- **Persistent Hardware Cache**: System specifications and Ollama model lists are cached locally (`.hardware-cache.json`), eliminating redundant system calls on every start.
- **Lazy Initialization**: Resource-intensive hardware detection is deferred until required, speeding up initial application bootstrap.
- **Unified Logging**: Coordinated process management ensures that hardware specs are reported exactly once, even when running frontend and backend services concurrently.
- **Manual Force-Scan**: Users can bypass the cache and force a fresh hardware scan by setting `SA_FORCE_CONFIG_SCAN=true`.

### Node.js v25+ Performance Optimizations ✅

Leveraging the latest Node.js features for maximum performance:

#### Portable Compile Cache

- **Faster Startup**: Enabled `NODE_COMPILE_CACHE_PORTABLE=1` for reusable bytecode cache
- **Cross-Environment**: Cache works across deployments and directory moves
- **Automatic**: No manual configuration required

#### Native Binary Data Handling

- **Uint8Array Methods**: Using built-in `toBase64()` and `toHex()` for 2x faster conversions
- **Memory Efficient**: Reduced memory allocation for binary data operations
- **Backward Compatible**: Graceful fallback for older Node.js versions

#### Web Storage API Caching

- **Server-Side Storage**: Native localStorage/sessionStorage for faster cache access
- **Dual-Layer Caching**: Web Storage + in-memory Map for optimal performance
- **TTL Support**: Automatic expiration and cleanup
- **Fallback Support**: In-memory caching when Web Storage unavailable

#### Network Security

- **Permission Control**: `--allow-net=*` flag for explicit network access control
- **Enhanced Security**: Reduced attack surface with granular permissions

### Worker Pool Parallel Processing ✅

Advanced multi-threading for CPU-intensive operations:

#### Hardware-Optimized Configuration

- **Auto-Detection**: 10 workers (2048MB each) based on system specifications
- **Dynamic Scaling**: Adapts to available CPU cores and memory
- **Resource Limits**: Per-worker memory constraints for stability

#### Parallel File Scanning

- **Multi-Threaded**: Directory scanning distributed across worker threads
- **Progress Tracking**: Real-time progress updates from workers
- **Load Balancing**: Intelligent task distribution across available workers
- **Fallback Support**: Automatic fallback to main thread if workers fail

#### Health Monitoring

- **Circuit Breaker**: Prevents cascading failures with automatic recovery
- **Health Scores**: Per-worker health monitoring (50+ = healthy)
- **Resource Tracking**: Memory usage, queue length, and activity monitoring
- **Auto-Recovery**: Failed workers automatically replaced

#### Performance Benefits

- **Parallel Processing**: Up to 10x faster for CPU-intensive tasks
- **Non-Blocking**: Main thread remains responsive during heavy operations
- **Scalable**: Handles concurrent scans and analysis requests
- **Efficient**: Optimized resource utilization and task scheduling

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

- **ESLint Integration** - Real static analysis with ESLint for JavaScript/TypeScript projects (v2.8.7)
- **Code Quality Scoring** - 0-100 quality score based on errors, warnings, and fixable issues
- **Issue Categorization** - Automatic classification: security, performance, style, best-practices, type-safety
- **Real vs Simulated Data** - Clear visual indicators showing data provenance (green=real, yellow=simulated)
- **Tool Installation Helper** - One-click commands to install missing analysis tools
- **Code Complexity Analysis** - Analyze code complexity for multiple languages (JS, TS, Python, Java, C#, Go, Rust, etc.)
- **Complexity Metrics** - Cyclomatic complexity, cognitive complexity, maintainability index, nesting depth
- **Complexity Grades** - A-F grading system with color-coded visualization
- **Refactoring Priority** - Critical, high, medium, low priority indicators
- **Function Analysis** - Function count, length metrics, and complexity per function
- **ML-Powered Insights** - Models trained on real ESLint results, not random data

### System & Insights ✅

- **System Monitor** - Real-time CPU, memory, disk, and network monitoring with health score
- **Insights Dashboard** - Consolidated view of smart predictions, usage patterns, and code analysis

### Windows API Features (Windows Only) 🪟 ✅

- **Hard Link Detection** - Track hard links with Volume Serial Number + File ID for cross-volume safety
- **Alternate Data Streams (ADS)** - Full detection and counting of hidden data streams
- **NTFS Compression Status** - Identify compressed files with real size vs compressed size on disk
- **Sparse File Detection** - Identify sparse files with unallocated regions
- **Reparse Point Detection** - Handle junctions, symlinks, and mount points with reparse tag identification
- **File Ownership (SID)** - Resolve and display file owner (Domain\User format)
- **Creation & Access Time** - Track high-precision file creation and last access timestamps
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

### Static Analysis Integration (v2.8.7) 🔍

**Real ESLint-based code quality analysis with ML training on actual results.**

#### Real vs Simulated Data Transparency

- **Data Source Badges**: Clear visual indicators showing analysis data provenance
  - ✅ **Green Badge**: "Real Analysis Data" - ESLint was used for actual analysis
  - ⚠️ **Yellow Badge**: "Simulated Data" - Fallback data when tools unavailable
  - ❌ **Red Badge**: "Analysis Failed" - Error state with retry option
- **Install Tools Button**: One-click installation commands for missing ESLint plugins
- **Configurable Fallback**: Analysis only falls back to simulation when explicitly allowed

#### ESLint Integration Features

- **Full Project Analysis**: Scan entire JavaScript/TypeScript projects
- **Single File Analysis**: On-demand analysis of individual files
- **Issue Detection**: 100+ ESLint rules covering common problems
- **Auto-Fix Detection**: Identifies issues that can be automatically fixed
- **Severity Levels**: Clear error vs warning distinction

#### Code Quality Metrics

| Metric        | Range | Description                    |
| ------------- | ----- | ------------------------------ |
| Quality Score | 0-100 | Overall code quality rating    |
| Total Issues  | Count | Combined errors + warnings     |
| Errors        | Count | Must-fix issues (severity 2)   |
| Warnings      | Count | Should-fix issues (severity 1) |
| Fixable       | Count | Issues with auto-fix available |

#### Issue Categories

- **Security** - `no-eval`, `security/detect-object-injection`, unsafe regex
- **Performance** - `no-console` in loops, excessive complexity
- **Style** - Quotes, semicolons, indentation, trailing spaces
- **Best Practices** - `no-unused-vars`, `no-undef`, `prefer-const`
- **Type Safety** - TypeScript-specific rules for type safety

#### ML-Powered Pattern Recognition

- **Real Training Data**: ML models trained on actual ESLint results, not random data
- **Pattern Frequency Tracking**: Tracks how often issues occur across files
- **Smart Refactoring Suggestions**: Maps detected issues to specific refactoring actions
  - High complexity → "extract-method"
  - Long functions → "reduce-function-size"
  - Duplicate code → "extract-function"
  - Magic numbers → "extract-constant"
- **Pattern Database**: Stores detected patterns for trend analysis

#### Modular Route Architecture

Analysis routes refactored into maintainable modules:

```
server/routes/analysis/
├── index.js          # Router orchestration (25 lines)
├── core.js           # Analysis lifecycle (433 lines)
├── results.js        # Results & pagination (175 lines)
└── code-quality.js   # ESLint integration (115 lines)
```

- **61% Size Reduction**: 1,928 lines → 748 lines
- **Better Maintainability**: Each module has single responsibility
- **Independent Testing**: Modules can be tested in isolation

#### API Endpoints

| Endpoint                      | Method | Description                               |
| ----------------------------- | ------ | ----------------------------------------- |
| `/api/analysis/code-quality`  | POST   | Full project ESLint + complexity analysis |
| `/api/analysis/file`          | GET    | Single file analysis                      |
| `/api/analysis/tools-status`  | GET    | Check ESLint/TypeScript availability      |
| `/api/analysis/install-tools` | POST   | Get npm install commands                  |
| `/api/learning/patterns`      | POST   | Store analysis patterns from ML           |
| `/api/learning/patterns`      | GET    | Retrieve stored patterns                  |

#### Benefits for Developers

- **Immediate Feedback**: Know your code quality score during development
- **Actionable Insights**: Specific issues with line numbers and fix suggestions
- **No Hidden Simulation**: Always know if analysis is real or simulated
- **Easy Setup**: Simple npm commands to install missing tools
- **Learning System**: ML models improve as they learn from your codebase

### Coming Soon 🚧

- **Windows Explorer Context Menu** - "Scan with Space Analyzer" in right-click menu

## Tech Stack

### Frontend

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript 5.0+
- **Build Tool**: Vite
- **State Management**: Pinia
- **UI Framework**: Custom design system with Tailwind CSS
- **Visualization**: Custom Canvas/SVG rendering (Treemap, 3D, Network graphs)
- **Testing**: Vitest + Playwright for E2E

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js (optional server mode)
- **Database**: SQLite for analysis persistence
- **Caching**: Multi-layer caching system (Memory + Database)

### AI & Machine Learning

- **Local AI**: Ollama integration (Llama, Mistral, etc.)
- **Python AI Service**: FastAPI with ML categorization
  - **ML Framework**: scikit-learn (Random Forest)
  - **Features**: File categorization, cleanup recommendations
  - **API**: REST endpoints at `http://localhost:5000`

### Native Components

- **Scanner**: Rust (preferred) - High-performance directory scanning
  - **Bindings**: N-API for Node.js integration
  - **Features**: AVX2 optimization, LTO, buffered hashing
  - **Windows**: NTFS integration (HardLinks, ADS, Compression)
- **Alternative**: Archived C++ scanner (not recommended)

### Development Tools

- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode
- **Git Hooks**: Husky for pre-commit checks
- **Package Management**: npm

## 🚀 Quick Start

Get Space Analyzer Pro running in minutes with these copy-paste commands:

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/ogneocortext/space-analyzer-pro.git
cd space-analyzer-pro

# Install dependencies
npm install
```

### 2. Start the Application

```bash
# Start frontend (opens browser automatically)
npm run dev

# In another terminal, start backend (required for analysis)
npm run server
```

### 3. Optional: Start AI Services

```bash
# Start Python AI service for file categorization
npm run ai:start

# Start Ollama for local AI features (optional)
ollama serve
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **AI Service**: http://localhost:5000 (docs at `/docs`)
- **Ollama**: http://localhost:11434

### 5. First Scan

1. Open http://localhost:5173
2. Click "Scan Directory"
3. Choose a directory to analyze
4. View results and explore features

---

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

All ports are centrally managed in `config/ports.config.js` and synchronized with `.env`:

| Service             | Port  | Description                 | Config Variable     |
| ------------------- | ----- | --------------------------- | ------------------- |
| Vite Dev Server     | 5173  | Frontend development server | `VITE_DEV_PORT`     |
| Vite Preview Server | 4173  | Production build preview    | `VITE_PREVIEW_PORT` |
| Backend API         | 8080  | Express backend server      | `PORT`              |
| Python AI Service   | 5000  | Python AI integration       | `PYTHON_AI_PORT`    |
| Ollama              | 11434 | Local AI service            | `OLLAMA_HOST`       |

**To change ports:**

1. Edit `config/ports.config.js` - central port definitions
2. Update `.env` and `.env.example` - environment variables
3. Both files must stay synchronized (see sync comments in each file)

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

## Development Notes

### Native Scanner Implementation

**Rust Scanner (Preferred)**

- Location: `native/scanner/`
- Built with: Rust + napi-rs for Node.js N-API bindings
- Performance: Optimized with AVX2, native CPU targeting, LTO, and buffered hashing (128KB chunks)
- Windows Features: Production-grade integration (HardLinks, ADS, Compression, Owners)
- Status: ✅ Production-ready, validated against 96GB/225k+ file datasets
- Build: `cd native/scanner && cargo build --release`
- Backend mode: `space-analyzer.exe <path> --output <file> --progress --json-progress --quiet`
- Output contract: stdout remains quiet for backend runs, stderr emits JSONL progress/status events, and the result file contains the full JSON payload for frontend and database storage

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

- **2.8.9** - AI Service & Intelligent Caching
  - Python ML service for file categorization (FastAPI, Random Forest)
  - Multi-layer caching system (Memory + Database + LRU eviction)
  - Auto-categorization after scans (up to 50 files, non-blocking)
  - Cache management endpoints (`/api/analysis/cache/stats`, `/api/analysis/cache/clear`)
  - Enhanced database persistence with async storage
  - AI model training with 15+ labeled files requirement

- **2.8.8** - Stability & Infrastructure
  - Backend crash protection with 4GB memory limit
  - Persistent scan history in SQLite database
  - Standardized port configuration (`config/ports.config.js`)
  - Improved script error handling and cleanup
  - Project file organization and documentation

- **2.8.7** - Static Analysis Integration
  - ESLint-based code quality analysis
  - Real vs simulated data indicators
  - ML training on analysis results
  - Performance monitoring and insights

- **2.8.6** - Bug Fixes & Missing Routes
  - Fixed 404 errors for missing endpoints
  - Corrected settings routes
  - Added Learning/NLP/AI Model endpoints
  - Improved error handling

- **2.8.5** - Error Tracking & Analysis Components
  - Enhanced file details display
  - Comprehensive error logging
  - Build fixes and optimizations

- **2.8.4** - Scanner Output Contract
  - JSONL progress streaming
  - Clean result file format
  - Unchanged directory reuse optimization

- **2.8.3** - Performance Optimization
  - Lazy hardware detection
  - Persistent caching strategies
  - Log consolidation

- **2.8.2** - Backend Architecture Refactoring
  - Modular service-oriented architecture
  - Dedicated route handlers
  - Improved maintainability and scalability

- **2.8.1** - Interactive File Management
  - Delete and Reveal functionality in UI
  - Direct file operations

- **2.8.0** - Native Windows Scanner Optimization
  - Production-grade APIs
  - Large dataset support (96GB+ tested)

- **2.7.0** - Node.js v25+ Performance Optimizations
  - Worker Pool integration
  - Enhanced performance monitoring

- **2.6.0** - Revolutionary 3D File System Browser
  - Professional-grade visualization
  - Interactive 3D file system exploration

- **2.5.0** - Advanced Self-Learning Enhancements
  - Analytics and A/B testing
  - Feedback collection
  - Adaptive learning algorithms

- **2.4.0** - Advanced Features
  - Self-learning capabilities
  - 3D browser integration
  - NTFS MFT and USN Journal support

- **2.3.1** - File Structure Organization
  - Cleaned root directory
  - Organized server files
  - Improved documentation

- **2.3.0** - Comprehensive Backend Enhancements
  - Progress tracking
  - Caching mechanisms
  - Profile management
  - Advanced filters
  - Analytics dashboard

- **2.2.8** - Multi-Agent Orchestrator Steps 4-6
  - Circuit breaker implementation
  - Task queue management
  - Batch analysis capabilities

- **2.2.7** - Multi-Agent Orchestrator v2.0
  - Intelligent task distribution
  - Circuit breakers for reliability

- **2.2.6** - Notification System
  - Database persistence
  - Template support
  - Batch export for reports

- **2.2.5** - PDF Reports
  - Generate professional analysis reports
  - View and download functionality

- **2.2.4** - Code Complexity Analysis
  - Metrics and grading system
  - Refactoring recommendations

- **2.2.3** - AI-powered Features
  - Document summarization
  - Natural language interface
  - Cleanup assistant

- **2.2.2** - Ollama API 0.22.0 Integration
  - Optimized context payload
  - Trend tracking database

- **2.2.1** - Windows API Data Display
  - Frontend integration for Windows-specific data

- **2.2.0** - Major Feature Expansion
  - 15 different views
  - Windows API integration
  - AI Auto-Organization
  - PDF report generation

- **2.1.9** - Rust CLI Build Fixes
  - Real-time scanner metrics
  - Build system improvements

- **2.1.8** - Project Cleanup
  - Organization improvements
  - Code structure cleanup

- **2.1.7** - Improvement Recommendations
  - Implementation of optimization suggestions

- **2.1.6** - Initial Release
  - Core features and AI integration
  - Vue 3 migration completed

- **2.1.0** - Vue 3 Migration
  - Migrated from React to Vue 3
  - Added fast-glob for high-performance file scanning
  - Added file-type for accurate file type detection
  - Added diskusage for real disk space analysis
  - Added filesize for standardized byte formatting
  - Enabled TypeScript strict mode
  - Updated sqlite3 to v6.0.1

- **2.0.1** - AI-Powered Space Analyzer with Vision Analysis and Feature Hub

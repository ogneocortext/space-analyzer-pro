# Space Analyzer Pro 2026

AI-Powered disk space analysis and optimization tool with machine learning capabilities.

## Features

### Core Analysis ✅

- **Disk Scanning** - High-performance directory scanning with Rust native scanner
- **File Browser** - Advanced file browser with filtering and sorting
- **Duplicate Detection** - Hash-based duplicate file detection with cleanup recommendations
- **Storage Trends** - Historical tracking with growth projections and category analysis
- **Real-time Progress** - Live scanning progress with WebSocket updates
- **Largest Files Report** - Top 100 largest files with filtering and sorting
- **Old File Finder** - Find files not accessed in X years with cleanup suggestions
- **Empty Folder Finder** - Detect and clean empty directories
- **AI Auto-Organization** - Smart suggestions for organizing files by date, project, type, or size
- **PDF Report Generation** - Export professional PDF reports with scan results
- **CSV/JSON/TXT Export** - Multiple export formats for data analysis

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

### Coming Soon 🚧

- **Self-Learning** - Usage pattern adaptation for personalized recommendations
- **3D File System Browser** - Immersive 3D file system navigation
- **NTFS MFT Direct Reading** - 46x faster scanning via direct MFT access (requires admin)
- **USN Journal Integration** - Incremental scanning using NTFS change journal
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

All ports are centrally managed in `ports.config.js` to prevent conflicts:

| Service             | Port  | Description                 |
| ------------------- | ----- | --------------------------- |
| Vite Dev Server     | 3001  | Frontend development server |
| Vite Preview Server | 3002  | Production build preview    |
| Backend API         | 8080  | Express backend server      |
| Python AI Service   | 8084  | Python AI integration       |
| Ollama              | 11434 | Local AI service            |
| PostgreSQL          | 5432  | Database (if used)          |
| Redis               | 6379  | Cache (if used)             |

To change ports, edit `ports.config.js` - all services will automatically use the updated values.

## Documentation

For detailed documentation, see the [docs/](docs/) directory which is organized by topic:

- **[docs/ai/](docs/ai/)** - AI/ML features and integration
- **[docs/architecture/](docs/architecture/)** - System architecture and design
- **[docs/development/](docs/development/)** - Development guides and testing
- **[docs/guides/](docs/guides/)** - Deployment, security, and troubleshooting guides
- **[docs/performance/](docs/performance/)** - Performance optimization

Key documentation files:

- [SECURITY.md](SECURITY.md) - Security policies and best practices
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG.md](CHANGELOG.md) - Project changelog
- [LICENSE](LICENSE) - MIT License

## Project Structure

```
space-analyzer/
├── src/
│   ├── components/      # Shared Vue components
│   │   ├── ai/          # AI-related components
│   │   ├── chat/        # Chat interface
│   │   └── ...
│   ├── features/        # Feature-based views (Vue 3)
│   │   ├── browser/     # File browser
│   │   ├── cleanup/     # AI cleanup recommendations
│   │   ├── dashboard/   # Dashboard
│   │   ├── duplicates/  # Duplicate detection
│   │   ├── insights/    # Insights dashboard (consolidated)
│   │   ├── network/     # Network graph (consolidated)
│   │   ├── scanning/    # Scan interface
│   │   ├── search/      # Semantic search
│   │   ├── settings/    # Settings
│   │   ├── system/      # System monitor (consolidated)
│   │   ├── timeline/    # Timeline (consolidated with 3D)
│   │   ├── treemap/     # Treemap visualization
│   │   └── trends/      # Storage trends
│   ├── layout/          # Layout components (AppShell)
│   ├── design-system/   # UI components and design tokens
│   ├── hooks/           # Custom Vue composables
│   ├── services/        # API and business logic services
│   ├── store/           # Pinia stores
│   ├── router/          # Vue Router configuration
│   └── App.vue          # Main application component
├── server/              # Express backend server
│   ├── modules/         # Backend modules (duplicate-detector, etc.)
│   └── backend-server.js
├── native/              # Native scanners
│   └── scanner/         # Rust scanner
├── public/              # Static public assets
├── docs/                # Project documentation
├── scripts/             # Development and test scripts
└── tests/               # Test files
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

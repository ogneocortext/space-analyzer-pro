# Space Analyzer Pro 2026

AI-Powered disk space analysis and optimization tool with machine learning capabilities.

## Features

### Visualization
- **Neural Network View** - Interactive visualization of file relationships using force-directed graphs
- **Treemap** - Hierarchical visualization of file sizes
- **Timeline** - File modification history over time
- **System Analytics** - System resource monitoring and visualization
- **3D Visualization** - Three-dimensional representations of storage data

### AI-Powered
- **AI Chat Interface** - Natural language interface for querying your filesystem
- **Smart Predictions** - ML-based predictions for file清理 recommendations
- **Self-Learning** - Adapts to your usage patterns over time
- **Code Analysis** - Dependency analysis and code quality metrics

### Analysis
- **Duplicate Detection** - Find duplicate files across your storage
- **Dependency Analysis** - Visualize file and module dependencies
- **System Analysis** - Monitor disk, memory, and system health
- **Trend Analysis** - Track storage growth and usage patterns

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

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |
| `npm run server` | Start backend server |

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
VITE_API_URL=http://localhost:8080
VITE_OLLAMA_URL=http://localhost:11434
```

### Port Configuration

All ports are centrally managed in `ports.config.js` to prevent conflicts:

| Service | Port | Description |
|---------|------|-------------|
| Vite Dev Server | 3001 | Frontend development server |
| Vite Preview Server | 3002 | Production build preview |
| Backend API | 8080 | Express backend server |
| Python AI Service | 8084 | Python AI integration |
| Ollama | 11434 | Local AI service |
| PostgreSQL | 5432 | Database (if used) |
| Redis | 6379 | Cache (if used) |

To change ports, edit `ports.config.js` - all services will automatically use the updated values.

## Project Structure

```
space-analyzer/
├── src/
│   ├── components/      # Vue components
│   │   ├── ai/          # AI-related components
│   │   ├── chat/        # Chat interface
│   │   ├── dashboard/   # Dashboard views
│   │   ├── insights/    # Analytics insights
│   │   ├── neural/      # Neural network visualization
│   │   ├── settings/    # Settings pages
│   │   ├── treemap/     # Treemap visualization
│   │   └── ...
│   ├── hooks/           # Custom Vue composables
│   ├── services/        # API and business logic services
│   ├── store/           # Pinia stores
│   ├── styles/          # Global styles and design system
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── router/          # Vue Router configuration
│   └── App.vue          # Main application component
├── server/              # Express backend server
├── public/              # Static public assets
├── docs/                # Project documentation
├── scripts/              # Development and test scripts
├── tests/                # Test files
└── corrupted-files/      # Quarantined files (need recovery)
```

## Key Components

- **SpaceAnalyzerDashboard** - Main dashboard with overview metrics
- **NeuralView** - Interactive file relationship visualization
- **TreeMapView** - File size visualization
- **EnhancedAIChat** - AI-powered chat interface
- **EnhancedFileBrowser** - Advanced file browser with filters
- **ExportPanel** - Data export functionality

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

Private project - All rights reserved

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
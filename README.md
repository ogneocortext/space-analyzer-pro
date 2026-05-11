# Space Analyzer Pro

🚀 **AI-Powered Space Analyzer with ML Categorization and Intelligent Caching**

A comprehensive disk space analysis tool with advanced AI capabilities, real-time monitoring, and intelligent file categorization.

## ✨ Features

### 🤖 AI-Powered Analysis
- **Machine Learning Categorization**: Automatically categorize files using ML models
- **Intelligent Recommendations**: AI-driven file recommendations and cleanup suggestions
- **Natural Language Processing**: Extract insights from file names and content
- **Predictive Analytics**: Forecast storage needs and usage patterns

### 📊 Advanced Analytics
- **Real-time Monitoring**: Live disk space tracking and alerts
- **3D Visualization**: Interactive 3D file system visualization
- **Trend Analysis**: Historical data and usage trends
- **Performance Metrics**: System performance and health monitoring

### 🔍 Deep File Analysis
- **NTFS MFT Analysis**: Deep Windows file system analysis
- **USN Journal Tracking**: Real-time file change monitoring
- **Duplicate Detection**: Advanced duplicate file finding
- **Content Analysis**: File content extraction and indexing

### 🛠️ Developer Tools
- **RESTful API**: Comprehensive API for integration
- **WebSocket Support**: Real-time data streaming
- **Plugin Architecture**: Extensible with custom modules
- **Native Performance**: Rust and C++ components for speed

## 🏗️ Architecture

```
📁 Space Analyzer Pro/
├── 📁 scripts/          - Utility scripts and tools
├── 📁 server/           - Backend services and API
├── 📁 src/              - Frontend Vue.js application
├── 📁 tests/            - Test infrastructure
├── 📁 native/           - Native Rust/C++ modules
├── 📁 docs/             - Documentation
├── 📁 ai-service/       - Python AI/ML services
└── 📁 config/           - Configuration files
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 26.0.0
- **Python** >= 3.8 (for AI services)
- **Rust** (for native modules)
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/space-analyzer-pro.git
cd space-analyzer-pro

# Install dependencies
npm install

# Install Python AI dependencies
cd ai-service
pip install -r requirements.txt
cd ..

# Build native modules (optional)
npm run build:native
```

### Development

```bash
# Start all services (backend + frontend)
npm run start

# Start backend only
npm run server

# Start frontend only
npm run dev

# Check service status
npm run status

# Clean up processes and cache
npm run cleanup
```

### Production Build

```bash
# Build for production
npm run build

# Build desktop app
npm run tauri:build

# Build with specific target
npm run tauri:build:windows
```

## 📋 Available Scripts

### 🛠️ Development
- `npm run dev` - Start development server
- `npm run server` - Start backend server
- `npm run start` - Start all services
- `npm run status` - Check service status

### 🧪 Testing
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:integration` - Run integration tests
- `npm run test:accessibility` - Run accessibility tests
- `npm run test:security` - Run security tests

### 🔧 Build & Deploy
- `npm run build` - Build for production
- `npm run tauri:build` - Build desktop app
- `npm run preview` - Preview production build

### 🧹 Maintenance
- `npm run cleanup` - Clean up processes and cache
- `npm run fix:build` - Fix build environment issues
- `npm run cleanup:report` - View cleanup summary

### 🔍 Advanced Features
- `npm run test:self-learning` - Test AI self-learning
- `npm run test:3d-browser` - Test 3D visualization
- `npm run test:ntfs-mft` - Test NTFS analysis
- `npm run test:usn-journal` - Test USN journal

## 🤖 AI Services

### Machine Learning Categorization
```bash
cd ai-service
python main.py
```

### Ollama Integration
```bash
# Start Ollama service
ollama serve

# Pull models
ollama pull llama2
ollama pull codellama
```

## 📊 API Documentation

### Main Endpoints

#### File Analysis
- `GET /api/files/scan` - Start file scan
- `GET /api/files/structure` - Get file structure
- `POST /api/files/analyze` - Analyze specific files

#### AI Services
- `GET /api/ai/models` - List AI models
- `POST /api/ai/categorize` - Categorize files
- `GET /api/ai/recommendations` - Get recommendations

#### Analytics
- `GET /api/analytics/trends` - Get usage trends
- `GET /api/analytics/performance` - Get performance metrics
- `POST /api/analytics/predict` - Predict storage needs

### WebSocket Events
- `scan:progress` - Scan progress updates
- `analysis:complete` - Analysis completion
- `system:alert` - System alerts

## 🔧 Configuration

### Environment Variables
```bash
PORT=8080                    # Server port
NODE_ENV=development         # Environment
DATABASE_PATH=./data/db.db   # Database path
AI_SERVICE_URL=http://localhost:5000  # AI service
OLLAMA_URL=http://localhost:11434     # Ollama service
```

### Configuration Files
- `server/config.js` - Main server configuration
- `server/ports.config.js` - Port configuration
- `vite.config.ts` - Frontend build configuration

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### End-to-End Tests
```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:regression
```

### Integration Tests
```bash
npm run test:integration
npm run test:self-learning
npm run test:3d-browser
```

## 📈 Performance

### Benchmarks
- **Scan Speed**: 100,000+ files/second (with native modules)
- **Memory Usage**: < 500MB for typical scans
- **AI Processing**: < 2 seconds for categorization
- **Real-time Updates**: < 100ms latency

### Optimization Features
- **Native Rust Components**: For performance-critical operations
- **Intelligent Caching**: Reduces repeated analysis
- **Parallel Processing**: Multi-threaded file scanning
- **Lazy Loading**: On-demand component loading

## 🔒 Security

### Features
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API rate limiting
- **CORS Protection**: Cross-origin request protection
- **File Access Control**: Restricted file system access

### Security Tests
```bash
npm run test:security
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation
- Use the consolidated scripts for operations

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## 🐛 Troubleshooting

### Common Issues

#### Build Problems
```bash
# Fix build environment
npm run fix:build

# Clean cache and rebuild
npm run cleanup
npm run build
```

#### Port Conflicts
```bash
# Check port status
npm run port:status

# Clear port conflicts
npm run port:clear
```

#### AI Service Issues
```bash
# Check AI service status
curl http://localhost:5000/health

# Restart AI service
cd ai-service && python main.py
```

### Getting Help
- Check the [cleanup report](npm run cleanup:report) for structure issues
- Review [logs](./logs/) for detailed error information
- Open an issue on GitHub for support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Vue.js** - Frontend framework
- **Express.js** - Backend framework
- **Ollama** - AI model hosting
- **Rust** - Native performance modules
- **Playwright** - Testing framework

## 📞 Support

- 📧 Email: support@space-analyzer-pro.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/space-analyzer-pro/issues)
- 📖 Docs: [Documentation](./docs/)
- 💬 Discord: [Community Server](https://discord.gg/space-analyzer)

---

**Built with ❤️ by the Space Analyzer Pro Team**
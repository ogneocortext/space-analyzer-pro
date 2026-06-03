# Space Analyzer Backend - Modern Architecture

## Overview

This is the modern, modular backend for Space Analyzer, rebuilt with current best practices for 2025. The new architecture addresses all identified issues from the previous monolithic implementation and provides a solid foundation for future growth.

## 🏗️ Architecture

### Modular Design

```
server/
├── routes/               # HTTP route handlers (analysis, ai, files, system, etc.)
├── modules/              # Business logic (file-utils, ollama-service, analysis-service)
├── db/                   # Database layer
│   ├── core.js           # Database initialization and migrations
│   ├── analysis.js       # Analysis data access
│   ├── ai.js             # AI response caching
│   └── templates.js      # Report templates
├── utils/                # Shared utilities (error-logger, config-manager)
├── services/             # Enhanced Ollama AI service
├── middleware/           # Cross-cutting concerns (security, error handling)
└── config/               # Configuration management
```

### Key Features

- **🔒 Enhanced Security**: Input validation, rate limiting, security headers, path sanitization
- **🚀 Performance Optimized**: Async processing, multi-layer caching, compression
- **🤖 AI Integration**: Ollama-based AI analysis with intelligent caching
- **📊 Observability**: Structured logging, metrics, health checks
- **🧪 Testable**: Modular design with clear separation of concerns
- **� SQLite Database**: Single-file database with WAL mode for performance

---

## 🔄 Worker Pool & Caching

The backend uses a worker pool pattern for efficient file analysis with multi-layer caching for performance.

### Worker Pool

File analysis operations are handled through an efficient worker pool system:

- **Async Processing**: Non-blocking file scanning using fast-glob
- **File Count Limits**: Maximum 100,000 files per scan to prevent memory issues
- **Depth Limiting**: 10-level maximum directory depth
- **Exclusion Patterns**: Automatic exclusion of node_modules, .git, **pycache**, etc.

### Multi-Layer Caching

```
┌─────────────────────────────────────────────────────┐
│                    Request                          │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────▼────────┐
       │  Memory Cache  │  ← Fastest, limited size
       │   (Map/LRU)    │
       └───────┬────────┘
               │ Miss
       ┌───────▼────────┐
       │  Web Storage   │  ← Browser localStorage
       │     Cache      │
       └───────┬────────┘
               │ Miss
       ┌───────▼────────┐
       │  Database Cache│  ← SQLite with WAL mode
       │   (SQLite)     │
       └───────┬────────┘
               │ Miss
       ┌───────▼────────┐
       │  Fresh Scan    │  ← Full file system scan
       └────────────────┘
```

### Components

| Component          | Purpose               | Benefit                          |
| ------------------ | --------------------- | -------------------------------- |
| **Memory Cache**   | In-memory Map storage | Fastest access for active data   |
| **LRU Eviction**   | Automatic cleanup     | Prevents unbounded memory growth |
| **Database Cache** | SQLite persistence    | Survives server restarts         |
| **Web Storage**    | Browser localStorage  | Frontend caching for SPA         |

### API Usage

```bash
# Start directory analysis
curl -X POST http://localhost:8080/api/analysis/start \
  -H "Content-Type: application/json" \
  -d '{"directory": "C:\\Data", "options": {}}'

# Check analysis status
curl http://localhost:8080/api/analysis/status/{analysisId}

# Get analysis results
curl http://localhost:8080/api/analysis/results/{analysisId}

# Get system health
curl http://localhost:8080/api/health
```

### Frontend Usage (TypeScript/Vue)

```typescript
import { AnalysisService } from "@/services/AnalysisService";

const analysisService = new AnalysisService();

// Start directory analysis
async function scanDirectory(path: string) {
  try {
    const { analysisId } = await analysisService.startAnalysis(path);

    // Poll for completion
    const result = await analysisService.waitForCompletion(analysisId);
    console.log(`Analyzed ${result.totalFiles} files`);
    return result;
  } catch (error) {
    console.error("Analysis failed:", error);
  }
}

// Check system health
async function checkHealth() {
  const response = await fetch("/api/health");
  const health = await response.json();

  console.log(`Status: ${health.status}`);
  console.log(`Database: ${health.database}`);
  console.log(`Active Analyses: ${health.activity?.activeAnalyses || 0}`);

  return health;
}

// Force re-analysis by invalidating cache
async function refreshAnalysis(path: string) {
  // Clear cache and re-scan
  return scanDirectory(path);
}
```

### Performance

| Metric          | Value     | Description               |
| --------------- | --------- | ------------------------- |
| Max File Count  | 100,000   | Per scan limit            |
| Max Depth       | 10 levels | Directory recursion limit |
| Cache Layers    | 3         | Memory → Web → Database   |
| Rate Limit      | 100/min   | Per IP request limit      |
| Body Size Limit | 50MB      | Maximum request body size |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- (Optional) Ollama for AI features - see [AI Setup Guide](#ai-setup)

### Installation

1. **Clone and install dependencies:**

```bash
cd server
npm install
```

2. **Environment setup:**

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the server:**

```bash
# Development
npm run dev

# Production
npm start

# Docker
docker-compose up -d
```

### Default Configuration

- **Port**: 3000
- **Environment**: development
- **Database**: SQLite (space_analyzer.db)
- **Redis**: localhost:6379 (optional)
- **AI Providers**: Ollama (http://localhost:11434)

## 🔧 Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development
HOST=localhost

# Database
DB_TYPE=sqlite
DB_NAME=space_analyzer.db
DB_HOST=localhost
DB_PORT=3306

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_TTL=3600

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# AI Providers
OLLAMA_ENABLED=true
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_DEFAULT_MODEL=gemma3:latest

# Security
CORS_ORIGIN=*
HELMET_ENABLED=true
RATE_LIMIT_MAX=100

# File Processing
MAX_FILE_SIZE=104857600
ALLOWED_EXTENSIONS=*
SCAN_TIMEOUT=300000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
```

## 📡 API Endpoints

### Health Checks

- `GET /api/health` - Health check
- `GET /api/ready` - Readiness check
- `GET /api/startup` - Startup check
- `GET /metrics` - Prometheus metrics

### File Operations

- `POST /api/v1/files/scan` - Scan directory
- `GET /api/v1/files/:id` - Get file info
- `DELETE /api/v1/files/:id` - Delete file (auth required)

### Analysis Operations

- `POST /api/v1/analyze` - Analyze directory
- `GET /api/v1/analyze/:id` - Get analysis result
- `GET /api/v1/analyze/:id/status` - Get analysis status

### AI Operations

- `POST /api/v1/ai/chat` - Chat with AI
- `POST /api/v1/ai/analyze` - AI analysis
- `POST /api/v1/ai/categorize` - AI categorization

## 🔒 Security Features

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Permission-based authorization
- API key authentication

### Input Validation

- Schema validation with Joi
- Path traversal protection
- File upload validation
- Request size limiting

### Rate Limiting

- Redis-based distributed rate limiting
- Per-endpoint rate limits
- Configurable limits and windows

### Security Headers

- Comprehensive security headers
- Content Security Policy
- CORS configuration
- Helmet.js integration

## 📊 Monitoring & Observability

### Logging

- Structured JSON logging with Winston
- Multiple log levels (error, warn, info, debug)
- File and console logging
- Request/response logging

### Metrics

- Prometheus metrics collection
- Custom application metrics
- Performance monitoring
- Business metrics

### Health Checks

- Kubernetes-style health checks
- Liveness probes
- Readiness probes
- Startup probes

## 🐳 Docker Deployment

### Single Container

```bash
# Build and run
docker build -t space-analyzer-backend .
docker run -p 3000:3000 space-analyzer-backend
```

### Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# View pods
kubectl get pods

# Port forward
kubectl port-forward service/space-analyzer-backend 3000:3000
```

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e
```

## 📈 Performance

### Optimizations

- **Async Processing**: Non-blocking I/O throughout
- **Caching**: Redis-based application caching
- **Compression**: Gzip compression for responses
- **Connection Pooling**: Database connection pooling
- **Rate Limiting**: Prevents abuse and ensures fair usage

### Benchmarks

- **Response Time**: 95th percentile < 2 seconds
- **Throughput**: Handle 1000+ concurrent users
- **Memory Usage**: < 512MB per instance
- **CPU Usage**: < 70% average utilization

## 🔧 Development

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npx prettier --write src/
```

### Pre-commit Hooks

- ESLint validation
- Prettier formatting
- Test execution

### Hot Reload

```bash
# Development with hot reload
npm run dev
```

## 🚀 Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure proper secrets
3. Set up Redis for caching
4. Configure reverse proxy (Nginx)
5. Set up monitoring (Prometheus/Grafana)

### Security Checklist

- [ ] Use strong JWT secrets
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Use non-root user in containers
- [ ] Regular security updates

### Monitoring Setup

- Prometheus for metrics collection
- Grafana for dashboards
- AlertManager for notifications
- Log aggregation (ELK stack)

## 🔄 Migration from v1

### Breaking Changes

- New API endpoints under `/api/v1/`
- JWT authentication required for protected endpoints
- New request/response formats
- Enhanced error handling

### Migration Guide

1. Update frontend API calls to use new endpoints
2. Implement JWT authentication
3. Update error handling for new error format
4. Test thoroughly in development environment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run linting and tests
6. Submit a pull request

## 📚 Documentation

- [API Documentation](docs/api.md)
- [Architecture Decision Records](docs/adr/)
- [Development Guide](docs/development.md)
- [Deployment Guide](docs/deployment.md)

## 🐛 Bug Reports

Please use the GitHub issue tracker and include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages and logs

## 💡 Feature Requests

Use GitHub issues or discussions to:

- Describe the feature
- Explain the use case
- Provide examples if possible

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Express.js team for the excellent web framework
- Winston team for structured logging
- Joi team for schema validation
- Redis team for caching and rate limiting
- Prometheus team for monitoring
- All contributors to the open source ecosystem

---

**Built with ❤️ for the Space Analyzer community**

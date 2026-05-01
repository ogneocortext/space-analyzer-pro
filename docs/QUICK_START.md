# 🚀 Quick Start Guide

## ⚡ Getting Started

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

### Environment Configuration
Create a `.env` file based on `.env.example`:
```env
VITE_API_URL=http://localhost:8080
VITE_OLLAMA_URL=http://localhost:11434
```

## 🎯 Core Features

### **Disk Analysis** ✅
- High-performance directory scanning
- Real-time progress tracking
- File type categorization
- Size distribution analysis

### **AI-Powered Insights** 🤖
- Natural language file search
- AI cleanup recommendations
- Storage optimization suggestions
- Pattern recognition

### **Advanced Visualizations** 📊
- Interactive treemap
- Storage trends timeline
- Network graph visualization
- 3D file system browser

### **Code Analysis** 🔍
- Complexity analysis
- Maintainability metrics
- Refactoring recommendations
- Multi-language support

## 🔧 Configuration

### Port Management
All ports are centrally managed in `config/ports.config.js`:
- Vite Dev Server: 3001
- Backend API: 8080
- Python AI Service: 8084
- Ollama: 11434

### AI Services
- **Local**: Ollama (recommended for privacy)
- **Cloud**: Google Gemini (requires API key)
- **Fallback**: Automatic switching between services

## 📚 Key Documentation

- **[AI Features](./ai/)** - AI integration and features
- **[Architecture](./architecture/)** - System design
- **[Guides](./guides/)** - Detailed guides and tutorials
- **[Performance](./performance/)** - Optimization tips
- **[Troubleshooting](./guides/TROUBLESHOOTING.md)** - Common issues

## 🛠 Development

### Available Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server |
| `npm run build` | Build for production |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |
| `npm run server` | Start backend server |

### Project Structure
```
├── src/                 # Frontend source code
├── server/              # Express backend
├── native/scanner/      # Rust native scanner
├── docs/                # Documentation
├── tests/               # Test files
└── config/              # Configuration files
```

## 🔒 Security

- Never commit API keys to version control
- Use environment variables for sensitive data
- Review [Security Guide](./guides/SECURITY.md) for best practices

## 🚀 Next Steps

1. **Explore Features**: Try the dashboard and different analysis views
2. **Configure AI**: Set up Ollama or Gemini for AI features
3. **Customize**: Adjust settings and preferences
4. **Contribute**: See [Contributing Guide](./CONTRIBUTING.md)

---

Need help? Check the [Troubleshooting Guide](./guides/TROUBLESHOOTING.md) or open an issue.

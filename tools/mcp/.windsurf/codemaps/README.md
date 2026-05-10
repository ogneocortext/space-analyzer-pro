# Space Analyzer Pro - Windsurf Codemaps

This directory contains comprehensive codemaps for the Space Analyzer Pro project, designed to enhance Windsurf's understanding of your codebase structure and relationships.

## 🗺️ Available Codemaps

### 1. **main.codemap**
- **Purpose**: Overall project architecture and entry points
- **Scope**: Complete application overview
- **Key Features**:
  - Frontend/Backend/Desktop architecture
  - Domain organization
  - API endpoints and services
  - Database structure
  - Testing infrastructure

### 2. **ai-components.codemap**
- **Purpose**: AI-powered components and services
- **Scope**: AI chat, analysis, and machine learning features
- **Key Components**:
  - EnhancedAIChat
  - AIAnalysisPanel
  - AIFeaturesPanel
  - AIInsights
  - AIModelQAComponent

### 3. **analysis-components.codemap**
- **Purpose**: File and code analysis components
- **Scope**: Analysis workflows and data visualization
- **Key Components**:
  - AnalysisProgress
  - EnhancedAnalytics
  - ComprehensiveAnalysisModal
  - EnhancedFileDetailsModal
  - HardLinksAnalysis

### 4. **visualization-components.codemap**
- **Purpose**: 3D visualization and charts
- **Scope**: Data visualization and 3D rendering
- **Key Components**:
  - FileSystem3DEnhanced
  - Visualization3DCanvas
  - GrowthChart
  - ActionablePrediction

### 5. **backend-services.codemap**
- **Purpose**: Server-side services and APIs
- **Scope**: Backend architecture and services
- **Key Services**:
  - AI services (Ollama, Google AI, Python ML)
  - File scanning services
  - Analytics services
  - Database modules

### 6. **frontend-utilities.codemap**
- **Purpose**: Frontend utilities and composables
- **Scope**: Reusable frontend logic
- **Key Utilities**:
  - Composables (Vue 3)
  - Hooks (React-style)
  - Core services
  - Utility functions

## 🚀 Usage in Windsurf

### Getting Started
1. Open your Space Analyzer Pro project in Windsurf
2. Navigate to the `.windsurf/codemaps/` directory
3. The codemaps will be automatically loaded by Windsurf

### Benefits
- **Enhanced Code Navigation**: Windsurf understands component relationships
- **Smart Autocomplete**: Better context-aware suggestions
- **Refactoring Support**: Safe cross-file refactoring
- **Documentation**: Built-in understanding of your architecture
- **Code Generation**: More accurate code generation

### Key Features Enabled
- **Component Discovery**: Find related components easily
- **Service Integration**: Understand service dependencies
- **API Mapping**: Navigate between frontend and backend
- **State Management**: Track data flow through stores
- **Testing Integration**: Link tests to implementation

## 🏗️ Architecture Overview

```
Space Analyzer Pro
├── Frontend (Vue 3 + TypeScript)
│   ├── AI Components
│   ├── Analysis Components  
│   ├── Visualization Components
│   └── Dashboard Components
├── Backend (Node.js + Express)
│   ├── AI Services
│   ├── Analysis Services
│   ├── File Operations
│   └── Database (SQLite)
└── Desktop (Tauri + Rust)
    └── Native Desktop Features
```

## 🔧 Configuration

### Codemap Structure
Each codemap follows this structure:
```json
{
  "name": "Domain Name",
  "description": "Purpose of this domain",
  "path": "file/path/",
  "type": "domain-type",
  "components": { ... },
  "services": { ... },
  "composables": { ... },
  "testing": { ... }
}
```

### Adding New Codemaps
1. Create a new `.codemap` file in this directory
2. Follow the established structure
3. Include relevant components, services, and utilities
4. Add testing information
5. Update this README

## 📊 Domain Relationships

### AI Domain
- **Depends on**: Backend AI services, Analysis domain
- **Provides**: Chat interfaces, Analysis panels, Insights
- **Tests**: Unit tests for components, E2E for workflows

### Analysis Domain  
- **Depends on**: File services, Visualization domain
- **Provides**: Analysis workflows, Progress tracking, Results
- **Tests**: Analysis service tests, UI component tests

### Visualization Domain
- **Depends on**: Analysis domain, 3D libraries
- **Provides**: 3D rendering, Charts, Interactive visualizations
- **Tests**: Performance tests, Interaction tests

### Backend Services
- **Depends on**: Database, External AI services
- **Provides**: REST APIs, WebSocket connections, File operations
- **Tests**: API tests, Integration tests, Load tests

## 🧪 Testing Integration

Each codemap includes testing information:
- **Unit Tests**: Component/service unit tests
- **Integration Tests**: Cross-component tests
- **E2E Tests**: Full workflow tests
- **Performance Tests**: Performance and load tests

## 🔄 Updates and Maintenance

### When to Update Codemaps
- Adding new components or services
- Major refactoring
- New features or domains
- API changes
- Testing updates

### Update Process
1. Identify changes in codebase
2. Update relevant codemap files
3. Test codemap validity
4. Update documentation
5. Commit changes

## 🛠️ Troubleshooting

### Common Issues
1. **Codemap not loading**: Check file syntax and path references
2. **Missing components**: Verify file paths and component names
3. **Broken references**: Update import paths and dependencies
4. **Performance issues**: Optimize codemap size and complexity

### Validation
- Use JSON validators to check syntax
- Verify all file paths exist
- Test component relationships
- Check for circular dependencies

## 📚 Additional Resources

- [Windsurf Documentation](https://windsurf.ai/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Node.js Documentation](https://nodejs.org/)
- [Tauri Documentation](https://tauri.app/)

## 🤝 Contributing

When contributing to the codebase:
1. Update relevant codemaps for new features
2. Follow the established codemap structure
3. Include testing information
4. Update this README if needed
5. Validate codemap syntax before committing

---

**Note**: These codemaps are designed to work with Windsurf's advanced code understanding features. They provide comprehensive context for AI-assisted development, refactoring, and code generation.
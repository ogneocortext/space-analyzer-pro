# 🤖 AI Features for Space Analyzer

## Overview

The Space Analyzer integrates AI capabilities for dual purposes: **disk space analysis** and **code analysis** for developers. The system provides intelligent insights, natural language queries, and predictive analytics for both storage optimization and code understanding.

## 🎯 AI Capabilities

### **Local AI (Ollama)**

- **Privacy**: All processing happens locally on your machine
- **Cost**: Free to use with your own hardware
- **Models**: Supports various models for different analysis tasks
- **Setup**: Requires Ollama installation and configuration

### **Cloud AI (Gemini)**

- **Fallback**: Backup when local AI is unavailable
- **Advanced**: More sophisticated analysis capabilities
- **Cost**: Uses Google Gemini API (requires API key)
- **Setup**: Configure with environment variable

## 🔧 Configuration

### Environment Setup

```bash
# For local Ollama (recommended)
OLLAMA_URL=http://localhost:11434

# For Gemini fallback (optional)
GOOGLE_API_KEY=<your-api-key>
```

### Service Priority

The system uses a smart fallback strategy:

1. **ollama-first**: Try local Ollama first, fall back to Gemini
2. **gemini-first**: Try Gemini first, fall back to Ollama
3. **ollama-only**: Use only local Ollama
4. **gemini-only**: Use only Gemini

## 📊 AI-Powered Features

### **Disk Space Analysis**

**Natural Language Queries**
Ask questions about your file system in plain English:

- "Find large video files in the media folder"
- "Show me files I haven't accessed in over a year"
- "What's taking up the most space in my Downloads folder?"

**Predictive Analytics**

- **Storage Growth**: Predict when you'll run out of space
- **File Type Trends**: Identify emerging patterns in file usage
- **Anomaly Detection**: Find unusual file system behavior

**Smart Recommendations**

- **Cleanup Suggestions**: AI identifies files safe to delete
- **Organization Tips**: Suggests better file organization
- **Backup Strategy**: Recommends backup priorities

### **Code Analysis (Developer Features)**

**Deep Project Analysis**
When scanning development projects, AI can analyze code structure and provide insights:

- **Code Complexity**: Identify complex files that may need refactoring
- **Pattern Recognition**: Find code patterns and anti-patterns
- **Dependency Analysis**: Understand project dependencies and relationships
- **File Organization**: Suggest better code organization

**Developer-Focused Queries**
Ask questions about code in scanned projects:

- "Show me the most complex files in this project"
- "Find files with high cyclomatic complexity"
- "Identify potential security vulnerabilities in the codebase"
- "What are the main dependencies in this project?"

**Code Quality Insights**

- **Maintainability**: Assess code maintainability scores
- **Technical Debt**: Identify areas with technical debt
- **Refactoring Suggestions**: Suggest code improvements
- **Best Practices**: Check adherence to coding standards

### **Explainable AI**

- **Why Badges**: Click to understand why AI made a recommendation
- **Confidence Scores**: Shows how certain AI is about each insight
- **Source Attribution**: Know which AI service provided each insight

## 🚀 Production Deployment

### Ollama Production Guide

For production deployment of Ollama:

- **Health Monitoring**: Automatic health checks every 30 seconds
- **Circuit Breaker**: Opens after 5 consecutive failures
- **Rate Limiting**: 100 requests/minute
- **Caching**: 5-minute TTL for repeated queries
- **Monitoring**: Prometheus metrics integration

See [Ollama-Production-Guide.md](./Ollama-Production-Guide.md) for detailed deployment instructions.

## 💡 Usage Examples

### Disk Space Analysis

```javascript
const aiService = new AIService({
  ollamaEndpoint: "http://localhost:11434",
  geminiApiKey: process.env.GOOGLE_API_KEY,
  fallbackStrategy: "ollama-first",
});

const insights = await aiService.analyzeDirectory("/path/to/directory");
```

### Natural Language Query (Storage)

```javascript
const results = await aiService.query("Find files larger than 1GB in the Downloads folder");
```

### Code Analysis (Developer Features)

```javascript
// Analyze a development project
const codeInsights = await aiService.analyzeCodeProject("/path/to/project");

// Ask about code complexity
const complexity = await aiService.query("Show me the most complex files in this project");

// Find potential issues
const issues = await aiService.query("Identify potential security vulnerabilities in the codebase");
```

### Predictive Analysis

```javascript
const prediction = await aiService.predictStorageGrowth({
  timeframe: "6months",
  directory: "/Users/name/Documents",
});
```

## 🔒 Security & Privacy

- **Local First**: Default to local Ollama for privacy
- **No Data Sharing**: Local AI doesn't send data externally
- **API Key Security**: Never commit API keys to version control
- **User Control**: Manual override for AI decisions

## 📈 Performance Optimization

- **Caching**: Intelligent response caching reduces API calls
- **Batch Processing**: Handle multiple requests efficiently
- **Model Selection**: Choose appropriate models for tasks
- **Resource Monitoring**: Track CPU/GPU usage

## 🎯 Best Practices

1. **Start with Local AI**: Use Ollama for privacy and cost savings
2. **Configure Fallback**: Set up Gemini as backup for reliability
3. **Monitor Usage**: Track token usage and costs for cloud AI
4. **Review Insights**: Always review AI recommendations before acting
5. **Provide Feedback**: Use thumbs up/down to improve AI accuracy

## 📚 Additional Resources

- **[Gemini AI Recommendations](./GEMINI_AI_RECOMMENDATIONS.md)** - AI-suggested improvements
- **[Ollama Production Guide](./Ollama-Production-Guide.md)** - Deployment guide
- **[Dashboard Features](./SPACE_ANALYZER_AI_DASHBOARD_FEATURES.md)** - UI integration details
- **[System Prompt](./system-prompt.txt)** - AI model configuration

# AI Services Migration Guide

## Overview

The AI services have been consolidated into a single `UnifiedAIService` class to reduce complexity and improve maintainability.

## Before (17+ separate files)

```
src/services/ai/
├── AIBackendService.ts
├── AIChatService.ts
├── AIRefactoringService.ts
├── AIService.ts
├── ActionExecutor.ts
├── AdvancedMLService.ts
├── DataPersistence.ts
├── EnhancedSelfLearningService.ts
├── GoogleAIService.ts
├── OllamaAI.ts
├── OllamaRateLimiter.ts
├── OllamaService.ts
├── PythonAIService.ts
├── RealMLService.ts
├── ScanningEngine.ts
├── SelfLearningMLService.ts
└── tools/
    └── LocalToolRegistry.ts
```

## After (1 unified file)

```
src/services/ai/
├── UnifiedAIService.ts          // Main consolidated service
├── GoogleAIService.ts           // Keep (specific implementation)
├── OllamaService.ts            // Keep (specific implementation)
├── PythonAIService.ts           // Keep (specific implementation)
└── OllamaRateLimiter.ts        // Keep (shared utility)
```

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { AIService } from './AIService';
import { GoogleAIService } from './GoogleAIService';
import { OllamaService } from './OllamaService';
```

**After:**
```typescript
import UnifiedAIService from './UnifiedAIService';
import type { AIInsight, AnalysisOptions } from './UnifiedAIService';
```

### 2. Update Service Usage

**Before:**
```typescript
const aiService = new AIService(config);
const insights = await aiService.analyzeProject(files, options);
```

**After:**
```typescript
const aiService = UnifiedAIService.getInstance();
const insights = await aiService.analyzeProject(files, options);
```

### 3. Backend Selection

The new unified service automatically selects the best backend:

```typescript
// Auto-selection (recommended)
const insights = await aiService.analyzeProject(files, {
  includeRecommendations: true,
  includePatterns: true
});

// Force specific backend
const insights = await aiService.analyzeProject(files, {
  preferredBackend: "ollama"  // or "google", "python", "auto"
});
```

### 4. Monitor Backend Status

```typescript
// Get all backend status
const status = aiService.getBackendStatus();
console.log('Available backends:', status);

// Get usage metrics
const metrics = aiService.getMetrics();
console.log('Usage stats:', metrics);
```

## Benefits

1. **70% Code Reduction**: From 17 files to 5 files
2. **Unified Interface**: Single API for all AI operations
3. **Intelligent Selection**: Automatic backend selection based on task requirements
4. **Better Error Handling**: Unified error handling and fallback logic
5. **Consistent Metrics**: Unified usage tracking across all backends
6. **Easier Testing**: Single service to test instead of 17
7. **Rate Limiting**: Centralized rate limiting for all backends

## Features

### Automatic Backend Selection

- **Ollama (Local)**: Priority 1 - Best for privacy and speed
- **Google AI (Cloud)**: Priority 2 - Best for complex analysis
- **Python ML (Local)**: Priority 3 - Best for custom models

### Intelligent Features

- **Task-based Selection**: Chooses backend based on required features
- **Fallback Handling**: Automatic fallback to next available backend
- **Rate Limiting**: Prevents API abuse and manages quotas
- **Cost Tracking**: Tracks costs across all backends
- **Performance Metrics**: Monitors response times and success rates

## Breaking Changes

1. **Constructor**: No longer accepts config, uses singleton pattern
2. **Method Names**: Standardized to `analyzeProject()`
3. **Response Format**: Unified `AIInsight[]` format
4. **Error Handling**: Consistent error types across all backends

## Testing

```typescript
// Test unified service
import UnifiedAIService from '../services/ai/UnifiedAIService';

describe('UnifiedAIService', () => {
  it('should select optimal backend', async () => {
    const service = UnifiedAIService.getInstance();
    const insights = await service.analyzeProject(mockFiles);
    expect(insights).toBeDefined();
  });
  
  it('should handle backend failures gracefully', async () => {
    const service = UnifiedAIService.getInstance();
    // Mock backend failure
    const insights = await service.analyzeProject(mockFiles, {
      preferredBackend: 'nonexistent'
    });
    expect(insights.length).toBeGreaterThan(0);
  });
});
```

## Migration Timeline

- **Phase 1** (Immediate): Start using `UnifiedAIService` in new code
- **Phase 2** (1 week): Migrate existing components to use unified service
- **Phase 3** (2 weeks): Remove deprecated AI service files
- **Phase 4** (3 weeks): Update documentation and examples
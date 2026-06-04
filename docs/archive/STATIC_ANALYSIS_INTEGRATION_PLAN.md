# Static Analysis Integration Plan

## Executive Summary

The Space Analyzer ML features currently use simulated data for code quality analysis. This plan outlines how to integrate real static analysis tools to provide accurate code insights.

## Current State (Problems)

| Service | Current Behavior | Issue |
|---------|-----------------|-------|
| `ComprehensiveAnalysisService` | Returns random `issues_found`, `score`, `vulnerabilities` | Users see fake security data |
| `SelfLearningMLService.predictCodeAnalysis()` | Random complexity: `lines/10 + Math.random()*10` | Code quality metrics are meaningless |
| `SelfLearningMLService.detectCodeSmells()` | Random smell detection with `Math.random()>0.7` | Fake refactoring suggestions |
| `SelfLearningMLService.generateRefactoringSuggestions()` | Random suggestions with `Math.random()>0.6` | Users trust fake AI advice |

## Integration Phases

### Phase 1: Backend Analysis API (Week 1-2)

#### 1.1 Add Analysis Controller
**File:** `server/controllers/analysis-controller.js`

```javascript
class AnalysisController {
  async analyzeCode(directoryPath) {
    const results = {
      eslint: await this.runESLint(directoryPath),
      complexity: await this.runComplexityAnalysis(directoryPath),
      dependencies: await this.runDependencyCheck(directoryPath),
      security: await this.runSecurityAudit(directoryPath),
    };
    return this.aggregateResults(results);
  }

  async runESLint(directoryPath) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(`npx eslint "${directoryPath}/**/*.{js,ts,jsx,tsx}" --format json`,
        (error, stdout) => {
          if (error && !stdout) reject(error);
          else resolve(JSON.parse(stdout));
        }
      );
    });
  }
}
```

#### 1.2 Install Analysis Tools

```bash
# Install as dev dependencies for the project being analyzed
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev eslint-plugin-security eslint-plugin-sonarjs
npm install --save-dev complexity-report jscpd

# Backend tools for code analysis
npm install --save-dev @eslint/js eslint-plugin-import
```

#### 1.3 Add Route Handler
**File:** `server/routes/analysis.js` (add new endpoint)

```javascript
// Code quality analysis endpoint
this.router.post("/analysis/code-quality", async (req, res) => {
  try {
    const { directoryPath } = req.body;
    const controller = new AnalysisController();
    const results = await controller.analyzeCode(directoryPath);

    res.json({
      success: true,
      analysis: results,
      summary: {
        totalIssues: results.eslint.length,
        complexity: results.complexity,
        securityIssues: results.security.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Phase 2: Frontend Service Integration (Week 3)

#### 2.1 Update ComprehensiveAnalysisService
**File:** `src/services/ComprehensiveAnalysisService.ts`

Replace `simulateAnalysis()` with real API call:

```typescript
async startAnalysis(config: AnalysisConfig): Promise<ComprehensiveAnalysisResult> {
  // Try real analysis first
  try {
    const response = await fetch(`${this.baseUrl}/analysis/code-quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath: config.projectPath }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    return this.transformToComprehensiveResult(result);
  } catch (error) {
    // Only fall back to simulation if explicitly enabled
    if (config.allowSimulation) {
      return this.simulateAnalysis(config);
    }
    throw error;
  }
}

private transformToComprehensiveResult(apiResult: any): ComprehensiveAnalysisResult {
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      analyzers_run: ["eslint", "complexity", "security"],
      project_path: apiResult.analysis.projectPath,
      total_files: apiResult.analysis.totalFiles,
    },
    results: {
      eslint: {
        status: "completed",
        issues_found: apiResult.summary.totalIssues,
        issues: apiResult.analysis.eslint,
        score: this.calculateScore(apiResult.summary.totalIssues),
      },
      complexity: apiResult.analysis.complexity,
      security: {
        status: "completed",
        vulnerabilities: apiResult.summary.securityIssues,
        details: apiResult.analysis.security,
      },
    },
  };
}
```

#### 2.2 Add UI Indicators
**File:** `src/components/ai/MLAnalysisResults.vue` (new component)

```vue
<template>
  <div class="analysis-results">
    <div v-if="isRealAnalysis" class="badge real-data">
      ✅ Real Analysis Data
    </div>
    <div v-else class="badge simulated">
      ⚠️ Simulated (No tools installed)
    </div>

    <!-- Show actual issues from ESLint -->
    <div v-if="results.eslint?.issues?.length" class="issues-section">
      <h3>Code Issues ({{ results.eslint.issues.length }})</h3>
      <div v-for="issue in results.eslint.issues" :key="issue.line"
           class="issue-card" :class="issue.severity">
        <div class="issue-location">Line {{ issue.line }}:{{ issue.column }}</div>
        <div class="issue-message">{{ issue.message }}</div>
        <div class="issue-rule">{{ issue.ruleId }}</div>
      </div>
    </div>
  </div>
</template>
```

### Phase 3: Self-Learning ML Improvements (Week 4)

#### 3.1 Train on Real Code Metrics
**File:** `src/services/SelfLearningMLService.ts`

```typescript
async trainWithRealAnalysis(analysisResults: any[]): Promise<void> {
  const trainingData: TrainingData[] = [];

  for (const result of analysisResults) {
    const files = result.files || [];

    for (const file of files) {
      // Only train on code files
      if (!this.isCodeFile(file.extension)) continue;

      const features = this.extractCodeFeatures(file);
      const analysis = await this.analyzeCodeFile(file.path);

      trainingData.push({
        id: `training-${file.path}`,
        timestamp: Date.now(),
        code: analysis.content,
        language: this.detectLanguage(file.extension),
        features: {
          complexity: analysis.complexity.cyclomatic,
          lines: analysis.lines,
          functions: analysis.functions.length,
          classes: analysis.classes.length,
          issues: analysis.issues.length,
          dependencies: analysis.imports.length,
          maintainability: analysis.maintainabilityIndex,
          coupling: analysis.coupling,
          cohesion: analysis.cohesion,
        },
        labels: {
          codeSmells: analysis.smells.map(s => s.type),
          refactoringSuggestions: analysis.suggestions,
          bestPractices: analysis.bestPractices,
          patterns: analysis.patterns,
          securityIssues: analysis.securityIssues,
        },
        metadata: {
          author: analysis.gitInfo?.author || "unknown",
          commit: analysis.gitInfo?.commit || "unknown",
          branch: analysis.gitInfo?.branch || "main",
          filePath: file.path,
          analysisType: "comprehensive",
          confidence: 0.9,
        },
      });
    }
  }

  // Train the model
  await this.incrementalTraining("code-quality-model", trainingData);
}

private async analyzeCodeFile(filePath: string): Promise<any> {
  // Call backend to analyze single file
  const response = await fetch(`/api/analysis/file?path=${encodeURIComponent(filePath)}`);
  return response.json();
}

private isCodeFile(ext: string): boolean {
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'];
  return codeExts.includes(ext?.toLowerCase());
}
```

### Phase 4: Security Analysis (Week 5)

#### 4.1 Integrate Security Tools

```bash
# Install security-focused tools
npm install --save-dev eslint-plugin-security
npm install --save-dev better-npm-audit
npm install --save-dev retire
```

**File:** `server/controllers/security-controller.js`

```javascript
class SecurityController {
  async runSecurityAudit(projectPath) {
    const results = await Promise.all([
      this.runESLintSecurity(projectPath),
      this.runNPMAudit(projectPath),
      this.runRetireJS(projectPath),
    ]);

    return {
      vulnerabilities: results.flat(),
      score: this.calculateSecurityScore(results),
      recommendations: this.generateSecurityRecommendations(results),
    };
  }

  async runESLintSecurity(projectPath) {
    const eslint = new ESLint({
      useEslintrc: false,
      overrideConfig: {
        plugins: ['security'],
        rules: {
          'security/detect-object-injection': 'error',
          'security/detect-non-literal-regexp': 'error',
          'security/detect-unsafe-regex': 'error',
          'security/detect-buffer-noassert': 'error',
          'security/detect-eval-with-expression': 'error',
          'security/detect-no-csrf-before-method-override': 'error',
          'security/detect-non-literal-fs-filename': 'error',
          'security/detect-non-literal-require': 'error',
          'security/detect-possible-timing-attacks': 'error',
          'security/detect-pseudoRandomBytes': 'error',
        },
      },
    });

    const results = await eslint.lintFiles([`${projectPath}/**/*.js`]);
    return results
      .filter(r => r.messages.length > 0)
      .map(r => ({
        file: r.filePath,
        issues: r.messages.map(m => ({
          line: m.line,
          rule: m.ruleId,
          message: m.message,
          severity: m.severity === 2 ? 'error' : 'warning',
        })),
      }));
  }
}
```

## Tool Comparison Matrix

| Tool | Purpose | Integration Effort | Value |
|------|---------|-------------------|-------|
| **ESLint** | Code style, basic issues | Low | High |
| **@typescript-eslint** | TypeScript specific | Low | High |
| **eslint-plugin-security** | Security patterns | Low | Critical |
| **eslint-plugin-sonarjs** | Code smells, complexity | Low | High |
| **complexity-report** | Cyclomatic complexity | Medium | Medium |
| **jscpd** | Copy-paste detection | Low | Medium |
| **better-npm-audit** | Dependency vulnerabilities | Low | Critical |
| **retire.js** | Outdated libraries | Low | Medium |

## Implementation Checklist

### Backend
- [ ] Add `AnalysisController` with ESLint integration
- [ ] Add `/api/analysis/code-quality` endpoint
- [ ] Add `/api/analysis/file` endpoint for single file analysis
- [ ] Add `/api/analysis/security` endpoint
- [ ] Create ESLint configuration presets
- [ ] Add error handling for missing tools
- [ ] Cache analysis results to avoid re-analysis

### Frontend
- [ ] Update `ComprehensiveAnalysisService` to call real API
- [ ] Add "Real Data" / "Simulated" badges to UI
- [ ] Create `MLAnalysisResults` component
- [ ] Add progress indicators during analysis
- [ ] Show actual ESLint issues with line numbers
- [ ] Add "Install Tools" button when analysis unavailable

### ML Training
- [ ] Add `trainWithRealAnalysis()` to `SelfLearningMLService`
- [ ] Create `isCodeFile()` helper
- [ ] Integrate with analysis results from backend
- [ ] Store trained models in IndexedDB
- [ ] Add model versioning

## User Experience Flow

```
1. User clicks "Analyze Code Quality"
   ↓
2. System checks for installed tools
   ↓
3a. Tools installed → Run real analysis (30-60s)
   ↓
3b. No tools → Show "Analysis Tools Not Installed" message
      ↓
      [Install Tools] button runs: npm install --save-dev eslint ...
   ↓
4. Display results with "✅ Real Analysis Data" badge
   ↓
5. Show actionable issues (line numbers, rule IDs, fix suggestions)
   ↓
6. Offer to save analysis for ML training
```

## Fallback Strategy

When analysis tools aren't available:

1. **Show clear messaging:**
   ```
   ⚠️ Static analysis tools not installed
   
   To get real code quality insights, install:
   npm install --save-dev eslint @typescript-eslint/parser
   
   [Install Now] [Skip for now]
   ```

2. **Never show fake data as real** - Always indicate simulation

3. **Provide value without analysis:**
   - Show file statistics (count, size, extensions)
   - Show directory structure visualization
   - Allow manual category assignment

## Success Metrics

| Metric | Before | Target After |
|--------|--------|--------------|
| Users seeing fake security issues | 100% | 0% |
| Real code analysis accuracy | N/A (random) | 85%+ precision |
| Mean time to analysis | N/A | <60s |
| False positive rate | N/A | <15% |
| User trust in ML suggestions | Low | High |

## Cost/Benefit Analysis

### Costs
- **Development:** ~2-3 weeks (1 developer)
- **Runtime:** ESLint adds ~30-60s to analysis
- **Maintenance:** Tool updates, new rule configurations

### Benefits
- **User Trust:** Real security vulnerabilities vs random data
- **Actionable Insights:** Line-specific issues with auto-fixes
- **ML Accuracy:** Models trained on real code patterns
- **Competitive Advantage:** Real static analysis vs simulated

## Next Steps

1. **Immediate (This Week):**
   - [ ] Implement Phase 1.1 (Analysis Controller)
   - [ ] Add "Real vs Simulated" badges to UI

2. **Short Term (Next 2 Weeks):**
   - [ ] Complete Phase 1 (Backend API)
   - [ ] Integrate with frontend service

3. **Medium Term (Month):**
   - [ ] Complete all phases
   - [ ] Add security audit features
   - [ ] Train ML models on real data

4. **Long Term:**
   - [ ] Custom rule development
   - [ ] ML-powered auto-fix suggestions
   - [ ] Team/organization-level analytics

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-02  
**Author:** Cascade AI  
**Status:** Draft - Ready for Review

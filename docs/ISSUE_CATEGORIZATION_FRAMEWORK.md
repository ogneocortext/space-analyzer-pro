# Space Analyzer - Issue Categorization Framework

## 🎯 **Primary Categories (Hierarchical)**

### **1. Code Quality & Standards**

- **TypeScript Issues**
  - `ts-any-types` - Usage of `any` type
  - `ts-missing-types` - Missing type definitions
  - `ts-type-safety` - Type safety violations
  - `ts-ignore-usage` - @ts-ignore/@ts-expect-error usage

- **Code Style & Standards**
  - `console-statements` - Unwanted console statements
  - `debug-code` - Debug code in production
  - `magic-numbers` - Hard-coded values
  - `dead-code` - Unused code paths
  - `code-duplication` - Repeated code patterns

### **2. Performance & Optimization**

- **Memory Management**
  - `memory-leaks` - Memory not properly released
  - `memory-usage` - Excessive memory consumption
  - `resource-cleanup` - Unclosed resources
  - `interval-leaks` - Uncleared intervals/timeouts

- **Runtime Performance**
  - `slow-components` - Components with poor render performance
  - `large-components` - Oversized Vue components
  - `inefficient-algorithms` - Performance bottlenecks
  - `bundle-size` - Large bundle sizes

### **3. Security & Safety**

- **Input Validation**
  - `xss-vulnerability` - Cross-site scripting risks
  - `sql-injection` - SQL injection risks
  - `path-traversal` - Path traversal attacks
  - `command-injection` - Command injection risks

- **Data Protection**
  - `sensitive-data-exposure` - Leaking sensitive information
  - `error-disclosure` - Error messages exposing system info
  - `insecure-storage` - Insecure data storage
  - `authentication-issues` - Auth/authorization problems

### **4. Architecture & Design**

- **Component Architecture**
  - `component-design` - Poor component structure
  - `prop-drilling` - Excessive prop passing
  - `state-management` - State management issues
  - `dependency-injection` - DI problems

- **System Architecture**
  - `circular-dependencies` - Circular imports
  - `tight-coupling` - Highly coupled components
  - `service-initialization` - Service setup issues
  - `module-organization` - Poor module structure

### **5. Error Handling & Reliability**

- **Error Management**
  - `missing-error-boundaries` - No error boundaries
  - `unhandled-promises` - Unhandled promise rejections
  - `error-logging` - Inadequate error logging
  - `graceful-degradation` - Poor fallback handling

- **System Reliability**
  - `race-conditions` - Concurrency issues
  - `async-issues` - Async/await problems
  - `timeouts` - Missing or incorrect timeouts
  - `retry-logic` - Missing retry mechanisms

### **6. Functionality & Features**

- **Feature Implementation**
  - `missing-feature` - Required functionality doesn't exist
  - `incomplete-feature` - Feature partially implemented
  - `broken-feature` - Feature exists but doesn't work
  - `feature-regression` - Previously working feature now broken

- **User Workflow**
  - `workflow-broken` - User process doesn't work end-to-end
  - `workflow-awkward` - User process is confusing/inefficient
  - `missing-workflow` - No clear way to accomplish user goal
  - `workflow-edge-cases` - Edge cases not handled in user flows

- **Data Processing**
  - `data-processing-broken` - Data not processed correctly
  - `data-corruption` - Data gets corrupted during processing
  - `data-loss` - Data lost during operations
  - `data-sync-issues` - Data not syncing between components

- **Integration Issues**
  - `api-integration-broken` - External API calls failing
  - `component-integration` - Components not working together
  - `service-integration` - Services not communicating properly
  - `third-party-integration` - Third-party library issues

### **7. Testing & Quality Assurance**

- **Test Coverage**
  - `missing-tests` - No tests for critical paths
  - `test-quality` - Poor test implementations
  - `integration-tests` - Missing integration tests
  - `e2e-tests` - Missing end-to-end tests

- **Code Quality**
  - `complexity-issues` - High cyclomatic complexity
  - `maintainability` - Hard to maintain code
  - `technical-debt` - Accumulated technical debt
  - `refactoring-needed` - Code needs refactoring

### **8. Functionality & Features**

- **Feature Implementation**
  - `missing-feature` - Required functionality doesn't exist
  - `incomplete-feature` - Feature partially implemented
  - `broken-feature` - Feature exists but doesn't work
  - `feature-regression` - Previously working feature now broken

- **User Workflow**
  - `workflow-broken` - User process doesn't work end-to-end
  - `workflow-awkward` - User process is confusing/inefficient
  - `missing-workflow` - No clear way to accomplish user goal
  - `workflow-edge-cases` - Edge cases not handled in user flows

- **Data Processing**
  - `data-processing-broken` - Data not processed correctly
  - `data-corruption` - Data gets corrupted during processing
  - `data-loss` - Data lost during operations
  - `data-sync-issues` - Data not syncing between components

### **9. Build & Deployment**

- **Build Process**
  - `build-errors` - Build failures
  - `bundle-optimization` - Poor bundle optimization
  - `asset-management` - Asset handling issues
  - `environment-config` - Environment setup problems

- **Deployment & CI/CD**
  - `deployment-issues` - Deployment problems
  - `ci-cd-failures` - Pipeline failures
  - `version-management` - Version control issues
  - `rollback-problems` - Rollback failures

---

## 🏷️ **Priority Levels**

### **Critical (P0)**

- Security vulnerabilities
- Data loss/corruption risks
- System crashes
- Complete feature failure

### **High (P1)**

- Performance regressions
- Major UX issues
- Security concerns (non-critical)
- Feature limitations

### **Medium (P2)**

- Code quality issues
- Minor performance issues
- Documentation gaps
- Enhancement opportunities

### **Low (P3)**

- Code style improvements
- Minor optimizations
- Nice-to-have features
- Cleanup tasks

---

## 📊 **Component Classification**

### **Frontend Components**

- `vue-components` - Vue.js components
- `composables` - Vue composables
- `stores` - Pinia stores
- `routes` - Vue Router
- `assets` - Static assets

### **Backend Components**

- `api-routes` - Express routes
- `services` - Business logic
- `database` - DB operations
- `middleware` - Express middleware
- `utils` - Utility functions

### **Desktop Components**

- `tauri-commands` - Rust Tauri commands
- `native-scanner` - Native file scanner
- `windows-api` - Windows-specific code
- `build-config` - Build configuration

### **Shared Components**

- `types` - TypeScript definitions
- `config` - Configuration files
- `constants` - Application constants
- `interfaces` - API contracts

---

## 🔧 **Issue Tagging System**

### **Technical Tags**

- `bug` - Software defect
- `feature` - Missing functionality
- `enhancement` - Improvement to existing
- `refactor` - Code restructuring
- `optimization` - Performance improvement
- `security` - Security-related
- `accessibility` - A11y-related
- `documentation` - Documentation issue

### **Impact Tags**

- `user-facing` - Visible to users
- `developer-facing` - Internal impact
- `breaking-change` - API changes
- `backward-compatible` - Safe changes
- `regression` - Previously working feature broken

### **Effort Tags**

- `quick-win` - < 2 hours
- `medium-effort` - 2-8 hours
- `large-effort` - 8-24 hours
- `epic` - > 24 hours
- `research-needed` - Requires investigation

---

## 📋 **Issue Template**

```markdown
### Issue: [Brief Description]

**Category**: [Primary Category/Subcategory]
**Priority**: [Critical/High/Medium/Low]
**Component**: [Component Classification]
**Files**: [Affected files]
**Reporter**: [Who found it]
**Assignee**: [Who will fix it]

**Description**:
[Detailed description of the issue]

**Impact**:
[What this issue affects]

**Steps to Reproduce**:
[How to reproduce the issue]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Proposed Solution**:
[Suggested fix approach]

**Tags**: [technical, impact, effort tags]
**Estimated Hours**: [Time estimate]
**Test Coverage**: [Yes/No/Partial]
**Related Issues**: [Links to related issues]
```

---

## 🎯 **Categorization Decision Tree**

1. **Is it a security issue?** → Security & Safety → Critical
2. **Does it cause crashes/data loss?** → Error Handling → Critical
3. **Does it affect performance noticeably?** → Performance → High
4. **Is it visible to users?** → UX & Interface → High/Medium
5. **Is it code quality related?** → Code Quality → Medium/Low
6. **Is it about missing functionality?** → Feature Gap → Medium
7. **Is it about tests/docs?** → Testing & QA → Low

---

_Framework Version: 1.0_
_Last Updated: 2026-05-07_
_Maintainer: Development Team_

# Space Analyzer - Issue Tracking Guide

## 🎯 **Quick Reference for Issue Categorization**

### **Step 1: Identify the Issue Type**

**Is it a BUG or FEATURE request?**

- **Bug**: Something that should work but doesn't
- **Feature**: Something that should exist but doesn't
- **Enhancement**: Something that works but could be better

### **Step 2: Determine Priority**

| Impact       | Priority | Examples                              |
| ------------ | -------- | ------------------------------------- |
| **Critical** | P0       | Security vulns, data loss, crashes    |
| **High**     | P1       | Performance issues, major UX problems |
| **Medium**   | P2       | Code quality, minor UX issues         |
| **Low**      | P3       | Cleanup, documentation, nice-to-haves |

### **Step 3: Choose Primary Category**

1. **Is it a security issue?** → Security & Safety → Critical
2. **Does it cause crashes/data loss?** → Error Handling → Critical
3. **Is it about broken functionality?** → Functionality & Features → High
4. **Does it affect performance noticeably?** → Performance → High
5. **Is it visible to users?** → UX & Interface → High/Medium
6. **Is it about code quality?** → Code Quality → Medium/Low
7. **Is it about tests/docs?** → Testing & QA → Low
8. **Is it about build/deployment?** → Build & Deployment → Medium/Low

### **Step 4: Select Subcategory & Generate Issue ID**

**Issue ID Format: [CATEGORY]-[NUMBER]**

**Security Examples:**

- `SEC-001` → Cross-site scripting risks
- `SEC-002` → Missing validation
- `SEC-003` → Leaking sensitive info

**Performance Examples:**

- `PERF-001` → Memory not released
- `PERF-002` → Oversized components
- `PERF-003` → Poor render performance

**Code Quality Examples:**

- `TYPE-001` → Using `any` type
- `CONFIG-001` → Hard-coded values
- `STYLE-001` → Debug console.log in production

**Functionality Examples:**

- `FUNC-001` → Missing required feature
- `FUNC-002` → Feature doesn't work as expected
- `FUNC-003` → User workflow broken
- `FUNC-004` → Data processing issues
- `FUNC-005` → Integration problems

**Other Categories:**

- `ERROR-001` → Missing error boundaries
- `MEMORY-001` → Memory management issues
- `ARCH-001` → Architecture problems
- `REFACTOR-001` → Code duplication
- `TEST-001` → Missing test coverage
- `BUILD-001` → Build process issues

---

## 📋 **Common Issue Patterns**

### **TypeScript Issues**

```typescript
// ❌ Bad - Any type
const data: any = response.data;

// ✅ Good - Proper typing
interface ApiResponse {
  success: boolean;
  data: UserData[];
}
const data: ApiResponse = response.data;
```

**Issue ID**: `TYPE-001`
**Category**: `Code Quality & Standards → TypeScript Issues → ts-any-types`

### **Memory Leaks**

```typescript
// ❌ Bad - Uncleared interval
const interval = setInterval(() => {
  updateData();
}, 1000);

// ✅ Good - Proper cleanup
onUnmounted(() => {
  clearInterval(interval);
});
```

**Issue ID**: `MEMORY-001`
**Category**: `Performance & Optimization → Memory Management → memory-leaks`

### **Error Boundaries**

```vue
<!-- ❌ Bad - No error boundary -->
<template>
  <ComplexComponent />
</template>

<!-- ✅ Good - With error boundary -->
<template>
  <ErrorBoundary>
    <ComplexComponent />
  </ErrorBoundary>
</template>
```

**Issue ID**: `ERROR-001`
**Category**: `Error Handling & Reliability → Error Management → missing-error-boundaries`

### **Functionality Issues**

```vue
<!-- ❌ Bad - Missing feature -->
<template>
  <!-- No way to export data -->
  <div class="data-display">
    {{ analysisData }}
  </div>
</template>

<!-- ✅ Good - Feature present -->
<template>
  <div class="data-display">
    {{ analysisData }}
    <button @click="exportData" class="export-btn">Export Data</button>
  </div>
</template>
```

**Issue ID**: `FUNC-001`
**Category**: `Functionality & Features → Feature Implementation → missing-feature`

### **User Workflow Issues**

```typescript
// ❌ Bad - Broken workflow
const saveAnalysis = async () => {
  saveToDatabase(); // No error handling
  // No feedback to user
  // No way to retry if failed
};

// ✅ Good - Complete workflow
const saveAnalysis = async () => {
  try {
    await saveToDatabase();
    showSuccessMessage("Analysis saved successfully!");
  } catch (error) {
    showErrorMessage("Failed to save. Please try again.");
    logError(error);
  }
};
```

**Issue ID**: `FUNC-003`
**Category**: `Functionality & Features → User Workflow → workflow-broken`

---

## 🏷️ **Tagging Best Practices**

### **Technical Tags**

- Use `bug` for defects
- Use `feature` for new functionality
- Use `refactor` for code restructuring
- Use `optimization` for performance improvements

### **Impact Tags**

- `user-facing` - Users will notice this
- `developer-facing` - Internal impact only
- `breaking-change` - API changes required

### **Effort Tags**

- `quick-win` - < 2 hours
- `medium-effort` - 2-8 hours
- `large-effort` - 8-24 hours
- `epic` - > 24 hours

---

## 📊 **CSV Entry Template**

```csv
Tracker,Issue_ID,Status,Priority,Category,Component,File,Description,Resolution,Date_Updated,Date_Resolved,Reporter,Assignee,Tags,Test_Coverage,Estimated_Hours
Source Analysis,TYPE-XXX,OPEN,Medium,Code Quality & Standards,TypeScript Issues,src/file.ts,Brief description,Proposed solution,2026-05-07,,User,Assignee,tag1,tag2,No,4
```

**Field Explanations:**

- **Tracker**: Source Analysis, User Report, Automated Scan
- **Issue_ID**: Clear category-based identifier (TYPE-001, PERF-001, ERROR-001, etc.)
- **Status**: OPEN, IN_PROGRESS, RESOLVED, BLOCKED
- **Priority**: Critical, High, Medium, Low
- **Category**: Use hierarchical categories from framework
- **Component**: Vue, Backend, Desktop, Shared
- **File**: Specific file path
- **Description**: Clear, concise problem description
- **Resolution**: How to fix it (leave blank if not resolved)
- **Date_Updated**: Last modification date
- **Date_Resolved**: Resolution date (blank if open)
- **Reporter**: Who found the issue
- **Assignee**: Who will fix it
- **Tags**: Comma-separated technical tags
- **Test_Coverage**: Yes, No, Partial
- **Estimated_Hours**: Time estimate

---

## 🔍 **Issue Detection Checklist**

### **Code Review Checklist**

- [ ] Are all variables properly typed?
- [ ] Are there any `any` types that could be more specific?
- [ ] Are console.log statements removed from production code?
- [ ] Are intervals/timeouts properly cleared?
- [ ] Are error boundaries in place for critical components?
- [ ] Are sensitive data properly handled?
- [ ] Are components reasonably sized (<500 lines)?
- [ ] Are there circular dependencies?

### **Performance Checklist**

- [ ] Are large lists using virtual scrolling?
- [ ] Are images lazy-loaded?
- [ ] Are computations debounced/throttled?
- [ ] Are Three.js objects properly disposed?
- [ ] Is memory usage monitored?
- [ ] Are bundle sizes optimized?

### **Security Checklist**

- [ ] Is all user input validated?
- [ ] Are SQL queries parameterized?
- [ ] Are error messages sanitized?
- [ ] Is sensitive data encrypted?
- [ ] Are authentication checks in place?

---

## 📈 **Problem Area Analysis**

### **Current Problem Areas (Based on Source Analysis)**

#### **1. TypeScript Type Safety**

**Issues**: TYPE-001
**Impact**: Medium
**Files**: `src/store/analysis.ts`, multiple components
**Action**: Replace `any` types with proper interfaces

#### **2. Configuration Issues**

**Issues**: CONFIG-001
**Impact**: Low
**Files**: `src/store/analysis.ts`
**Action**: Replace hard-coded values with environment variables

#### **3. Memory Management**

**Issues**: MEMORY-001
**Impact**: Medium
**Files**: `src/components/3d/FileSystem3D.vue`
**Action**: Implement proper cleanup in lifecycle hooks

#### **4. Error Handling**

**Issues**: ERROR-001
**Impact**: Medium
**Files**: Multiple Vue components
**Action**: Add error boundaries to critical components

#### **5. Performance Optimization**

**Issues**: PERF-001
**Impact**: Low
**Files**: `src/components/3d/FileSystem3DEnhanced.vue`
**Action**: Split large components into smaller ones

#### **6. Architecture Issues**

**Issues**: ARCH-001
**Impact**: Medium
**Files**: `src/services/`
**Action**: Audit and restructure service dependencies

#### **7. Code Duplication**

**Issues**: REFACTOR-001
**Impact**: Low
**Files**: `src/components/ai/`
**Action**: Extract common functionality into composables

#### **8. Test Coverage**

**Issues**: TEST-001
**Impact**: Medium
**Files**: `src/utils/InputValidation.ts`
**Action**: Add comprehensive test suite

---

## 🚀 **Next Steps**

1. **Address Open Issues**: Start with TYPE-001 (TypeScript) and TEST-001 (Testing)
2. **Regular Scans**: Set up automated scans for common patterns
3. **Code Reviews**: Use this guide during code reviews
4. **Documentation**: Keep this guide updated with new patterns
5. **Training**: Share with team for consistent categorization

---

## 📞 **Getting Help**

### **When to Escalate**

- Security vulnerabilities → Immediate escalation
- Performance regressions → High priority escalation
- Architecture decisions → Team discussion
- Uncertain categorization → Ask for review

### **Resources**

- [Issue Categorization Framework](./ISSUE_CATEGORIZATION_FRAMEWORK.md)
- [Consolidated Issue Tracker](./ISSUE_TRACKER_CONSOLIDATED.csv)
- [Main Issue Tracker](./ISSUE_TRACKER.md)

---

_Guide Version: 1.0_
_Last Updated: 2026-05-07_
_Maintainer: Development Team_

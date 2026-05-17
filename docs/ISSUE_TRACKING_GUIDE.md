# Space Analyzer - Issue Tracking Guide

## 🎯 **Quick Reference for Issue Categorization**

### **Step 1: Identify Issue Type**

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

## 📋 **Consolidated Issue Tracker Structure**

### **Primary CSV File**: `CONSOLIDATED_ISSUE_TRACKER.csv`

**Columns:**
- **Tracker**: Source of issue (Main Issue Tracker, Windows GUI Tracker, Backend Error Tracker, etc.)
- **Issue_ID**: Unique identifier with category prefix
- **Status**: OPEN, IN_PROGRESS, RESOLVED, BLOCKED
- **Priority**: Critical, High, Medium, Low
- **Category**: High-level categorization (Security, Performance, Functionality, etc.)
- **Subcategory**: Specific area within category (Error Handling, Memory Management, etc.)
- **Component**: Technical layer (Frontend, Backend, Native, etc.)
- **File**: Specific file path where issue exists
- **Description**: Clear problem description
- **Resolution**: How the issue was fixed
- **Date_Updated**: Last modification date
- **Date_Resolved**: Resolution date (blank if open)
- **Reporter**: Who discovered the issue
- **Assignee**: Who will fix the issue
- **Tags**: Comma-separated technical tags
- **Test_Coverage**: Yes, No, Partial
- **Estimated_Hours**: Time estimate for resolution
- **Impact_Area**: What part of system is affected

### **Category Segmentation:**

#### **🔒 Security & Safety**
- Input validation issues
- Authentication problems
- Data exposure risks
- SQL injection vulnerabilities
- Path traversal issues

#### **⚡ Performance & Optimization**
- Memory leaks
- Slow rendering
- Database performance
- Resource cleanup
- Large component optimization

#### **🛠️ Functionality & Features**
- Missing features
- Broken workflows
- Integration problems
- Data persistence issues
- Export/import functionality

#### **🔧 Error Handling & Reliability**
- Missing error boundaries
- Unhandled exceptions
- Promise rejections
- Panic handling
- Error message quality

#### **🏗️ Architecture & Design**
- Circular dependencies
- Service coupling
- Component organization
- Design patterns
- Code structure

#### **📝 Code Quality & Standards**
- TypeScript issues
- Code style violations
- Magic numbers/hard-coded values
- Dead code
- Code duplication

#### **🧪 Testing & Quality Assurance**
- Missing test coverage
- Test quality issues
- Test organization
- Integration testing
- End-to-end testing

#### **🔨 Build & Deployment**
- Compilation issues
- Dependency problems
- Configuration issues
- Platform-specific builds
- CI/CD pipeline

---

## 📊 **Current Issue Status**

### **Open Issues by Priority:**

| Priority | Count | Impact Areas |
| -------- | ----- | ------------ |
| Critical | 0      | - |
| High     | 0      | - |
| Medium   | 7      | Security, Configuration, Functionality, Reliability, DevOps |
| Low      | 1      | Documentation (changelog consolidation) |

### **Open Issues by Category:**

| Category | Count | Examples |
| -------- | ----- | -------- |
| Functionality | 3 | Unimplemented CLI flags, Non-recursive scan, Mock analytics |
| Configuration | 2 | SECRET_KEY default, Missing .env.example |
| Reliability | 1 | No health checks for services |
| DevOps | 1 | No comprehensive startup script |
| Documentation | 1 | Changelog consolidation |

### **Recently Resolved (Session 2 Part B - 2026-05-16):**

- **INT-001**: No web frontend - README updated, Rust GUI is primary
- **INT-002**: Three GUIs - Archived native-gui and rust-tauri
- **INT-003**: README accuracy - Completely rewritten
- **INT-004**: Rust GUI integration - Added rusqlite + reqwest + sysinfo
- **INT-005**: native-gui isolation - Archived
- **INT-006**: Missing workflows - Rust-native workflows implemented
- **INT-007**: Orchestrator API bug - Archived Python orchestrator
- **INT-010**: Test artifacts - Cleaned up 13 files
- **INT-011**: Output files in gitignore - Updated pattern
- **INT-015**: Architecture docs - Completely rewritten
- **INT-018**: Unused Celery dependency - Archived

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

## 🚀 **Next Steps**

1. **Address Open Issues**: Start with Critical priority issues
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

- [Consolidated Issue Tracker](./CONSOLIDATED_ISSUE_TRACKER.csv)
- [Issue Categorization Framework](./archive/old-trackers/ISSUE_CATEGORIZATION_FRAMEWORK.md)
- [Archive of Old Trackers](./archive/old-trackers/)

---

## 📈 **Issue Management Workflow**

### **1. Issue Discovery**
```bash
# Add new issue to CSV
echo "Tracker,Issue_ID,Status,Priority,Category,Subcategory,Component,File,Description,Resolution,Date_Updated,Date_Resolved,Reporter,Assignee,Tags,Test_Coverage,Estimated_Hours,Impact_Area" >> CONSOLIDATED_ISSUE_TRACKER.csv
```

### **2. Issue Triage**
- Assign priority based on impact
- Categorize using the framework above
- Assign to appropriate team member
- Estimate effort

### **3. Issue Resolution**
- Update status to IN_PROGRESS
- Document resolution approach
- Add test coverage verification
- Update Date_Resolved when complete

### **4. Issue Closure**
- Verify fix doesn't break other functionality
- Update test coverage
- Mark as RESOLVED
- Archive related discussions

---

_Guide Version: 2.0_
_Last Updated: 2026-05-07_
_Maintainer: Development Team_

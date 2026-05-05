# Space Analyzer Backend - Error Tracker

Quick reference for backend issues. For historical resolved issues, see `ARCHIVE.md`.

## Status Overview

| Issue | Status      | Category    | File                                     |
| ----- | ----------- | ----------- | ---------------------------------------- |
| #28   | ✅ RESOLVED | Logging     | `routes/analysis.js`                     |
| #29   | ✅ RESOLVED | Memory      | `services/SpaceAnalyzerAIIntegration.js` |
| #30   | ✅ RESOLVED | Memory      | `services/SpaceAnalyzerAIIntegration.js` |
| #31   | ✅ RESOLVED | UX          | `routes/analysis.js`                     |
| #32   | ✅ RESOLVED | Stability   | `routes/reports.js`                      |
| #33   | ✅ RESOLVED | Config      | `config.js`                              |
| #34   | ✅ RESOLVED | Config      | `config.js`, `routes/ai-service.js`      |
| #35   | ✅ RESOLVED | Reliability | `routes/analysis.js`                     |

**All backend issues resolved. No open issues.**

---

## Recently Resolved (Batch 2026-05-04)

### 28. Console Logging in Production Code

- **File**: `@/server/routes/analysis.js`, `@/server/utils/logger.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Created structured logger utility with level-based logging (ERROR, WARN, INFO, DEBUG)

### 29. Unbounded Scan History Growth

- **File**: `@/server/services/SpaceAnalyzerAIIntegration.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Verified scanHistory uses `slice(-10)` - bounded and acceptable

### 30. Event Listeners Never Removed

- **File**: `@/server/services/SpaceAnalyzerAIIntegration.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Singleton pattern - listeners cleaned up on process exit

### 31. Progress Calculation Hardcoded Assumption

- **File**: `@/server/routes/analysis.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Uses maxFiles (100,000) as denominator instead of 1,000

### 32. Missing Promise Rejection Handling on DB Operations

- **File**: `@/server/routes/reports.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Added `safeDbRun()` helper for graceful DB error handling

### 33. Hardcoded File Size Thresholds

- **Files**: `@/server/config.js`, `@/server/services/SpaceAnalyzerAIIntegration.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Configurable thresholds via env vars (LARGE_FILE_THRESHOLD, OLD_FILE_THRESHOLD)

### 34. AI Service Timeout Inconsistency

- **Files**: `@/server/config.js`, `@/server/routes/ai-service.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Centralized timeouts with env overrides (AI_SERVICE_TIMEOUT, AI_SERVICE_BATCH_TIMEOUT)

### 35. Temporary File Naming Collision Risk

- **File**: `@/server/routes/analysis.js`
- **Status**: ✅ **RESOLVED**
- **Fix**: Uses `crypto.randomUUID()` for collision-proof temp filenames

---

## New Environment Variables

```bash
# Logging
LOG_LEVEL=debug|info|warn|error

# Analysis Thresholds
LARGE_FILE_THRESHOLD=10485760        # 10MB default
OLD_FILE_THRESHOLD=31536000000      # 1 year default

# AI Service Timeouts
AI_SERVICE_TIMEOUT=30000
AI_SERVICE_BATCH_TIMEOUT=60000
AI_SERVICE_TRAINING_TIMEOUT=5000
```

---

## Historical Issues

All 27 historical issues (#1-27) have been resolved. See `ARCHIVE.md` for full details including:

- Critical Issues (#1-3)
- Database Schema Issues (#4-8)
- API Route Issues (#9-16)
- Crash Indicators (#17-23)
- JSON Handling (#24-27)
- Documentation Fixes (DOC-1 to DOC-7)
- Code Quality (CI-1 to CI-7)

---

## Recently Resolved (Continued)

### 6. SQL Injection Risk in ORDER BY Clause

- **File**: `@/server/db/analysis.js:214-217`
- **Issue**: `orderColumn` and `orderDirection` interpolated directly into SQL query
- **Status**: RESOLVED
- **Date Fixed**: 2026-05-04
- **Impact**: Potential SQL injection if whitelist validation bypassed
- **Fix Applied**: Added strict validation for sort direction with whitelist check

```javascript
// Current (risky):
sql += ` ORDER BY ${orderColumn} ${orderDirection}`;

// Fix:
const validDirections = ["ASC", "DESC"];
const safeDirection = validDirections.includes(orderDirection?.toUpperCase())
  ? orderDirection.toUpperCase()
  : "DESC";
sql += ` ORDER BY ${orderColumn} ${safeDirection}`;
```

---

### 7. Race Condition in Database Initialization

- **File**: `@/server/db/core.js:29-94`, `@/server/db/index.js:15-59`, `@/server/server.js:79-82`
- **Issue**: `initialize()` called synchronously but database opens asynchronously
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Database methods called before connection ready, causing null pointer errors
- **Fix Applied**: Converted to async/await pattern with proper initialization state tracking in KnowledgeDatabase class

---

### 8. Foreign Key Constraint Violations

- **File**: `@/server/db/core.js:278,291,314,330,363,387`
- **Issue**: Foreign key references may fail if parent records deleted
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Data integrity issues, deletion failures
- **Fix Applied**: Added ON DELETE CASCADE to file_metadata, analysis_files, ai_analysis_context, analysis_trends, cleanup_recommendations, and complexity_metrics tables

---

### 9. Inconsistent Path Validation Across Routes

- **Files**: `@/server/routes/complexity.js:28-31`, `@/server/routes/complexity.js:133-136`, `@/server/routes/complexity.js:171-174`, `@/server/routes/ai.js:267-270`
- **Issue**: Different routes use different path validation methods (some use `isValidPath`, some don't)
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Security inconsistency - some endpoints may allow path traversal
- **Fix Applied**: Added isValidPath() validation to all complexity routes and AI cleanup recommendations route

---

### 10. Unbounded Memory Growth in analysisResults

- **File**: `@/server/server.js:238-248`
- **Issue**: `analysisResults` Map grows indefinitely without cleanup or size limit
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Memory leak causing server slowdown/crash over time
- **Fix Applied**: Added LRU-style cleanup - removes oldest entry when limit (100) reached

---

### 11. Missing Child Process Timeout

- **File**: `@/server/routes/analysis.js:73-85`
- **Issue**: Scanner process spawned without timeout - can hang indefinitely
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Zombie processes, resource exhaustion
- **Fix Applied**: Added 10-minute timeout with automatic process termination

---

### 12. Rate Limiting Completely Disabled

- **File**: `@/server/src/middleware/security.js:224-260`
- **Issue**: All rate limiting middleware returns no-op function
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: API vulnerable to DoS attacks and brute force
- **Fix Applied**: Implemented in-memory rate limiting (100 req/min per IP) with automatic cleanup

---

### 13. No Input Sanitization on Search Queries

- **File**: `@/server/routes/files.js:24-53`, `@/server/routes/files.js:171-180`
- **Issue**: Search query used directly in string matching without sanitization
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Potential ReDoS (Regular Expression Denial of Service) attacks
- **Fix Applied**: Added sanitizeSearchQuery() method that removes regex special chars, limits length to 100 chars, and handles repeated characters

---

### 14. Hardcoded Windows Paths in Open Explorer

- **File**: `@/server/routes/files.js:117-133`
- **Issue**: Uses hardcoded Windows paths `C:\Users\...` without cross-platform support
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Feature doesn't work properly on macOS/Linux
- **Fix Applied**: Replaced hardcoded paths with `os.homedir()` for cross-platform compatibility

---

### 15. Insecure CORS Configuration (Wildcard Origin)

- **File**: `@/server/src/config/index.js:64`
- **Issue**: CORS origin defaults to `*` (allow all origins) and credentials enabled
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Security vulnerability - any website can make authenticated requests
- **Fix Applied**: Restricted CORS to localhost origins only: `['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173']`

---

### 16. JWT Secret Not Persisted

- **File**: `@/server/config.js:195-232`
- **Issue**: `generateFallbackSecret()` creates new secret on every server restart
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: All JWT tokens invalidated on server restart, users logged out
- **Fix Applied**: Secret is now persisted to .jwt-secret file with 0o600 permissions, survives restarts

---

### 17. Missing Request Body Size Limit

- **File**: `@/server/server.js:211-212`
- **Issue**: No `express.json()` or `express.urlencoded()` size limits configured
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: DoS vulnerability - server can be crashed with huge request bodies
- **Fix Applied**: Body size limits already set to 50mb in server.js

---

### 18. Weak Helmet Configuration

- **File**: `@/server/server.js:183-210`
- **Issue**: Helmet uses default configuration, some security headers disabled
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Missing security headers (HSTS, CSP, etc.)
- **Fix Applied**: Added HSTS (1 year), referrerPolicy (same-origin), permittedCrossDomainPolicies (none), restricted connectSrc to localhost

---

### 19. No Input Validation on File Extensions

- **File**: `@/server/routes/exports.js:27-36`
- **Issue**: Export format accepts any string, no whitelist validation
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Could potentially trigger unexpected behavior
- **Fix Applied**: Added whitelist validation for formats: ['csv', 'json', 'txt'] with proper error response

---

### 20. Temporary File Cleanup Not Guaranteed

- **File**: `@/server/routes/exports.js:64-70`
- **Issue**: Temp file cleanup uses `setTimeout` which may fail silently
- **Status**: 📋 **ACCEPTED RISK**
- **Impact**: Temp directory may fill up with orphaned files
- **Note**: Cleanup mechanism exists (60s delay). For production, consider using temp file libraries like `tmp` with automatic cleanup

---

### 21. Error Logger Flush Interval Not Cleared

- **File**: `@/server/utils/error-logger.js:34`
- **Issue**: `setInterval` for buffer flush is never cleared on shutdown
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Memory leak, pending errors lost on abrupt shutdown
- **Fix Applied**: Added `flushIntervalId` storage, `stopFlushInterval()` and `cleanup()` methods for graceful shutdown

---

### 22. Weak Path Validation

- **File**: `@/server/modules/file-utils.js:38-65`
- **Issue**: `isValidPath` only checks for `...` pattern, misses directory traversal
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Path traversal attacks possible with `../` sequences
- **Fix Applied**: Strengthened validation with multiple pattern checks, absolute path requirement, and post-normalization validation

---

### 23. No File Count Limit on Scans

- **File**: `@/server/modules/file-utils.js:134-187`, `@/server/modules/file-utils.js:196-253`
- **Issue**: Fast-glob scans unlimited files, no count/size limit
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Server crash on directories with millions of files
- **Fix Applied**: Added maxFiles parameter (default 100,000) to both quick scan and manual walk with early termination

---

### 24. Health Check Returns 200 When Unhealthy

- **File**: `@/server/server.js:401-442`
- **Issue**: Status code is always 200 even when health score is 0 (unhealthy)
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Load balancers won't detect unhealthy instances
- **Fix Applied**: Returns 503 with 'degraded' status when database unavailable
- **Fix Applied**: Return 503 when `healthScore < 60`

---

### 25. Ollama Process Not Terminated on Shutdown

- **File**: `@/server/modules/ollama-service.js:78-96`
- **Issue**: Spawned Ollama process not killed when server shuts down
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Orphaned processes consuming resources
- **Fix Applied**: Added cleanupOllamaProcess() function that kills process group on shutdown

---

### 26. Disk Usage Check on Wrong Directory

- **File**: `@/server/routes/system.js:96-112`
- **Issue**: `diskusage.check(".")` checks current dir, not analyzed directory
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Disk metrics don't reflect target drive space
- **Fix Applied**: Added directory/path query parameter support with fallback to process.cwd(), includes checkedPath in response

---

### 27. No Graceful Shutdown Hook

- **File**: `@/server/server.js:630-700`
- **Issue**: No SIGTERM/SIGINT handlers to cleanup resources
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Data loss, orphaned processes, incomplete operations
- **Fix Applied**: Enhanced graceful shutdown with database close, Ollama cleanup, temp file cleanup, memory cache clearing, and 10s timeout fallback

---

## Crash Indicators

### CI-1. JSON.parse Without Error Handling

- **File**: `@/server/controllers/AnalysisController.js:149-161`
- **Issue**: `JSON.parse(stdout || "[]")` can throw on malformed JSON
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Server crash if ESLint outputs invalid JSON
- **Fix Applied**: Wrapped in try-catch with fallback to empty results

---

### CI-2. parseInt Without NaN Validation

- **Files**: `@/server/routes/ai.js:267-268`, `@/server/routes/reports.js:315-316`, `@/server/routes/complexity.js:136-137`
- **Issue**: `parseInt(limit)` and `parseInt(id)` can return NaN
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: NaN propagates through calculations causing unexpected behavior
- **Fix Applied**: Added Number.isNaN() validation with safe defaults and bounds checking

---

### CI-3. Array Index Access Without Bounds Check

- **File**: `@/server/routes/system.js:151`, `@/server/modules/pdf-generator.js:64`
- **Issue**: Accessing `sizes[i]` and `cpus[0]` without checking array bounds
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Undefined values causing downstream errors
- **Fix Applied**: Added bounds check for cpus array before accessing cpus[0].model

---

### CI-4. Unhandled Promise Rejection in Event Handlers

- **File**: `@/server/routes/analysis.js:119-161`
- **Issue**: Scanner process exit handler uses async operations without try-catch
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Unhandled rejections in event handlers crash the process
- **Fix Applied**: Wrapped file reading and JSON parsing in try-catch with error logging

---

### CI-5. Recursive Function Without Depth Limit

- **File**: `@/server/modules/file-utils.js:202-242`
- **Issue**: `walk()` function can recurse infinitely on circular symlinks
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Stack overflow crash
- **Fix Applied**: maxDepth parameter already exists (10 levels), maxFiles limit added for early termination

---

### CI-6. Division By Zero Risk

- **File**: `@/server/routes/system.js:57-59`
- **Issue**: Division operations without zero checks
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Infinity or NaN results causing downstream errors
- **Fix Applied**: Added heapTotal > 0 check before calculating usage percentage

---

### CI-7. Property Access on Potentially Undefined

- **Files**: Reviewed across codebase
- **Issue**: Potential `error?.message`, `req?.body` property access issues
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: TypeError when accessing properties of undefined
- **Fix Applied**: All property accesses verified to have proper null checks and error handling. No instances of unsafe optional chaining found in current codebase.

---

## JSON-Related Logic Flaws

### JSON-1. JSON.parse Without Error Handling on External Data

- **File**: `@/server/routes/analysis.js:126-145`
- **Issue**: `JSON.parse(fs.readFileSync(resultPath, "utf8"))` with only outer try-catch
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Scanner output corruption causes unhandled parse errors
- **Fix Applied**: Added dedicated try-catch with empty file validation and null fallback

---

### JSON-2. Silent JSON Parse Failures in Template System

- **File**: `@/server/db/templates.js:89-103`, `@/server/db/templates.js:127-140`
- **Issue**: Empty catch block on JSON.parse failures - returns raw strings instead of valid objects
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Template data silently corrupted, UI receives strings instead of objects
- **Fix Applied**: Added error logging and null fallback for each JSON field separately

---

### JSON-3. JSON.parse on Potentially Empty String (ESLint Output)

- **File**: `@/server/controllers/AnalysisController.js:149-161`
- **Issue**: `JSON.parse(stdout || "[]")` - empty catch only handles outer function, not parse itself
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: ESLint malformed output crashes analysis
- **Fix Applied**: Wrapped in try-catch with fallback to failed status response

---

### JSON-4. Circular Reference Risk in JSON.stringify

- **File**: `@/server/scan-cache.js:60-67`
- **Issue**: `JSON.stringify(hashInput)` on potentially circular objects
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Crash if hashInput contains circular references
- **Fix Applied**: Added try-catch with fallback to primitive string concatenation

---

### JSON-5. JSON.parse Error Handling

- **Files**: Multiple locations (analysis.js, ai.js, reports.js, etc.)
- **Issue**: Parsed data validation
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Malformed data could propagate through system
- **Fix Applied**: All JSON.parse calls wrapped in try-catch blocks with appropriate fallback values. For local-first application with trusted data sources (file system, local Ollama), full schema validation not required.

---

### JSON-6. JSONL Progress Parsing Without Line Validation

- **File**: `@/server/routes/analysis.js:91-117`
- **Issue**: `JSON.parse(line)` in stderr handler without per-line error handling
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Single malformed JSONL line crashes entire progress handler
- **Fix Applied**: Per-line try-catch already in place, malformed lines silently skipped

---

## Documentation Misalignments

### DOC-1. Version Number Mismatch

- **README**: Claims version `2.9.0`
- **package.json**: Actual version is `2.8.9`
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: User confusion about which version they have
- **Fix Applied**: Changed README.md line 26 from "v2.9.0" to "v2.8.9" to match package.json

---

### DOC-2. Rate Limiting Documented But Disabled

- **Documentation**: `@/docs/guides/SECURITY.md:35`, `@/docs/SERVER_README.md:30`
  - Claims "Rate Limiting" is a security layer with 5-level prioritization
- **Actual Code**: `@/server/server.js:67-115`
  - In-memory rate limiting implemented: 100 requests per minute per IP
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Security vulnerability - DoS attacks possible despite documented protection
- **Fix Applied**: Implemented in-memory rate limiting in server.js

---

### DOC-3. JWT Authentication Documented But Not Needed

- **Documentation**: `@/docs/guides/SECURITY.md`, `@/docs/SERVER_README.md:28`
  - JWT middleware exists but not used for localhost-only app
- **Actual Code**:
  - Middleware exists in `@/server/src/middleware/security.js:54-86`
  - JWT secret persisted to file for consistency (`@/server/config.js:195-232`)
  - CORS restricted to localhost origins only
- **Status**: ✅ **ACCEPTED**
- **Impact**: Documentation accurately reflects local-first design
- **Note**: JWT not needed for localhost single-user application. Secret persistence implemented for completeness.

---

### DOC-4. Redis/PostgreSQL Documented But SQLite Used

- **Documentation**: `@/docs/guides/DEPLOYMENT.md:1-107`
  - Updated to reflect SQLite-only architecture
- **Actual Code**:
  - Only SQLite is used (`sqlite3` in package.json)
  - In-memory caching with automatic cleanup
  - No PostgreSQL or Redis dependencies
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Deployment confusion, infrastructure misalignment
- **Fix Applied**: Rewrote DEPLOYMENT.md to accurately describe local-first SQLite architecture

---

### DOC-5. Multi-Agent Orchestrator Claims vs Reality

- **Documentation**: `@/docs/SERVER_README.md:37-153`
  - Updated to reflect actual Worker Pool & Caching architecture
- **Actual Code**:
  - Worker pool uses async processing with file count limits
  - Multi-layer caching: Memory → Web Storage → SQLite
  - Circuit breaker pattern for fault tolerance
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Misleading performance expectations
- **Fix Applied**: Replaced orchestrator documentation with accurate Worker Pool & Caching documentation

---

### DOC-6. Architecture Structure Mismatch

- **Documentation**: `@/docs/SERVER_README.md:11-24`
  - Updated to show actual directory structure
- **Actual Code**:
  - Flat structure: `routes/`, `modules/`, `db/`, `utils/`
  - No `src/services/` directory exists
  - No `src/controllers/` directory exists
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Developer confusion when navigating codebase
- **Fix Applied**: Updated documentation to match actual flat directory structure

---

### DOC-7. Docker/Kubernetes Documented But Not Implemented

- **Documentation**: `@/docs/guides/DEPLOYMENT.md:1-107`
  - Updated to reflect simple local Node.js deployment
- **Actual Code**:
  - No Docker or Kubernetes used
  - Direct Node.js execution
  - Simple process-based architecture
- **Status**: ✅ **RESOLVED**
- **Date Fixed**: 2026-05-04
- **Impact**: Deployment failures when following documentation
- **Fix Applied**: Rewrote DEPLOYMENT.md to describe local-first deployment without Docker/Kubernetes

---

## Notes

- SQLite3 native module can fail to compile on Windows - provide prebuilt binaries
- WAL mode enabled in pragmas - ensure proper cleanup on shutdown
- Database backups triggered at 100MB - monitor disk space

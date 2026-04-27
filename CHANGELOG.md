# Changelog

All notable changes to Space Analyzer will be documented in this file.

## Version Timeline

| Version | Date | Summary |
|---------|------|---------|
| 2.1.4 | 2026-04-27 | Remove React plugins from ESLint config |
| 2.1.3 | 2026-04-27 | Native scanner integration fixes |
| 2.1.2 | 2026-04-27 | Port centralization and dependency cleanup |
| 2.1.1 | 2026-04-27 | Configuration fixes, performance dependencies, Vue migration cleanup |
| 2.1.0 | 2026-04-27 | Vue 3 migration with enhanced performance dependencies |
| 2.0.1 | Previous | AI-Powered Space Analyzer with Vision Analysis and Feature Hub |

---

## [2.1.4] - 2026-04-27

### ESLint Configuration

#### eslint.config.js
- Removed React plugin imports: `react-hooks`, `react-refresh`
- Removed React-specific rules configuration
- Moved common TypeScript rules to shared configuration
- Updated test file patterns from `.tsx` to `.js` extensions
- ESLint now configured for Vue 3 only

### Benefits

- **Cleaner configuration**: No unused React plugins
- **Faster linting**: Fewer plugins to load
- **Accurate linting**: Rules match actual Vue codebase

### Breaking Changes

None - all changes are internal improvements

### Migration Notes

No migration required. All changes are internal improvements.

---

## [2.1.3] - 2026-04-27

### Native Scanner Integration

#### polyglot-scanner.js
- **Rust Scanner Loading**
  - Changed from requiring `.node` file directly to using proper `index.js` loader
  - Updated path resolution to use `path.join(__dirname, '../src/rust/simple-scanner')`
  - Added debug logging for loaded exports and path
  - Fixed API call to use `nativeScanner.scan(path)` instead of `scanDirectorySimple`
  - Removed options object from scan call (Rust scanner only accepts path string)
  - Updated result mapping to match Rust scanner interface
  - Changed `getSystemInfo()` to use `getMetrics()` method

- **C++ Scanner Loading**
  - Changed from requiring `.node` file directly to using proper `index.js` loader
  - Updated path resolution to use `path.join(__dirname, '../src/cpp/native-scanner')`
  - Added debug logging for loaded exports and path
  - Removed duplicate loading code

#### Testing Results
- Rust scanner loads successfully from `scanner.node`
- Scan test: successfully scanned 3,508 files in 50ms
- Returns proper file information with categories and extensions
- Interface: `scan(path)` accepts only path string
- Returns: `{ files, categories, extension_stats, total_files, total_size, scan_time }`

### Benefits

- **Proper module loading**: Uses index.js loaders with fallback paths
- **Correct API usage**: Matches Rust scanner interface exactly
- **Better debugging**: Added logging for loaded paths and exports
- **Functional native scanner**: Rust scanner now properly integrated

### Breaking Changes

None - all changes are internal improvements

### Migration Notes

No migration required. All changes are internal improvements.

---

## [2.1.2] - 2026-04-27

### Port Configuration

#### New File: ports.config.js
- Created centralized port configuration file
- Added validation to prevent duplicate ports
- Documented port ranges and purposes
- Added utility functions for port management

#### Port Assignments
- Vite Dev Server: 3001
- Vite Preview Server: 3002
- Backend API: 8080
- Python AI Service: 8084
- Ollama: 11434
- PostgreSQL: 5432
- Redis: 6379

#### Configuration Updates
- **vite.config.ts** - Import and use centralized ports for dev and preview servers
- **playwright.config.ts** - Import and use centralized port for baseURL, added environment-based headless mode
- **server/src/config/index.js** - Import and use centralized API server port
- **server/python-ai-service/ai_service.py** - Import and use centralized Python AI service port

#### Documentation
- Added port configuration table to README.md
- Explained how to change ports in one place

### Dependency Cleanup

#### package.json
- Removed React dependencies: `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@tanstack/react-virtual`, `cmdk`, `framer-motion`, `lucide-react`, `react`, `react-dom`, `react-error-boundary`, `react-force-graph-3d`, `recharts`, `zustand`
- Removed React devDependencies: `@testing-library/react`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `babel-plugin-react-compiler`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Regenerated package-lock.json

#### Results
- Removed 119 packages
- Reduced from 782 to 663 total packages
- Project now contains only Vue 3 dependencies
- No vulnerabilities found

### Benefits

- **Consistent port management**: All services reference the same port configuration
- **Easy port changes**: Update ports in one place (`ports.config.js`)
- **Prevents conflicts**: Built-in validation for duplicate ports
- **Smaller dependency tree**: Removed unused React packages
- **Faster installs**: Fewer packages to download and install
- **Cleaner codebase**: Only Vue 3 dependencies remain

### Breaking Changes

None - all changes are backward compatible

### Migration Notes

No migration required. All changes are internal improvements.

---

## [2.1.1] - 2026-04-27

### Configuration Fixes

#### vite.config.ts
- Removed React-specific dependencies from `optimizeDeps.include` (lucide-react, framer-motion, cmdk, recharts)
- Added Vue equivalent (lucide-vue-next) to dependency optimization
- Updated `manualChunks` to chunk Vue libraries instead of React libraries
- Removed conditional framework loading - now directly loads Vue plugin
- Removed unused React configuration

#### tsconfig.json
- Removed `"jsx": "react-jsx"` setting (Vue doesn't use JSX)
- Removed React types (`react`, `react-dom`) from types array
- Enabled `"strict": true` for better type safety
- Enabled type-checking options: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitThis`, `noImplicitAny`
- Removed invalid `ignoreDeprecations: "6.0"` setting

#### tsconfig.app.json
- Fixed include path from `src/main.tsx` to `src/main.ts` (Vue entry point)

#### index.html
- Removed unused `#root` div (React mount point)
- Kept only `#app` div (Vue mount point)

### Dependency Updates

#### server/package.json
- Updated sqlite3 from `^5.1.7` to `^6.0.1` to match latest version

#### Root Directory
- Deleted `sqlite3-6.0.1.tgz` (3MB cached package - no longer needed)

### New Dependencies Added

#### High-Priority Performance Packages
- **fast-glob** - High-performance file pattern matching for faster directory scanning
- **file-type** - Accurate file type detection from magic numbers (not just extensions)
- **diskusage** - Cross-platform disk space analysis
- **filesize** - Standardized byte formatting

### Code Updates

#### server/modules/file-utils.js
- Integrated fast-glob for efficient file scanning with pattern-based exclusion
- Added `getFileType()` function for magic number-based file type detection
- Added `getDiskUsage()` function for real disk space analysis
- Added `formatBytes()` function using filesize package
- Implemented manual fallback for compatibility if fast-glob fails

#### server/backend-server.js
- Added diskusage and filesize imports
- Updated `/api/system/metrics` endpoint to use real disk space data via diskusage.check()
- Made endpoint async to support disk usage checking
- Maintained fallback to memory-based estimates if disk usage check fails

#### server/OllamaService.js
- Added filesize import
- Replaced custom `formatFileSize()` implementation with filesize package

#### server/ai-integrated-scanner.js
- Added filesize import
- Replaced custom `formatFileSize()` implementation with filesize package

#### server/temp/ai-integrated-scanner.js
- Added filesize import
- Replaced custom `formatFileSize()` implementation with filesize package

### Benefits

- **Faster file scanning**: fast-glob provides pattern-based exclusion and better performance
- **Accurate file detection**: file-type uses magic numbers instead of relying on extensions
- **Real disk metrics**: diskusage provides actual disk space information instead of memory estimates
- **Consistent formatting**: filesize package ensures standardized byte formatting across all services
- **Better type safety**: TypeScript strict mode enabled for catching more errors
- **Cleaner configuration**: Removed unused React/Vue mixed framework setup
- **Updated dependencies**: sqlite3 updated to latest version for security and performance

### Breaking Changes

None - all changes are backward compatible

### Migration Notes

No migration required. All changes are internal improvements.

---

## [2.1.0] - Previous Release

Initial release with AI-powered space analysis and feature hub.

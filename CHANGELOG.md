# Changelog

All notable changes to Space Analyzer will be documented in this file.

## Version Timeline

| Version | Date | Summary |
|---------|------|---------|
| 2.1.1 | 2026-04-27 | Configuration fixes, performance dependencies, Vue migration cleanup |
| 2.1.0 | 2026-04-27 | Vue 3 migration with enhanced performance dependencies |
| 2.0.1 | Previous | AI-Powered Space Analyzer with Vision Analysis and Feature Hub |

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

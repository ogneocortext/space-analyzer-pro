# File and Directory Naming Convention

## Overview
This document defines the consistent naming convention for all files and directories in the Space Analyzer project.

## General Principles
1. **Consistency**: All files and directories follow the same naming pattern
2. **Clarity**: Names should clearly indicate the purpose/content of the file
3. **Portability**: Names should work across different operating systems
4. **Scalability**: Names should not conflict with future additions

## Naming Conventions

### Directories and Folders
- **Pattern**: `kebab-case` (lowercase with hyphens)
- **Examples**: 
  - `src/gui` ✅
  - `src/web` ✅
  - `blender-scripts` ✅ (instead of `blender_scripts`)

### Files
- **Pattern**: `kebab-case` with file extension
- **Examples**:
  - `enhanced-mobile-responsive.css` ✅ (instead of `enhanced-mobile-responsive.css`)
  - `analyze-frontend.js` ✅ (instead of `analyze_frontend.js`)
  - `project-link-hub.html` ✅

### JavaScript Files
- **Pattern**: `feature-name.js` or `feature-name.module.js`
- **Examples**:
  - `analyze-frontend.js` ✅
  - `space-analyzer-core.js` ✅
  - `blender-script-generator.js` ✅

### CSS Files
- **Pattern**: `component-name.css` or `page-name.css`
- **Examples**:
  - `enhanced-mobile-responsive.css` ✅
  - `main-interface.css` ✅

### HTML Files
- **Pattern**: `page-name.html` or `component-name.html`
- **Examples**:
  - `index.html` ✅ (main exception for standard web files)
  - `project-link-hub.html` ✅
  - `music-video-studio.html` ✅

### C++ Files
- **Pattern**: `component-name.cpp` and `component-name.h`
- **Examples**:
  - `space-analyzer-gui.cpp` ✅
  - `space-analyzer-gui.h` ✅

### Configuration Files
- **Pattern**: Keep original names for build system compatibility
- **Examples**:
  - `CMakeLists.txt` ✅ (keep as-is for CMake compatibility)
  - `package.json` ✅ (keep as-is for Node.js)

### Build System Files
- **Pattern**: Keep original names for compatibility
- **Examples**:
  - `.vcxproj` files ✅ (keep as-is for Visual Studio)
  - `.slnx` files ✅ (keep as-is for Visual Studio)

## File Type Categories

### Application Core
- `space-analyzer-core.h` ✅
- `space-analyzer-core.cpp` ✅

### User Interface
- `main-interface.css` ✅
- `main-interface.html` ✅
- `mobile-responsive.css` ✅

### Features
- `analyze-frontend.js` ✅
- `music-video-studio.js` ✅
- `blender-script-generator.js` ✅

### Tests
- `e2e-test.js` ✅
- `unit-test.js` ✅
- `integration-test.js` ✅

### Assets
- `logo.png` ✅
- `icon-16x16.png` ✅
- `background-image.jpg` ✅

## Migration Strategy

### Phase 1: Documentation
- Create this naming convention document
- Identify all files that need renaming

### Phase 2: Systematic Renaming
- Rename files directory by directory
- Update all internal references
- Update build configurations if necessary

### Phase 3: Verification
- Test that all functionality still works
- Verify build system compatibility
- Update documentation references

## Special Cases

### External Dependencies
- Third-party files keep their original names
- Node.js modules: `node_modules/*`
- Build artifacts: `build/*`, `dist/*`

### Generated Files
- Auto-generated files follow the generator's convention
- Temporary files use temporary naming

### Legacy Compatibility
- Some files may need to maintain dual names during transition
- Create symbolic links if necessary for backward compatibility

## Implementation Checklist

- [ ] Review all files against this convention
- [ ] Create rename mapping for systematic changes
- [ ] Execute file renames in logical groups
- [ ] Update import/require statements
- [ ] Update build configurations
- [ ] Update documentation references
- [ ] Test all functionality
- [ ] Clean up temporary files

## Benefits

1. **Improved Developer Experience**: Consistent naming makes navigation easier
2. **Better Tool Integration**: IDEs and build tools work better with consistent naming
3. **Reduced Cognitive Load**: Developers don't need to remember different naming patterns
4. **Professional Appearance**: Consistent naming looks more professional
5. **Easier Maintenance**: Future developers can understand the structure quickly
const { existsSync } = require('fs');
const { join } = require('path');

// Determine the correct native module path based on platform
const platform = process.platform;
const arch = process.arch;

// Try multiple possible locations for the native module
const possiblePaths = [
  // Current directory (where this file is)
  join(__dirname, 'scanner.node'),
  // Target release directory
  join(__dirname, 'target', 'release', 'scanner.node'),
  // Target debug directory
  join(__dirname, 'target', 'debug', 'scanner.node'),
  // NAPI output directory
  join(__dirname, 'scanner.node'),
];

let nativeModule;
let loadedPath = null;

for (const path of possiblePaths) {
  if (existsSync(path)) {
    try {
      nativeModule = require(path);
      loadedPath = path;
      break;
    } catch (err) {
      console.warn(`Failed to load from ${path}:`, err.message);
    }
  }
}

if (!nativeModule) {
  throw new Error(
    `Native scanner module not found for ${platform}-${arch}.\n` +
    `Please build with one of the following:\n` +
    `  npm run build           # Build with napi-rs\n` +
    `  npm run build:native    # Build with cargo\n` +
    `  npm run build:full      # Build both\n\n` +
    `Searched paths:\n${possiblePaths.map(p => `  ${p}`).join('\n')}`
  );
}

// Export all native functions
module.exports = {
  // NativeScanner class
  NativeScanner: nativeModule.NativeScanner,
  
  // Helper function for quick scanning
  scan: (path, options) => {
    const scanner = new nativeModule.NativeScanner();
    return scanner.scan(path, options);
  },
  
  // Categorize a single file
  categorizeFile: (filename) => {
    const scanner = new nativeModule.NativeScanner();
    return scanner.categorizeFile(filename);
  },
  
  // Get scanner metrics
  getMetrics: () => {
    const scanner = new nativeModule.NativeScanner();
    return scanner.getMetrics();
  },
  
  // Internal: loaded module path for debugging
  _loadedPath: loadedPath
};

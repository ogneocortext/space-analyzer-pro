const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

// Try to load the native module
const bindingPath = join(__dirname, 'build', 'Release', 'native_scanner.node');
const bindingDebugPath = join(__dirname, 'build', 'Debug', 'native_scanner.node');

let nativeModule;

if (existsSync(bindingPath)) {
  nativeModule = require(bindingPath);
} else if (existsSync(bindingDebugPath)) {
  nativeModule = require(bindingDebugPath);
} else {
  throw new Error(
    `Native scanner module not found. Please build with:\n` +
    `  npx node-gyp rebuild --release\n` +
    `Searched paths:\n` +
    `  ${bindingPath}\n` +
    `  ${bindingDebugPath}`
  );
}

// Export the scanDirectory function
module.exports = {
  scanDirectory: nativeModule.scanDirectory,
  // Helper function for async scanning
  scanDirectoryAsync: (path, maxFiles) => {
    return new Promise((resolve, reject) => {
      try {
        const result = nativeModule.scanDirectory(path, maxFiles);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }
};

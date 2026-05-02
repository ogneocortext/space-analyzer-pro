/**
 * Install Hook - Application Initialization
 * Initializes the Vue app and AnalysisBridge system
 */

console.log("[INFO] 🔗 AnalysisBridge using Vite proxy (relative paths)");
console.log("Starting Vue app...");

// Export for use in main.ts
export function initializeApp() {
  // This function can be called from main.ts to ensure proper initialization
  console.log("[INFO] Install hook initialized");
}

// Auto-initialize if this script is loaded directly
if (typeof window !== 'undefined') {
  // Set up global error handling for install hook
  window.addEventListener('error', (event) => {
    if (event.filename && event.filename.includes('installHook.js')) {
      console.error('[ERROR] Install hook error:', event.error);
    }
  });

  console.log("[INFO] Install hook loaded successfully");
}

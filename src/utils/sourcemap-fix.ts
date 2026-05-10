/**
 * Source Map Fix for Lucide Vue Zodiac Icons
 * Handles missing source map files gracefully
 */

// Suppress source map errors for zodiac icons
export function suppressSourcemapErrors() {
  const originalConsoleError = console.error;
  
  console.error = (...args) => {
    const message = args.join(' ');
    
    // Filter out zodiac icon source map errors
    if (message.includes('zodiac-') && 
        (message.includes('.js.map') || message.includes('Failed to load source map'))) {
      return; // Suppress these specific errors
    }
    
    // Call original console.error for other messages
    originalConsoleError.apply(console, args);
  };
  
  // Also handle unhandled promise rejections related to source maps
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && 
        typeof event.reason === 'object' && 
        event.reason.message && 
        event.reason.message.includes('zodiac-') &&
        event.reason.message.includes('.map')) {
      event.preventDefault(); // Prevent the error from showing
    }
  });
}

// Initialize the fix when the module loads
if (typeof window !== 'undefined') {
  suppressSourcemapErrors();
}
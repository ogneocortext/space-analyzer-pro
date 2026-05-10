/**
 * Deferred Initialization Utilities
 * Offloads non-critical work to idle periods for faster app startup
 */

/**
 * Execute a function during browser idle time, or after a delay if idle callback is not available
 */
export function runWhenIdle(fn: () => void, timeout: number = 2000): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(fn, { timeout });
  } else {
    // Fallback: execute after a short delay using setTimeout
    setTimeout(fn, timeout);
  }
}

/**
 * Execute a function after the page has fully loaded
 */
export function runAfterLoad(fn: () => void): void {
  if (document.readyState === 'complete') {
    fn();
  } else {
    window.addEventListener('load', fn, { once: true });
  }
}
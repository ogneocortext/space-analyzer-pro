/**
 * Utility functions for Tauri detection and HTTP request handling
 */

// Check if running in Tauri desktop mode
export const isTauri = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    console.warn('🖥️ Tauri mode detected');
    return true;
  }
  return false;
};

// Safe fetch function that skips HTTP requests in Tauri mode
export const safeFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  if (isTauri()) {
    console.warn(`🖥️ Skipping HTTP request in Tauri mode: ${url}`);
    throw new Error('HTTP requests not supported in Tauri desktop mode');
  }
  
  return fetch(url, options);
};

// Safe fetch with JSON parsing
export const safeFetchJSON = async (url: string, options?: RequestInit): Promise<any> => {
  const response = await safeFetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// Log message for Tauri mode
export const logTauriMode = (operation: string): void => {
  console.warn(`🖥️ Tauri mode - ${operation}`);
};

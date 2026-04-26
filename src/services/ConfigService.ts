
/**
 * Configuration Service
 * Centralizes API endpoints and ports
 */

export const ConfigService = {
  // Base URL for API calls
  // In development, Vite proxy handles /api -> localhost:8081
  // In production, it expects the backend to serve the frontend
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',

  // Explicit ports if needed for direct connection (e.g. WebSocket)
  PORTS: {
    BACKEND: 8090,
    WEB: 5173,
    OLLAMA: 11434
  },

  // Ollama Configuration
  OLLAMA: {
    BASE_URL: 'http://localhost:11434',
    DEFAULT_MODEL: 'gemma3:latest',
    CODE_MODEL: 'deepseek-coder:6.7b'
  },

  // Helper to get full URL if needed
  getFullUrl(path: string): string {
    if (path.startsWith('http')) return path;
    const base = this.API_BASE_URL.startsWith('http') 
      ? this.API_BASE_URL 
      : window.location.origin + this.API_BASE_URL;
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }
};

export default ConfigService;

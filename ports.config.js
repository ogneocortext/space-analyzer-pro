/**
 * Centralized Port Configuration
 * 
 * This file defines all port numbers used across the project to prevent
 * port conflicts and ensure consistency between development, testing, and
 * production environments.
 * 
 * Port Ranges:
 * - 3000-3099: Frontend development servers
 * - 8000-8099: Backend API servers
 * - 11400-11499: AI/ML services (Ollama, etc.)
 * - 5432: PostgreSQL (default)
 * - 6379: Redis (default)
 */

module.exports = {
  // Frontend Development
  VITE_DEV_PORT: 3001,           // Vite development server
  VITE_PREVIEW_PORT: 3002,       // Vite preview server (production build)
  
  // Backend API
  API_SERVER_PORT: 8080,         // Express backend server
  PYTHON_AI_PORT: 8084,          // Python AI service
  
  // AI/ML Services
  OLLAMA_PORT: 11434,            // Ollama AI service
  
  // External Services (defaults)
  POSTGRES_PORT: 5432,           // PostgreSQL database
  REDIS_PORT: 6379,              // Redis cache
  
  // Testing
  PLAYWRIGHT_BASE_URL: `http://localhost:3001`, // Should match VITE_DEV_PORT
  
  // Production
  PRODUCTION_HTTP_PORT: 80,      // HTTP
  PRODUCTION_HTTPS_PORT: 443,    // HTTPS
  
  // Utility function to get port by name
  getPort(name) {
    return this[name];
  },
  
  // Validate no port conflicts
  validate() {
    const ports = Object.values(this).filter(v => typeof v === 'number');
    const uniquePorts = new Set(ports);
    if (ports.length !== uniquePorts.size) {
      throw new Error('Port conflict detected: Duplicate port numbers in configuration');
    }
    return true;
  }
};

// Validate on load
try {
  module.exports.validate();
} catch (error) {
  console.error('Port configuration error:', error.message);
}

/**
 * Dynamic Port Manager
 * Handles dynamic port detection and assignment for frontend and backend services
 */

class DynamicPortManager {
  private static instance: DynamicPortManager;
  private portCache: Map<string, number> = new Map();
  private readonly portRanges = {
    frontend: { min: 5170, max: 5200 },
    backend: { min: 8080, max: 8100 },
    api: { min: 8080, max: 8100 }
  };

  private constructor() {}

  static getInstance(): DynamicPortManager {
    if (!DynamicPortManager.instance) {
      DynamicPortManager.instance = new DynamicPortManager();
    }
    return DynamicPortManager.instance;
  }

  /**
   * Get the current API server URL dynamically
   */
  async getApiServerUrl(): Promise<string> {
    const port = await this.getAvailablePort('api');
    return `http://localhost:${port}`;
  }

  /**
   * Get the current API server port dynamically
   */
  async getApiServerPort(): Promise<number> {
    return await this.getAvailablePort('api');
  }

  /**
   * Get the current frontend server URL dynamically
   */
  async getFrontendServerUrl(): Promise<string> {
    const port = await this.getAvailablePort('frontend');
    return `http://localhost:${port}`;
  }

  /**
   * Find an available port in the specified range
   */
  async getAvailablePort(serviceType: 'frontend' | 'backend' | 'api'): Promise<number> {
    const cachedPort = this.portCache.get(serviceType);
    if (cachedPort && await this.isPortAvailable(cachedPort)) {
      return cachedPort;
    }

    const range = this.portRanges[serviceType];
    const startPort = serviceType === 'api' ? 8085 : range.min;
    
    for (let port = startPort; port <= range.max; port++) {
      if (await this.isPortAvailable(port)) {
        this.portCache.set(serviceType, port);
        return port;
      }
    }

    throw new Error(`No available ports found for ${serviceType} service in range ${range.min}-${range.max}`);
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    try {
      if (typeof window !== 'undefined') {
        // Browser environment - can't directly check ports, use heuristic
        return true;
      }

      // Node.js environment
      const net = await import('net');
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close(() => resolve(true));
        });
        server.on('error', () => resolve(false));
      });
    } catch (error) {
      console.warn(`Error checking port ${port}:`, error);
      return false;
    }
  }

  /**
   * Get backend URLs with fallback ports
   */
  async getBackendUrls(): Promise<string[]> {
    const basePort = await this.getApiServerPort();
    const urls = [`http://localhost:${basePort}`];
    
    // Add common fallback ports
    const fallbackPorts = [8080, 8081, 8082, 8083, 8084, 3000, 5000, 8000];
    for (const port of fallbackPorts) {
      if (port !== basePort && await this.isPortAvailable(port)) {
        urls.push(`http://localhost:${port}`);
      }
    }
    
    return urls;
  }

  /**
   * Get WebSocket URL for real-time services
   */
  async getWebSocketUrl(): Promise<string> {
    const port = await this.getApiServerPort();
    return `ws://localhost:${port}`;
  }

  /**
   * Clear port cache (useful for testing or reinitialization)
   */
  clearCache(): void {
    this.portCache.clear();
  }

  /**
   * Set a specific port (useful when server reports its port)
   */
  setPort(serviceType: 'frontend' | 'backend' | 'api', port: number): void {
    this.portCache.set(serviceType, port);
  }
}

// Export singleton instance
export const dynamicPortManager = DynamicPortManager.getInstance();

// Export convenience functions
export const getApiUrl = () => dynamicPortManager.getApiServerUrl();
export const getApiPort = () => dynamicPortManager.getApiServerPort();
export const getBackendUrls = () => dynamicPortManager.getBackendUrls();
export const getWebSocketUrl = () => dynamicPortManager.getWebSocketUrl();
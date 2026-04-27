/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

/**
 * PortDetector - Dynamic port detection system for Space Analyzer Pro
 * Automatically detects running servers and manages port configurations
 */

export interface ServerInfo {
  port: number;
  protocol: "http" | "https";
  service: "frontend" | "backend" | "api" | "unknown";
  status: "running" | "available" | "unavailable";
  responseTime: number;
  lastChecked: number;
}

export interface PortConfiguration {
  frontend: number;
  backend: number;
  api: number;
  detected: boolean;
  timestamp: number;
}

export class PortDetector {
  private static instance: PortDetector;
  private serverCache: Map<number, ServerInfo> = new Map();
  private config: PortConfiguration;
  private detectionHistory: ServerInfo[] = [];
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly DETECTION_TIMEOUT = 5000; // 5 seconds

  private constructor() {
    this.config = {
      frontend: 3001,
      backend: 8080, // Updated to match enhanced backend port
      api: 8080, // Updated to match enhanced backend port
      detected: false,
      timestamp: 0,
    };
  }

  public static getInstance(): PortDetector {
    if (!PortDetector.instance) {
      PortDetector.instance = new PortDetector();
    }
    return PortDetector.instance;
  }

  /**
   * Detect all running servers and update configuration
   */
  public async detectAllServers(): Promise<PortConfiguration> {
    console.warn("🔍 Starting comprehensive server detection...");

    const startTime = Date.now();
    const commonPorts = {
      frontend: [3001, 3000, 5173, 5176, 8080, 8000, 4200, 9000],
      backend: [8080, 8081, 8092, 3001, 5000, 8001, 9001, 3000], // Put 8080 first since that's our configured port
      api: [8080, 8081, 8092, 3001, 5000, 8001, 9001, 3000], // Put 8080 first since that's our configured port
    };

    // Detect frontend servers
    const frontendResult = await this.detectFrontendServer(commonPorts.frontend);
    if (frontendResult) {
      this.config.frontend = frontendResult.port;
      console.warn(`✅ Frontend server detected on port ${frontendResult.port}`);
    } else {
      console.warn("⚠️ No frontend server detected, using default port 5176");
    }

    // Detect backend servers
    const backendResult = await this.detectBackendServer(commonPorts.backend);
    if (backendResult) {
      this.config.backend = backendResult.port;
      this.config.api = backendResult.port; // API usually runs on same port as backend
      console.warn(`✅ Backend server detected on port ${backendResult.port}`);
    } else {
      console.warn("⚠️ No backend server detected, using default port 8081");
    }

    this.config.detected = true;
    this.config.timestamp = Date.now();

    const detectionTime = Date.now() - startTime;
    console.warn(`🎯 Server detection completed in ${detectionTime}ms`);
    console.warn(
      `📊 Configuration: Frontend=${this.config.frontend}, Backend=${this.config.backend}, API=${this.config.api}`
    );

    return { ...this.config };
  }

  /**
   * Detect frontend server (Vite, Create React App, etc.)
   */
  private async detectFrontendServer(ports: number[]): Promise<ServerInfo | null> {
    for (const port of ports) {
      try {
        const result = await this.checkServer(port, "frontend");
        if (result.status === "running") {
          return result;
        }
      } catch (error) {
        // Continue to next port
      }
    }
    return null;
  }

  /**
   * Detect backend server (Node.js, Express, etc.)
   */
  private async detectBackendServer(ports: number[]): Promise<ServerInfo | null> {
    // First try health check endpoints
    for (const port of ports) {
      try {
        const result = await this.checkHealthEndpoint(port);
        if (result.status === "running") {
          return result;
        }
      } catch (error) {
        // Continue to next port
      }
    }

    // If no health endpoints, try common API endpoints
    for (const port of ports) {
      try {
        const result = await this.checkApiEndpoint(port);
        if (result.status === "running") {
          return result;
        }
      } catch (error) {
        // Continue to next port
      }
    }

    return null;
  }

  /**
   * Check server with health endpoint
   */
  private async checkHealthEndpoint(port: number): Promise<ServerInfo> {
    return this.checkServer(port, "backend", "/api/health");
  }

  /**
   * Check server with API endpoint
   */
  private async checkApiEndpoint(port: number): Promise<ServerInfo> {
    return this.checkServer(port, "api", "/api/health");
  }

  /**
   * Generic server check with timeout and caching
   */
  private async checkServer(
    port: number,
    service: ServerInfo["service"],
    endpoint: string = "/"
  ): Promise<ServerInfo> {
    const cacheKey = port;
    const cached = this.serverCache.get(cacheKey);

    // Check cache
    if (cached && Date.now() - cached.lastChecked < this.CACHE_TTL) {
      return cached;
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.DETECTION_TIMEOUT);

      const response = await fetch(`http://localhost:${port}${endpoint}`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const serverInfo: ServerInfo = {
        port,
        protocol: "http",
        service,
        status: response.ok ? "running" : "unavailable",
        responseTime,
        lastChecked: Date.now(),
      };

      this.serverCache.set(cacheKey, serverInfo);
      this.detectionHistory.push(serverInfo);

      return serverInfo;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const serverInfo: ServerInfo = {
        port,
        protocol: "http",
        service,
        status: "unavailable",
        responseTime,
        lastChecked: Date.now(),
      };

      this.serverCache.set(cacheKey, serverInfo);
      this.detectionHistory.push(serverInfo);

      return serverInfo;
    }
  }

  /**
   * Get current port configuration
   */
  public getConfiguration(): PortConfiguration {
    return { ...this.config };
  }

  /**
   * Get specific port for a service
   */
  public getPort(service: "frontend" | "backend" | "api"): number {
    return this.config[service];
  }

  /**
   * Get base URL for a service
   */
  public getBaseUrl(service: "frontend" | "backend" | "api"): string {
    const port = this.getPort(service);
    return `http://localhost:${port}`;
  }

  /**
   * Get API base URL (includes /api path for backend)
   */
  public getApiBaseUrl(): string {
    const port = this.getPort("api");
    return `http://localhost:${port}/api`;
  }

  /**
   * Force refresh server detection
   */
  public async refreshDetection(): Promise<PortConfiguration> {
    console.warn("🔄 Forcing server detection refresh...");
    this.serverCache.clear();
    this.detectionHistory = [];
    return this.detectAllServers();
  }

  /**
   * Check if servers are still running
   */
  public async checkServerStatus(): Promise<{
    frontend: ServerInfo;
    backend: ServerInfo;
    api: ServerInfo;
  }> {
    const frontend = await this.checkServer(this.config.frontend, "frontend");
    const backend = await this.checkServer(this.config.backend, "backend");
    const api = await this.checkServer(this.config.api, "api", "/api/health");

    return { frontend, backend, api };
  }

  /**
   * Get detection history
   */
  public getDetectionHistory(): ServerInfo[] {
    return [...this.detectionHistory];
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.serverCache.clear();
    console.warn("🧹 Port detection cache cleared");
  }

  /**
   * Get server status summary
   */
  public async getStatusSummary(): Promise<{
    detected: boolean;
    frontend: string;
    backend: string;
    api: string;
    lastDetection: number;
    uptime: number;
  }> {
    const status = await this.checkServerStatus();

    return {
      detected: this.config.detected,
      frontend: status.frontend.status,
      backend: status.backend.status,
      api: status.api.status,
      lastDetection: this.config.timestamp,
      uptime: Date.now() - this.config.timestamp,
    };
  }
}

// Export singleton instance
export const portDetector = PortDetector.getInstance();

// Auto-detect on module load (but don't await to avoid blocking)
portDetector.detectAllServers().catch((error) => {
  console.warn("⚠️ Initial port detection failed:", error.message);
});

// Export for direct use
export default PortDetector;

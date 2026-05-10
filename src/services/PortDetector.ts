/* eslint-disable @typescript-eslint/no-unused-vars */

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
      backend: 0, // Will be dynamically detected
      api: 0, // Will be dynamically detected
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
    // Use dynamic port ranges instead of hardcoded lists
    const portRanges = {
      frontend: { min: 5170, max: 5200 },
      backend: { min: 8080, max: 8100 },
      api: { min: 8080, max: 8100 },
    };

    // Detect frontend servers dynamically
    const frontendResult = await this.detectFrontendServerInRange(portRanges.frontend);
    if (frontendResult) {
      this.config.frontend = frontendResult.port;
      console.warn(`✅ Frontend server detected on port ${frontendResult.port}`);
    } else {
      this.config.frontend = 5173; // Vite default
      console.warn("⚠️ No frontend server detected, using default port 5173");
    }

    // Detect backend servers dynamically
    const backendResult = await this.detectBackendServerInRange(portRanges.backend);
    if (backendResult) {
      this.config.backend = backendResult.port;
      this.config.api = backendResult.port; // API usually runs on same port as backend
      console.warn(`✅ Backend server detected on port ${backendResult.port}`);
    } else {
      this.config.backend = await this.findAvailablePort(
        portRanges.backend.min,
        portRanges.backend.max
      );
      this.config.api = this.config.backend;
      console.warn(`⚠️ No backend server detected, found available port ${this.config.backend}`);
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
   * Find an available port in the specified range
   */
  private async findAvailablePort(min: number, max: number): Promise<number> {
    for (let port = min; port <= max; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found in range ${min}-${max}`);
  }

  /**
   * Check if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    try {
      if (typeof window !== "undefined") {
        // Browser environment - can't directly check, assume available
        return true;
      }

      // Node.js environment
      const net = await import("net");
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close(() => resolve(true));
        });
        server.on("error", () => resolve(false));
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect frontend server in port range
   */
  private async detectFrontendServerInRange(range: {
    min: number;
    max: number;
  }): Promise<ServerInfo | null> {
    // Check common frontend ports first
    const commonPorts = [5173, 3000, 3001, 5176];
    for (const port of commonPorts) {
      if (port >= range.min && port <= range.max) {
        const result = await this.checkServer(port, "frontend");
        if (result.status === "running") {
          return result;
        }
      }
    }

    // Check the entire range
    for (let port = range.min; port <= range.max; port++) {
      if (!commonPorts.includes(port)) {
        const result = await this.checkServer(port, "frontend");
        if (result.status === "running") {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Read port from backend port file
   */
  private async readBackendPortFile(): Promise<number | null> {
    try {
      if (typeof window !== "undefined") {
        // Browser environment - fetch port file
        const response = await fetch("/.backend-port");
        if (response.ok) {
          const port = await response.text();
          return parseInt(port.trim());
        }
      } else {
        // Node.js environment - read file directly
        const fs = await import("fs");
        const path = await import("path");
        const portFile = path.join(process.cwd(), ".backend-port");

        if (fs.existsSync(portFile)) {
          const port = fs.readFileSync(portFile, "utf8");
          return parseInt(port.trim());
        }
      }
    } catch (error) {
      // Port file not found or unreadable
    }

    return null;
  }

  /**
   * Detect backend server in port range
   */
  private async detectBackendServerInRange(range: {
    min: number;
    max: number;
  }): Promise<ServerInfo | null> {
    // First try to read from backend port file
    const backendPort = await this.readBackendPortFile();
    if (backendPort) {
      const result = await this.checkHealthEndpoint(backendPort);
      if (result.status === "running") {
        console.log(`✅ Backend server detected from port file: ${backendPort}`);
        return result;
      }
    }

    // Fallback to scanning range
    for (let port = range.min; port <= range.max; port++) {
      const result = await this.checkHealthEndpoint(port);
      if (result.status === "running") {
        return result;
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

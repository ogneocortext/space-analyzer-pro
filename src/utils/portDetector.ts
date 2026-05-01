/**
 * Enhanced Port Detection Service
 * Detects available ports and manages service startup
 */

import { ConfigService } from "../services/ConfigService";

export interface PortInfo {
  port: number;
  isAvailable: boolean;
  serviceName: string;
  url: string;
}

export class PortDetector {
  /**
   * Check if a port is available
   */
  static async checkPort(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      await fetch(`http://localhost:${port}`, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return false; // Port is in use
    } catch (error) {
      return true; // Port is available
    }
  }

  /**
   * Find an available port starting from a base port
   */
  static async findAvailablePort(basePort: number, maxAttempts: number = 10): Promise<number> {
    for (let i = 0; i < maxAttempts; i++) {
      const port = basePort + i;
      if (await this.checkPort(port)) {
        return port;
      }
    }
    throw new Error(`No available port found starting from ${basePort}`);
  }

  /**
   * Get service port information
   */
  static async getServicePorts(): Promise<PortInfo[]> {
    const ports = [
      {
        port: ConfigService.PORTS.WEB,
        serviceName: "Frontend",
        url: `http://localhost:${ConfigService.PORTS.WEB}`,
      },
      {
        port: ConfigService.PORTS.BACKEND,
        serviceName: "Backend",
        url: `http://localhost:${ConfigService.PORTS.BACKEND}`,
      },
      {
        port: ConfigService.PORTS.OLLAMA,
        serviceName: "Ollama",
        url: `http://localhost:${ConfigService.PORTS.OLLAMA}`,
      },
    ];

    const results: PortInfo[] = [];

    for (const portInfo of ports) {
      const isAvailable = await this.checkPort(portInfo.port);
      results.push({
        ...portInfo,
        isAvailable,
      });
    }

    return results;
  }

  /**
   * Get configuration for services
   */
  static async getServicesConfig(): Promise<{
    frontend: { port: number; url: string };
    backend: { port: number; url: string };
    ollama: { port: number; url: string };
  }> {
    const ports = await this.getServicePorts();

    return {
      frontend: {
        port: ports.find((p) => p.serviceName === "Frontend")?.port || ConfigService.PORTS.WEB,
        url: `http://localhost:${ports.find((p) => p.serviceName === "Frontend")?.port || ConfigService.PORTS.WEB}`,
      },
      backend: {
        port: ports.find((p) => p.serviceName === "Backend")?.port || ConfigService.PORTS.BACKEND,
        url: `http://localhost:${ports.find((p) => p.serviceName === "Backend")?.port || ConfigService.PORTS.BACKEND}`,
      },
      ollama: {
        port: ports.find((p) => p.serviceName === "Ollama")?.port || ConfigService.PORTS.OLLAMA,
        url: `http://localhost:${ports.find((p) => p.serviceName === "Ollama")?.port || ConfigService.PORTS.OLLAMA}`,
      },
    };
  }

  /**
   * Check if all required services are running
   */
  static async checkServicesStatus(): Promise<{
    frontend: boolean;
    backend: boolean;
    ollama: boolean;
    allRunning: boolean;
  }> {
    const ports = await this.getServicePorts();

    const status = {
      frontend: !ports.find((p) => p.serviceName === "Frontend")?.isAvailable,
      backend: !ports.find((p) => p.serviceName === "Backend")?.isAvailable,
      ollama: !ports.find((p) => p.serviceName === "Ollama")?.isAvailable,
    };

    return {
      ...status,
      allRunning: status.frontend && status.backend && status.ollama,
    };
  }
}

export default PortDetector;

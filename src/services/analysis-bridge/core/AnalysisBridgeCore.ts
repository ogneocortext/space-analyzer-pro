/**
 * AnalysisBridge Core Module
 * Handles base functionality, configuration, and common utilities
 */

export interface BridgeConfig {
  baseUrl: string;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

export class AnalysisBridgeCore {
  public config: BridgeConfig;

  constructor() {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): BridgeConfig {
    try {
      // Use environment variable for backend API URL if provided
      const backendApiUrl =
        typeof import.meta !== "undefined" ? import.meta.env.VITE_BACKEND_API_URL : undefined;

      let baseUrl: string;
      
      if (backendApiUrl) {
        baseUrl = backendApiUrl;
        this.log("info", `🔗 AnalysisBridge initialized with env var baseUrl: ${baseUrl}`);
      } else if (typeof window !== "undefined") {
        // Try multiple backend ports - backend runs on 8081, not Vite's port
        const ports = [8081, 8080, 3000, 5000, 8000];
        const origin = window.location.origin;
        const isDev = origin.includes("localhost") || origin.includes("127.0.0.1");

        if (isDev) {
          // In dev, use the Vite proxy (relative paths)
          baseUrl = "";
          this.log("info", `🔗 AnalysisBridge using Vite proxy (relative paths)`);
        } else {
          // Production - use same origin
          baseUrl = origin;
          this.log("info", `🔗 AnalysisBridge initialized with prod baseUrl: ${baseUrl}`);
        }
      } else {
        // Server-side - require BACKEND_API_URL environment variable in production
        const serverBackendUrl = process.env.BACKEND_API_URL;
        if (!serverBackendUrl) {
          throw new Error(
            "BACKEND_API_URL environment variable is required for server-side operation"
          );
        }
        baseUrl = serverBackendUrl;
        this.log("info", `🔗 AnalysisBridge initialized with server baseUrl: ${baseUrl}`);
      }
      } catch (error) {
        this.log("error", "Failed to initialize baseUrl", error);
        throw new Error(
          `Failed to initialize AnalysisBridge: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      return {
        baseUrl,
        defaultTimeout: 120000, // 2 minutes
        maxRetries: 3,
        retryDelay: 1000, // 1 second
      };
    }
  }

  /**
   * Enhanced fetch with retry logic and timeout
   */
  async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    timeout: number = this.config.defaultTimeout,
    maxRetries: number = this.config.maxRetries
  ): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown fetch error');
        this.log("warn", `Fetch attempt ${attempt}/${maxRetries} failed:`, lastError);
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempt - 1))
        );
      }
    }
    
    throw lastError!;
  }

  /**
   * Enhanced logging method
   */
  private log(level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const isProduction = typeof import.meta !== "undefined" && import.meta.env.PROD;
    const currentLevel = isProduction ? levels.warn : levels.debug;

    if (levels[level] >= currentLevel) {
      const timestamp = new Date().toISOString();
      const logEntry = { timestamp, level, message, data: args };
      
      if (typeof window !== "undefined") {
        (window as any).__bridgeLogs = (window as any).__bridgeLogs || [];
        (window as any).__bridgeLogs.push(logEntry);
      }

      console[level](`[AnalysisBridge] ${message}`, ...args);
    }
  }

  /**
   * Health check to verify backend is reachable
   */
  async checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      const healthUrl = `${this.config.baseUrl}/api/health`;
      console.log("🔍 Checking backend health at:", healthUrl);
      
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      console.log("📡 Health check response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Backend health check successful:", data);
        
        // Clear any stale analysis state when backend becomes available
        if (typeof window !== "undefined" && (window as any).__currentAnalysisId) {
          console.log("🧹 Clearing stale analysis ID after backend reconnection");
          (window as any).__currentAnalysisId = null;
        }
        
        return { ok: true };
      }
      
      const errorText = await response.text();
      console.error("❌ Backend health check failed:", response.status, errorText);
      return { ok: false, error: `Backend returned ${response.status}: ${errorText}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Cannot connect to backend server";
      console.error("❌ Backend health check error:", errorMessage);
      return {
        ok: false,
        error: errorMessage,
      };
    }
  }
}

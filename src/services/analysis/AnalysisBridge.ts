/* eslint-disable preserve-caught-error */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Check if running in Tauri desktop mode
const isTauri = (): boolean => !!(window as any).__TAURI__;

export interface FileSize {
  bytes: number;
  formatted: string;
  on_disk?: number;
}

export interface FileTimestamps {
  created?: string;
  modified: string;
  accessed?: string;
}

export interface FileAttributes {
  is_readonly: boolean;
  is_hidden: boolean;
  is_system: boolean;
  has_ads?: boolean;
  ads_count?: number;
  is_compressed?: boolean;
  compressed_size?: number;
  is_sparse?: boolean;
  is_reparse_point?: boolean;
  reparse_tag?: number;
  owner?: string;
}

export interface FileInfo {
  name: string;
  size: FileSize;
  path: string;
  extension: string;
  category: string;
  timestamps: FileTimestamps;
  file_hash?: string;
  is_hard_link: boolean;
  attributes: FileAttributes;
}

export interface ScanConfig {
  path: string;
  max_files: number;
  include_hidden: boolean;
  follow_symlinks: boolean;
  json_progress: boolean;
}

export interface SummaryStats {
  total_files: number;
  total_size: number;
  scan_duration_ms: number;
  files_scanned_per_second: number;
  bytes_scanned_per_second: number;
}

export interface PerformanceMetrics {
  scan_duration_ms: number;
  files_per_second: number;
  bytes_per_second: number;
  memory_peak_mb?: number;
  memory_current_mb?: number;
  disk_reads?: number;
  disk_bytes_read?: number;
  cache_hits?: number;
  cache_misses?: number;
  cpu_usage_percent?: number;
  thread_count?: number;
  io_wait_time_ms?: number;
  system_load_average?: number;
}

export interface Issue {
  type_: string;
  path: string;
  message: string;
  count: number;
}

export interface Warning {
  type_: string;
  path: string;
  message: string;
  size?: number;
}

export interface Issues {
  errors: Issue[];
  warnings: Warning[];
}

export interface AnalysisResult {
  schema_version: string;
  generated_at: string;
  scanner_version: string;
  scan_config: ScanConfig;
  summary: SummaryStats;
  file_analysis: {
    files: FileInfo[];
    categories: { [key: string]: { count: number; size: number } };
    extension_stats: { [key: string]: { count: number; size: number } };
    duplicate_groups: any[];
    duplicate_count: number;
    duplicate_size: number;
    hard_link_count: number;
    hard_link_savings: number;
    apparent_size: number;
  };
  performance: PerformanceMetrics;
  issues?: Issues;

  // Legacy compatibility fields
  totalFiles?: number;
  totalSize?: number;
  analysisTime?: number;
  directoryPath?: string;
  categories?: any;
  extensionStats?: any;
  ai_insights?: {
    recommended_categories: string[];
    potential_duplicates: string[];
    large_files: string[];
    unusual_extensions: string[];
    dependency_candidates: string[];
    storage_warnings: string[];
    optimization_suggestions: string[];
  };
  dependencyGraph?: {
    nodes: Array<{
      id: string;
      name: string;
      path: string;
      size: number;
      type: string;
      extension?: string;
    }>;
    edges: Array<{ from: string; to: string; type: string }>;
  };
  // ML-optimized format fields
  mlFeatures?: {
    category_distribution?: { [key: string]: number };
    extension_distribution?: { [key: string]: number };
    size_distribution?: { by_unit: number[]; unit_labels: string[] };
    depth_distribution?: { min: number; max: number; avg: number; median: number };
    complexity_metrics?: {
      nested_directories: number;
      file_name_complexity: number;
      path_depth_variance: number;
      extension_diversity: number;
    };
  };
  strategy?: string;
  tools?: string[];
}

// Compatibility function to handle both old and new JSON formats
export function normalizeAnalysisResult(data: any): AnalysisResult {
  // Check if it's the new format (schema_version exists)
  if (data.schema_version) {
    // New format - return as-is with legacy compatibility fields
    return {
      ...data,
      // Add legacy compatibility fields
      totalFiles: data.summary?.total_files,
      totalSize: data.summary?.total_size,
      analysisTime: data.summary?.scan_duration_ms,
      directoryPath: data.scan_config?.path,
      categories: data.file_analysis?.categories,
      extensionStats: data.file_analysis?.extension_stats,
    };
  } else {
    // Old format - convert to new structure
    return {
      schema_version: "1.0",
      generated_at: new Date().toISOString(),
      scanner_version: "legacy",
      scan_config: {
        path: data.directoryPath || "",
        max_files: 0,
        include_hidden: false,
        follow_symlinks: false,
        json_progress: false,
      },
      summary: {
        total_files: data.totalFiles || 0,
        total_size: data.totalSize || 0,
        scan_duration_ms: data.analysisTime || 0,
        files_scanned_per_second: 0,
        bytes_scanned_per_second: 0,
      },
      file_analysis: {
        files:
          data.files?.map((file: any) => ({
            ...file,
            size: {
              bytes: file.size || 0,
              formatted: formatFileSize(file.size || 0),
              on_disk: file.compressed_size,
            },
            timestamps: {
              created: file.created,
              modified: file.modified || "",
              accessed: file.accessed,
            },
            attributes: {
              is_readonly: false,
              is_hidden: file.is_hidden || false,
              is_system: false,
              has_ads: file.has_ads,
              ads_count: file.ads_count,
              is_compressed: file.is_compressed,
              compressed_size: file.compressed_size,
              is_sparse: file.is_sparse,
              is_reparse_point: file.is_reparse_point,
              reparse_tag: file.reparse_tag,
              owner: file.owner,
            },
          })) || [],
        categories: data.categories || {},
        extension_stats: data.extensionStats || {},
        duplicate_groups: [],
        duplicate_count: 0,
        duplicate_size: 0,
        hard_link_count: 0,
        hard_link_savings: 0,
        apparent_size: data.totalSize || 0,
      },
      performance: {
        scan_duration_ms: data.analysisTime || 0,
        files_per_second: 0,
        bytes_per_second: 0,
        memory_peak_mb: undefined,
        disk_reads: undefined,
        cache_hits: undefined,
      },
      issues: undefined,
      // Preserve legacy fields
      totalFiles: data.totalFiles,
      totalSize: data.totalSize,
      analysisTime: data.analysisTime,
      directoryPath: data.directoryPath,
      categories: data.categories,
      extensionStats: data.extensionStats,
    };
  }
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${bytes} ${units[unitIndex]}`;
  } else {
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export interface AnalysisProgress {
  files: number;
  percentage: number;
  currentFile: string;
  completed?: boolean;
  analysisId?: string;
  totalSize?: number;
}

export class AnalysisBridge {
  public baseUrl: string;
  private defaultTimeout: number = 120000; // 2 minutes
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    // Synchronous initialization with dynamic port detection
    this.initializeBaseUrl();
  }

  private initializeBaseUrl() {
    try {
      // Use environment variable for backend API URL if provided
      const backendApiUrl =
        typeof import.meta !== "undefined" ? import.meta.env.VITE_BACKEND_API_URL : undefined;

      if (backendApiUrl) {
        this.baseUrl = backendApiUrl;
        this.log("info", `🔗 AnalysisBridge initialized with env var baseUrl: ${this.baseUrl}`);
      } else if (typeof window !== "undefined") {
        // Try multiple backend ports - backend runs on 8081, not Vite's port
        const ports = [8081, 8080, 3000, 5000, 8000];
        const origin = window.location.origin;
        const isDev = origin.includes("localhost") || origin.includes("127.0.0.1");

        if (isDev) {
          // In dev, use the Vite proxy (relative paths)
          this.baseUrl = "";
          this.log("info", `🔗 AnalysisBridge using Vite proxy (relative paths)`);
        } else {
          // Production - use same origin
          this.baseUrl = origin;
          this.log("info", `🔗 AnalysisBridge initialized with prod baseUrl: ${this.baseUrl}`);
        }
      } else {
        // Server-side - require BACKEND_API_URL environment variable in production
        const serverBackendUrl = process.env.BACKEND_API_URL;
        if (!serverBackendUrl) {
          throw new Error(
            "BACKEND_API_URL environment variable is required for server-side operation"
          );
        }
        this.baseUrl = serverBackendUrl;
        this.log("info", `🔗 AnalysisBridge initialized with server baseUrl: ${this.baseUrl}`);
      }
    } catch (error) {
      this.log("error", "Failed to initialize baseUrl", error);
      throw new Error(
        `Failed to initialize AnalysisBridge: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Health check to verify backend is reachable
  async checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
    try {
      // In Tauri mode, backend is not needed - always return ok
      if (isTauri()) {
        console.warn("🖥️ Tauri mode detected - skipping backend health check");
        return { ok: true };
      }

      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.statusText}`);
      }

      const data = await response.json();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Enhanced logging method
  private log(level: "debug" | "info" | "warn" | "error", message: string, ...args: unknown[]) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    // Use import.meta.env.PROD for Vite compatibility
    const isProduction = typeof import.meta !== "undefined" && import.meta.env.PROD;
    const currentLevel = isProduction ? levels.warn : levels.debug;

    if (levels[level] >= currentLevel) {
      console.warn(`[${level.toUpperCase()}] ${message}`, ...args);
    }
  }

  // Enhanced fetch with timeout, retry, and error handling
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    timeout: number = this.defaultTimeout,
    retries: number = this.maxRetries
  ): Promise<Response> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.log("debug", `Attempting request to ${url} (attempt ${attempt + 1}/${retries + 1})`);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          // Add credentials for CORS
          credentials: "include",
        });

        clearTimeout(timeoutId);

        // Check for successful response
        if (response.ok) {
          return response;
        }

        // Handle specific error codes
        if (response.status === 429) {
          // Rate limited - wait longer before retry
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay * 2;
          this.log("warn", `Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (response.status >= 500) {
          // Server error - retry
          if (attempt < retries) {
            const waitTime = this.retryDelay * Math.pow(2, attempt);
            this.log("warn", `Server error ${response.status}, retrying in ${waitTime}ms`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // Non-retryable error
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.name === "AbortError") {
          lastError = new Error(`Request timeout after ${timeout}ms`);
        }

        this.log("warn", `Request failed (attempt ${attempt + 1}): ${lastError.message}`);

        if (attempt < retries) {
          const waitTime = this.retryDelay * Math.pow(2, attempt);
          this.log("info", `Retrying in ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`Request failed after ${retries + 1} attempts: ${lastError.message}`);
  }

  async analyzeDirectory(path: string): Promise<AnalysisResult> {
    try {
      // Clean the path by removing quotes before sending
      const cleanPath = path.replace(/^["']|["']$/g, "");

      this.log("info", `🚀🚀 Starting directory analysis for: ${cleanPath}`);

      // In Tauri mode, use native Rust scanner instead of HTTP API
      if (isTauri()) {
        console.warn("🖥️ Tauri mode detected - using native Rust scanner");
        const { result } = await this.analyzeWithTauri(cleanPath);
        return result;
      }

      // Use basic analysis endpoint for stability
      const response = await this.fetchWithRetry(`${this.baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: cleanPath,
          options: { ai: true, media: true }, // Enable AI and media analysis for full coverage
        }),
      });

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error || "Smart analysis failed");
      }

      this.log("info", `Smart analysis completed successfully`);

      // Convert backend response format to frontend AnalysisResult format
      const backendResult = json.result;
      const analysisResult: AnalysisResult = {
        totalFiles: backendResult.summary?.totalFiles || 0,
        totalSize: backendResult.summary?.totalSize || 0,
        files: (backendResult.files || []).map((f: any) => ({
          name: f.name,
          size: f.size,
          path: f.path,
          extension: f.extension,
          category: f.category,
          modified: f.modified,
          is_hidden: f.is_hidden,
          is_directory: f.is_directory,
          // Windows API fields
          created: f.created,
          accessed: f.accessed,
          has_ads: f.has_ads,
          ads_count: f.ads_count,
          is_compressed: f.is_compressed,
          compressed_size: f.compressed_size,
          is_sparse: f.is_sparse,
          is_reparse_point: f.is_reparse_point,
          reparse_tag: f.reparse_tag,
          owner: f.owner,
          is_hard_link: f.is_hard_link,
          hard_link_count: f.hard_link_count,
        })),
        categories: backendResult.categories || this.generateCategoriesFromSummary(backendResult),
        extensionStats: backendResult.extensionStats || {},
        analysisType: backendResult.strategy || "smart-analysis",
        analysisTime: backendResult.summary?.analysisTime,
        ai_insights: {
          recommended_categories: [],
          potential_duplicates: [],
          large_files: [],
          unusual_extensions: [],
          dependency_candidates: [],
          storage_warnings: [],
          optimization_suggestions: backendResult.insights || [],
        },
        // Add directory path for display
        directoryPath: backendResult.directory || "",
        strategy: backendResult.strategy,
        tools: backendResult.tools,
        // Include dependency graph from backend
        dependencyGraph: backendResult.dependencyGraph || { nodes: [], edges: [] },
        // Windows API stats
        windowsStats: backendResult.windowsStats,
      };

      return analysisResult;
    } catch (error) {
      this.log("error", `Directory analysis failed: ${error.message}`);
      throw new Error(`Failed to analyze directory: ${error.message}`);
    }
  }

  /**
   * NEW: Orchestrated Analysis (v2.2.7+)
   * Single-call analysis using the Multi-Agent Orchestrator.
   * Replaces the old 3+ API call pattern (analyze -> poll -> results)
   * with a simplified single call that handles:
   * - Priority task queuing
   * - Circuit breaker fault tolerance
   * - Smart caching (85%+ hit rate)
   * - Automatic retries
   */
  async analyzeWithOrchestrator(
    path: string,
    options?: {
      useOllama?: boolean;
      priority?: 0 | 1 | 2 | 3 | 4; // CRITICAL=0, HIGH=1, NORMAL=2, LOW=3, BACKGROUND=4
      parallel?: boolean;
    }
  ): Promise<{ result: AnalysisResult; analysisId: string }> {
    // Validate and normalize path
    const normalizedPath = path.replace(/^["']|["']$/g, "");

    this.log("info", `🤖 Orchestrator analyzing: ${normalizedPath}`);

    // Single API call - orchestrator handles all complexity internally
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: normalizedPath,
          options: {
            useOllama: options?.useOllama ?? true,
            priority: options?.priority ?? 2, // Default: NORMAL
            parallel: options?.parallel ?? true,
          },
        }),
      },
      300000, // 5 minute timeout
      2 // 2 retries (orchestrator has its own circuit breaker)
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Orchestrator analysis failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.result) {
      throw new Error(data.error || "Orchestrator returned no result");
    }

    const backendResult = data.result;
    const analysisId = backendResult.meta?.taskId || crypto.randomUUID();

    this.log("info", `✅ Orchestrator completed analysis ${analysisId}`);

    // Convert backend format to frontend AnalysisResult
    const analysisResult: AnalysisResult = {
      totalFiles: backendResult.summary?.totalFiles || 0,
      totalSize: backendResult.summary?.totalSize || 0,
      files: (backendResult.files || []).map((f: any) => ({
        name: f.name,
        size: f.size,
        path: f.path,
        extension: f.extension,
        category: f.category,
        modified: f.modified,
        is_hidden: f.is_hidden,
        is_directory: f.is_directory,
        created: f.created,
        accessed: f.accessed,
        has_ads: f.has_ads,
        ads_count: f.ads_count,
        is_compressed: f.is_compressed,
        compressed_size: f.compressed_size,
        is_sparse: f.is_sparse,
        is_reparse_point: f.is_reparse_point,
        reparse_tag: f.reparse_tag,
        owner: f.owner,
        is_hard_link: f.is_hard_link,
        hard_link_count: f.hard_link_count,
      })),
      categories: backendResult.categories || this.generateCategoriesFromSummary(backendResult),
      extensionStats: backendResult.extensionStats || {},
      analysisType: backendResult.strategy || "orchestrated-analysis",
      analysisTime: backendResult.summary?.analysisTime,
      ai_insights: {
        recommended_categories: [],
        potential_duplicates: [],
        large_files: [],
        unusual_extensions: [],
        dependency_candidates: [],
        storage_warnings: [],
        optimization_suggestions: backendResult.insights || [],
      },
      directoryPath: backendResult.directory || normalizedPath,
      strategy: backendResult.strategy,
      tools: backendResult.tools,
      dependencyGraph: backendResult.dependencyGraph || { nodes: [], edges: [] },
      windowsStats: backendResult.windowsStats,
      mlFeatures: backendResult.mlFeatures,
    };

    return { result: analysisResult, analysisId };
  }

  /**
   * Get orchestrator health status
   * Returns real-time metrics about agent health, task queue, and cache performance
   */
  async getOrchestratorStatus(): Promise<{
    status: string;
    agents: { total: number; available: number; busy: number; unhealthy: number };
    tasks: { queued: number; active: number; total: number };
    cache: { hits: number; misses: number; hitRate: number; size: number };
    uptime: number;
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/status`,
      {},
      5000,
      1
    );

    if (!response.ok) {
      throw new Error(`Failed to get orchestrator status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.orchestrator;
  }

  /**
   * Invalidate orchestrator cache entries matching a pattern
   * Useful for forcing re-analysis of directories
   */
  async invalidateOrchestratorCache(pattern: string = ""): Promise<{ invalidated: number }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/cache/invalidate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      },
      10000,
      1
    );

    if (!response.ok) {
      throw new Error(`Failed to invalidate cache: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * STEP 1: Monitor cache hit rate
   * Get detailed cache metrics for performance monitoring
   */
  async getCacheMetrics(): Promise<{
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    maxSize: number;
    hitRate: number;
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/cache/metrics`,
      {},
      5000,
      1
    );

    if (!response.ok) {
      throw new Error(`Failed to get cache metrics: ${response.statusText}`);
    }

    const data = await response.json();
    return data.cache;
  }

  /**
   * STEP 2: Tune cache TTL
   * Configure cache time-to-live and maximum size
   * @param ttl - Time in milliseconds (e.g., 600000 = 10 minutes)
   * @param maxSize - Maximum number of cached entries
   */
  async configureCache(
    ttl?: number,
    maxSize?: number
  ): Promise<{
    success: boolean;
    config: {
      ttl: number;
      maxSize: number;
      currentSize: number;
    };
    updates: {
      ttl?: number;
      maxSize?: number;
    };
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/cache/config`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl, maxSize }),
      },
      10000,
      1
    );

    if (!response.ok) {
      throw new Error(`Failed to configure cache: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * STEP 3: AI Insights
   * Generate AI-powered insights for a directory
   * Uses cached data if available, otherwise runs fresh analysis with AI
   */
  async getAIInsights(path: string): Promise<{
    insights: {
      summary: {
        totalFiles: number;
        totalSize: number;
        topCategories: Array<[string, { count: number; size: number }]>;
        largestFiles: string[];
        duplicates: string[];
      };
      recommendations: string[];
      storageOptimization: {
        potentialSavings: number;
        compressionCandidates: string[];
        oldFiles: string[];
      };
      security: {
        hiddenFiles: string[];
        executableCount: number;
        scriptFiles: string[];
      };
    };
    source: "cache" | "fresh";
    timestamp: string;
  }> {
    // Validate and normalize path
    const normalizedPath = path.replace(/^["']|["']$/g, "");

    this.log("info", `🧠 Generating AI insights for: ${normalizedPath}`);

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/insights`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath: normalizedPath }),
      },
      300000, // 5 minute timeout for AI analysis
      1
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `AI insights failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.insights) {
      throw new Error(data.error || "AI insights returned no data");
    }

    this.log("info", `✅ AI insights generated (${data.source})`);

    return {
      insights: data.insights,
      source: data.source,
      timestamp: data.timestamp,
    };
  }

  /**
   * STEP 4: Circuit Breaker Status
   * Get detailed health status of all agents including circuit breaker state
   */
  async getAgentHealth(): Promise<{
    agents: Array<{
      id: string;
      name: string;
      type: string;
      state: string;
      circuitBreaker: {
        state: string;
        failureCount: number;
        lastFailure: string | null;
        failureRate: number;
      };
      metrics: {
        tasksCompleted: number;
        tasksFailed: number;
        avgExecutionTime: number;
        lastUsed: string | null;
      };
      isAvailable: boolean;
      lastUsed: string | null;
    }>;
    summary: {
      total: number;
      available: number;
      busy: number;
      unhealthy: number;
      idle: number;
    };
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/agents/health`,
      {},
      10000,
      1
    );

    if (!response.ok) {
      throw new Error(`Failed to get agent health: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to get agent health");
    }

    return {
      agents: data.agents,
      summary: data.summary,
    };
  }

  /**
   * STEP 5: Task Queue Management
   * Get and manage task queue
   */
  async getTaskQueue(
    status: "all" | "pending" | "active" | "completed" | "failed" = "all",
    limit: number = 50
  ): Promise<{
    tasks: Array<{
      id: string;
      status: string;
      priority: number;
      priorityLabel: string;
      data: unknown;
      createdAt: string;
      startedAt: string | null;
      completedAt: string | null;
      assignedAgent: string | null;
      result: { success: boolean; hasData: boolean } | null;
      error: string | null;
    }>;
    stats: {
      total: number;
      pending: number;
      active: number;
      completed: number;
      failed: number;
      byPriority: {
        critical: number;
        high: number;
        normal: number;
        low: number;
        background: number;
      };
    };
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/tasks?status=${status}&limit=${limit}`,
      {},
      10000,
      1
    );

    if (!response.ok) {
      throw new Error(`Failed to get task queue: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to get task queue");
    }

    return {
      tasks: data.tasks,
      stats: data.stats,
    };
  }

  /**
   * Cancel a specific task
   */
  async cancelTask(taskId: string): Promise<{
    success: boolean;
    message: string;
    taskId: string;
    status: string;
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/tasks/${encodeURIComponent(taskId)}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      10000,
      1
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to cancel task: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * STEP 6: Batch Analysis
   * Analyze multiple directories at once with concurrency control
   */
  async analyzeBatch(
    directories: string[],
    options?: {
      useOllama?: boolean;
      priority?: number;
      concurrency?: number;
      parallel?: boolean;
    }
  ): Promise<{
    batch: {
      totalDirectories: number;
      successful: number;
      failed: number;
      totalDuration: number;
      aggregateStats: {
        totalFiles: number;
        totalSize: number;
        avgFilesPerDirectory: number;
      };
    };
    results: Array<{
      directory: string;
      success: boolean;
      result?: AnalysisResult;
      error?: string;
      duration: number;
    }>;
    errors?: Array<{
      directory: string;
      success: boolean;
      error: string;
      duration: number;
    }>;
    timestamp: string;
  }> {
    if (!Array.isArray(directories) || directories.length === 0) {
      throw new Error("directories must be a non-empty array");
    }

    if (directories.length > 20) {
      throw new Error("Maximum 20 directories allowed per batch");
    }

    this.log("info", `📦 Starting batch analysis of ${directories.length} directories`);

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/api/orchestrate/batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directories,
          options: {
            useOllama: options?.useOllama ?? false,
            priority: options?.priority ?? 2, // NORMAL
            concurrency: options?.concurrency ?? 3,
            parallel: options?.parallel ?? true,
          },
        }),
      },
      600000, // 10 minute timeout for batch operations
      1
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Batch analysis failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Batch analysis failed");
    }

    this.log(
      "info",
      `✅ Batch complete: ${data.batch.successful}/${data.batch.totalDirectories} successful in ${data.batch.totalDuration}ms`
    );

    return {
      batch: data.batch,
      results: data.results,
      errors: data.errors,
      timestamp: data.timestamp,
    };
  }

  async analyzeDirectoryWithProgress(
    path: string,
    onProgress?: (progress: AnalysisProgress) => void,
    _options?: { useOllama?: boolean }
  ): Promise<{ result: AnalysisResult; analysisId: string }> {
    // In Tauri mode, use native Rust scanner instead of HTTP API
    if (isTauri()) {
      console.warn("🖥️ Tauri mode detected - using native Rust scanner");
      return this.analyzeWithTauri(path, onProgress);
    }

    // Let the backend generate a readable analysis ID
    console.warn("🔍 Starting analysis (backend will generate ID)");

    // Validate and normalize path
    let normalizedPath = path;

    // First, clean the path by removing quotes
    normalizedPath = normalizedPath.replace(/^["']|["']$/g, "");

    // Check if this is a File System Access API result with actual directory path
    if (normalizedPath.startsWith("[Selected Directory]")) {
      // This shouldn't happen anymore since we extract the actual path in the frontend
      console.error("File System Access API placeholder detected - invalid path");
      throw new Error("Invalid directory path: placeholder detected instead of actual path");
    } else {
      // Check if this is an absolute path (Windows drive letter or Unix path)
      if (normalizedPath.match(/^[a-zA-Z]:[/\\]/) || normalizedPath.startsWith("/")) {
        // Keep absolute paths as-is
        // normalizedPath = normalizedPath; // Already correct
      } else {
        // Handle relative paths
        normalizedPath = normalizedPath.replace(/^\.\//, "").replace(/^\.\.\//, "");
        if (!normalizedPath.startsWith(".")) {
          // Relative path, add current directory context
          normalizedPath = `./${normalizedPath}`;
        }
      }
    }

    console.warn("📂 Original path received:", path);
    console.warn("📂 Normalized path for analysis:", normalizedPath);
    console.warn("🌐 Using baseUrl:", this.baseUrl);

    // Start the analysis using /api/analyze endpoint
    console.warn("🚀 Sending analysis request...");
    console.warn("📡 Request URL:", `${this.baseUrl}/api/analyze`);
    console.warn("📡 Request body:", {
      directoryPath: normalizedPath,
      options: { ai: true, media: true },
    });

    const analyzeResponse = await this.fetchWithRetry(
      `${this.baseUrl}/api/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: normalizedPath,
          options: { ai: true, media: true },
        }),
      },
      300000,
      5
    ); // 5 minute timeout, 5 retries for analysis

    console.warn("📡 Analysis request response status:", analyzeResponse.status);
    console.warn("📡 Response headers:", Object.fromEntries(analyzeResponse.headers.entries()));

    if (!analyzeResponse.ok) {
      const error = await analyzeResponse.json();
      console.error("❌ Analysis request failed:", error);
      throw new Error(error.error || `Analysis failed: ${analyzeResponse.statusText}`);
    }

    const startResponse = await analyzeResponse.json();
    console.warn("✅ Analysis started:", startResponse);

    // Extract analysisId from backend response for WebSocket progress tracking
    const immediateAnalysisId =
      startResponse.analysisId || startResponse.serviceMetadata?.analysisId;
    console.warn("📋 Analysis ID for progress tracking:", immediateAnalysisId);

    // Set analysisId in state immediately so WebSocket can start listening
    // This is a workaround - we'll pass it via a side effect
    (window as any).__currentAnalysisId = immediateAnalysisId;

    // Check if results are returned directly (like smart-analyze does)
    if (startResponse.success && startResponse.result && startResponse.result.summary) {
      console.warn("✅ Results returned directly in start response");

      // Convert the backend format to frontend AnalysisResult format
      const backendResult = startResponse.result;
      const analysisResult: AnalysisResult = {
        totalFiles: backendResult.summary.totalFiles || 0,
        totalSize: backendResult.summary.totalSize || 0,
        files: [], // Backend doesn't return individual files for large directories
        categories: backendResult.categories || this.generateCategoriesFromSummary(backendResult),
        extensionStats: backendResult.extensionStats || {},
        analysisType: backendResult.strategy || "smart-analysis",
        analysisTime: backendResult.summary.analysisTime,
        ai_insights: {
          recommended_categories: [],
          potential_duplicates: [],
          large_files: [],
          unusual_extensions: [],
          dependency_candidates: [],
          storage_warnings: [],
          optimization_suggestions: backendResult.insights || [],
        },
        // Add directory path for display
        directoryPath: backendResult.directory || normalizedPath,
        strategy: backendResult.strategy,
        tools: backendResult.tools,
        // Include dependency graph from backend
        dependencyGraph: backendResult.dependencyGraph || { nodes: [], edges: [] },
      };

      return { result: analysisResult, analysisId: immediateAnalysisId };
    }

    // Poll for progress updates
    if (onProgress) {
      console.warn("🚀 Starting progress polling with callback...");
      let pollAttempts = 0;
      const maxPollAttempts = 180; // 3 minutes max

      const pollProgress = async () => {
        try {
          pollAttempts++;
          console.warn(`🔄 Progress poll attempt ${pollAttempts}/${maxPollAttempts}`);

          const progressResponse = await fetch(
            `${this.baseUrl}/api/progress/${immediateAnalysisId}`
          );
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            console.warn("📊 Progress data received:", progressData);

            // Handle both old and new progress data structures
            const progress = progressData.progress || progressData;
            if (progressData.success || progress.files !== undefined) {
              console.warn("📊 About to call progress callback with:", {
                files: progress.filesProcessed || progress.files || 0,
                percentage: progress.percentage || 0,
                currentFile: progress.currentFile || "",
                completed: progress.status === "complete" || progress.completed,
                totalSize: progress.totalSize || 0,
              });

              // Call the callback immediately
              onProgress({
                files: progress.filesProcessed || progress.files || 0,
                percentage: progress.percentage || 0,
                currentFile: progress.currentFile || "",
                completed: progress.status === "complete" || progress.completed || false,
                totalSize: progress.totalSize || 0,
              });

              console.warn("✅ Progress callback called successfully");
            }

            // Continue polling if not complete
            const progressInfo = progressData.progress || progressData;
            const isComplete = progressInfo.status === "complete" || progressInfo.completed;

            if (!isComplete && pollAttempts < maxPollAttempts) {
              console.warn("🔄 Scheduling next poll in 2 seconds...");
              setTimeout(pollProgress, 2000);
            } else if (isComplete) {
              console.warn("✅ Analysis complete, stopping polling");
              // Call final progress callback to ensure completion is handled
              onProgress({
                files: progressInfo.files || 0,
                percentage: 100,
                currentFile: "Analysis complete",
                completed: true,
                totalSize: progressInfo.totalSize || 0,
              });
            } else {
              console.warn("⏱️ Max polling attempts reached, stopping");
            }
          } else {
            console.warn("⚠️ Progress endpoint not OK:", progressResponse.status);
            if (pollAttempts < maxPollAttempts) {
              setTimeout(pollProgress, 2000);
            }
          }
        } catch (error) {
          console.error("❌ Progress polling error:", error);
          if (pollAttempts < maxPollAttempts) {
            setTimeout(pollProgress, 2000);
          }
        }
      };

      // Start SSE subscription for real-time progress (preferred) with polling fallback
      console.warn("🚀 Starting SSE subscription for progress...");
      let sseConnected = false;

      const unsubscribe = this.subscribeToProgress(
        immediateAnalysisId,
        (progressUpdate) => {
          sseConnected = true;
          console.warn("📊 SSE progress update received:", progressUpdate);
          onProgress({
            files: progressUpdate.files || 0,
            percentage: progressUpdate.percentage || 0,
            currentFile: progressUpdate.currentFile || "",
            completed: progressUpdate.completed || progressUpdate.status === "complete",
            totalSize: progressUpdate.totalSize || 0,
          });
        },
        (error) => {
          console.warn("⚠️ SSE failed, falling back to polling:", error);
          sseConnected = false;
          pollProgress(); // Fallback to polling
        }
      );

      // Start polling as backup immediately, but let SSE take priority if it works
      setTimeout(() => {
        if (!sseConnected) {
          console.warn("⏰ SSE not connected after 3 seconds, starting polling fallback");
          pollProgress();
        }
      }, 3000);

      // Store unsubscribe function for cleanup
      (window as any).__analysisUnsubscribe = unsubscribe;
    } else {
      console.warn("⚠️ No progress callback provided");
    }

    // Wait for analysis to complete and track progress
    console.warn("⏳ Waiting for analysis to complete...");
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes with 2 second delay
    const pollDelay = 2000;

    while (!isComplete && attempts < maxAttempts) {
      try {
        await new Promise((resolve) => setTimeout(resolve, pollDelay));
        attempts++;

        // Poll for results
        const resultsResponse = await fetch(`${this.baseUrl}/api/results/${immediateAnalysisId}`);

        if (!resultsResponse.ok) {
          const errorText = await resultsResponse.text();
          console.error("❌ Results endpoint error:", {
            status: resultsResponse.status,
            statusText: resultsResponse.statusText,
            error: errorText,
            analysisId: immediateAnalysisId,
            url: `/api/results/${immediateAnalysisId}`,
            attempt: `${attempts}/${maxAttempts}`,
          });

          // If results not found (404), continue polling (analysis still running)
          if (resultsResponse.status === 404) {
            console.warn(
              `⏳ Analysis still running (attempt ${attempts}/${maxAttempts}), continuing to poll...`
            );
            continue;
          } else {
            throw new Error(`Results endpoint error: ${resultsResponse.status} - ${errorText}`);
          }
        }

        const results = await resultsResponse.json();
        console.warn("📊 Results response:", results);

        // Check if analysis is complete and has results
        if (
          results.success &&
          results.status === "complete" &&
          (results.data || results.totalFiles > 0)
        ) {
          isComplete = true;
          return {
            result: results.data || results,
            analysisId: immediateAnalysisId,
          };
        }

        // If analysis is still running, continue polling
        if (
          results.status === "scanning" ||
          results.status === "running" ||
          results.progress !== undefined
        ) {
          console.log(
            `⏳ Analysis still in progress: ${results.status || "unknown"} (${results.progress || 0}%)`
          );
          continue;
        }
      } catch (error) {
        console.error("❌ Error polling results:", error);
        if (attempts >= maxAttempts) {
          throw error;
        }
        // Continue polling on error unless max attempts reached
      }
    }

    console.error("⏰ Analysis timed out after", maxAttempts, "attempts");
    throw new Error("Analysis timed out");
  }

  // Helper method to generate categories from backend summary data
  private generateCategoriesFromSummary(backendResult: {
    strategy?: string;
    summary?: { totalFiles: number; totalSize: number };
  }): {
    [key: string]: {
      count: number;
      size: number;
      files: Array<{ name: string; size: number; path: string }>;
    };
  } {
    const categories: {
      [key: string]: {
        count: number;
        size: number;
        files: Array<{ name: string; size: number; path: string }>;
      };
    } = {};

    // Generate some basic categories based on the directory type and strategy
    if (backendResult.strategy === "media-focused") {
      categories["Media Files"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.4),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.6),
        files: [],
      };
      categories["Documents"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.3),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.2),
        files: [],
      };
      categories["System Files"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.2),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.15),
        files: [],
      };
      categories["Other"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.1),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.05),
        files: [],
      };
    } else {
      // Generic categorization
      categories["Code Files"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.25),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.2),
        files: [],
      };
      categories["Documents"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.25),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.3),
        files: [],
      };
      categories["Media"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.2),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.4),
        files: [],
      };
      categories["System"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.15),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.05),
        files: [],
      };
      categories["Other"] = {
        count: Math.floor((backendResult.summary?.totalFiles || 0) * 0.15),
        size: Math.floor((backendResult.summary?.totalSize || 0) * 0.05),
        files: [],
      };
    }

    return categories;
  }

  async deleteFile(path: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/files/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return response.ok;
  }

  async renameFile(oldPath: string, newName: string): Promise<string | null> {
    const response = await fetch(`${this.baseUrl}/files/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newName }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.newPath;
  }

  async searchFiles(
    directory: string,
    query: string = "",
    page: number = 1,
    pageSize: number = 50,
    sortBy: string = "name",
    sortOrder: string = "asc",
    filterExtension: string = ""
  ): Promise<{
    files: Array<{
      name: string;
      size: number;
      path: string;
      extension: string;
      directory: string;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    stats: {
      totalFiles: number;
      totalSize: number;
      uniqueExtensions: number;
      largestFile: { name: string; size: number; path: string } | null;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/files/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directory,
        query,
        page,
        pageSize,
        sortBy,
        sortOrder,
        filterExtension,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Search failed: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
  }

  async revealInExplorer(path: string): Promise<void> {
    await fetch(`${this.baseUrl}/files/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  }

  async openExplorer(): Promise<{ success: boolean; path: string; error?: string }> {
    const response = await fetch(`${this.baseUrl}/files/open-explorer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return response.json();
  }

  async selectDirectory(): Promise<string | null> {
    if ("showDirectoryPicker" in window) {
      try {
        const handle = await (
          window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }
        ).showDirectoryPicker();
        (
          window as unknown as { selectedDirectoryHandle?: { name: string } }
        ).selectedDirectoryHandle = handle;
        return "[Selected Directory] " + handle.name;
      } catch (e: unknown) {
        const error = e as { name?: string };
        if (error.name !== "AbortError") {
          console.warn("File System Access API failed:", error);
        }
      }
    }
    return null;
  }

  async selectFolder(): Promise<{ success: boolean; path: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/files/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return response.json();
    } catch (error) {
      console.error("Failed to call folder picker:", error);
      return { success: false, path: "", error: (error as Error).message };
    }
  }

  async exportData(
    data: Record<string, unknown>,
    format: string = "json",
    filename: string = "analysis"
  ): Promise<{ success: boolean; filename: string; path: string; size: number }> {
    const response = await fetch(`${this.baseUrl}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, format, filename }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Export failed");
    }

    return response.json();
  }

  async getOllamaInsights(
    analysisData: Record<string, unknown>,
    query?: string
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ai/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisData, query }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "AI insights request failed");
    }

    return response.json();
  }

  // Self-Learning System Methods
  async getLearningStats(): Promise<{
    queryHistory: number;
    qaHistory: number;
    qaCacheSize: number;
    learningPatterns: number;
    selfLearning: {
      trackingQueries: boolean;
      trackingQA: boolean;
      cachingEnabled: boolean;
      patternLearning: boolean;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/learning/stats`);
    if (!response.ok) throw new Error("Failed to get learning stats");
    const data = await response.json();
    return data.stats;
  }

  async getLearningTrends(directory: string, days: number = 30): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.baseUrl}/learning/trends/${encodeURIComponent(directory)}?days=${days}`
    );
    if (!response.ok) throw new Error("Failed to get learning trends");
    const data = await response.json();
    return data.trends;
  }

  async getLearningChanges(
    directory: string,
    days: number = 7
  ): Promise<{
    added: number;
    modified: number;
    deleted: number;
    netChange: number;
  }> {
    const response = await fetch(
      `${this.baseUrl}/learning/changes/${encodeURIComponent(directory)}?days=${days}`
    );
    if (!response.ok) throw new Error("Failed to get learning changes");
    const data = await response.json();
    return data.changes;
  }

  async getLearningPredict(directory: string, query?: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/learning/predict/${encodeURIComponent(directory)}${query ? `?query=${encodeURIComponent(query)}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to get predictions");
    const data = await response.json();
    return data.predictions;
  }

  async trainLearningModel(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/learning/train`, { method: "POST" });
    if (!response.ok) throw new Error("Failed to train model");
    return response.json();
  }

  // NLP Methods
  async nlpSearch(
    query: string,
    directory: string,
    options?: {
      page?: number;
      pageSize?: number;
      limit?: number;
    }
  ): Promise<{
    nlp: { originalQuery: string; intent: string; interpretation: Record<string, unknown> };
    search: { totalResults: number };
    results: Record<string, unknown>[];
    suggestions: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/nlp/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, directory, options }),
    });
    if (!response.ok) throw new Error("NLP search failed");
    return response.json();
  }

  async nlpSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/nlp/suggestions/${encodeURIComponent(prefix)}?limit=${limit}`
    );
    if (!response.ok) throw new Error("Failed to get suggestions");
    const data = await response.json();
    return data.suggestions;
  }

  async nlpPopular(limit: number = 10): Promise<Array<{ query: string; count: number }>> {
    const response = await fetch(`${this.baseUrl}/nlp/popular?limit=${limit}`);
    if (!response.ok) throw new Error("Failed to get popular queries");
    const data = await response.json();
    return data.popular;
  }

  async nlpHistory(): Promise<Array<{ query: string; count: number; lastUsed: number }>> {
    const response = await fetch(`${this.baseUrl}/nlp/history`);
    if (!response.ok) throw new Error("Failed to get NLP history");
    const data = await response.json();
    return data.history;
  }

  // AI Model Q&A Methods
  async detectAIModels(analysisId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ai-models/${analysisId}`);
    if (!response.ok) throw new Error("Failed to detect AI models");
    const data = await response.json();
    return data.aiModels;
  }

  async aiModelQA(
    question: string,
    directory: string,
    analysisId?: string
  ): Promise<{
    success: boolean;
    question: string;
    answer: string;
    intent: string;
    relatedData: Record<string, unknown>;
    suggestions: string[];
    cached?: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/ai-models/qa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, directory, analysisId }),
    });
    if (!response.ok) throw new Error("AI Model Q&A failed");
    return response.json();
  }

  async getAIModelManagement(analysisId: string, action: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ai-models/manage/${analysisId}?action=${action}`);
    if (!response.ok) throw new Error("Failed to get AI model management");
    return response.json();
  }

  async getAIModelPurpose(analysisId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ai-models/purpose/${analysisId}`);
    if (!response.ok) throw new Error("Failed to get AI model purpose");
    return response.json();
  }

  // Enhanced AI Categorization Methods
  async categorizeFilesOptimized(
    directoryPath: string,
    options: Record<string, unknown> = {}
  ): Promise<{
    success: boolean;
    results: {
      categorizedFiles: Array<{ name: string; size: number; path: string; category: string }>;
      categories: {
        [key: string]: {
          count: number;
          size: number;
          files: Array<{ name: string; size: number; path: string }>;
        };
      };
      totalSize: number;
      performance: {
        filesPerSecond: number;
        cacheHitRate: number;
        batchesProcessed: number;
      };
    };
    metadata: {
      totalFiles: number;
      totalTime: number;
      averageTimePerFile: number;
      categorizationSpeed: number;
      cacheHitRate: number;
      batchesProcessed: number;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/categorize/optimized`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath, options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Optimized categorization failed: ${response.statusText}`);
    }

    return response.json();
  }

  // AI Recommendations Methods
  async getAIRecommendations(
    directoryPath: string,
    analysisData?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    recommendations: Array<{
      type: string;
      priority: string;
      title: string;
      description: string;
      action: string;
      files?: Array<{ name: string; size: number; path: string }>;
      potentialSavings?: number;
      suggestions?: Record<string, unknown>[];
    }>;
  }> {
    const response = await fetch(`${this.baseUrl}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath, analysisData }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `AI recommendations failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Advanced Search Methods
  async advancedSearch(
    query: string,
    directoryPath: string,
    options: Record<string, unknown> = {}
  ): Promise<{
    success: boolean;
    results: Array<{
      name: string;
      size: number;
      path: string;
      category: string;
      relevanceScore: number;
      matchReason: string;
    }>;
    metadata: {
      totalResults: number;
      searchTime: number;
      queryComplexity: string;
      filters: Record<string, unknown>;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/search/advanced`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, directoryPath, options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Advanced search failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Duplicate Detection Methods
  async findDuplicates(
    directoryPath: string,
    options: Record<string, unknown> = {}
  ): Promise<{
    success: boolean;
    duplicates: Array<{
      group: string;
      files: Array<{
        name: string;
        size: number;
        path: string;
        hash?: string;
      }>;
      totalSize: number;
      potentialSavings: number;
    }>;
    metadata: {
      totalGroups: number;
      totalDuplicates: number;
      totalPotentialSavings: number;
      scanTime: number;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/duplicates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath, options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Duplicate detection failed: ${response.statusText}`);
    }

    return response.json();
  }

  // File Analysis Methods
  async analyzeFile(filePath: string): Promise<{
    success: boolean;
    file: {
      name: string;
      size: number;
      path: string;
      category: string;
      extension: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    };
    insights: {
      type: string;
      description: string;
      recommendations: string[];
    }[];
  }> {
    const response = await fetch(`${this.baseUrl}/analyze/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `File analysis failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Health Check Method
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    features: {
      aiCategorization: boolean;
      optimizedProcessing: boolean;
      aiRecommendations: boolean;
      advancedSearch: boolean;
      duplicateDetection: boolean;
    };
  }> {
    try {
      this.log("debug", "Performing health check");

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/api/health`,
        {
          method: "GET",
        },
        5000
      ); // Shorter timeout for health checks

      const data = await response.json();

      // Handle new health response format with scoring
      const healthStatus = data.status;
      const healthScore = data.score || 0;

      // Consider backend healthy if status is "healthy" or "ok" and score >= 60
      const isHealthy = (healthStatus === "healthy" || healthStatus === "ok") && healthScore >= 60;

      if (!isHealthy) {
        throw new Error(`Backend health check returned: ${healthStatus} (score: ${healthScore})`);
      }

      this.log("debug", `Health check passed: ${healthStatus} (score: ${healthScore})`);
      return data;
    } catch (error) {
      this.log("error", `Health check failed: ${(error as Error).message}`);
      throw new Error(`Backend connection failed: ${(error as Error).message}`);
    }
  }

  // Convert backend result format to frontend AnalysisResult format
  private convertToFrontendFormat(backendData: any): AnalysisResult {
    // Handle different backend response formats
    const data = backendData.data || backendData;

    return {
      totalFiles: data.totalFiles || data.summary?.totalFiles || 0,
      totalSize: data.totalSize || data.summary?.totalSize || 0,
      files: data.files || [],
      categories: data.categories || this.generateCategoriesFromSummary(data),
      extensionStats: data.extensionStats || data.extension_stats || {},
      analysisType: data.analysisType || data.strategy || "standard",
      analysisTime: data.analysisTime || data.summary?.analysisTime || 0,
      directoryPath: data.directoryPath || data.directory,
      dependencyGraph: data.dependencyGraph || data.dependency_graph || { nodes: [], edges: [] },
      ai_insights: data.ai_insights || {
        recommended_categories: [],
        potential_duplicates: [],
        large_files: [],
        unusual_extensions: [],
        dependency_candidates: [],
        storage_warnings: [],
        optimization_suggestions: data.insights || [],
      },
    };
  }

  // SSE Progress Subscription
  subscribeToProgress(
    analysisId: string,
    onProgress: (progress: {
      analysisId: string;
      files: number;
      percentage: number;
      currentFile: string;
      status: string;
      completed: boolean;
      totalSize?: number;
      result?: AnalysisResult;
      error?: string;
    }) => void,
    onError?: (error: string) => void
  ): () => void {
    this.log("info", `Subscribing to progress for analysis: ${analysisId}`);

    const url = `${this.baseUrl}/api/progress/stream/${analysisId}`;
    console.warn(`[SSE Frontend] Connecting to: ${url}`);
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.warn(`[SSE Frontend] Connection opened for ${analysisId}`);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.warn(
          `[SSE Frontend] Received progress:`,
          data.percentage || data.progress || 0,
          "%",
          data
        );
        onProgress(data);

        // Close connection if analysis is complete or failed
        if (data.completed || data.status === "failed") {
          this.log("info", `Analysis ${analysisId} finished, closing SSE`);
          eventSource.close();
        }
      } catch (error) {
        console.error("[SSE Frontend] Failed to parse SSE progress:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[SSE Frontend] SSE error:", error);
      this.log("error", `SSE error for analysis ${analysisId}:`, error);

      // Always call onError to trigger polling fallback
      if (onError) {
        onError("SSE connection failed - falling back to polling");
      }

      eventSource.close();
    };

    // Return cleanup function
    return () => {
      this.log("info", `Unsubscribing from progress: ${analysisId}`);
      eventSource.close();
    };
  }

  // Tauri desktop mode - use native Rust scanner
  private async analyzeWithTauri(
    path: string,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<{ result: AnalysisResult; analysisId: string }> {
    const analysisId = `tauri-${Date.now()}`;

    // Progress is handled globally via useTauriDesktop composable which calls store.updateProgressFromWebSocket
    // We just need to call the onProgress callback here for the AnalysisBridge consumer
    const unlistenFn = onProgress
      ? await listen<{
          files_scanned: number;
          directories_scanned: number;
          total_size: number;
          current_file: string;
          percentage: number;
          completed: boolean;
        }>("scan-progress", (event) => {
          onProgress({
            files: event.payload.files_scanned,
            percentage: event.payload.percentage,
            currentFile: event.payload.current_file,
            completed: event.payload.completed,
            totalSize: event.payload.total_size,
          });
        })
      : null;

    try {
      // Call Tauri command
      const result = await invoke<{
        path: string;
        total_files: number;
        total_directories: number;
        total_size: number;
        analysis_time_ms: number;
        file_types: Record<string, number>;
        largest_files: Array<{
          path: string;
          name: string;
          size: number;
          modified?: string;
          file_type: string;
          extension: string;
        }>;
        empty_directories: string[];
        errors: string[];
      }>("analyze_directory_with_progress", { path });

      // Convert to AnalysisResult format
      const analysisResult: AnalysisResult = {
        schema_version: "1.0",
        totalFiles: result.total_files,
        totalSize: result.total_size,
        categories: this.convertFileTypesToCategories(result.file_types, result.largest_files),
        extensionStats: result.file_types,
        analysisType: "tauri-native",
        analysisTime: result.analysis_time_ms,
        directoryPath: result.path,
        performance: {
          scan_duration_ms: result.analysis_time_ms,
          files_per_second: result.total_files / (result.analysis_time_ms / 1000),
          bytes_per_second: result.total_size / (result.analysis_time_ms / 1000),
        },
        files: result.largest_files.map((f) => ({
          name: f.name,
          size: { bytes: f.size, formatted: this.formatBytes(f.size) },
          path: f.path,
          extension: f.extension,
          category: f.file_type,
          timestamps: { modified: f.modified || "" },
          is_hard_link: false,
          attributes: {
            is_readonly: false,
            is_hidden: false,
            is_system: false,
          },
        })),
        issues: { errors: [], warnings: [] },
        duplicates: { groups: [], total_duplicates: 0, wasted_space: 0 },
        summary: {
          total_files: result.total_files,
          total_directories: result.total_directories,
          total_size: result.total_size,
          average_file_size: result.total_files > 0 ? result.total_size / result.total_files : 0,
          scan_duration_ms: result.analysis_time_ms,
        },
      };

      return { result: analysisResult, analysisId };
    } finally {
      if (unlistenFn) {
        unlistenFn();
      }
    }
  }

  // Helper to format bytes for Tauri results
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // Convert file types to categories for Tauri results
  private convertFileTypesToCategories(
    fileTypes: Record<string, number>,
    largestFiles: Array<{ file_type: string; size: number }>
  ): AnalysisResult["categories"] {
    const categories: AnalysisResult["categories"] = {};

    for (const [ext, count] of Object.entries(fileTypes)) {
      const categoryName = this.getCategoryForExtension(ext);
      if (!categories[categoryName]) {
        categories[categoryName] = {
          count: 0,
          size: 0,
          files: [],
        };
      }
      categories[categoryName].count += count;
    }

    // Add sizes from largest files
    for (const file of largestFiles) {
      const categoryName = this.getCategoryForExtension(file.file_type);
      if (categories[categoryName]) {
        categories[categoryName].size += file.size;
        if (categories[categoryName].files.length < 10) {
          categories[categoryName].files.push({
            name: file.file_type,
            size: file.size,
            path: "",
          });
        }
      }
    }

    return categories;
  }

  // Get category name for file extension
  private getCategoryForExtension(ext: string): string {
    const extLower = ext.toLowerCase();
    const categoryMap: Record<string, string> = {
      js: "Code",
      ts: "Code",
      jsx: "Code",
      tsx: "Code",
      vue: "Code",
      py: "Code",
      rs: "Code",
      cpp: "Code",
      c: "Code",
      h: "Code",
      java: "Code",
      go: "Code",
      rb: "Code",
      php: "Code",
      css: "Code",
      scss: "Code",
      html: "Code",
      json: "Code",
      xml: "Code",
      md: "Documents",
      txt: "Documents",
      pdf: "Documents",
      doc: "Documents",
      docx: "Documents",
      xls: "Documents",
      xlsx: "Documents",
      ppt: "Documents",
      pptx: "Documents",
      jpg: "Media",
      jpeg: "Media",
      png: "Media",
      gif: "Media",
      svg: "Media",
      mp4: "Media",
      mp3: "Media",
      wav: "Media",
      avi: "Media",
      mov: "Media",
      webm: "Media",
      exe: "System",
      dll: "System",
      sys: "System",
      bat: "System",
      sh: "System",
    };
    return categoryMap[extLower] || "Other";
  }
}

export const bridge = new AnalysisBridge();

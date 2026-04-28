/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

export interface AnalysisResult {
  totalFiles: number;
  totalSize: number;
  files: Array<{ name: string; size: number; path: string; extension: string; category: string }>;
  categories?: {
    [key: string]: {
      count: number;
      size: number;
      files: Array<{ name: string; size: number; path: string }>;
    };
  };
  extensionStats?: { [key: string]: { count: number; size: number } };
  analysisType?: string;
  analysisTime?: number;
  directoryPath?: string;
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

export interface AnalysisProgress {
  files: number;
  percentage: number;
  currentFile: string;
  completed?: boolean;
  analysisId?: string;
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
        // Use Vite proxy in development (simpler and more reliable)
        this.baseUrl = `${window.location.origin}/api`;
        this.log("info", `🔗 AnalysisBridge initialized with proxy baseUrl: ${this.baseUrl}`);
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

      // Use basic analysis endpoint for stability
      const response = await this.fetchWithRetry(`${this.baseUrl}/analyze`, {
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
        files: [], // Backend doesn't return individual files for large directories
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
      };

      return analysisResult;
    } catch (error) {
      this.log("error", `Directory analysis failed: ${error.message}`);
      throw new Error(`Failed to analyze directory: ${error.message}`);
    }
  }

  async analyzeDirectoryWithProgress(
    path: string,
    onProgress?: (progress: AnalysisProgress) => void,
    options?: { useOllama?: boolean }
  ): Promise<{ result: AnalysisResult; analysisId: string }> {
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

    // Start the analysis using analyze endpoint
    console.warn("🚀 Sending analysis request...");
    const analyzeResponse = await this.fetchWithRetry(
      `${this.baseUrl}/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: normalizedPath,
          options: { ai: true, media: true, useOllama: options?.useOllama !== false },
        }),
      },
      300000,
      5
    ); // 5 minute timeout, 5 retries for analysis

    console.warn("📡 Analysis request response status:", analyzeResponse.status);

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

          const progressResponse = await fetch(`${this.baseUrl}/progress/${immediateAnalysisId}`);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            console.warn("📊 Progress data received:", progressData);

            if (progressData.success && progressData.progress) {
              const progress = progressData.progress;
              console.warn("📊 About to call progress callback with:", {
                files: progress.filesProcessed || 0,
                percentage: progress.percentage || 0,
                currentFile: progress.currentFile || "",
                completed: progress.status === "complete",
              });

              // Call the callback immediately
              onProgress({
                files: progress.filesProcessed || 0,
                percentage: progress.percentage || 0,
                currentFile: progress.currentFile || "",
                completed: progress.status === "complete",
              });

              console.warn("✅ Progress callback called successfully");
            }

            // Continue polling if not complete (reduced from 1s to 2s for better performance)
            if (
              progressData.progress &&
              progressData.progress.status !== "complete" &&
              pollAttempts < maxPollAttempts
            ) {
              console.warn("🔄 Scheduling next poll in 2 seconds...");
              setTimeout(pollProgress, 2000);
            } else if (progressData.progress && progressData.progress.status === "complete") {
              console.warn("✅ Analysis complete, stopping polling");
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

      // Start polling immediately
      console.warn("🚀 Starting pollProgress immediately...");
      pollProgress();
    } else {
      console.warn("⚠️ No progress callback provided");
    }

    // Wait for analysis to complete and get results
    console.warn("⏳ Starting results polling...");
    let attempts = 0;
    const maxAttempts = 180; // Reduce to 3 minutes for automated testing
    let pollInterval = 2000; // Start with 2 second intervals

    while (attempts < maxAttempts) {
      console.warn(`🔄 Results poll attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        const resultsResponse = await fetch(`${this.baseUrl}/results/${immediateAnalysisId}`);
        console.warn("📋 Results response status:", resultsResponse.status);

        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json();
          console.warn("📋 Results data received:", resultsData);

          if (resultsData.success) {
            console.warn("✅ Analysis results successfully retrieved!");
            return { result: resultsData.data, analysisId: immediateAnalysisId };
          }
        } else if (resultsResponse.status === 202) {
          console.warn("⏳ Analysis still processing (202 Accepted)");
          attempts++;
          // Exponential backoff: increase interval by 500ms every 10 attempts, max 5 seconds
          if (attempts % 10 === 0 && pollInterval < 5000) {
            pollInterval += 500;
            console.warn(`📈 Increasing poll interval to ${pollInterval}ms`);
          }
          continue;
        } else {
          console.error("❌ Results endpoint error:", resultsResponse.status);
          throw new Error("Results endpoint error");
        }
      } catch (error) {
        console.error("❌ Results polling error:", error);
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
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
        `${this.baseUrl}/health`,
        {
          method: "GET",
        },
        5000
      ); // Shorter timeout for health checks

      const data = await response.json();

      if (!data.status || data.status !== "ok") {
        throw new Error("Backend health check returned unhealthy status");
      }

      this.log("debug", "Health check passed");
      return data;
    } catch (error) {
      this.log("error", `Health check failed: ${error.message}`);
      throw new Error(`Backend connection failed: ${error.message}`);
    }
  }
}

export const bridge = new AnalysisBridge();

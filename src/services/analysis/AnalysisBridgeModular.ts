/**
 * Modularized AnalysisBridge
 * Orchestrates all analysis bridge modules for better maintainability
 */

import { AnalysisBridgeCore } from './analysis-bridge/core/AnalysisBridgeCore';
import { PathValidator } from './analysis-bridge/utils/PathValidator';
import { ProgressManager } from './analysis-bridge/managers/ProgressManager';
import { SSEManager } from './analysis-bridge/managers/SSEManager';
import { ResultsManager } from './analysis-bridge/managers/ResultsManager';
import { ErrorHandler } from './analysis-bridge/utils/ErrorHandler';
import type { 
  AnalysisProgress, 
  AnalysisResult, 
  AnalysisOptions, 
  BackendResponse,
  BridgeError 
} from './analysis-bridge/types';

export class AnalysisBridgeModular {
  private core: AnalysisBridgeCore;
  private progressManager: ProgressManager;
  private sseManager: SSEManager;
  private resultsManager: ResultsManager;
  private errorHandler: ErrorHandler;

  constructor() {
    this.core = new AnalysisBridgeCore();
    this.progressManager = new ProgressManager(this.core.config.baseUrl);
    this.sseManager = new SSEManager(this.core.config.baseUrl);
    this.resultsManager = new ResultsManager(this.core.config.baseUrl);
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Enhanced analysis ID extraction with validation
   */
  private extractAnalysisId(response: BackendResponse): string | null {
    const possibleIds = [
      response.analysisId,
      response.serviceMetadata?.analysisId,
      response.taskId,
      response.id,
      response.meta?.taskId,
    ];
    
    for (const id of possibleIds) {
      if (id && typeof id === 'string' && id.trim().length > 0) {
        console.log(`✅ Found analysis ID: ${id}`);
        return id.trim();
      }
    }
    
    console.warn("⚠️ No analysis ID found in response:", response);
    return null;
  }

  /**
   * Main analysis method with progress tracking
   */
  async analyzeDirectoryWithProgress(
    path: string,
    onProgress?: (progress: AnalysisProgress) => void,
    options?: AnalysisOptions
  ): Promise<{ result: AnalysisResult; analysisId: string }> {
    const context = this.errorHandler.createContext({
      userAction: 'analyzeDirectoryWithProgress',
      endpoint: '/api/analyze',
    });

    return this.errorHandler.withErrorHandling(async () => {
      console.log("🔍 Starting analysis with modular architecture");

      // Validate and normalize path
      const normalizedPath = PathValidator.validateAndNormalizePath(path);
      
      console.log("📂 Original path received:", path);
      console.log("📂 Normalized path for analysis:", normalizedPath);
      console.log("🌐 Using baseUrl:", this.core.config.baseUrl);

      // Start analysis
      const analysisId = await this.startAnalysis(normalizedPath, options);
      
      // Set analysis ID for tracking
      if (typeof window !== "undefined") {
        (window as any).__currentAnalysisId = analysisId;
      }

      // Handle progress tracking
      if (onProgress) {
        await this.trackProgress(analysisId, onProgress);
      }

      // Get results
      const result = await this.resultsManager.pollForResults(analysisId);

      return { result, analysisId };
    }, context);
  }

  /**
   * Start analysis and return analysis ID
   */
  private async startAnalysis(
    normalizedPath: string,
    options?: AnalysisOptions
  ): Promise<string> {
    const requestBody = {
      directoryPath: normalizedPath,
      options: { 
        ai: true, 
        media: true, 
        useOllama: options?.useOllama !== false,
        ...options,
      },
    };

    console.log("🚀 Sending analysis request...");
    console.log("📡 Request URL:", `${this.core.config.baseUrl}/api/analyze`);
    console.log("📡 Request body:", requestBody);

    const response = await this.core.fetchWithRetry(
      `${this.core.config.baseUrl}/api/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      30000, // 30 second timeout
      2 // 2 retries
    );

    console.log("📡 Analysis request response status:", response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ Analysis request failed:", error);
      throw this.errorHandler.createError(
        error.error || `Analysis failed: ${response.statusText}`,
        'ANALYSIS_START_FAILED'
      );
    }

    const startResponse = await response.json();
    console.log("✅ Analysis started:", startResponse);

    // Extract and validate analysis ID
    const analysisId = this.extractAnalysisId(startResponse);
    
    if (!analysisId) {
      throw this.errorHandler.createError(
        "Backend did not return an analysis ID",
        'NO_ANALYSIS_ID'
      );
    }
    
    console.log("📋 Analysis ID for progress tracking:", analysisId);
    return analysisId;
  }

  /**
   * Track progress using SSE with polling fallback
   */
  private async trackProgress(
    analysisId: string,
    onProgress: (progress: AnalysisProgress) => void
  ): Promise<void> {
    console.log("🚀 Starting progress tracking with SSE + polling fallback");

    let pollFallbackUsed = false;
    let sseCleanup: (() => void) | null = null;

    // Try SSE first
    try {
      sseCleanup = this.sseManager.subscribeToProgress(
        analysisId,
        (progress) => {
          console.log("📊 SSE progress update received:", progress);
          onProgress(progress);
        },
        (error) => {
          console.warn("⚠️ SSE error, falling back to polling:", error);
          pollFallbackUsed = true;
          this.startPollingFallback(analysisId, onProgress);
        }
      );

      // Wait a bit to see if SSE connects
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // If SSE hasn't received any updates and we haven't fallen back to polling, start polling
      if (!pollFallbackUsed) {
        console.log("🔄 Starting simultaneous polling as backup");
        this.startPollingFallback(analysisId, onProgress);
      }

    } catch (error) {
      console.warn("⚠️ SSE setup failed, using polling only:", error);
      this.startPollingFallback(analysisId, onProgress);
    }

    // Note: Cleanup will be handled when analysis completes
  }

  /**
   * Start polling fallback for progress
   */
  private async startPollingFallback(
    analysisId: string,
    onProgress: (progress: AnalysisProgress) => void
  ): Promise<void> {
    try {
      await this.progressManager.pollProgress(analysisId, onProgress);
    } catch (error) {
      console.error("❌ Progress polling failed:", error);
      throw this.errorHandler.handleError(error as Error, {
        analysisId,
        endpoint: '/api/progress',
      });
    }
  }

  /**
   * Health check to verify backend is reachable
   */
  async checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
    return this.core.checkBackendHealth();
  }

  /**
   * Get results for a specific analysis ID
   */
  async getResults(analysisId: string): Promise<AnalysisResult | null> {
    const context = this.errorHandler.createContext({
      analysisId,
      endpoint: '/api/results',
    });

    return this.errorHandler.withErrorHandling(async () => {
      return await this.resultsManager.getResults(analysisId);
    }, context);
  }

  /**
   * Cancel an ongoing analysis
   */
  async cancelAnalysis(analysisId: string): Promise<boolean> {
    const context = this.errorHandler.createContext({
      analysisId,
      endpoint: '/api/analyze/cancel',
      userAction: 'cancelAnalysis',
    });

    return this.errorHandler.withErrorHandling(async () => {
      try {
        const response = await fetch(
          `${this.core.config.baseUrl}/api/analyze/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ analysisId }),
            signal: AbortSignal.timeout(5000),
          }
        );

        return response.ok;
      } catch (error) {
        console.error("❌ Failed to cancel analysis:", error);
        return false;
      }
    }, context);
  }

  /**
   * Get available analysis results
   */
  async getAvailableResults(): Promise<string[]> {
    return this.resultsManager.getAvailableResults();
  }

  /**
   * Get error log for debugging
   */
  getErrorLog(limit?: number) {
    return this.errorHandler.getErrorLog(limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.errorHandler.getErrorStats();
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorHandler.clearErrorLog();
  }

  /**
   * Get bridge configuration
   */
  getConfig() {
    return { ...this.core.config };
  }

  /**
   * Test SSE connection (for debugging)
   */
  async testSSEConnection(analysisId: string) {
    return this.sseManager.testConnection(analysisId);
  }
}

// Export the modular bridge as the default
export const bridge = new AnalysisBridgeModular();

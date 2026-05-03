/**
 * Results Manager Module
 * Handles results polling and retrieval
 */

import type { AnalysisResult } from '../types';

export interface ResultsConfig {
  maxAttempts: number;
  pollInterval: number;
  timeout: number;
  staleAnalysisThreshold: number;
}

export class ResultsManager {
  private config: ResultsConfig;
  private baseUrl: string;

  constructor(baseUrl: string, config: Partial<ResultsConfig> = {}) {
    this.baseUrl = baseUrl;
    this.config = {
      maxAttempts: 60,
      pollInterval: 2000,
      timeout: 10000,
      staleAnalysisThreshold: 5,
      ...config,
    };
  }

  /**
   * Enhanced results polling with better error handling
   */
  async pollForResults(
    analysisId: string
  ): Promise<AnalysisResult> {
    console.log(`📊 Starting results polling for analysis: ${analysisId}`);

    for (let attempts = 1; attempts <= this.config.maxAttempts; attempts++) {
      try {
        console.log(`🔄 Results poll attempt ${attempts}/${this.config.maxAttempts}`);

        let resultsResponse;
        try {
          resultsResponse = await fetch(
            `${this.baseUrl}/api/results/${analysisId}`,
            {
              signal: AbortSignal.timeout(this.config.timeout),
            }
          );
        } catch (fetchError) {
          console.error("❌ Results fetch error:", fetchError);
          if (attempts < this.config.maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, this.config.pollInterval));
            continue;
          } else {
            throw new Error(`Results polling failed after ${this.config.maxAttempts} attempts`);
          }
        }

        if (resultsResponse.ok) {
          const results = await resultsResponse.json();
          console.log("📊 Results response received:", results);

          // Validate and normalize results
          const normalizedResults = this.normalizeResults(results, analysisId);
          
          console.log("✅ Results retrieved successfully");
          return normalizedResults;
        }

        // Handle different error cases
        const errorText = await resultsResponse.text();
        console.error("❌ Results endpoint error:", {
          status: resultsResponse.status,
          statusText: resultsResponse.statusText,
          error: errorText,
          analysisId,
          url: `/api/results/${analysisId}`,
          attempt: `${attempts}/${this.config.maxAttempts}`,
        });

        if (resultsResponse.status === 404) {
          if (attempts > this.config.staleAnalysisThreshold) {
            console.warn(
              `⚠️ Analysis ID not found after ${attempts} attempts - likely stale analysis, stopping polling`
            );
            throw new Error(`Analysis not found: ${analysisId} - please start a new scan`);
          }
          console.log(
            `⏳ Analysis still running (attempt ${attempts}/${this.config.maxAttempts}), continuing to poll...`
          );
        } else {
          throw new Error(`Results endpoint error: ${resultsResponse.status} - ${errorText}`);
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('Analysis not found')) {
          throw error; // Re-throw stale analysis errors
        }
        
        console.error("❌ Results polling error:", error);
        if (attempts === this.config.maxAttempts) {
          throw new Error(`Results polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Wait before next attempt
      if (attempts < this.config.maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval));
      }
    }

    throw new Error(`Results polling failed after ${this.config.maxAttempts} attempts`);
  }

  /**
   * Get results immediately (single attempt)
   */
  async getResults(analysisId: string): Promise<AnalysisResult | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/results/${analysisId}`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (response.ok) {
        const results = await response.json();
        return this.normalizeResults(results, analysisId);
      } else if (response.status === 404) {
        return null;
      } else {
        const errorText = await response.text();
        throw new Error(`Results endpoint error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error("❌ Failed to get results:", error);
      return null;
    }
  }

  /**
   * Check if results are available without fetching them
   */
  async areResultsAvailable(analysisId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/results/${analysisId}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      console.error("❌ Failed to check results availability:", error);
      return false;
    }
  }

  /**
   * Normalize results data to ensure consistent format
   */
  private normalizeResults(results: any, analysisId: string): AnalysisResult {
    // Handle different result formats from backend
    if (results.data) {
      // Results wrapped in data property
      return this.formatAnalysisResult(results.data, analysisId);
    } else if (results.summary) {
      // Direct results with summary
      return this.formatAnalysisResult(results, analysisId);
    } else {
      // Minimal results - create default structure
      return {
        totalFiles: results.total_files || results.totalFiles || 0,
        totalSize: results.total_size || results.totalSize || 0,
        fileAnalysis: {
          files: results.files || [],
          summary: results.summary || {
            totalFiles: results.total_files || 0,
            totalSize: results.total_size || 0,
            categories: {},
            extensions: {},
          },
          categories: results.categories || {},
          extensionStats: results.extensionStats || results.extensions || {},
          duplicateGroups: results.duplicateGroups || [],
          duplicateCount: results.duplicateCount || 0,
          duplicateSize: results.duplicateSize || 0,
          hardLinkCount: results.hardLinkCount || 0,
          hardLinkSavings: results.hardLinkSavings || 0,
          apparentSize: results.apparentSize || 0,
        },
        performance: results.performance || {
          scan_duration_ms: 0,
          files_per_second: 0,
          bytes_per_second: 0,
          memory_peak_mb: 0,
          disk_reads: 0,
          cache_hits: 0,
          cache_misses: 0,
          cpu_usage_percent: 0,
          io_wait_time: 0,
        },
        insights: results.insights || [],
        aiAnalysis: results.aiAnalysis || null,
        metadata: {
          analysisId,
          timestamp: new Date().toISOString(),
          path: results.directory || results.path || '',
          version: '2.8.1',
        },
      };
    }
  }

  /**
   * Format analysis result into standard structure
   */
  private formatAnalysisResult(data: any, analysisId: string): AnalysisResult {
    return {
      totalFiles: data.summary?.totalFiles || data.total_files || 0,
      totalSize: data.summary?.totalSize || data.total_size || 0,
      fileAnalysis: {
        files: data.files || [],
        summary: data.summary || {
          totalFiles: data.total_files || 0,
          totalSize: data.total_size || 0,
          categories: data.categories || {},
          extensions: data.extensions || {},
        },
        categories: data.categories || {},
        extensionStats: data.extensionStats || data.extensions || {},
        duplicateGroups: data.duplicateGroups || [],
        duplicateCount: data.duplicateCount || 0,
        duplicateSize: data.duplicateSize || 0,
        hardLinkCount: data.hardLinkCount || 0,
        hardLinkSavings: data.hardLinkSavings || 0,
        apparentSize: data.apparentSize || 0,
      },
      performance: data.performance || {
        scan_duration_ms: 0,
        files_per_second: 0,
        bytes_per_second: 0,
        memory_peak_mb: 0,
        disk_reads: 0,
        cache_hits: 0,
        cache_misses: 0,
        cpu_usage_percent: 0,
        io_wait_time: 0,
      },
      insights: data.insights || [],
      aiAnalysis: data.aiAnalysis || null,
      metadata: {
        analysisId,
        timestamp: new Date().toISOString(),
        path: data.directory || data.path || '',
        version: '2.8.1',
      },
    };
  }

  /**
   * Delete results from backend (if supported)
   */
  async deleteResults(analysisId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/results/${analysisId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      console.error("❌ Failed to delete results:", error);
      return false;
    }
  }

  /**
   * Get list of available analysis results
   */
  async getAvailableResults(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/results`, {
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        return data.results || data.analyses || [];
      } else {
        console.error("❌ Failed to get available results:", response.status);
        return [];
      }
    } catch (error) {
      console.error("❌ Failed to get available results:", error);
      return [];
    }
  }
}

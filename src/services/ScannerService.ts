/**
 * Scanner Service - Handles all scanning-related operations
 * Extracted from analysis store for better maintainability
 */

import { ref } from "vue";
import { AnalysisBridge } from "./analysis/AnalysisBridge";

export interface ScannerOptions {
  ai?: boolean;
  media?: boolean;
  maxFiles?: number;
  includeHidden?: boolean;
  followSymlinks?: boolean;
  scannerType?: string;
}

export interface ScanProgress {
  files: number;
  percentage: number;
  currentFile: string;
  completed: boolean;
  totalSize: number;
}

export interface ScanResult {
  success: boolean;
  analysisId?: string;
  result?: any;
  error?: string;
}

export class ScannerService {
  private analysisBridge: AnalysisBridge;
  private isScanning = ref(false);
  private currentAnalysisId = ref<string | null>(null);
  private progressCallback: ((progress: ScanProgress) => void) | null = null;

  constructor() {
    this.analysisBridge = new AnalysisBridge();
  }

  /**
   * Start scanning a directory with optional AI enhancement
   */
  async startScanning(
    directoryPath: string,
    options: ScannerOptions = {},
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResult> {
    try {
      this.isScanning.value = true;
      this.progressCallback = onProgress || null;

      // Clean the path
      const cleanPath = directoryPath.replace(/^["']|["']$/g, "");

      console.log(`🚀 Starting scan of: ${cleanPath}`);

      // Use the analysis bridge with progress tracking
      const result = await this.analysisBridge.analyzeDirectoryWithProgress(
        cleanPath,
        (progressInfo) => {
          // Update progress if callback provided
          if (this.progressCallback) {
            this.progressCallback({
              files: progressInfo.files || 0,
              percentage: progressInfo.percentage || 0,
              currentFile: progressInfo.currentFile || "Scanning...",
              completed: progressInfo.completed || false,
              totalSize: progressInfo.totalSize || 0,
            });
          }
        },
        { useOllama: options.ai }
      );

      this.currentAnalysisId.value = result.analysisId;
      this.isScanning.value = false;

      return {
        success: true,
        analysisId: result.analysisId,
        result: result.result,
      };
    } catch (error) {
      this.isScanning.value = false;
      this.currentAnalysisId.value = null;

      return {
        success: false,
        error: error instanceof Error ? error.message : "Scanning failed",
      };
    }
  }

  /**
   * Cancel the current scanning operation
   */
  async cancelScanning(): Promise<boolean> {
    if (!this.isScanning.value || !this.currentAnalysisId.value) {
      return false;
    }

    try {
      const response = await fetch("/api/analysis/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: this.currentAnalysisId.value,
        }),
      });

      if (response.ok) {
        this.isScanning.value = false;
        this.currentAnalysisId.value = null;
        return true;
      }
    } catch (error) {
      console.error("Failed to cancel scanning:", error);
    }

    return false;
  }

  /**
   * Check if backend is available
   */
  async checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
    return await this.analysisBridge.checkBackendHealth();
  }

  /**
   * Get scan status
   */
  get isScanningActive(): boolean {
    return this.isScanning.value;
  }

  /**
   * Get current analysis ID
   */
  get currentScanId(): string | null {
    return this.currentAnalysisId.value;
  }

  /**
   * Poll for scan progress
   */
  async pollProgress(): Promise<ScanProgress | null> {
    if (!this.currentAnalysisId.value) {
      return null;
    }

    try {
      const response = await fetch(`/api/progress/${this.currentAnalysisId.value}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return {
            files: data.files || 0,
            percentage: data.percentage || 0,
            currentFile: data.currentFile || "Scanning...",
            completed: data.completed || false,
            totalSize: data.totalSize || 0,
          };
        }
      }
    } catch (error) {
      console.warn("Failed to poll progress:", error);
    }

    return null;
  }

  /**
   * Get scan result by ID
   */
  async getScanResult(analysisId: string): Promise<any | null> {
    try {
      const response = await fetch(`/api/history/${analysisId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.analysis) {
          return data.analysis;
        }
      }
    } catch (error) {
      console.error("Failed to get scan result:", error);
    }

    return null;
  }

  /**
   * Get scan history
   */
  async getScanHistory(): Promise<any[]> {
    try {
      const response = await fetch("/api/analysis/history");
      const data = await response.json();
      return data.success ? data.analyses || [] : [];
    } catch (error) {
      console.error("Failed to get scan history:", error);
      return [];
    }
  }

  /**
   * Get analysis for current path
   */
  async getCurrentAnalysis(directoryPath: string): Promise<any | null> {
    try {
      const response = await fetch(
        `/api/analysis/current?path=${encodeURIComponent(directoryPath)}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.analysis) {
          return data.analysis;
        }
      }
    } catch (error) {
      console.error("Failed to get current analysis:", error);
    }

    return null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.isScanning.value = false;
    this.currentAnalysisId.value = null;
    this.progressCallback = null;
  }
}

// Singleton instance for app-wide use
export const scannerService = new ScannerService();

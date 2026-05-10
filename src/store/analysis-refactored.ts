/**
 * Refactored Analysis Store - Now uses smaller, focused components
 * Much more maintainable and easier to debug
 */

import { defineStore } from "pinia";
import { ref, watch, computed, onMounted } from "vue";
import { useDebugLogger } from "../utils/DebugUtils";
import { useNotificationStore } from "./notificationStore";
import { scannerService } from "../services/ScannerService";
import { useProgressTracker } from "../services/ProgressTracker";
import { useDataPersistence } from "../utils/DataPersistence";

// Initialize logger
const logger = useDebugLogger("AnalysisStore");

// Type definitions
interface AnalysisData {
  file_analysis?: {
    files: Array<any>;
  };
  [key: string]: unknown;
}

// Legacy window logger for backwards compatibility
const log = (tag: string, ...args: unknown[]) => {
  logger.info(tag, ...args);
  // Also save to window for inspection
  const timestamp = new Date().toISOString();
  const entry = { timestamp, tag, data: args };
  if (typeof window !== "undefined") {
    const globalWindow = window as unknown as {
      __debugLogs?: Array<{ timestamp: string; tag: string; data: unknown[] }>;
      __TAURI__?: unknown;
    };
    globalWindow.__debugLogs = globalWindow.__debugLogs || [];
    globalWindow.__debugLogs.push(entry);
  }
};

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

export const useAnalysisStore = defineStore("analysis", () => {
  // Core state
  const path = ref(
    localStorage.getItem("lastPath") || "E:\\Self Built Web and Mobile Apps\\Space Analyzer"
  );
  const status = ref("idle");
  const data = ref<AnalysisData | null>(null);
  const error = ref<string | null>(null);
  const useAI = ref(false);
  const scannedFiles = ref<any[]>([]);
  const recentlyScannedFiles = ref<string[]>([]);

  // Services
  const dataPersistence = useDataPersistence();
  const progressTracker = useProgressTracker();

  // Computed properties
  const isAnalysisRunning = computed(() => scannerService.isScanningActive());
  const isLoading = ref(false);
  const currentAnalysisId = computed(() => scannerService.currentAnalysisId);
  const analysisResult = computed(() => data.value); // Alias for dashboard components

  // Progress data from tracker
  const progressData = computed(() => progressTracker.progress);
  const progress = computed(() => progressTracker.percentage);
  const filesScanned = computed(() => progressTracker.filesScanned);
  const currentFile = computed(() => progressTracker.currentFile);
  const analysisStartTime = ref<number | null>(null);

  // Initialize store
  const initialize = async () => {
    const savedPath = localStorage.getItem("lastPath");
    if (savedPath) {
      path.value = savedPath;
    }

    // Try to load from localStorage first (most reliable)
    try {
      const savedAnalysis = dataPersistence.load("lastAnalysisResult");
      if (savedAnalysis && savedAnalysis.file_analysis && savedAnalysis.file_analysis.files) {
        data.value = savedAnalysis;
        log("LOCAL_STORAGE_LOADED", "Loaded analysis from localStorage");
        return;
      }
    } catch (error) {
      log("LOCAL_STORAGE_ERROR", "Failed to load from localStorage", error);
    }

    // If no localStorage data, try database
    if (savedPath) {
      const dbAnalysis = await scannerService.getCurrentAnalysis(savedPath);
      if (dbAnalysis) {
        data.value = dbAnalysis;
        log("DATABASE_LOADED", "Loaded analysis from database");
        return;
      }
    }

    // Try to find any existing analysis data
    try {
      const allAnalyses = await scannerService.getScanHistory();
      if (allAnalyses && allAnalyses.length > 0) {
        // Load the most recent analysis
        data.value = allAnalyses[0];
        log("PREVIOUS_SCAN_LOADED", "Loaded most recent scan data from database");
        return;
      }
    } catch (error) {
      log("HISTORY_LOAD_ERROR", "Failed to load analysis history", error);
    }

    // Only load sample data as last resort
    try {
      const sampleResponse = await fetch("/sample-analysis-data.json");
      if (sampleResponse.ok) {
        const sampleData = await sampleResponse.json();
        if (sampleData.success) {
          data.value = sampleData.analysis;
          log("SAMPLE_DATA_LOADED", "Loaded sample analysis data (no previous scans found)");
        }
      }
    } catch (error) {
      log("SAMPLE_DATA_ERROR", "Failed to load sample data", error);
    }
  };

  // Handle analysis
  const handleAnalysis = async (enableAI: boolean = false) => {
    try {
      logger.info("handleAnalysis called", { enableAI, path: path.value });
      log("ANALYSIS_START", "Starting analysis");
      status.value = "starting";
      error.value = null;
      data.value = null;
      scannedFiles.value = [];
      recentlyScannedFiles.value = [];
      useAI.value = enableAI;
      analysisStartTime.value = Date.now();

      logger.debug("Store state set", {
        status: status.value,
        isAnalysisRunning: isAnalysisRunning.value,
        path: path.value,
      });

      // Set up progress tracking
      progressTracker.startTracking(`analysis-${Date.now()}`, {
        onProgress: (progress) => {
          // Update recently scanned files
          if (
            progress.currentFile &&
            progress.currentFile !== "Starting scan..." &&
            progress.currentFile !== "Analysis complete"
          ) {
            recentlyScannedFiles.value.unshift(progress.currentFile);
            // Keep only the last 50 files
            if (recentlyScannedFiles.value.length > 50) {
              recentlyScannedFiles.value = recentlyScannedFiles.value.slice(0, 50);
            }
          }
        },
        onComplete: (result) => {
          log("ANALYSIS_COMPLETE", "Analysis completed successfully", {
            files: result?.file_analysis?.files?.length,
          });

          // Update store state
          data.value = result;
          status.value = "complete";

          // Populate scanned files
          if (result?.file_analysis?.files && Array.isArray(result.file_analysis.files)) {
            scannedFiles.value = result.file_analysis.files;
          }

          // Save to localStorage for persistence
          dataPersistence.save("lastAnalysisResult", result);

          // Save path for next time
          localStorage.setItem("lastPath", path.value);
        },
        onError: (errorMessage) => {
          log("ANALYSIS_ERROR", errorMessage);
          error.value = errorMessage;
          status.value = "error";
        },
      });

      // Start scanning with the scanner service
      const scanResult = await scannerService.startScanning(
        path.value,
        {
          ai: enableAI,
          media: true,
          maxFiles: 5000,
          includeHidden: false,
          followSymlinks: false,
        },
        progressTracker.updateProgress.bind(progressTracker)
      );

      if (scanResult.success) {
        log("SCAN_SUCCESS", "Scanner service completed successfully");
        // The progress tracker will handle completion
      } else {
        progressTracker.handleError(scanResult.error || "Scanning failed");
        error.value = scanResult.error || "Scanning failed";
        status.value = "error";
      }
    } catch (err: unknown) {
      log("ERROR", err);
      error.value = err instanceof Error ? err.message : "Analysis failed";
      status.value = "error";
      progressTracker.handleError(error.value || "Analysis failed");

      // Show error notification
      const notificationStore = useNotificationStore();
      notificationStore.error("Scan Failed ❌", error.value || "An error occurred during scanning");
    }
  };

  // Cancel analysis
  const cancelAnalysis = async (): Promise<boolean> => {
    if (!isAnalysisRunning.value) {
      return false;
    }

    try {
      log("CANCEL", "Cancelling analysis");

      const cancelled = await scannerService.cancelScanning();

      if (cancelled) {
        status.value = "cancelled";
        progressTracker.reset();
        log("CANCEL_SUCCESS", "Analysis cancelled successfully");
      }

      return cancelled;
    } catch (error) {
      log("CANCEL_ERROR", "Failed to cancel analysis", error);
      return false;
    }
  };

  // Check backend health
  const checkBackend = async (): Promise<{ ok: boolean; error?: string }> => {
    return await scannerService.checkBackendHealth();
  };

  // Reset store state
  const reset = (): void => {
    status.value = "idle";
    data.value = null;
    error.value = null;
    scannedFiles.value = [];
    recentlyScannedFiles.value = [];
    useAI.value = false;
    progressTracker.reset();
    analysisStartTime.value = null;
  };

  // Fetch analysis from database by path
  const fetchAnalysisFromDB = async (directoryPath: string): Promise<any> => {
    return scannerService.getCurrentAnalysis(directoryPath);
  };

  // Get analysis history
  const getAnalysisHistory = async (): Promise<any[]> => {
    return scannerService.getScanHistory();
  };

  // Update progress from WebSocket
  const updateProgressFromWebSocket = (progressInfo: {
    files: number;
    percentage: number;
    currentFile: string;
    completed: boolean;
    totalSize?: number;
  }): void => {
    progressTracker.updateProgress(progressInfo);
  };

  // Auto-save on important state changes
  watch(
    [path, data, useAI, scannedFiles],
    () => {
      // Save analysis result to localStorage
      if (data.value && data.value.file_analysis?.files) {
        dataPersistence.save("lastAnalysisResult", data.value);
      }
      // Save path preference
      if (path.value) {
        localStorage.setItem("lastPath", path.value);
      }
    },
    { deep: true }
  );

  // Initialize on mount
  onMounted(() => {
    initialize();
  });

  return {
    // Core state
    path,
    status,
    data,
    analysisResult,
    error,
    useAI,
    scannedFiles,
    recentlyScannedFiles,

    // Progress tracking
    progress,
    progressData,
    filesScanned,
    currentFile,
    isAnalysisRunning,
    isLoading,
    currentAnalysisId,
    analysisStartTime,

    // Methods
    handleAnalysis,
    cancelAnalysis,
    checkBackend,
    reset,
    initialize,
    fetchAnalysisFromDB,
    getAnalysisHistory,
    updateProgressFromWebSocket,

    // Services (exposed for advanced use)
    scannerService,
    progressTracker,
    dataPersistence,

    // Computed properties
    progressPercentage: computed(() => progressTracker.percentage),
    duration: computed(() => progressTracker.duration),
    estimatedTimeRemaining: computed(() => progressTracker.estimatedTimeRemaining),
  };
});

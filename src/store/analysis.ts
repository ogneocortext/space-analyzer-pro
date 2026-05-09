import { defineStore } from "pinia";
import { ref, watch, onMounted } from "vue";
import { AnalysisBridge, FileInfo as BridgeFileInfo } from "@/services/analysis/AnalysisBridge";
import { useDebugLogger } from "@/services/DebugLogger";

// Initialize logger for analysis store
const logger = useDebugLogger("AnalysisStore");

// Type definitions
interface AnalysisData {
  file_analysis?: {
    files: Array<BridgeFileInfo>;
  };
  [key: string]: unknown;
}

interface ProgressData {
  files: number;
  percentage: number;
  currentFile: string;
  completed: boolean;
  totalSize: number;
}

interface DebugLogEntry {
  timestamp: string;
  tag: string;
  data: unknown[];
}

// Legacy window logger for backwards compatibility
const log = (tag: string, ...args: unknown[]) => {
  logger.info(tag, ...args);
  // Also save to window for inspection
  const timestamp = new Date().toISOString();
  const entry: DebugLogEntry = { timestamp, tag, data: args };
  if (typeof window !== "undefined") {
    const globalWindow = window as unknown as {
      __debugLogs?: DebugLogEntry[];
      __TAURI__?: unknown;
    };
    globalWindow.__debugLogs = globalWindow.__debugLogs || [];
    globalWindow.__debugLogs.push(entry);
  }
};

export const useAnalysisStore = defineStore("analysis", () => {
  const defaultPath =
    import.meta.env?.VITE_DEFAULT_PATH || "E:\\Self Built Web and Mobile Apps\\Space Analyzer";
  const path = ref(localStorage.getItem("lastPath") || defaultPath);
  const status = ref("idle");
  const progress = ref(0);
  const isAnalysisRunning = ref(false);
  const isLoading = ref(false);
  const currentAnalysisId = ref<string | null>(null);
  // Data will be fetched from database - don't store in localStorage
  const data = ref<AnalysisData | null>(null);
  const error = ref<string | null>(null);
  const useAI = ref(false);
  const scannedFiles = ref<BridgeFileInfo[]>([]);
  const recentlyScannedFiles = ref<string[]>([]);
  const progressData = ref<ProgressData>({
    files: 0,
    percentage: 0,
    currentFile: "",
    completed: false,
    totalSize: 0,
  });
  const abortController = ref<AbortController | null>(null);
  const analysisStartTime = ref<number | null>(null);

  const analysisBridge = new AnalysisBridge();

  // Check if backend is available
  async function checkBackend(): Promise<{ ok: boolean; error?: string }> {
    return await analysisBridge.checkBackendHealth();
  }

  // Update progress data from external sources (WebSocket/SSE/Tauri)
  function updateProgressFromWebSocket(progressInfo: {
    files: number;
    percentage: number;
    currentFile: string;
    completed: boolean;
    totalSize?: number;
  }) {
    logger.debug("Updating progress from WebSocket", progressInfo);

    progressData.value = {
      files: progressInfo.files,
      percentage: progressInfo.percentage,
      currentFile: progressInfo.currentFile,
      completed: progressInfo.completed,
      totalSize: progressInfo.totalSize ?? progressData.value.totalSize ?? 0,
    };
    progress.value = progressInfo.percentage;

    logger.debug("Updated progressData", progressData.value);

    // Update status if completed
    if (progressInfo.completed) {
      status.value = "complete";
      isAnalysisRunning.value = false;
    } else if (!isAnalysisRunning.value && !progressInfo.completed) {
      // Mark as running when we receive progress
      isAnalysisRunning.value = true;
      status.value = "analyzing";
    }
  }

  // Register store update function for WebSocket updates
  if (typeof window !== "undefined") {
    const globalWindow = window as unknown as {
      __updateStoreProgress?: (progressInfo: ProgressData) => void;
    };
    globalWindow.__updateStoreProgress = updateProgressFromWebSocket;
  }

  // Cancel ongoing analysis
  async function cancelAnalysis() {
    log("CANCEL", "Cancelling analysis");

    // First try to cancel via backend API
    if (isAnalysisRunning.value && currentAnalysisId.value) {
      try {
        const response = await fetch("/api/analysis/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisId: currentAnalysisId.value }),
        });

        if (response.ok) {
          const result = await response.json();
          log("CANCEL_SUCCESS", "Backend cancel successful", result);
        } else {
          log("CANCEL_ERROR", "Backend cancel failed", response.status);
        }
      } catch (error) {
        log("CANCEL_ERROR", "Failed to call backend cancel", error);
      }
    }

    // Also abort any ongoing fetch requests
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }

    // Update store state
    isAnalysisRunning.value = false;
    currentAnalysisId.value = null;
    isLoading.value = false;
    status.value = "cancelled";
    progress.value = 0;

    // Clean up any stored unsubscribe functions
    if (typeof window !== "undefined") {
      const globalWindow = window as unknown as { __analysisUnsubscribe?: (() => void) | null };
      if (globalWindow.__analysisUnsubscribe) {
        globalWindow.__analysisUnsubscribe();
        globalWindow.__analysisUnsubscribe = null;
      }
    }
  }

  const handleAnalysis = async (enableAI: boolean = false) => {
    // Record analysis start time
    analysisStartTime.value = Date.now();

    try {
      logger.info("handleAnalysis called", { enableAI, path: path.value });
      log("ANALYSIS_START", "Starting analysis");
      status.value = "starting";
      isAnalysisRunning.value = true;
      error.value = null;
      progress.value = 0;
      data.value = null;
      scannedFiles.value = [];
      recentlyScannedFiles.value = [];
      useAI.value = enableAI;

      logger.debug("Store state set", {
        status: status.value,
        isAnalysisRunning: isAnalysisRunning.value,
        path: path.value,
      });

      const { result, analysisId } = await analysisBridge.analyzeDirectoryWithProgress(
        path.value,
        (progressInfo) => {
          logger.debug("Progress callback received", progressInfo);
          log("PROGRESS", progressInfo);
          progress.value = progressInfo.percentage;
          progressData.value = {
            files: progressInfo.files,
            percentage: progressInfo.percentage,
            currentFile: progressInfo.currentFile,
            completed: progressInfo.completed || false,
            totalSize: progressInfo.totalSize || 0,
          };
          status.value = "analyzing";

          logger.debug("Updated progressData", progressData.value);

          // Add current file to recently scanned files list
          if (
            progressInfo.currentFile &&
            progressInfo.currentFile !== "Starting scan..." &&
            progressInfo.currentFile !== "Analysis complete"
          ) {
            recentlyScannedFiles.value.unshift(progressInfo.currentFile);
            // Keep only the last 50 files
            if (recentlyScannedFiles.value.length > 50) {
              recentlyScannedFiles.value = recentlyScannedFiles.value.slice(0, 50);
            }
          }
        },
        { useOllama: enableAI }
      );

      currentAnalysisId.value = analysisId;

      log("RESULT", result);
      data.value = result as unknown as AnalysisData;
      // Populate scannedFiles from result for RealTimeFileScanner
      if (result?.file_analysis?.files && Array.isArray(result.file_analysis.files)) {
        scannedFiles.value = result.file_analysis.files;
      }
      status.value = "complete";
      progress.value = 100;
      progressData.value.completed = true;
      isAnalysisRunning.value = false;

      // Save only the path for next time - data is stored in database
      localStorage.setItem("lastPath", path.value);
    } catch (err: unknown) {
      log("ERROR", err);
      error.value = err instanceof Error ? err.message : "Analysis failed";
      status.value = "error";
      isAnalysisRunning.value = false;
    }
  };

  // Fetch analysis from database by path
  const fetchAnalysisFromDB = async (directoryPath: string) => {
    try {
      log("FETCH_DB", "Fetching analysis from database", directoryPath);
      const response = await fetch(
        `/api/analysis/current?path=${encodeURIComponent(directoryPath)}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.analysis) {
          data.value = result.analysis;
          scannedFiles.value = result.analysis.files || [];
          log("FETCH_DB_SUCCESS", "Loaded analysis from", result.source);
          return result.analysis;
        }
      }
      log("FETCH_DB_MISS", "No analysis found in database");
      return null;
    } catch (err) {
      log("FETCH_DB_ERROR", err);
      return null;
    }
  };

  // Get analysis history from backend
  const getAnalysisHistory = async () => {
    try {
      log("FETCH_HISTORY", "Fetching analysis history from backend");
      const response = await fetch("/api/analysis/history");
      const data = await response.json();

      if (data.success) {
        log(
          "FETCH_HISTORY_SUCCESS",
          "Analysis history fetched successfully",
          data.analyses?.length || 0
        );
        return data.analyses || [];
      } else {
        log("FETCH_HISTORY_ERROR", "Failed to fetch analysis history", data.error);
        throw new Error(data.error || "Failed to fetch analysis history");
      }
    } catch (error) {
      log("FETCH_HISTORY_ERROR", "Error fetching analysis history", error);
      throw error;
    }
  };

  // Initialize: try to load previous analysis from database
  const initialize = async () => {
    const savedPath = localStorage.getItem("lastPath");
    if (savedPath) {
      path.value = savedPath;
      const dbAnalysis = await fetchAnalysisFromDB(savedPath);

      // Only load sample data if no previous scan data exists at all
      if (!dbAnalysis) {
        // Try to find any existing analysis data in the database
        try {
          const allAnalyses = await getAnalysisHistory();
          if (allAnalyses && allAnalyses.length > 0) {
            // Load the most recent analysis
            data.value = allAnalyses[0];
            log("PREVIOUS_SCAN_LOADED", "Loaded most recent scan data");
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
      }
    } else {
      log("PREVIOUS_SCAN_LOADED", "Loaded previous analysis from database");
    }
  };

  const reset = () => {
    status.value = "idle";
    progress.value = 0;
    isAnalysisRunning.value = false;
    currentAnalysisId.value = null;
    data.value = null;
    error.value = null;
    scannedFiles.value = [];
    recentlyScannedFiles.value = [];
    progressData.value = {
      files: 0,
      percentage: 0,
      currentFile: "",
      completed: false,
      totalSize: 0,
    };
    // Clear persisted data (path is kept for convenience)
    // Analysis data is cleared from memory only, database keeps history
  };

  // Progress polling mechanism
  let progressPollingInterval: NodeJS.Timeout | null = null;

  const startProgressPolling = () => {
    if (progressPollingInterval) return;

    progressPollingInterval = setInterval(async () => {
      if (currentAnalysisId.value && isAnalysisRunning.value) {
        try {
          const response = await fetch(`/api/progress/${currentAnalysisId.value}`);
          if (response.ok) {
            const backendProgress = await response.json();
            if (backendProgress.success) {
              // Update progress data from backend
              progressData.value = {
                files: backendProgress.files || 0,
                percentage: backendProgress.percentage || 0,
                currentFile: backendProgress.currentFile || "Scanning...",
                completed: backendProgress.completed || false,
                totalSize: backendProgress.totalSize || 0,
              };
              progress.value = backendProgress.percentage || 0;

              log("PROGRESS_POLL", "Updated progress from backend", progressData.value);
            }
          }
        } catch (error: unknown) {
          log("PROGRESS_POLL_ERROR", "Failed to fetch progress", error);
        }
      }
    }, 1000); // Poll every 1 second
  };

  const stopProgressPolling = () => {
    if (progressPollingInterval) {
      clearInterval(progressPollingInterval);
      progressPollingInterval = null;
    }
  };

  // Watch for analysis running state to manage polling
  watch(isAnalysisRunning, (running) => {
    if (running) {
      startProgressPolling();
    } else {
      stopProgressPolling();
    }
  });

  // Watch for current analysis ID changes
  watch(currentAnalysisId, (newId) => {
    if (newId && isAnalysisRunning.value) {
      startProgressPolling();
    } else if (!newId) {
      stopProgressPolling();
    }
  });

  // Persistence functions
  const saveToStorage = () => {
    try {
      const storeData = {
        path: path.value,
        status: status.value,
        data: data.value,
        useAI: useAI.value,
        scannedFiles: scannedFiles.value,
        recentlyScannedFiles: recentlyScannedFiles.value,
        progressData: progressData.value,
        timestamp: new Date().toISOString(),
      };

      // Save to localStorage
      localStorage.setItem("analysis-store", JSON.stringify(storeData));

      log("STORAGE_SAVE", "Analysis store saved to localStorage");
    } catch (error) {
      log("STORAGE_SAVE_ERROR", "Failed to save analysis store", error);
    }
  };

  const loadFromStorage = () => {
    try {
      const savedData = localStorage.getItem("analysis-store");

      if (!savedData) {
        log("STORAGE_LOAD", "No saved analysis store data found");
        return;
      }

      const parsedData = JSON.parse(savedData);

      // Restore state with validation
      if (parsedData.path) path.value = parsedData.path;
      if (parsedData.status) status.value = parsedData.status;
      if (parsedData.data) data.value = parsedData.data;
      if (parsedData.useAI !== undefined) useAI.value = parsedData.useAI;
      if (parsedData.scannedFiles) scannedFiles.value = parsedData.scannedFiles;
      if (parsedData.recentlyScannedFiles)
        recentlyScannedFiles.value = parsedData.recentlyScannedFiles;
      if (parsedData.progressData) progressData.value = parsedData.progressData;

      log("STORAGE_LOAD", "Analysis store loaded from localStorage", {
        timestamp: parsedData.timestamp,
      });
    } catch (error) {
      log("STORAGE_LOAD_ERROR", "Failed to load analysis store", error);
    }
  };

  const clearStorage = () => {
    try {
      localStorage.removeItem("analysis-store");
      log("STORAGE_CLEAR", "Analysis store cleared from localStorage");
    } catch (error) {
      log("STORAGE_CLEAR_ERROR", "Failed to clear analysis store", error);
    }
  };

  // Auto-save on important state changes
  watch(
    [path, data, useAI, scannedFiles, progressData],
    () => {
      saveToStorage();
    },
    { deep: true }
  );

  // Load from storage on initialization
  // Note: onMounted in Pinia stores works differently than in components
  // We'll initialize in the initialize method instead
  // onMounted(() => {
  //   loadFromStorage();
  // });

  return {
    path,
    status,
    progress,
    isAnalysisRunning,
    isLoading,
    data,
    analysisResult: data, // Alias for dashboard components
    error,
    useAI,
    scannedFiles,
    recentlyScannedFiles,
    progressData,
    analysisStartTime,
    handleAnalysis,
    cancelAnalysis,
    checkBackend,
    reset,
    initialize,
    saveToStorage,
    loadFromStorage,
    clearStorage,
    fetchAnalysisFromDB,
    getAnalysisHistory,
    updateProgressFromWebSocket,
  };
});

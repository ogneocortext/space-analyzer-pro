import { defineStore } from "pinia";
import { ref } from "vue";
import { AnalysisBridge } from "@/services/analysis/AnalysisBridge";
import { useDebugLogger } from "@/services/DebugLogger";

// Initialize logger for analysis store
const logger = useDebugLogger("AnalysisStore");

// Legacy window logger for backwards compatibility
const log = (tag: string, ...args: any[]) => {
  logger.info(tag, ...args);
  // Also save to window for inspection
  const timestamp = new Date().toISOString();
  const entry = { timestamp, tag, data: args };
  if (typeof window !== "undefined") {
    (window as any).__debugLogs = (window as any).__debugLogs || [];
    (window as any).__debugLogs.push(entry);
  }
};

export const useAnalysisStore = defineStore("analysis", () => {
  const path = ref(
    localStorage.getItem("lastPath") || "E:\\Self Built Web and Mobile Apps\\Space Analyzer"
  );
  const status = ref("idle");
  const progress = ref(0);
  const isAnalysisRunning = ref(false);
  const isLoading = ref(false);
  const currentAnalysisId = ref<string | null>(null);
  // Data will be fetched from database - don't store in localStorage
  const data = ref<any>(null);
  const error = ref<string | null>(null);
  const useAI = ref(false);
  const scannedFiles = ref<any[]>([]);
  const recentlyScannedFiles = ref<string[]>([]);
  const progressData = ref({
    files: 0,
    percentage: 0,
    currentFile: "",
    completed: false as boolean | undefined,
    totalSize: 0,
  });
  // Initialize backend status - in Tauri mode, set to ok by default
  const isTauriMode = typeof window !== "undefined" && !!(window as any).__TAURI__;
  const backendStatus = ref(isTauriMode ? { ok: true } : null);
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
    (window as any).__updateStoreProgress = updateProgressFromWebSocket;
  }

  // Cancel ongoing analysis
  function cancelAnalysis() {
    log("CANCEL", "Cancelling analysis");
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    // Also try to cancel via API
    if (isAnalysisRunning.value) {
      const body = currentAnalysisId.value
        ? JSON.stringify({ analysisId: currentAnalysisId.value })
        : "{}";
      fetch(`${analysisBridge.baseUrl}/api/analysis/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {
        // Ignore errors - backend might not support cancel
      });
    }
    isAnalysisRunning.value = false;
    currentAnalysisId.value = null;
    isLoading.value = false;
    status.value = "cancelled";

    // Clean up any stored unsubscribe functions
    if (typeof window !== "undefined" && (window as any).__analysisUnsubscribe) {
      (window as any).__analysisUnsubscribe();
      (window as any).__analysisUnsubscribe = null;
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
      data.value = result;
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
    } catch (err) {
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
        if (result.success && result.data) {
          data.value = result.data;
          scannedFiles.value = result.data.files || [];
          log("FETCH_DB_SUCCESS", "Loaded analysis from", result.source);
          return result.data;
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
      await fetchAnalysisFromDB(savedPath);
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
    fetchAnalysisFromDB,
    getAnalysisHistory,
    updateProgressFromWebSocket,
  };
});

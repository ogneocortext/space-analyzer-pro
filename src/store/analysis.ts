import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { AnalysisBridge } from "@/services/AnalysisBridge";

// Simple logger that saves to window object for inspection
const log = (tag: string, ...args: any[]) => {
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

  const analysisBridge = new AnalysisBridge();

  const handleAnalysis = async (enableAI: boolean = false) => {
    try {
      log("ANALYSIS_START", "Starting analysis");
      status.value = "starting";
      isAnalysisRunning.value = true;
      error.value = null;
      progress.value = 0;
      data.value = null;
      scannedFiles.value = [];
      recentlyScannedFiles.value = [];
      useAI.value = enableAI;

      const { result } = await analysisBridge.analyzeDirectoryWithProgress(
        path.value,
        (progressInfo) => {
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

      log("RESULT", result);
      data.value = result;
      // Populate scannedFiles from result for RealTimeFileScanner
      if (result?.files && Array.isArray(result.files)) {
        scannedFiles.value = result.files;
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
    data,
    analysisResult: data, // Alias for dashboard components
    error,
    useAI,
    scannedFiles,
    recentlyScannedFiles,
    progressData,
    handleAnalysis,
    reset,
    initialize,
    fetchAnalysisFromDB,
  };
});

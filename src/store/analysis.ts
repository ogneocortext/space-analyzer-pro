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
  const data = ref<any>(null);
  const error = ref<string | null>(null);
  const useAI = ref(false);
  const scannedFiles = ref<any[]>([]);
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

      // Save path for next time
      localStorage.setItem("lastPath", path.value);
    } catch (err) {
      log("ERROR", err);
      error.value = err instanceof Error ? err.message : "Analysis failed";
      status.value = "error";
      isAnalysisRunning.value = false;
    }
  };

  const reset = () => {
    status.value = "idle";
    progress.value = 0;
    isAnalysisRunning.value = false;
    data.value = null;
    error.value = null;
    scannedFiles.value = [];
    progressData.value = {
      files: 0,
      percentage: 0,
      currentFile: "",
      completed: false,
      totalSize: 0,
    };
  };

  return {
    path,
    status,
    progress,
    isAnalysisRunning,
    data,
    error,
    useAI,
    scannedFiles,
    progressData,
    handleAnalysis,
    reset,
  };
});

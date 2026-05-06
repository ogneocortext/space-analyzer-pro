import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { AnalysisResult } from "../services/AnalysisBridge";

// Analysis store
export const useAnalysisStore = defineStore("analysis", () => {
  const analysisResult = ref<AnalysisResult | null>(null);
  const isAnalyzing = ref(false);
  const analysisProgress = ref(0);
  const analysisError = ref<string | null>(null);
  const currentFile = ref("");
  const filesScanned = ref(0);

  // Analysis controls
  const startAnalysis = async (path: string) => {
    isAnalyzing.value = true;
    analysisProgress.value = 0;
    analysisError.value = null;
    try {
      // Import bridge dynamically to avoid circular dependencies
      const { bridge } = await import("../services/AnalysisBridge");

      const result = await bridge.analyzeDirectoryWithProgress(path, (progress) => {
        console.warn("Progress callback:", progress);
        analysisProgress.value = progress.percentage;
        currentFile.value = progress.currentFile || "";
        filesScanned.value = progress.files || 0;
      });

      analysisResult.value = result.result;
      isAnalyzing.value = false;
      analysisProgress.value = 100;
      currentFile.value = "Analysis complete";
      filesScanned.value = result.result?.totalFiles || 0;
    } catch (error: any) {
      analysisError.value = error.message;
      isAnalyzing.value = false;
    }
  };

  const cancelAnalysis = () => {
    isAnalyzing.value = false;
    analysisProgress.value = 0;
    currentFile.value = "";
    filesScanned.value = 0;
  };

  const clearAnalysis = () => {
    analysisResult.value = null;
    analysisProgress.value = 0;
    analysisError.value = null;
    currentFile.value = "";
    filesScanned.value = 0;
  };

  const updateProgress = (progress: number) => {
    analysisProgress.value = progress;
  };

  const setAnalysisError = (error: string | null) => {
    analysisError.value = error;
  };

  return {
    // State
    analysisResult,
    isAnalyzing,
    analysisProgress,
    analysisError,
    currentFile,
    filesScanned,
    // Actions
    startAnalysis,
    cancelAnalysis,
    clearAnalysis,
    updateProgress,
    setAnalysisError,
  };
});

// AI store
export const useAIStore = defineStore("ai", () => {
  const messages = ref<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>>([]);

  const isChatLoading = ref(false);
  const chatError = ref<string | null>(null);

  const insights = ref<Array<{
    id: string;
    type: "recommendation" | "warning" | "info";
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    timestamp: Date;
  }>>([]);

  // AI controls
  const addMessage = (message: { role: "user" | "assistant"; content: string }) => {
    messages.value.push({
      id: Date.now().toString(),
      ...message,
      timestamp: new Date(),
    });
  };

  const clearChat = () => {
    messages.value = [];
  };

  const setChatLoading = (loading: boolean) => {
    isChatLoading.value = loading;
  };

  const addInsight = (insight: Omit<typeof insights.value[0], "id" | "timestamp">) => {
    insights.value.push({
      id: Date.now().toString(),
      ...insight,
      timestamp: new Date(),
    });
  };

  const clearInsights = () => {
    insights.value = [];
  };

  return {
    // State
    messages,
    isChatLoading,
    chatError,
    insights,
    // Actions
    addMessage,
    clearChat,
    setChatLoading,
    addInsight,
    clearInsights,
  };
});

// Error store
export const useErrorStore = defineStore("errors", () => {
  const errors = ref<Array<{
    id: string;
    message: string;
    type?: "error" | "warning" | "info";
    persistent?: boolean;
  }>>([]);

  const addError = (error: {
    message: string;
    type?: "error" | "warning" | "info";
    persistent?: boolean;
  }) => {
    errors.value.push({
      id: Date.now().toString(),
      ...error,
    });
  };

  const removeError = (id: string) => {
    const index = errors.value.findIndex(err => err.id === id);
    if (index > -1) {
      errors.value.splice(index, 1);
    }
  };

  const clearErrors = () => {
    errors.value = [];
  };

  const clearPersistentErrors = () => {
    errors.value = errors.value.filter(err => !err.persistent);
  };

  return {
    // State
    errors,
    // Actions
    addError,
    removeError,
    clearErrors,
    clearPersistentErrors,
  };
});

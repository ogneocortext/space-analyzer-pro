import { ref, computed, watch } from "vue";
import { AnalysisResult } from "../services/analysis/AnalysisBridge";

// Custom hook for analysis data with intelligent caching
export const useAnalysisData = (directoryPath: string | null) => {
  const analysisResult = ref<AnalysisResult | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const analysisData = computed(() => analysisResult.value);
  const isAnalyzing = computed(() => isLoading.value);

  const analyzeDirectory = async (path: string) => {
    if (!path) return;

    isLoading.value = true;
    error.value = null;

    try {
      // Import bridge dynamically to avoid circular dependencies
      const { bridge } = await import("../services/analysis/AnalysisBridge");

      const result = await bridge.analyzeDirectoryWithProgress(path, (progress: any) => {
        console.log("Analysis progress:", progress);
      });

      analysisResult.value = result.result;
    } catch (err: any) {
      error.value = err.message || "Analysis failed";
    } finally {
      isLoading.value = false;
    }
  };

  const clearAnalysis = () => {
    analysisResult.value = null;
    error.value = null;
  };

  // Watch for directory path changes
  watch(
    () => directoryPath.value,
    (newPath) => {
      if (newPath && typeof newPath === "string") {
        analyzeDirectory(newPath);
      }
    },
    { immediate: true }
  );

  return {
    analysisData,
    isAnalyzing,
    isLoading,
    error,
    analyzeDirectory,
    clearAnalysis,
  };
};

// Custom hook for managing analysis state
import { ref, computed } from "vue";
import { useAnalysisStore } from "../store";

interface AnalysisState {
  path: string;
  status: string;
  progress: number;
  data: AnalysisResult | null;
  error: string | null;
}

export interface UseAnalysisStateReturn {
  state: AnalysisState;
  isAnalyzing: boolean;
  hasData: boolean;
  hasError: boolean;
  updatePath: (path: string) => void;
  updateStatus: (status: string) => void;
  updateProgress: (progress: number) => void;
  updateData: (data: AnalysisResult | null) => void;
  updateError: (error: string | null) => void;
  resetState: () => void;
}

export const useAnalysisState = (): UseAnalysisStateReturn => {
  const analysisStore = useAnalysisStore();

  const state = computed(
    (): AnalysisState => ({
      path: analysisStore.currentFile || "",
      status: analysisStore.isAnalyzing ? "analyzing" : "idle",
      progress: analysisStore.analysisProgress,
      data: analysisStore.analysisResult,
      error: analysisStore.analysisError,
    })
  );

  const isAnalyzing = computed(() => analysisStore.isAnalyzing);
  const hasData = computed(() => !!analysisStore.analysisResult);
  const hasError = computed(() => !!analysisStore.analysisError);

  const updatePath = (path: string) => {
    analysisStore.currentFile = path;
  };

  const updateStatus = (status: string) => {
    // This would update a status field if needed
    console.log("Analysis status updated:", status);
  };

  const updateProgress = (progress: number) => {
    analysisStore.updateProgress(progress);
  };

  const updateData = (data: AnalysisResult | null) => {
    analysisStore.analysisResult = data;
  };

  const updateError = (error: string | null) => {
    analysisStore.setAnalysisError(error);
  };

  const resetState = () => {
    analysisStore.clearAnalysis();
  };

  return {
    state,
    isAnalyzing,
    hasData,
    hasError,
    updatePath,
    updateStatus,
    updateProgress,
    updateData,
    updateError,
    resetState,
  };
};

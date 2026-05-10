// Custom hook for managing analysis state
import { computed } from "vue";
import { useAnalysisStore } from "../store";

interface AnalysisResult {
  // Define AnalysisResult interface
  id: string;
  path: string;
  timestamp: string;
  files: any[];
  totalSize: number;
}

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
      path: (analysisStore as any).path || "",
      status: (analysisStore as any).isAnalysisRunning ? "analyzing" : "idle",
      progress: (analysisStore as any).progress || 0,
      data: (analysisStore as any).result || null,
      error: (analysisStore as any).error || null,
    })
  );

  const isAnalyzing = computed(() => (analysisStore as any).isAnalysisRunning);
  const hasData = computed(() => !!(analysisStore as any).result);
  const hasError = computed(() => !!(analysisStore as any).error);

  const updatePath = (path: string) => {
    (analysisStore as any).path = path;
  };

  const updateStatus = (status: string) => {
    // This would update a status field if needed
    console.log("Analysis status updated:", status);
  };

  const updateProgress = (progress: number) => {
    (analysisStore as any).progress = progress;
  };

  const updateData = (data: AnalysisResult | null) => {
    (analysisStore as any).result = data;
  };

  const updateError = (error: string | null) => {
    (analysisStore as any).error = error;
  };

  const resetState = () => {
    (analysisStore as any).path = "";
    (analysisStore as any).progress = 0;
    (analysisStore as any).result = null;
    (analysisStore as any).error = null;
  };

  return {
    state: state.value,
    isAnalyzing: isAnalyzing.value,
    hasData: hasData.value,
    hasError: hasError.value,
    updatePath,
    updateStatus,
    updateProgress,
    updateData,
    updateError,
    resetState,
  };
};

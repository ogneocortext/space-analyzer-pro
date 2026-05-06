import { ref, onMounted, onUnmounted } from "vue";
import { useAnalysisStore } from "../store";

interface UseInteractiveAnalysisOptions {
  onQuickAnalysis?: (path: string) => Promise<any>;
  onExecuteAction?: (action: string, params: any) => Promise<void>;
  onSpeedChange?: (speed: "slow" | "normal" | "fast") => void;
  onDepthChange?: (depth: number) => void;
}

export interface UseInteractiveAnalysisReturn {
  isAnalyzing: boolean;
  currentPath: string;
  analysisDepth: number;
  analysisSpeed: "slow" | "normal" | "fast";
  quickAnalyze: (path: string) => Promise<void>;
  executeAction: (action: string, params: any) => Promise<void>;
  setAnalysisSpeed: (speed: "slow" | "normal" | "fast") => void;
  setAnalysisDepth: (depth: number) => void;
}

export const useInteractiveAnalysis = (options: UseInteractiveAnalysisOptions = {}): UseInteractiveAnalysisReturn => {
  const analysisStore = useAnalysisStore();
  const isAnalyzing = ref(false);
  const currentPath = ref("");
  const analysisDepth = ref(3);
  const analysisSpeed = ref<"slow" | "normal" | "fast">("normal");

  const quickAnalyze = async (path: string): Promise<void> => {
    if (!path) return;
    
    isAnalyzing.value = true;
    currentPath.value = path;
    
    try {
      if (options.onQuickAnalysis) {
        await options.onQuickAnalysis(path);
      } else {
        // Default quick analysis
        await analysisStore.startAnalysis(path);
      }
    } catch (error: any) {
      console.error("Quick analysis failed:", error);
    } finally {
      isAnalyzing.value = false;
    }
  };

  const executeAction = async (action: string, params: any): Promise<void> => {
    try {
      if (options.onExecuteAction) {
        await options.onExecuteAction(action, params);
      } else {
        // Default action handler
        console.log("Executing action:", action, params);
        
        // Example action implementations
        switch (action) {
          case "delete":
            console.log("Delete action:", params);
            break;
          case "move":
            console.log("Move action:", params);
            break;
          case "copy":
            console.log("Copy action:", params);
            break;
          default:
            console.log("Unknown action:", action);
        }
      }
    } catch (error: any) {
      console.error("Action execution failed:", error);
    }
  };

  const setAnalysisSpeed = (speed: "slow" | "normal" | "fast") => {
    analysisSpeed.value = speed;
    if (options.onSpeedChange) {
      options.onSpeedChange(speed);
    }
  };

  const setAnalysisDepth = (depth: number) => {
    analysisDepth.value = depth;
    if (options.onDepthChange) {
      options.onDepthChange(depth);
    }
  };

  // Watch for changes in analysis store
  const unsubscribe = analysisStore.$onAction(({ isAnalyzing: analyzing, analysisResult }) => {
    isAnalyzing.value = analyzing;
    if (analysisResult && analysisResult.currentFile) {
      currentPath.value = analysisResult.currentFile;
    }
  });

  onUnmounted(() => {
    unsubscribe();
  });

  return {
    isAnalyzing,
    currentPath,
    analysisDepth,
    analysisSpeed,
    quickAnalyze,
    executeAction,
    setAnalysisSpeed,
    setAnalysisDepth,
  };
};

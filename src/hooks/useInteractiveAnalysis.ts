import { useState, useCallback, useEffect } from "react";
import { useStreamingChat } from "./useStreamingChat";
import { useAnalysisData } from "../contexts/AIContext";

interface UseInteractiveAnalysisOptions {
  onQuickAnalysis?: (path: string) => Promise<any>;
  onExecuteAction?: (action: string, params: any) => Promise<void>;
  onSpeedChange?: (speed: "slow" | "normal" | "fast") => void;
  onDepthChange?: (depth: number) => void;
}

interface AnalysisState {
  isAnalyzing: boolean;
  progress: number;
  status: string;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
  estimatedTimeRemaining?: number;
  analysisId?: string;
  currentSpeed: "slow" | "normal" | "fast";
  currentDepth: number;
  results?: any;
}

interface QuickAnalysisResult {
  path: string;
  estimatedFiles: number;
  estimatedSize: number;
  complexity: "Low" | "Medium" | "High";
  recommendations: string[];
  estimatedTime: number;
}

export const useInteractiveAnalysis = (options: UseInteractiveAnalysisOptions = {}) => {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: 0,
    status: "",
    currentSpeed: "normal",
    currentDepth: 5,
  });

  const [quickAnalysisCache, setQuickAnalysisCache] = useState<Map<string, QuickAnalysisResult>>(
    new Map()
  );
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  const chat = useStreamingChat();
  const analysisData = useAnalysisData();

  // Enhanced quick analysis with caching
  const performQuickAnalysis = useCallback(
    async (path: string): Promise<QuickAnalysisResult> => {
      // Check cache first
      if (quickAnalysisCache.has(path)) {
        return quickAnalysisCache.get(path)!;
      }

      if (!options.onQuickAnalysis) {
        // Mock quick analysis for demo
        const mockResult: QuickAnalysisResult = {
          path,
          estimatedFiles: Math.floor(Math.random() * 10000) + 1000,
          estimatedSize: Math.floor(Math.random() * 1000000000) + 100000000,
          complexity: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)] as
            | "Low"
            | "Medium"
            | "High",
          recommendations: [
            "This directory contains mixed file types",
            "Consider organizing by file category",
            "Large files detected that may need compression",
          ],
          estimatedTime: Math.floor(Math.random() * 60) + 30,
        };

        // Cache the result
        setQuickAnalysisCache((prev) => new Map(prev).set(path, mockResult));
        return mockResult;
      }

      try {
        const result = await options.onQuickAnalysis(path);
        const quickResult: QuickAnalysisResult = {
          path,
          estimatedFiles: result.fileCount || 0,
          estimatedSize: result.totalSize || 0,
          complexity: result.complexity || "Medium",
          recommendations: result.recommendations || [],
          estimatedTime: result.estimatedTime || 60,
        };

        // Cache the result
        setQuickAnalysisCache((prev) => new Map(prev).set(path, quickResult));
        return quickResult;
      } catch (error) {
        console.error("Quick analysis failed:", error);
        throw error;
      }
    },
    [options.onQuickAnalysis, quickAnalysisCache]
  );

  // Start full analysis with enhanced options
  const startAnalysis = useCallback(
    async (
      path: string,
      analysisOptions: {
        speed?: "slow" | "normal" | "fast";
        depth?: number;
        enableML?: boolean;
        enableRealtime?: boolean;
      } = {}
    ) => {
      setAnalysisState((prev) => ({
        ...prev,
        isAnalyzing: true,
        progress: 0,
        status: "🔍 Starting analysis...",
        currentSpeed: analysisOptions.speed || prev.currentSpeed,
        currentDepth: analysisOptions.depth || prev.currentDepth,
      }));

      // Add to recent paths
      if (!recentPaths.includes(path)) {
        setRecentPaths((prev) => [path, ...prev.slice(0, 4)]);
      }

      try {
        // Simulate analysis with real-time updates
        const totalSteps = 100;
        const stepDelay =
          analysisOptions.speed === "fast" ? 50 : analysisOptions.speed === "slow" ? 200 : 100;

        for (let step = 0; step <= totalSteps; step++) {
          if (!analysisState.isAnalyzing) break; // Allow cancellation

          const progress = (step / totalSteps) * 100;
          const currentFile = `Processing file_${step}.ext`;
          const processedFiles = Math.floor((step / totalSteps) * 1000);
          const totalFiles = 1000;

          setAnalysisState((prev) => ({
            ...prev,
            progress,
            status:
              step < 25
                ? "🔍 Scanning directory structure..."
                : step < 75
                  ? "🤖 Running AI categorization..."
                  : step < 90
                    ? "💡 Generating AI recommendations..."
                    : "📊 Finalizing analysis results...",
            currentFile,
            processedFiles,
            totalFiles,
            estimatedTimeRemaining: ((totalSteps - step) * stepDelay) / 1000,
          }));

          await new Promise((resolve) => setTimeout(resolve, stepDelay));
        }

        // Mock final results
        const finalResults = {
          path,
          totalFiles: 1000,
          totalSize: 500000000,
          categories: {
            "JavaScript/TypeScript": { count: 400, size: 100000000 },
            Images: { count: 200, size: 300000000 },
            Python: { count: 150, size: 50000000 },
            Configuration: { count: 100, size: 10000000 },
            Other: { count: 150, size: 40000000 },
          },
          recommendations: [
            "Compress large images to save space",
            "Organize JavaScript files into subdirectories",
            "Archive old configuration files",
          ],
          performance: {
            filesPerSecond:
              analysisOptions.speed === "fast" ? 100 : analysisOptions.speed === "slow" ? 25 : 50,
            scanTime: Date.now() - Date.now(),
          },
        };

        setAnalysisState((prev) => ({
          ...prev,
          isAnalyzing: false,
          progress: 100,
          status: "✅ Analysis complete!",
          results: finalResults,
        }));

        return finalResults;
      } catch (error) {
        console.error("Analysis failed:", error);
        setAnalysisState((prev) => ({
          ...prev,
          isAnalyzing: false,
          status: "❌ Analysis failed",
        }));
        throw error;
      }
    },
    [analysisState.isAnalyzing, recentPaths]
  );

  // Cancel analysis
  const cancelAnalysis = useCallback(() => {
    setAnalysisState((prev) => ({
      ...prev,
      isAnalyzing: false,
      status: "⏹️ Analysis cancelled",
    }));
  }, []);

  // Pause/Resume analysis
  const pauseAnalysis = useCallback(() => {
    setAnalysisState((prev) => ({
      ...prev,
      status: "⏸️ Analysis paused",
    }));
  }, []);

  const resumeAnalysis = useCallback(() => {
    setAnalysisState((prev) => ({
      ...prev,
      status: "▶️ Resuming analysis...",
    }));
  }, []);

  // Execute smart action
  const executeAction = useCallback(
    async (actionId: string, params: any = {}) => {
      if (!options.onExecuteAction) {
        console.warn("Mock action execution:", actionId, params);
        return;
      }

      try {
        await options.onExecuteAction(actionId, params);

        // Update analysis state if needed
        if (actionId === "compress_images") {
          setAnalysisState((prev) => ({
            ...prev,
            status: "🖼️ Compressing images...",
          }));
        } else if (actionId === "remove_duplicates") {
          setAnalysisState((prev) => ({
            ...prev,
            status: "🗑️ Removing duplicates...",
          }));
        }
      } catch (error) {
        console.error("Action execution failed:", error);
        throw error;
      }
    },
    [options.onExecuteAction]
  );

  // Change analysis speed
  const changeSpeed = useCallback(
    (speed: "slow" | "normal" | "fast") => {
      setAnalysisState((prev) => ({
        ...prev,
        currentSpeed: speed,
      }));

      if (options.onSpeedChange) {
        options.onSpeedChange(speed);
      }
    },
    [options.onSpeedChange]
  );

  // Change analysis depth
  const changeDepth = useCallback(
    (depth: number) => {
      setAnalysisState((prev) => ({
        ...prev,
        currentDepth: depth,
      }));

      if (options.onDepthChange) {
        options.onDepthChange(depth);
      }
    },
    [options.onDepthChange]
  );

  // Get available actions based on current analysis
  const getAvailableActions = useCallback(() => {
    const actions = [];

    if (analysisState.results) {
      actions.push(
        {
          id: "compress_images",
          name: "Compress Images",
          description: "Compress large images to save storage space",
          icon: "🖼️",
          category: "optimization",
        },
        {
          id: "remove_duplicates",
          name: "Remove Duplicates",
          description: "Find and remove duplicate files",
          icon: "🗑️",
          category: "cleanup",
        },
        {
          id: "organize_by_type",
          name: "Organize by Type",
          description: "Organize files into type-specific directories",
          icon: "📁",
          category: "organization",
        },
        {
          id: "archive_old_files",
          name: "Archive Old Files",
          description: "Archive files older than 90 days",
          icon: "📦",
          category: "cleanup",
        }
      );
    }

    return actions;
  }, [analysisState.results]);

  return {
    // Analysis state
    analysisState,
    quickAnalysisCache,
    recentPaths,

    // Chat integration
    chat,
    analysisData,

    // Methods
    performQuickAnalysis,
    startAnalysis,
    cancelAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    executeAction,
    changeSpeed,
    changeDepth,
    getAvailableActions,

    // Computed values
    isAnalyzing: analysisState.isAnalyzing,
    progress: analysisState.progress,
    status: analysisState.status,
    currentFile: analysisState.currentFile,
    results: analysisState.results,
    availableActions: getAvailableActions(),
  };
};

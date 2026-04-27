import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnalysisResult } from "../services/AnalysisBridge";

// Custom hook for analysis data with intelligent caching
export const useAnalysisData = (directoryPath: string | null) => {
  return useQuery({
    queryKey: ["analysis", directoryPath],
    queryFn: async (): Promise<AnalysisResult | null> => {
      if (!directoryPath) return null;

      const { AnalysisBridge } = await import("../services/AnalysisBridge");
      const bridge = new AnalysisBridge();

      const result = await bridge.analyzeDirectory(directoryPath);
      return result;
    },
    enabled: !!directoryPath,
    staleTime: 10 * 60 * 1000, // 10 minutes - analysis results are fairly stable
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 2,
    refetchOnWindowFocus: false, // Don't refetch on window focus for expensive operations
  });
};

// Custom hook for real-time analysis with progress
export const useAnalysisWithProgress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      directoryPath,
      onProgress,
    }: {
      directoryPath: string;
      onProgress?: (progress: any) => void;
    }) => {
      const { AnalysisBridge } = await import("../services/AnalysisBridge");
      const bridge = new AnalysisBridge();

      const result = await bridge.analyzeDirectoryWithProgress(directoryPath, (progress) => {
        onProgress?.(progress);
      });

      return result.result;
    },
    onSuccess: (data, variables) => {
      // Update the cached analysis data
      queryClient.setQueryData(["analysis", variables.directoryPath], data);

      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["analysis-stats"] });
      queryClient.invalidateQueries({ queryKey: ["file-categories"] });
    },
  });
};

// Hook for analysis statistics (memoized computation)
export const useAnalysisStats = (analysisData: AnalysisResult | null) => {
  return useQuery({
    queryKey: ["analysis-stats", analysisData?.directoryPath],
    queryFn: () => {
      if (!analysisData) return null;

      // Expensive computations are cached and memoized
      const stats = {
        totalFiles: analysisData.totalFiles,
        totalSize: analysisData.totalSize,
        largestFile: analysisData.files?.reduce(
          (max, file) => (file.size > max.size ? file : max),
          analysisData.files[0]
        ),
        fileTypes: analysisData.categories ? Object.keys(analysisData.categories).length : 0,
        averageFileSize: analysisData.totalSize / analysisData.totalFiles,
        directoriesCount:
          analysisData.files?.filter((file) => !file.extension || file.extension === "").length ||
          0,
      };

      return stats;
    },
    enabled: !!analysisData,
    staleTime: 30 * 60 * 1000, // 30 minutes - stats don't change often
  });
};

// Hook for file categories with memoization
export const useFileCategories = (analysisData: AnalysisResult | null) => {
  return useQuery({
    queryKey: ["file-categories", analysisData?.directoryPath],
    queryFn: () => {
      if (!analysisData?.categories) return [];

      // Process categories data (expensive operation)
      const categories = Object.entries(analysisData.categories)
        .map(([name, data]: [string, any]) => ({
          name,
          size: data.size,
          count: data.count,
          percentage: (data.size / analysisData.totalSize) * 100,
          color: getCategoryColor(name),
        }))
        .sort((a, b) => b.size - a.size); // Sort by size descending

      return categories;
    },
    enabled: !!analysisData?.categories,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook for cached snapshots
export const useAnalysisSnapshots = () => {
  return useQuery({
    queryKey: ["analysis-snapshots"],
    queryFn: async () => {
      const { useIndexedDB } = await import("../hooks/useIndexedDB");
      // This would need to be refactored to work with the existing hook
      // For now, return mock data
      return [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Utility function for category colors (memoized)
const getCategoryColor = (categoryName: string): string => {
  const colors: Record<string, string> = {
    JavaScript: "#f7df1e",
    TypeScript: "#3178c6",
    Python: "#3776ab",
    Java: "#ed8b00",
    CSS: "#1572b6",
    HTML: "#e34f26",
    JSON: "#000000",
    Markdown: "#083fa1",
    Images: "#ff6b35",
    Videos: "#ff4757",
    Audio: "#3742fa",
    Documents: "#2f3542",
    Archives: "#ffa502",
    Other: "#7bed9f",
  };

  return colors[categoryName] || "#6366f1"; // Default blue
};

// Hook for performance metrics
export const usePerformanceMetrics = () => {
  return useQuery({
    queryKey: ["performance-metrics"],
    queryFn: async () => {
      // Simulate performance metrics collection
      const metrics = {
        analysisTime: Math.random() * 5000 + 1000, // 1-6 seconds
        memoryUsage: Math.random() * 100 + 50, // 50-150 MB
        cacheHitRate: Math.random() * 30 + 70, // 70-100%
        lastUpdated: new Date(),
      };

      return metrics;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

// Hook for AI insights caching
export const useAIInsights = (analysisData: AnalysisResult | null) => {
  return useQuery({
    queryKey: ["ai-insights", analysisData?.directoryPath],
    queryFn: async () => {
      if (!analysisData?.ai_insights) return null;

      // Simulate AI processing time (expensive operation)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        ...analysisData.ai_insights,
        generatedAt: new Date(),
        confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      };
    },
    enabled: !!analysisData?.ai_insights,
    staleTime: 15 * 60 * 1000, // 15 minutes - AI insights are relatively stable
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Prefetch hook for better UX
export const usePrefetchAnalysis = (directoryPath: string | null) => {
  const queryClient = useQueryClient();

  const prefetch = async () => {
    if (!directoryPath) return;

    await queryClient.prefetchQuery({
      queryKey: ["analysis", directoryPath],
      queryFn: async (): Promise<AnalysisResult | null> => {
        const { AnalysisBridge } = await import("../services/AnalysisBridge");
        const bridge = new AnalysisBridge();
        const result = await bridge.analyzeDirectory(directoryPath);
        return result;
      },
      staleTime: 10 * 60 * 1000,
    });
  };

  return { prefetch };
};

// Hook for Neural View data (calculating dependencies on the fly)
export const useNeuralData = (analysisData: AnalysisResult | null) => {
  return useQuery({
    queryKey: ["neural-data", analysisData?.directoryPath],
    queryFn: async () => {
      if (!analysisData || !analysisData.files || analysisData.files.length === 0) {
        return null; // Return null to fall back to safe default in component
      }

      console.warn("🧠 Calculating neural dependency graph...");
      const { dependencyCheckerService } = await import("../services/DependencyCheckerService");

      // Build the graph (this is async)
      // Limit to 200 files for performance
      const filesToAnalyze = analysisData.files.slice(0, 200);
      await dependencyCheckerService.buildDependencyGraph(filesToAnalyze);

      const graph = await dependencyCheckerService.getDependencyGraph();
      const nodes: any[] = [];
      const connections: any[] = [];

      // Convert Map<string, FileDependency[]> to NeuralData format
      // First create nodes
      filesToAnalyze.forEach((file, index) => {
        // Calculate node metadata
        const fileType = file.extension ? "file" : "directory";
        let specificType = "other";
        if (["mp4", "avi", "mov"].includes(file.extension?.toLowerCase() || ""))
          specificType = "video";
        else if (["pdf", "doc", "docx", "txt", "md"].includes(file.extension?.toLowerCase() || ""))
          specificType = "document";
        else if (["exe", "dll", "sys"].includes(file.extension?.toLowerCase() || ""))
          specificType = "system";

        nodes.push({
          id: file.path.replace(/\\/g, "/"), // Normalize paths for IDs
          label: file.name,
          x: Math.random() * 800, // Initial random position, physics will fix
          y: Math.random() * 600,
          size: Math.max(5, Math.min(25, Math.log10(file.size + 1) * 3)),
          type: fileType,
          connections: [], // Will be filled below
          fileType: specificType,
          fileSize: file.size,
          accessFrequency: 50, // Default
        });
      });

      // Then create connections
      for (const [filePath, deps] of graph.entries()) {
        const normalizedPath = filePath.replace(/\\/g, "/");
        const sourceNode = nodes.find((n) => n.id === normalizedPath);
        if (!sourceNode) continue;

        deps.forEach((dep) => {
          const normalizedDepPath = dep.path.replace(/\\/g, "/");
          const targetNode = nodes.find((n) => n.id === normalizedDepPath);
          if (targetNode) {
            // Add to source connections list
            if (!sourceNode.connections.includes(normalizedDepPath)) {
              sourceNode.connections.push(normalizedDepPath);
            }

            // Add edge object
            connections.push({
              from: normalizedPath,
              to: normalizedDepPath,
              strength: dep.strength === "strong" ? 0.9 : dep.strength === "medium" ? 0.6 : 0.3,
              type: dep.type === "import" || dep.type === "require" ? "dependency" : "similarity",
              accessFrequency: 50,
            });
          }
        });
      }

      // Calculate metrics
      const metrics = {
        neuralDensity: connections.length / Math.max(1, nodes.length),
        connectionStrength:
          connections.reduce((s, c) => s + c.strength, 0) / Math.max(1, connections.length),
        patternRecognition: 0.8, // Placeholder
        anomalyScore: 0.1, // Placeholder
      };

      console.warn(
        `🧠 Neural graph built: ${nodes.length} nodes, ${connections.length} connections`
      );

      return {
        nodes,
        connections,
        metrics,
      };
    },
    enabled: !!analysisData?.files,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

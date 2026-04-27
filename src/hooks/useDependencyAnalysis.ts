import { useState, useEffect } from "react";
import { AnalysisResult } from "../services/AnalysisBridge";

export const useDependencyAnalysis = (analysisData: AnalysisResult | null) => {
  const [dependencyGraph, setDependencyGraph] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisData) return;

    const analyzeDependencies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate dependency analysis based on file data
        const files = analysisData.files || [];

        // Create a simple dependency graph based on file categories
        const graph = {
          nodes: files.map((file) => ({
            id: file.path,
            name: file.name,
            path: file.path,
            type: "file",
            category: file.category,
            size: file.size,
            dependencies: [],
            dependents: [],
          })),
          edges: [],
          circularDependencies: [],
          missingDependencies: [],
        };

        // Create connections between files in the same category
        const categoryMap: Record<string, string[]> = {};
        files.forEach((file) => {
          if (!categoryMap[file.category]) {
            categoryMap[file.category] = [];
          }
          categoryMap[file.category].push(file.path);
        });

        // Add edges for files in the same category
        Object.values(categoryMap).forEach((categoryFiles) => {
          if (categoryFiles.length > 1) {
            for (let i = 0; i < categoryFiles.length - 1; i++) {
              graph.edges.push({
                from: categoryFiles[i],
                to: categoryFiles[i + 1],
                type: "category",
                strength: 0.3,
              });
            }
          }
        });

        setDependencyGraph(graph);
        setIsLoading(false);
      } catch (err) {
        console.error("Dependency analysis failed:", err);
        setError("Failed to analyze dependencies");
        setIsLoading(false);
      }
    };

    analyzeDependencies();
  }, [analysisData]);

  return {
    dependencyGraph,
    isLoading,
    error,
  };
};

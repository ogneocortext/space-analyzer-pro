import { ref, computed, watch } from "vue";
import { AnalysisResult } from "../services/analysis/AnalysisBridge";

export const useDependencyAnalysis = (analysisData: AnalysisResult | null) => {
  const dependencyGraph = ref<any>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const processedGraph = computed(() => {
    if (!dependencyGraph.value) return null;

    // Process the dependency graph for visualization
    return {
      nodes: dependencyGraph.value.nodes || [],
      edges: dependencyGraph.value.edges || [],
      metrics: {
        totalNodes: dependencyGraph.value.nodes?.length || 0,
        totalEdges: dependencyGraph.value.edges?.length || 0,
        circularDependencies: dependencyGraph.value.circular?.length || 0,
      },
    };
  });

  const analyzeDependencies = () => {
    if (!analysisData) return;

    isLoading.value = true;
    error.value = null;

    try {
      // Simple dependency analysis based on imports
      const dependencies = new Map<string, Set<string>>();
      const nodes: any[] = [];
      const edges: any[] = [];

      // Analyze files for import relationships
      if ((analysisData as any).files) {
        (analysisData as any).files.forEach((file: any) => {
          const nodeId = file.path || file.name;
          nodes.push({
            id: nodeId,
            name: file.name,
            type: "file",
            size: file.size || 0,
          });

          // Extract imports from file content (simplified)
          if (file.content) {
            const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
            const imports = file.content.match(importRegex) || [];

            imports.forEach((imp: string) => {
              if (!dependencies.has(nodeId)) {
                dependencies.set(nodeId, new Set());
              }
              dependencies.get(nodeId)!.add(imp);
            });
          }
        });

        // Create edges from dependencies
        dependencies.forEach((deps, from) => {
          deps.forEach((to) => {
            edges.push({
              from,
              to,
              type: "import",
            });
          });
        });
      }

      dependencyGraph.value = {
        nodes,
        edges,
        circular: [], // Simplified circular detection
      };
    } catch (err: any) {
      error.value = err.message || "Failed to analyze dependencies";
    } finally {
      isLoading.value = false;
    }
  };

  // Auto-analyze when analysis data changes
  watch(
    () => analysisData,
    (newData) => {
      if (newData) {
        analyzeDependencies();
      } else {
        dependencyGraph.value = null;
      }
    },
    { immediate: true }
  );

  return {
    dependencyGraph: processedGraph,
    isLoading,
    error,
    analyzeDependencies,
  };
};

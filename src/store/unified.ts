import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { AnalysisData, AIInsight } from "@/types";

// Unified store combining analysis and AI functionality
export const useUnifiedStore = defineStore("unified", () => {
  // Global state
  const theme = ref<"light" | "dark" | "system">("system");
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastActivity = ref<Date>(new Date());

  // Analysis state
  const currentAnalysis = ref<AnalysisData | null>(null);
  const isAnalyzing = ref(false);
  const analysisProgress = ref(0);
  const currentFile = ref("");
  const filesScanned = ref(0);

  // AI state
  const aiInsights = ref<AIInsight[]>([]);
  const isAIProcessing = ref(false);
  const aiBackend = ref<string>("auto");
  const aiMetrics = ref({
    totalInsights: 0,
    averageConfidence: 0,
    processingTime: 0,
    backendUsed: "auto"
  });

  // Computed properties
  const hasActiveAnalysis = computed(() => !!currentAnalysis.value);
  const hasAIInsights = computed(() => aiInsights.value.length > 0);
  const isProcessing = computed(() => isAnalyzing.value || isAIProcessing.value);
  const overallProgress = computed(() => {
    if (isAnalyzing.value) return analysisProgress.value;
    if (isAIProcessing.value) return 50; // AI processing indicator
    return 100;
  });

  // Actions
  const startAnalysis = async (path: string) => {
    isAnalyzing.value = true;
    analysisProgress.value = 0;
    error.value = null;
    lastActivity.value = new Date();

    try {
      // Import dynamically to avoid circular dependencies
      const { AnalysisBridge } = await import("@/services/analysis/AnalysisBridge");
      const bridge = new AnalysisBridge();

      const result = await bridge.analyzeDirectoryWithProgress(path, (progress) => {
        analysisProgress.value = progress.percentage;
        currentFile.value = progress.currentFile || "";
        filesScanned.value = progress.files || 0;
      });

      currentAnalysis.value = result.result;
      isAnalyzing.value = false;
      analysisProgress.value = 100;
      currentFile.value = "Analysis complete";
      filesScanned.value = result.result?.totalFiles || 0;

      // Trigger AI analysis automatically
      await generateAIInsights(result.result);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Analysis failed";
      isAnalyzing.value = false;
    }
  };

  const generateAIInsights = async (analysisData: AnalysisData) => {
    if (!analysisData?.files || analysisData.files.length === 0) return;

    isAIProcessing.value = true;
    lastActivity.value = new Date();

    try {
      const { UnifiedAIService } = await import("@/services/ai/UnifiedAIService");
      const aiService = UnifiedAIService.getInstance();

      const insights = await aiService.analyzeProject(analysisData.files, {
        includeRecommendations: true,
        includePatterns: true,
        includeOptimizations: true,
        preferredBackend: aiBackend.value
      });

      aiInsights.value = insights;
      
      // Update AI metrics
      const metrics = aiService.getMetrics();
      aiMetrics.value = {
        totalInsights: insights.length,
        averageConfidence: insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length,
        processingTime: Date.now() - lastActivity.value,
        backendUsed: aiBackend.value
      };

      isAIProcessing.value = false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "AI analysis failed";
      isAIProcessing.value = false;
    }
  };

  const cancelAnalysis = () => {
    isAnalyzing.value = false;
    isAIProcessing.value = false;
    analysisProgress.value = 0;
    currentFile.value = "";
    error.value = null;
  };

  const clearAnalysis = () => {
    currentAnalysis.value = null;
    isAnalyzing.value = false;
    isAIProcessing.value = false;
    analysisProgress.value = 0;
    currentFile.value = "";
    filesScanned.value = 0;
    aiInsights.value = [];
    error.value = null;
  };

  const setTheme = (newTheme: "light" | "dark" | "system") => {
    theme.value = newTheme;
    localStorage.setItem("theme", newTheme);
  };

  const setAIBackend = (backend: string) => {
    aiBackend.value = backend;
    localStorage.setItem("ai-backend", backend);
  };

  const clearError = () => {
    error.value = null;
  };

  const updateActivity = () => {
    lastActivity.value = new Date();
  };

  return {
    // Global state
    theme,
    isLoading,
    error,
    lastActivity,

    // Analysis state
    currentAnalysis,
    isAnalyzing,
    analysisProgress,
    currentFile,
    filesScanned,
    hasActiveAnalysis,

    // AI state
    aiInsights,
    isAIProcessing,
    aiBackend,
    aiMetrics,
    hasAIInsights,

    // Computed
    isProcessing,
    overallProgress,

    // Actions
    startAnalysis,
    generateAIInsights,
    cancelAnalysis,
    clearAnalysis,
    setTheme,
    setAIBackend,
    clearError,
    updateActivity
  };
});
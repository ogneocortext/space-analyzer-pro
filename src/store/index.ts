// Unified store exports for Space Analyzer
// Consolidates all store functionality into clean, organized exports

export { useUnifiedStore } from "./unified";
export { useAnalysisStore } from "./analysis";
export { useAIStore } from "./ai";
export { useNotificationStore } from "./notifications";
export { useSelfLearningStore } from "./selfLearning";
export { useAppStore } from "./app";

// Re-export for backward compatibility
export { useAnalysisStore as useAnalysisStore } from "./analysis";
export { useAIStore as useAIStore } from "./ai";
export { useNotificationStore as useNotificationStore } from "./notifications";
export { useSelfLearningStore as useSelfLearningStore } from "./selfLearning";
export { useAppStore as useAppStore } from "./app";

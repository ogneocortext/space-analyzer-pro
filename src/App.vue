<template>
  <div
    id="app"
    class="flex h-screen bg-slate-900"
  >
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { provide } from "vue";
import { useRouter } from "vue-router";
import { useAnalysisStore } from "./store/analysis";
import { useAppStore } from "./store/app";
import {
  analysisStoreKey,
  appStoreKey,
  handlePathChangeKey,
  toggleAIKey,
  handleSelectRecentPathKey,
  navigateToDashboardKey,
  navigateToBrowserKey,
  navigateToVisualizationKey,
  exportReportKey,
  cleanupSuggestionsKey,
  getCategoryColorKey,
} from "./types/injection";

const router = useRouter();
const analysisStore = useAnalysisStore();
const appStore = useAppStore();

// Provide stores to child components
provide(analysisStoreKey, analysisStore);
provide(appStoreKey, appStore);

const handlePathChange = (newPath: string) => {
  analysisStore.path = newPath;
};

const toggleAI = () => {
  analysisStore.useAI = !analysisStore.useAI;
};

const handleSelectRecentPath = (selectedPath: string) => {
  analysisStore.path = selectedPath;
  appStore.togglePathPicker();
};

const navigateToDashboard = () => {
  router.push("/dashboard");
};

const navigateToBrowser = () => {
  router.push("/browser");
};

const navigateToVisualization = () => {
  router.push("/visualization");
};

const exportReport = () => {
  if (!analysisStore.data) {
    console.warn("No analysis data to export");
    return;
  }
  // Simple export to JSON
  const dataStr = JSON.stringify(analysisStore.data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-report-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  console.warn("Report exported successfully");
};

const cleanupSuggestions = () => {
  if (!analysisStore.data) {
    console.warn("No analysis data for cleanup suggestions");
    return;
  }
  // Navigate to dashboard for cleanup suggestions
  router.push("/dashboard");
  console.warn("Navigating to dashboard for cleanup suggestions");
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    Images: "#00B4D8",
    Videos: "#9333EA",
    Audio: "#10B981",
    Documents: "#F59E0B",
    Archives: "#EF4444",
    Code: "#3B82F6",
    Other: "#6B7280",
  };
  return colors[category] || "#6B7280";
};

// Provide helper functions
provide(handlePathChangeKey, handlePathChange);
provide(toggleAIKey, toggleAI);
provide(handleSelectRecentPathKey, handleSelectRecentPath);
provide(navigateToDashboardKey, navigateToDashboard);
provide(navigateToBrowserKey, navigateToBrowser);
provide(navigateToVisualizationKey, navigateToVisualization);
provide(exportReportKey, exportReport);
provide(cleanupSuggestionsKey, cleanupSuggestions);
provide(getCategoryColorKey, getCategoryColor);
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

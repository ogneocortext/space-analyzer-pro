<template>
  <div id="app" class="flex h-screen bg-slate-900">
    <LandingPage
      :path="analysisStore.path"
      :onPathChange="handlePathChange"
      :onAnalyze="analysisStore.handleAnalysis"
      :isBackendOnline="appStore.isBackendOnline"
      :isAnalysisRunning="analysisStore.isAnalysisRunning"
      :progress="analysisStore.progress"
      :status="analysisStore.status"
      :error="analysisStore.error"
      :useAI="analysisStore.useAI"
      :onToggleAI="toggleAI"
      :recentPaths="appStore.recentPaths"
      :showPathPicker="appStore.showPathPicker"
      :onTogglePathPicker="appStore.togglePathPicker"
      :onSelectRecentPath="handleSelectRecentPath"
      :analysisData="analysisStore.data"
      :scannedFiles="analysisStore.scannedFiles"
      :progressData="analysisStore.progressData"
      :onNavigateToDashboard="navigateToDashboard"
      :onNavigateToBrowser="navigateToBrowser"
      :onExportReport="exportReport"
      :onCleanupSuggestions="cleanupSuggestions"
      :getCategoryColor="getCategoryColor"
    />
  </div>
</template>

<script setup lang="ts">
import { useAnalysisStore } from './store/analysis'
import { useAppStore } from './store/app'
import LandingPage from './components/layout/LandingPage.vue'

const analysisStore = useAnalysisStore()
const appStore = useAppStore()

const handlePathChange = (newPath: string) => {
  analysisStore.path = newPath
}

const toggleAI = () => {
  analysisStore.useAI = !analysisStore.useAI
}

const handleSelectRecentPath = (selectedPath: string) => {
  analysisStore.path = selectedPath
  appStore.togglePathPicker()
}

const navigateToDashboard = () => {
  appStore.setView('dashboard')
}

const navigateToBrowser = () => {
  appStore.setView('browser')
}

const exportReport = () => {
  console.log('Export report')
}

const cleanupSuggestions = () => {
  console.log('Cleanup suggestions')
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    'Images': '#00B4D8',
    'Videos': '#9333EA',
    'Audio': '#10B981',
    'Documents': '#F59E0B',
    'Archives': '#EF4444',
    'Code': '#3B82F6',
    'Other': '#6B7280'
  }
  return colors[category] || '#6B7280'
}
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

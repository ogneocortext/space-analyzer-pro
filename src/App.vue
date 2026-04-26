<template>
  <div id="app" class="flex h-screen bg-slate-900">
    <LandingPage
      :path="path"
      :onPathChange="onPathChange"
      :onAnalyze="onAnalyze"
      :isBackendOnline="isBackendOnline"
      :isAnalysisRunning="isAnalysisRunning"
      :progress="progress"
      :status="status"
      :useAI="useAI"
      :onToggleAI="onToggleAI"
      :recentPaths="recentPaths"
      :showPathPicker="showPathPicker"
      :onTogglePathPicker="onTogglePathPicker"
      :onSelectRecentPath="onSelectRecentPath"
      :analysisData="analysisData"
      :scannedFiles="scannedFiles"
      :progressData="progressData"
      :onNavigateToDashboard="onNavigateToDashboard"
      :onNavigateToBrowser="onNavigateToBrowser"
      :onExportReport="onExportReport"
      :onCleanupSuggestions="onCleanupSuggestions"
      :getCategoryColor="getCategoryColor"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LandingPage from './components/layout/LandingPage.vue'

const path = ref('E:\\Generated with Producer.AI')
const onPathChange = (newPath: string) => { path.value = newPath }
const onAnalyze = (useAI: boolean) => console.log('Analyze called with AI:', useAI)
const isBackendOnline = ref(true)
const isAnalysisRunning = ref(false)
const progress = ref(0)
const status = ref('Ready')
const useAI = ref(false)
const onToggleAI = () => { useAI.value = !useAI.value }
const recentPaths = ref([])
const showPathPicker = ref(false)
const onTogglePathPicker = () => { showPathPicker.value = !showPathPicker.value }
const onSelectRecentPath = (selectedPath: string) => { path.value = selectedPath }
const analysisData = ref(null)
const scannedFiles = ref([])
const progressData = ref({ files: 0, percentage: 0, currentFile: '', completed: false })
const onNavigateToDashboard = () => console.log('Navigate to dashboard')
const onNavigateToBrowser = () => console.log('Navigate to browser')
const onExportReport = () => console.log('Export report')
const onCleanupSuggestions = () => console.log('Cleanup suggestions')
const getCategoryColor = (category: string) => '#00B4D8'
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

<template>
  <div id="app" class="flex h-screen bg-slate-900">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { provide } from 'vue'
import { useAnalysisStore } from './store/analysis'
import { useAppStore } from './store/app'

const analysisStore = useAnalysisStore()
const appStore = useAppStore()

// Provide stores to child components
provide('analysisStore', analysisStore)
provide('appStore', appStore)

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

// Provide helper functions
provide('handlePathChange', handlePathChange)
provide('toggleAI', toggleAI)
provide('handleSelectRecentPath', handleSelectRecentPath)
provide('navigateToDashboard', navigateToDashboard)
provide('navigateToBrowser', navigateToBrowser)
provide('exportReport', exportReport)
provide('cleanupSuggestions', cleanupSuggestions)
provide('getCategoryColor', getCategoryColor)
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

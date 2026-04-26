<template>
  <div class="flex flex-col min-h-screen bg-slate-900 text-white relative overflow-hidden">
    <!-- Animated Background - simplified for better performance -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
    </div>

    <div class="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
      <div class="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <!-- Left Side - Hero Content -->
        <div class="space-y-8 lg:space-y-12 text-center lg:text-left animate-in fade-in slide-in-from-left-12 duration-600">
          <div class="flex justify-center lg:justify-start animate-in zoom-in duration-500 delay-200">
            <div class="relative">
              <div class="absolute inset-0 bg-linear-to-r from-[#00B4D8] to-purple-500 blur-2xl opacity-20 rounded-full"></div>
              <div class="relative bg-slate-800/50 p-4 lg:p-6 rounded-full border border-white/20 shadow-lg">
                <BrainCircuit :size="80" class="text-transparent bg-linear-to-r from-[#00B4D8] to-purple-500 bg-clip-text w-12 h-12 lg:w-20 lg:h-20" />
              </div>
            </div>
          </div>

          <h1 class="text-4xl lg:text-5xl text-transparent bg-linear-to-r from-[#00B4D8] to-purple-500 bg-clip-text leading-tight animate-in fade-in slide-in-from-bottom-5 duration-500 delay-300">
            Space Analyzer Pro
          </h1>

          <p class="text-sm lg:text-base text-slate-300 leading-relaxed font-normal animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
            AI-Powered Intelligence for Your Digital Universe
          </p>

          <!-- Feature Highlights -->
          <div class="grid grid-cols-2 gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
            <div
              v-for="(feature, index) in features"
              :key="feature.text"
              class="bg-slate-800/50 backdrop-blur border-2 border-white/20 rounded-xl p-4 cursor-pointer hover:border-[#00B4D8] hover:scale-103 transition-all duration-200"
              :style="{ animationDelay: `${0.6 + index * 0.05}s` }"
            >
              <div class="flex flex-col items-center text-center">
                <span class="text-2xl lg:text-3xl mb-2">{{ feature.icon }}</span>
                <span class="text-sm font-medium text-white mb-1">{{ feature.text }}</span>
                <span class="text-xs text-slate-300">{{ feature.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Input Card -->
        <div
          class="w-full max-w-md mx-auto animate-in fade-in slide-in-from-right-12 duration-600 delay-300"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop="handleDrop"
        >
          <div :class="['bg-slate-800/50 p-4 lg:p-6 space-y-3 lg:space-y-4 backdrop-blur-lg border border-white/20 rounded-xl', isDragOver ? 'border-2 border-dashed border-[#00B4D8] bg-[#00B4D8]/10' : '']">
            <div>
              <label for="directory-path" class="block text-sm font-medium text-slate-300 mb-2">Target Directory</label>
              <div class="relative">
                <Folder class="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" :size="20" />
                <input
                  id="directory-path"
                  name="directory-path"
                  type="text"
                  v-model="analysisStore.path"
                  @input="handlePathChange(analysisStore.path)"
                  class="w-full pl-12 pr-20 font-mono text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  placeholder="Enter directory path..."
                  @keydown.enter="handleEnterKey"
                />
                <div class="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  <button
                    @click="handleCopyPath"
                    class="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Copy path"
                  >
                    <Check v-if="copied" :size="16" class="text-[#00B4D8]" />
                    <Copy v-else :size="16" class="text-slate-300" />
                  </button>
                  <button
                    v-if="appStore.recentPaths.length > 0"
                    @click="appStore.togglePathPicker"
                    class="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Recent paths"
                  >
                    <FolderOpen :size="16" class="text-slate-300" />
                  </button>
                </div>
              </div>
              <!-- Recent paths dropdown -->
              <Transition name="dropdown">
                <div v-if="appStore.showPathPicker && appStore.recentPaths.length > 0" class="mt-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <button
                    v-for="(path, index) in appStore.recentPaths"
                    :key="index"
                    @click="selectRecentPath(path)"
                    class="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors first:border-b border-slate-700"
                  >
                    {{ path }}
                  </button>
                </div>
              </Transition>
            </div>

            <!-- Backend status indicator -->
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <div :class="['w-2 h-2 rounded-full', appStore.isBackendOnline ? 'bg-[#00B4D8] animate-pulse' : 'bg-red-400']" />
                <span :class="appStore.isBackendOnline ? 'text-[#00B4D8]' : 'text-red-400'">
                  {{ appStore.isBackendOnline ? 'Backend Online' : 'Backend Offline' }}
                </span>
              </div>
              <span v-if="!appStore.isBackendOnline" class="text-slate-500">Start the backend server to enable analysis</span>
            </div>

            <!-- AI toggle -->
            <div class="flex items-center justify-between">
              <label class="text-sm text-slate-300">Enable AI Analysis</label>
              <button
                @click="toggleAI"
                :class="['relative w-12 h-6 rounded-full transition-colors', analysisStore.useAI ? 'bg-[#00B4D8]' : 'bg-slate-600']"
              >
                <div :class="['absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform', analysisStore.useAI ? 'translate-x-6' : 'translate-x-0']" />
              </button>
            </div>

            <Transition name="error">
              <div v-if="analysisStore.error" class="bg-orange-500/10 border border-orange-500 text-orange-400 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle :size="18" />
                {{ analysisStore.error }}
              </div>
            </Transition>

            <div v-if="analysisStore.isAnalysisRunning" class="space-y-3">
              <div class="flex justify-between text-sm text-slate-300">
                <span>{{ analysisStore.status }}</span>
                <span>{{ Math.round(analysisStore.progress) }}%</span>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div
                  class="bg-[#00B4D8] h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${analysisStore.progress}%` }"
                  :title="`Analysis progress: ${Math.round(analysisStore.progress)}%`"
                />
              </div>
              <!-- Real-time file scanner -->
              <RealTimeFileScanner
                :scannedFiles="analysisStore.scannedFiles"
                :progress="analysisStore.progressData"
              />
            </div>

            <button
              v-else
              @click="analysisStore.handleAnalysis(analysisStore.useAI)"
              :disabled="!appStore.isBackendOnline || analysisStore.isAnalysisRunning"
              class="bg-[#00B4D8] hover:bg-[#0095b8] text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full"
            >
              <Play :size="20" />
              {{ analysisStore.isAnalysisRunning ? 'Analyzing...' : (analysisStore.useAI ? 'Start AI Analysis' : 'Start Standard Analysis') }}
            </button>

            <Transition name="results">
              <div v-if="analysisStore.data" class="pt-4 border-t border-slate-700 space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-sm text-slate-300">Analysis Complete</span>
                  <span class="text-xs text-emerald-400">✓</span>
                </div>
                
                <!-- Storage Gauge -->
                <StorageGauge
                  :used="analysisStore.data.totalSize || 0"
                  :total="(analysisStore.data.totalSize || 0) * 1.5 || 1"
                  :categories="categoryData"
                />
                
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ analysisStore.data.files?.length || 0 }}
                    </div>
                    <div class="text-xs text-slate-300">Files</div>
                  </div>
                  <div class="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ analysisStore.data.totalSize ? `${(analysisStore.data.totalSize / 1024 / 1024).toFixed(1)}` : '0' }}
                    </div>
                    <div class="text-xs text-slate-300">MB</div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="space-y-2 mt-4">
                  <h4 class="text-sm font-medium text-white mb-2">Quick Actions</h4>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      @click="navigateToBrowser"
                      :disabled="!analysisStore.data"
                      class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'Browse Files' : 'Run analysis first'"
                    >
                      <FolderOpen :size="16" class="mr-1" />
                      Browse Files
                    </button>
                    <button
                      @click="navigateToDashboard"
                      :disabled="!analysisStore.data"
                      class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'View Dashboard' : 'Run analysis first'"
                    >
                      <BarChart3 :size="16" class="mr-1" />
                      View Dashboard
                    </button>
                    <button
                      @click="exportReport"
                      :disabled="!analysisStore.data"
                      class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'Export Report' : 'Run analysis first'"
                    >
                      <Download :size="16" class="mr-1" />
                      Export Report
                    </button>
                    <button
                      @click="cleanupSuggestions"
                      :disabled="!analysisStore.data"
                      class="bg-[#00B4D8] hover:bg-[#0095b8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'Cleanup' : 'Run analysis first'"
                    >
                      <Trash2 :size="16" class="mr-1" />
                      Cleanup
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { BrainCircuit, Folder, Play, AlertTriangle, FolderOpen, BarChart3, Download, Trash2, Copy, Check } from 'lucide-react'
import { RealTimeFileScanner } from '../RealTimeFileScanner'
import { StorageGauge } from '../StorageGauge'

// Inject stores and functions from App.vue
const analysisStore = inject('analysisStore') as any
const appStore = inject('appStore') as any
const handlePathChange = inject('handlePathChange') as (path: string) => void
const toggleAI = inject('toggleAI') as () => void
const handleSelectRecentPath = inject('handleSelectRecentPath') as (path: string) => void
const navigateToDashboard = inject('navigateToDashboard') as () => void
const navigateToBrowser = inject('navigateToBrowser') as () => void
const exportReport = inject('exportReport') as () => void
const cleanupSuggestions = inject('cleanupSuggestions') as () => void
const getCategoryColor = inject('getCategoryColor') as (category: string) => string

const copied = ref(false)
const isDragOver = ref(false)

const features = [
  { icon: '🧠', text: 'Neural Analysis', desc: 'AI-powered file relationships' },
  { icon: '⚡', text: 'Lightning Fast', desc: 'Instant scanning results' },
  { icon: '🤖', text: 'AI Insights', desc: 'Smart recommendations' },
  { icon: '📊', text: 'Smart Reports', desc: 'Detailed analytics' }
]

const categoryData = computed(() => {
  if (!analysisStore.data?.categories) return []
  return Object.entries(analysisStore.data.categories).map(([name, data]: [string, any]) => ({
    name,
    size: data.size || 0,
    color: getCategoryColor(name)
  }))
})

const truncatePath = (path: string, maxLength: number = 40) => {
  if (path.length <= maxLength) return path
  const parts = path.split(/[\\/]/)
  if (parts.length <= 2) return path
  return `${parts[0]}\\...\\${parts[parts.length - 1]}`
}

const handleCopyPath = async () => {
  try {
    await navigator.clipboard.writeText(analysisStore.path)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch (err) {
    console.error('Failed to copy path:', err)
  }
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  const droppedFile = e.dataTransfer?.files[0]
  if (droppedFile) {
    const droppedPath = (droppedFile as any).path || droppedFile.name
    handlePathChange(droppedPath)
  }
}

const handleEnterKey = () => {
  if (appStore.isBackendOnline && !analysisStore.isAnalysisRunning) {
    analysisStore.handleAnalysis(analysisStore.useAI)
  }
}

const selectRecentPath = (path: string) => {
  handleSelectRecentPath(path)
  appStore.togglePathPicker()
}
</script>

<style scoped>
/* CSS animations for Vue transitions */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInFromLeft {
  from { transform: translateX(-50px); }
  to { transform: translateX(0); }
}

@keyframes slideInFromRight {
  from { transform: translateX(50px); }
  to { transform: translateX(0); }
}

@keyframes slideInFromBottom {
  from { transform: translateY(20px); }
  to { transform: translateY(0); }
}

@keyframes zoomIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.animate-in {
  animation-fill-mode: both;
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

.slide-in-from-left-12 {
  animation: slideInFromLeft 0.6s ease-out;
}

.slide-in-from-right-12 {
  animation: slideInFromRight 0.6s ease-out;
}

.slide-in-from-bottom-5 {
  animation: slideInFromBottom 0.5s ease-out;
}

.slide-in-from-bottom-4 {
  animation: slideInFromBottom 0.5s ease-out;
}

.zoom-in {
  animation: zoomIn 0.5s ease-out;
}

.hover\:scale-103:hover {
  transform: scale(1.03);
}

/* Transition classes */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.error-enter-active,
.error-leave-active {
  transition: all 0.3s ease;
}

.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.results-enter-active {
  transition: all 0.5s ease;
}

.results-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
</style>

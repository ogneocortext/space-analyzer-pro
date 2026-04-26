import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AnalysisBridge } from '@/services/AnalysisBridge'

export const useAnalysisStore = defineStore('analysis', () => {
  const path = ref(localStorage.getItem('lastPath') || 'E:\\Generated with Producer.AI')
  const status = ref('idle')
  const progress = ref(0)
  const isAnalysisRunning = ref(false)
  const data = ref<any>(null)
  const error = ref<string | null>(null)
  const useAI = ref(false)
  const scannedFiles = ref<any[]>([])
  const progressData = ref({
    files: 0,
    percentage: 0,
    currentFile: '',
    completed: false
  })

  const analysisBridge = new AnalysisBridge()

  const handleAnalysis = async (enableAI: boolean = false) => {
    try {
      status.value = 'starting'
      isAnalysisRunning.value = true
      error.value = null
      progress.value = 0
      data.value = null
      scannedFiles.value = []
      useAI.value = enableAI

      const result = await analysisBridge.startAnalysis(path.value, enableAI, {
        onProgress: (progressInfo) => {
          progress.value = progressInfo.percentage
          progressData.value = progressInfo
          status.value = 'analyzing'
        },
        onFileScanned: (file) => {
          scannedFiles.value.push(file)
        }
      })

      data.value = result
      status.value = 'complete'
      progress.value = 100
      progressData.value.completed = true
      
      // Save path for next time
      localStorage.setItem('lastPath', path.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Analysis failed'
      status.value = 'error'
      isAnalysisRunning.value = false
    }
  }

  const reset = () => {
    status.value = 'idle'
    progress.value = 0
    isAnalysisRunning.value = false
    data.value = null
    error.value = null
    scannedFiles.value = []
    progressData.value = {
      files: 0,
      percentage: 0,
      currentFile: '',
      completed: false
    }
  }

  return {
    path,
    status,
    progress,
    isAnalysisRunning,
    data,
    error,
    useAI,
    scannedFiles,
    progressData,
    handleAnalysis,
    reset
  }
})

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import {
  FolderOpen,
  FolderPlus,
  Search,
  WifiOff,
  Server,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  FileText,
  HardDrive,
  Activity,
  Clock,
  X,
  CheckCircle2,
  FolderTree,
  AlertCircle,
  Square,
  Scan,
  Upload,
  Zap,
  TrendingUp,
  Shield,
  ChevronRight,
  Loader2,
} from "lucide-vue-next";
import { useAnalysisStore } from "@/store";
import Button from "@/design-system/components/Button.vue";

const store = useAnalysisStore();
const router = useRouter();
const selectedPath = ref(store.path);
const errorMessage = ref("");
const showError = ref(false);
const isDragging = ref(false);
// Check if we're in Tauri mode
const isTauriMode = typeof window !== "undefined" && !!(window as any).__TAURI__;
const backendStatus = ref<{ ok: boolean; error?: string } | null>(null);
const isCheckingBackend = ref(false);
// Check backend health on mount
onMounted(async () => {
  // In Tauri mode, no backend check needed
  if (isTauriMode) {
    return;
  }
  // Only check backend in web mode
  isCheckingBackend.value = true;
  try {
    // Use proxy for backend health check
    const response = await fetch("/api/health");
    if (response.ok) {
      const data = await response.json();
      backendStatus.value = { ok: data.success };
    } else {
      backendStatus.value = { ok: false, error: "Backend health check failed" };
    }
  } catch (error) {
    backendStatus.value = { ok: false, error: "Failed to check backend status" };
  } finally {
    isCheckingBackend.value = false;
  }
});
// Sync with store
watch(selectedPath, (newPath) => {
  store.path = newPath;
  // Clear error when path changes
  if (newPath) {
    showError.value = false;
    errorMessage.value = "";
  }
});
// Auto-redirect to dashboard when complete
watch(
  () => store.status,
  async (newStatus) => {
    if (newStatus === "complete") {
      // Load analysis results from database
      await store.fetchAnalysisFromDB(store.path);
      // Wait 3 seconds so user can see completion, then redirect
      setTimeout(() => {
        router.push("/");
      }, 3000);
    }
  }
);
// Watch for isAnalysisRunning changes
watch(
  () => store.isAnalysisRunning,
  (newRunning, oldRunning) => {
    // Analysis running state changed
  }
);
// Watch for store errors
watch(
  () => store.error,
  (newError) => {
    if (newError) {
      errorMessage.value = newError;
      showError.value = true;
    }
  }
);
// Computed for reactive progress
const progressPercent = computed(() => {
  return store.progressData.percentage || 0;
});
const filesScanned = computed(() => {
  return store.progressData.files || 0;
});
const totalBytes = computed(() => {
  return store.progressData.totalSize || 0;
});
const currentFile = computed(() => {
  return store.progressData.currentFile || "Starting scan...";
});
// Watch for progress data changes
watch(
  () => store.progressData,
  (newProgressData, oldProgressData) => {
    // Force Vue reactivity update
    nextTick(() => {
      // Progress display updated
    });
  },
  { deep: true }
);
// Estimated time remaining
const estimatedTimeRemaining = computed(() => {
  if (!store.isAnalysisRunning || progressPercent.value === 0) return null;
  // Rough estimate: if we're at X%, assume linear progress
  const remainingPercent = 100 - progressPercent.value;
  // Assume each percent takes roughly the same time
  // This is a simple heuristic
  return Math.ceil(remainingPercent * 0.5); // ~30 seconds per percent as rough guess
});
async function startScan() {
  if (!selectedPath.value) {
    errorMessage.value = "Please select a directory to scan";
    showError.value = true;
    return;
  }
  if (backendStatus.value && !backendStatus.value.ok) {
    errorMessage.value = "Backend is offline. Please check server connection.";
    showError.value = true;
    return;
  }
  showError.value = false;
  errorMessage.value = "";
  try {
    await store.handleAnalysis(false);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Scan failed. Please try again.";
    showError.value = true;
  }
}
async function cancelScan() {
  if (confirm("Are you sure you want to cancel the scan?")) {
    try {
      await store.cancelAnalysis();
    } catch (error) {
      console.error("Failed to cancel analysis:", error);
      // Fallback: reload page if cancel not available
      window.location.reload();
    }
  }
}
interface FileWithPath extends File {
  path?: string;
}
function selectDirectory() {
  // Note: webkitdirectory shows "upload" dialog but we only read the path
  // The actual files are never uploaded, only analyzed locally by the backend
  const input = document.createElement("input");
  input.type = "file";
  input.webkitdirectory = true;
  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      // Get path from first file (Electron/Chrome extension)
      const fileWithPath = files[0] as FileWithPath;
      const filePath = fileWithPath.path || "";
      // Extract directory path (remove filename)
      const lastSlash = filePath.lastIndexOf("\\");
      const dirPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
      selectedPath.value = dirPath;
      store.path = dirPath;
    } else {
      // User cancelled the dialog
      errorMessage.value = "No directory selected. Please try again.";
      showError.value = true;
    }
  };
  input.click();
}
// Drag and drop handlers
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}
function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}
function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const items = e.dataTransfer?.items;
  if (items && items.length > 0) {
    const item = items[0];
    if (item.kind === "file") {
      const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.();
      if (entry && entry.isDirectory) {
        // For dropped folders, we can't easily get the path
        // Show a message explaining this limitation
        errorMessage.value =
          "Drag and drop folders requires the Browse button. Please click Browse to select your folder.";
        showError.value = true;
      } else {
        errorMessage.value = "Please drop a folder, not a file.";
        showError.value = true;
      }
    }
  }
}
function clearError() {
  showError.value = false;
  errorMessage.value = "";
}
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
function formatPath(path: string): string {
  // Show only last 2 directories + filename for readability
  const parts = path.split(/[\\/]/);
  if (parts.length <= 3) return path;
  return "..." + parts.slice(-3).join("/");
}
</script>
<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <!-- Header -->
    <div class="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Scan class="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 class="text-2xl font-bold text-white">Space Scanner</h1>
              <p class="text-slate-400 text-sm">Analyze your disk space with AI-powered insights</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg">
              <div
                class="w-2 h-2 rounded-full"
                :class="backendStatus?.ok ? 'bg-emerald-500' : 'bg-red-500'"
              />
              <span class="text-sm text-slate-300">
                {{ backendStatus?.ok ? "Backend Online" : "Backend Offline" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid lg:grid-cols-3 gap-8">
        <!-- Left Panel - Directory Selection -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Directory Selection Card -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8">
            <div class="mb-6">
              <h2 class="text-xl font-semibold text-white mb-2">Select Directory</h2>
              <p class="text-slate-400">
                Choose a folder to analyze its contents and storage usage
              </p>
            </div>

            <!-- Drag & Drop Zone -->
            <div
              class="relative border-2 border-dashed border-slate-600 rounded-xl p-8 text-center transition-all duration-300"
              :class="{
                'border-blue-500 bg-blue-500/10 scale-[1.02]': isDragging,
                'hover:border-slate-500 hover:bg-slate-700/30':
                  !isDragging && !store.isAnalysisRunning,
                'opacity-50 cursor-not-allowed': store.isAnalysisRunning,
              }"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
            >
              <div class="flex flex-col items-center gap-4">
                <div class="p-4 bg-slate-700/50 rounded-full">
                  <Upload class="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <p class="text-white font-medium mb-1">
                    {{ isDragging ? "Drop folder here" : "Drag & drop a folder here" }}
                  </p>
                  <p class="text-slate-400 text-sm">or click to browse</p>
                </div>
                <Button
                  variant="secondary"
                  class="px-6"
                  :disabled="store.isAnalysisRunning"
                  @click="selectDirectory"
                >
                  <FolderOpen class="w-4 h-4 mr-2" />
                  Browse Folders
                </Button>
              </div>
            </div>

            <!-- Selected Path Display -->
            <div v-if="selectedPath" class="mt-6">
              <div class="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg">
                <FolderTree class="w-5 h-5 text-blue-400 flex-shrink-0" />
                <input
                  v-model="selectedPath"
                  type="text"
                  class="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none"
                  :disabled="store.isAnalysisRunning"
                />
                <Button
                  v-if="!store.isAnalysisRunning"
                  variant="ghost"
                  size="sm"
                  class="text-slate-400 hover:text-white"
                  @click="selectedPath = ''"
                >
                  <X class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <!-- Error Message -->
            <div
              v-if="showError"
              class="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
            >
              <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-red-300 text-sm">
                  {{ errorMessage }}
                </p>
              </div>
              <button class="text-red-400 hover:text-red-300 transition-colors" @click="clearError">
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Progress Display -->
          <div
            v-if="store.isAnalysisRunning || store.status === 'complete'"
            class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8"
          >
            <div class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-xl font-semibold text-white">
                  {{ store.status === "complete" ? "Analysis Complete!" : "Scanning in Progress" }}
                </h3>
                <div v-if="store.isAnalysisRunning" class="flex items-center gap-2">
                  <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span class="text-sm text-blue-400">Active</span>
                </div>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="bg-slate-700/30 rounded-xl p-4 text-center">
                <FileText class="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <div class="text-2xl font-bold text-white">
                  {{ filesScanned.toLocaleString() }}
                </div>
                <div class="text-xs text-slate-400">Files</div>
              </div>
              <div class="bg-slate-700/30 rounded-xl p-4 text-center">
                <HardDrive class="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <div class="text-2xl font-bold text-white">
                  {{ formatSize(totalBytes) }}
                </div>
                <div class="text-xs text-slate-400">Total Size</div>
              </div>
              <div class="bg-slate-700/30 rounded-xl p-4 text-center">
                <Activity class="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <div class="text-2xl font-bold text-white">{{ progressPercent }}%</div>
                <div class="text-xs text-slate-400">Progress</div>
              </div>
              <div
                v-if="store.isAnalysisRunning && estimatedTimeRemaining !== null"
                class="bg-slate-700/30 rounded-xl p-4 text-center"
              >
                <Clock class="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <div class="text-2xl font-bold text-white">~{{ estimatedTimeRemaining }}s</div>
                <div class="text-xs text-slate-400">ETA</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mb-6">
              <div class="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  :class="[
                    'h-full rounded-full transition-all duration-500 ease-out',
                    store.status === 'complete'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse',
                  ]"
                  :style="{ width: progressPercent + '%' }"
                />
              </div>
            </div>

            <!-- Current Status -->
            <div class="text-center">
              <p class="text-slate-300">
                {{
                  store.status === "complete" ? "✅ Analysis finished successfully!" : currentFile
                }}
              </p>
            </div>

            <!-- Cancel Button -->
            <div v-if="store.isAnalysisRunning" class="mt-6 text-center">
              <Button variant="secondary" @click="cancelScan">
                <X class="w-4 h-4 mr-2" />
                Cancel Scan
              </Button>
            </div>
          </div>
        </div>

        <!-- Right Panel - Features & Info -->
        <div class="space-y-6">
          <!-- Features Card -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Features</h3>
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-emerald-500/20 rounded-lg">
                  <Shield class="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p class="text-white text-sm font-medium">Secure Analysis</p>
                  <p class="text-slate-400 text-xs">Files stay in place</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="p-2 bg-blue-500/20 rounded-lg">
                  <Zap class="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p class="text-white text-sm font-medium">Lightning Fast</p>
                  <p class="text-slate-400 text-xs">Local processing only</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="p-2 bg-purple-500/20 rounded-lg">
                  <TrendingUp class="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p class="text-white text-sm font-medium">AI Insights</p>
                  <p class="text-slate-400 text-xs">Smart recommendations</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div class="space-y-3">
              <Button
                variant="ghost"
                class="w-full justify-start"
                @click="router.push('/scan-history')"
              >
                <Clock class="w-4 h-4 mr-3" />
                View Scan History
                <ChevronRight class="w-4 h-4 ml-auto" />
              </Button>
              <Button variant="ghost" class="w-full justify-start" @click="router.push('/largest')">
                <TrendingUp class="w-4 h-4 mr-3" />
                Largest Files
                <ChevronRight class="w-4 h-4 ml-auto" />
              </Button>
              <Button
                variant="ghost"
                class="w-full justify-start"
                @click="router.push('/duplicates')"
              >
                <FileText class="w-4 h-4 mr-3" />
                Duplicates
                <ChevronRight class="w-4 h-4 ml-auto" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Start Scan Button -->
      <div class="mt-8 flex justify-center">
        <Button
          v-if="!store.isAnalysisRunning"
          :disabled="!selectedPath || (backendStatus && !backendStatus.ok)"
          variant="primary"
          size="lg"
          class="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          @click="startScan"
        >
          <Scan class="w-5 h-5 mr-3" />
          {{ backendStatus && !backendStatus.ok ? "Backend Offline" : "Start Analysis" }}
        </Button>
      </div>
    </div>
  </div>
</template>

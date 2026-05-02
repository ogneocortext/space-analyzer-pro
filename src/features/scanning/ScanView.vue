<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  FolderOpen,
  Scan,
  CheckCircle2,
  FileText,
  HardDrive,
  Activity,
  Loader2,
  AlertCircle,
  X,
  Clock,
  FolderTree,
  Server,
  WifiOff,
} from "lucide-vue-next";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";
import PerformanceMonitor from "../../components/performance/PerformanceMonitor.vue";
import RealTimePerformanceMonitor from "../../components/performance/RealTimePerformanceMonitor.vue";
import PerformanceInsights from "../../components/performance/PerformanceInsights.vue";

const store = useAnalysisStore();
const router = useRouter();
const selectedPath = ref(store.path);
const errorMessage = ref("");
const showError = ref(false);
const isDragging = ref(false);
const backendStatus = ref<{ ok: boolean; error?: string } | null>(null);
const isCheckingBackend = ref(false);

// Check backend health on mount
onMounted(async () => {
  await checkBackendHealth();
});

async function checkBackendHealth() {
  isCheckingBackend.value = true;
  try {
    backendStatus.value = await store.checkBackend();
  } catch (error) {
    backendStatus.value = { ok: false, error: "Failed to check backend status" };
  } finally {
    isCheckingBackend.value = false;
  }
}

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
  (newStatus) => {
    console.log("🔄 Store status changed to:", newStatus);
    console.log("🔄 isAnalysisRunning:", store.isAnalysisRunning);
    console.log("🔄 progressData:", store.progressData);

    if (newStatus === "complete" && store.analysisResult) {
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
    console.log("🔄 isAnalysisRunning changed:", { from: oldRunning, to: newRunning });
  }
);

// Watch for store errors
watch(
  () => store.error,
  (newError) => {
    if (newError) {
      console.log("❌ Store error:", newError);
      errorMessage.value = newError;
      showError.value = true;
    }
  }
);

// Computed for reactive progress
const progressPercent = computed(() => {
  const value = store.progressData.percentage || 0;
  console.log("📊 Progress percent computed:", value, "from progressData:", store.progressData);
  return value;
});

const filesScanned = computed(() => {
  const value = store.progressData.files || 0;
  console.log("📊 Files scanned computed:", value, "from progressData:", store.progressData);
  return value;
});

const totalBytes = computed(() => {
  const value = store.progressData.totalSize || 0;
  console.log("📊 Total bytes computed:", value, "from progressData:", store.progressData);
  return value;
});

const currentFile = computed(() => {
  const value = store.progressData.currentFile || "Starting scan...";
  console.log("📊 Current file computed:", value, "from progressData:", store.progressData);
  return value;
});

// Watch for progress data changes
watch(
  () => store.progressData,
  (newProgressData, oldProgressData) => {
    console.log("🔄 Progress data changed:", {
      from: oldProgressData,
      to: newProgressData,
      timestamp: new Date().toISOString(),
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
  console.log("🚀 Start scan button clicked");
  console.log("📂 Selected path:", selectedPath.value);
  console.log("🔧 Store state before:", {
    isAnalysisRunning: store.isAnalysisRunning,
    status: store.status,
    path: store.path,
  });
  console.log("🔧 Backend status:", backendStatus.value);
  console.log("🔧 Button disabled state check:", {
    hasSelectedPath: !!selectedPath.value,
    backendOk: !backendStatus.value || backendStatus.value.ok,
    isDisabled: !selectedPath.value || (backendStatus.value && !backendStatus.value.ok),
  });

  if (!selectedPath.value) {
    console.log("❌ No path selected, showing error");
    errorMessage.value = "Please select a directory to scan";
    showError.value = true;
    return;
  }

  if (backendStatus.value && !backendStatus.value.ok) {
    console.log("❌ Backend is offline, cannot start scan");
    errorMessage.value = "Backend is offline. Please check server connection.";
    showError.value = true;
    return;
  }

  showError.value = false;
  errorMessage.value = "";

  try {
    console.log("✅ Starting analysis...");
    await store.handleAnalysis(false);
    console.log("✅ Analysis completed");
  } catch (error) {
    console.error("❌ Analysis failed:", error);
    errorMessage.value = error instanceof Error ? error.message : "Scan failed. Please try again.";
    showError.value = true;
  }
}

function cancelScan() {
  if (confirm("Are you sure you want to cancel the scan?")) {
    store.cancelAnalysis?.();
    // Fallback: reload page if cancel not available
    if (!store.cancelAnalysis) {
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
  <div class="max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">Scan Directory</h1>

    <!-- Backend Status Warning -->
    <div
      v-if="backendStatus && !backendStatus.ok"
      class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3"
    >
      <WifiOff class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-amber-300 text-sm font-medium mb-1">Backend Server Not Available</p>
        <p class="text-amber-400/80 text-xs">
          {{
            backendStatus.error ||
            "Cannot connect to the analysis backend. The server may not be running."
          }}
        </p>
        <p class="text-amber-400/60 text-xs mt-2">
          Make sure the backend server is running on port 8080.
        </p>
      </div>
      <Button variant="ghost" size="sm" @click="checkBackendHealth" :disabled="isCheckingBackend">
        <Server class="w-4 h-4 mr-1" />
        {{ isCheckingBackend ? "Checking..." : "Retry" }}
      </Button>
    </div>

    <!-- Error Message -->
    <div
      v-if="showError"
      class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in"
    >
      <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-red-300 text-sm">{{ errorMessage }}</p>
      </div>
      <button @click="clearError" class="text-red-400 hover:text-red-300 transition-colors">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Path Selection -->
    <div
      class="bg-linear-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50 transition-all"
      :class="{ 'border-blue-500/50 ring-2 ring-blue-500/20': isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 bg-blue-500/20 rounded-lg">
          <FolderTree class="w-5 h-5 text-blue-400" />
        </div>
        <h2 class="text-lg font-semibold text-slate-100">Select Directory to Scan</h2>
      </div>

      <div class="space-y-4">
        <!-- Drop Zone -->
        <div
          class="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center transition-all"
          :class="{
            'border-blue-500 bg-blue-500/10': isDragging,
            'hover:border-slate-500': !isDragging && !store.isAnalysisRunning,
          }"
        >
          <FolderOpen class="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p class="text-slate-300 font-medium mb-1">
            {{ isDragging ? "Drop folder here" : "Click Browse or drag & drop a folder" }}
          </p>
          <p class="text-slate-500 text-sm mb-4">
            Select any folder on your computer to analyze its contents
          </p>
          <Button
            variant="secondary"
            class="px-6"
            @click="selectDirectory"
            :disabled="store.isAnalysisRunning"
          >
            <FolderOpen class="w-4 h-4 mr-2" />
            Browse
          </Button>
        </div>

        <!-- Selected Path Display -->
        <div v-if="selectedPath" class="flex gap-3 items-center">
          <div class="flex-1 relative">
            <input
              v-model="selectedPath"
              type="text"
              placeholder="Enter directory path..."
              :disabled="store.isAnalysisRunning"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
            <div class="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle2 class="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <Button
            v-if="!store.isAnalysisRunning"
            variant="ghost"
            size="sm"
            @click="selectedPath = ''"
            class="text-slate-400 hover:text-slate-200"
          >
            <X class="w-4 h-4" />
          </Button>
        </div>

        <!-- Feature Highlights -->
        <div class="grid grid-cols-3 gap-3 pt-2">
          <div class="flex items-center gap-2 text-sm text-slate-400">
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Files stay in place</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-slate-400">
            <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Local analysis only</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-slate-400">
            <div class="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>AI-powered insights</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Start/Cancel Scan -->
    <div class="flex justify-center gap-4">
      <button
        v-if="!store.isAnalysisRunning"
        :disabled="!selectedPath || (backendStatus && !backendStatus.ok)"
        class="group relative inline-flex items-center gap-3 px-8 py-4 bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:shadow-none transition-all duration-300"
        @click="startScan"
      >
        <Scan class="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span>
          {{ backendStatus && !backendStatus.ok ? "Backend Offline" : "Start Scan" }}
        </span>
      </button>

      <button
        v-else
        class="group relative inline-flex items-center gap-3 px-8 py-4 bg-linear-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300"
        @click="cancelScan"
      >
        <X class="w-5 h-5" />
        <span>Cancel Scan</span>
      </button>
    </div>

    <!-- Progress -->
    <div v-if="store.isAnalysisRunning || store.status === 'complete'" class="space-y-4">
      <div
        class="bg-linear-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50"
      >
        <div class="flex items-center gap-3 mb-6">
          <div class="p-2 bg-emerald-500/20 rounded-lg">
            <Activity class="w-5 h-5 text-emerald-400" />
          </div>
          <h2 class="text-lg font-semibold text-slate-100">
            {{ store.status === "complete" ? "Scan Complete!" : "Scanning Progress" }}
          </h2>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <FileText class="w-4 h-4 text-blue-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">Files</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-blue-400">
              {{ filesScanned.toLocaleString() }}
            </div>
          </div>

          <div class="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <HardDrive class="w-4 h-4 text-emerald-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">Size</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-emerald-400">
              {{ formatSize(totalBytes) }}
            </div>
          </div>

          <div class="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <Activity class="w-4 h-4 text-purple-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">Progress</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-purple-400">{{ progressPercent }}%</div>
          </div>

          <div
            v-if="store.isAnalysisRunning && estimatedTimeRemaining !== null"
            class="bg-slate-950/50 rounded-xl p-4 border border-slate-800"
          >
            <div class="flex items-center gap-2 mb-2">
              <Clock class="w-4 h-4 text-amber-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">ETA</span>
            </div>
            <div class="text-2xl sm:text-3xl font-bold text-amber-400">
              ~{{ estimatedTimeRemaining }}s
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mb-6">
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              :class="[
                'h-full rounded-full transition-all duration-500 ease-out',
                store.status === 'complete'
                  ? 'bg-linear-to-r from-emerald-500 to-emerald-400'
                  : 'bg-linear-to-r from-blue-600 to-blue-400 animate-pulse',
              ]"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
        </div>

        <!-- Current File / Recent Files -->
        <div class="space-y-3">
          <p class="text-sm text-slate-400">
            {{
              store.status === "complete"
                ? "✅ Analysis finished successfully!"
                : "Recently scanned files:"
            }}
          </p>

          <div
            v-if="store.status !== 'complete' && store.recentlyScannedFiles.length > 0"
            class="bg-slate-950/50 rounded-xl border border-slate-800/50 max-h-48 overflow-y-auto"
          >
            <ul class="divide-y divide-slate-800/50">
              <li
                v-for="(file, index) in [...store.recentlyScannedFiles].reverse()"
                :key="index"
                class="px-4 py-2 text-xs text-slate-400 font-mono hover:bg-slate-800/30 transition-colors flex items-center gap-2"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                <span class="truncate">{{ formatPath(file) }}</span>
              </li>
            </ul>
          </div>

          <p
            v-else-if="store.status !== 'complete'"
            class="text-sm text-slate-500 text-center py-4 bg-slate-950/30 rounded-lg border border-slate-800/30"
          >
            {{ currentFile }}
          </p>
        </div>
      </div>
    </div>

    <!-- Performance Monitoring -->
    <div v-if="store.isAnalysisRunning || store.status === 'complete'" class="space-y-4">
      <!-- Real-time Performance Monitor (shown during scanning) -->
      <RealTimePerformanceMonitor
        v-if="store.isAnalysisRunning"
        :is-active="store.isAnalysisRunning"
        :current-metrics="{
          timestamp: Date.now(),
          filesPerSecond:
            store.progressData.files > 0
              ? store.progressData.files /
                ((Date.now() - (store.analysisStartTime || Date.now())) / 1000)
              : 0,
          bytesPerSecond:
            store.progressData.totalSize > 0
              ? store.progressData.totalSize /
                ((Date.now() - (store.analysisStartTime || Date.now())) / 1000)
              : 0,
          memoryUsage: 0, // Will be updated with real data
          diskReads: store.progressData.files,
          cpuUsage: 0, // Will be updated with real data
          ioWaitTime: 0, // Will be updated with real data
        }"
      />

      <!-- Performance Monitor (shown after completion) -->
      <PerformanceMonitor
        v-if="store.status === 'complete' && store.analysisResult?.performance"
        :performance="store.analysisResult.performance"
        :is-loading="false"
      />

      <!-- Performance Insights (shown after completion) -->
      <PerformanceInsights
        v-if="store.status === 'complete' && store.analysisResult?.performance"
        :performance="store.analysisResult.performance"
        :scan-size="store.analysisResult.summary?.total_files || 0"
        :scan-duration="store.analysisResult.performance?.scan_duration_ms || 0"
      />
    </div>

    <!-- Results Summary -->
    <div v-if="store.analysisResult && store.status === 'complete'" class="space-y-4">
      <Card title="Analysis Complete">
        <div class="space-y-6">
          <!-- Stats Grid -->
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center p-4 bg-slate-800/50 rounded-lg">
              <div class="text-3xl font-bold text-blue-400">
                {{ store.analysisResult.totalFiles.toLocaleString() }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Files Found</div>
            </div>
            <div class="text-center p-4 bg-slate-800/50 rounded-lg">
              <div class="text-3xl font-bold text-emerald-400">
                {{ formatSize(store.analysisResult.totalSize) }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Total Size</div>
            </div>
          </div>

          <!-- Next Steps -->
          <div class="space-y-3">
            <p class="text-sm text-slate-400 text-center">What would you like to do next?</p>
            <div class="flex gap-3 justify-center">
              <Button variant="primary" @click="$router.push('/')"> View Dashboard </Button>
              <Button variant="secondary" @click="$router.push('/browser')"> Browse Files </Button>
            </div>
          </div>

          <!-- AI Insights Note -->
          <div
            v-if="store.useAI"
            class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center"
          >
            <p class="text-sm text-blue-300">
              AI insights are being generated from your scan results
            </p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

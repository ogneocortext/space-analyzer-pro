<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { AlertTriangle, Search } from "lucide-vue-next";
import { useAnalysisStore } from "@/store";
import Button from "@/design-system/components/Button.vue";

const store = useAnalysisStore();
const router = useRouter();
const route = useRoute();
const selectedPath = ref("");
const errorMessage = ref("");
const showError = ref(false);
const isDragging = ref(false);
const isSelectingDirectory = ref(false);
const directorySelectionProgress = ref(0);
const recentDirectories = ref<string[]>([]);
const scanSettings = ref({
  includeHiddenFiles: false,
  maxDepth: 10,
  excludePatterns: [] as string[],
});
const showSettings = ref(false);
// Check if we're in Tauri mode
const isTauriMode = typeof window !== "undefined" && !!(window as any).__TAURI__;
const backendStatus = ref<{ ok: boolean; error?: string } | null>(null);
const isCheckingBackend = ref(false);
// Load recent directories on mount
loadRecentDirectories();

// Check backend health on mount
onMounted(async () => {
  // Check if we have analysis data from route parameters
  if (route.query.path && route.query.analysisId) {
    console.log("🔍 Route parameters detected:", {
      path: route.query.path,
      analysisId: route.query.analysisId,
    });

    // Load analysis data from route parameters
    selectedPath.value = route.query.path as string;

    // Fetch analysis data from database using analysisId
    try {
      console.log("📡 Fetching analysis from API:", `/api/history/${route.query.analysisId}`);
      const response = await fetch(`/api/history/${route.query.analysisId}`);
      console.log("📡 API Response status:", response.status);

      if (response.ok) {
        const analysisData = await response.json();
        console.log("📊 Raw API response:", analysisData);

        if (analysisData.success && analysisData.analysis) {
          // Set analysis data in store
          store.analysisResult = analysisData.analysis;
          // Set filesScanned from analysis data
          store.filesScanned = analysisData.analysis.totalFiles || 0;
          // Set analysis as complete (not analyzing)
          store.isAnalyzing = false;
          store.analysisProgress = 100;
        } else {
          console.warn("Invalid analysis data format:", analysisData);
          showError.value = true;
          errorMessage.value = "Invalid analysis data format";
        }
      } else {
        console.warn("Failed to fetch analysis data:", response.status, response.statusText);
        showError.value = true;
        errorMessage.value = `Failed to load analysis: ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      console.error("Error fetching analysis data:", error);
      showError.value = true;
      errorMessage.value = "Network error while loading analysis";
      // Continue with empty state - don't break the page
    }
  } else {
    console.log("ℹ️ No route parameters found, showing normal scan view");
  }

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
// Auto-redirect to dashboard when complete (only for new analyses, not historical ones)
watch(
  () => store.analysisResult,
  async (analysisResult) => {
    // Only redirect if we're not viewing historical analysis (no route.query.analysisId)
    if (analysisResult && !route.query.analysisId) {
      // Load analysis results from database
      await store.fetchAnalysisFromDB(store.path);
      // Wait 3 seconds so user can see completion, then redirect
      setTimeout(() => {
        router.push("/");
      }, 3000);
    }
  }
);
// Watch for isAnalyzing changes
watch(
  () => store.isAnalyzing,
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
  return store.analysisProgress || 0;
});
const filesScanned = computed(() => {
  return store.filesScanned || 0;
});
const totalBytes = computed(() => {
  return store.analysisResult?.totalSize || 0;
});
const currentFile = computed(() => {
  return store.currentFile || "Starting scan...";
});
// Estimated time remaining
const estimatedTimeRemaining = computed(() => {
  if (!store.isAnalyzing || progressPercent.value === 0) return null;
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

  // Add to recent directories
  addToRecentDirectories(selectedPath.value);

  showError.value = false;
  errorMessage.value = "";
  try {
    await store.handleAnalysis(false); // false = no AI for regular scan
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
async function selectDirectory() {
  isSelectingDirectory.value = true;
  directorySelectionProgress.value = 0;

  try {
    // Simulate directory selection progress
    directorySelectionProgress.value = 25;

    // Note: webkitdirectory shows "upload" dialog but we only read file metadata
    // The actual files are never moved or uploaded, only scanned for analysis
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;

    directorySelectionProgress.value = 50;

    return new Promise<void>((resolve, reject) => {
      input.onchange = (e: Event) => {
        directorySelectionProgress.value = 75;

        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Get path from first file (Electron/Chrome extension)
          const fileWithPath = files[0] as FileWithPath;
          const filePath = fileWithPath.path || "";
          // Extract directory path (remove filename)
          const lastSlash = filePath.lastIndexOf("\\");
          const dirPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;

          directorySelectionProgress.value = 100;
          selectedPath.value = dirPath;
          // Note: store.path property doesn't exist in current store, commented out for now
          // store.path = dirPath;

          setTimeout(() => {
            isSelectingDirectory.value = false;
            directorySelectionProgress.value = 0;
            resolve();
          }, 500);
        } else {
          // User cancelled the dialog
          isSelectingDirectory.value = false;
          directorySelectionProgress.value = 0;
          errorMessage.value = "No directory selected. Please try again.";
          showError.value = true;
          resolve();
        }
      };

      input.oncancel = () => {
        isSelectingDirectory.value = false;
        directorySelectionProgress.value = 0;
        resolve();
      };

      input.click();
    });
  } catch (error) {
    isSelectingDirectory.value = false;
    directorySelectionProgress.value = 0;
    errorMessage.value = "Failed to open directory selection dialog.";
    showError.value = true;
  }
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
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function addToRecentDirectories(path: string) {
  if (!path) return;

  // Remove if already exists
  recentDirectories.value = recentDirectories.value.filter((dir) => dir !== path);

  // Add to beginning
  recentDirectories.value.unshift(path);

  // Keep only last 5 directories
  recentDirectories.value = recentDirectories.value.slice(0, 5);

  // Save to localStorage
  try {
    localStorage.setItem("recentDirectories", JSON.stringify(recentDirectories.value));
  } catch (error) {
    console.error("Failed to save recent directories:", error);
  }
}

function loadRecentDirectories() {
  try {
    const saved = localStorage.getItem("recentDirectories");
    if (saved) {
      recentDirectories.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to load recent directories:", error);
  }
}

function selectRecentDirectory(path: string) {
  selectedPath.value = path;
  addToRecentDirectories(path);
  startScan();
}

function toggleSettings() {
  showSettings.value = !showSettings.value;
}

function clearError() {
  showError.value = false;
  errorMessage.value = "";
}

function clearRecentDirectories() {
  recentDirectories.value = [];
  try {
    localStorage.removeItem("recentDirectories");
  } catch (error) {
    console.error("Failed to clear recent directories:", error);
  }
}
</script>
<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-slate-100 mb-2">Space Analyzer</h1>
        <p class="text-slate-400 mb-6">Select a directory to scan and analyze storage usage</p>
      </div>

      <!-- Error Display -->
      <div v-if="showError" class="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
        <div class="flex items-center mb-2">
          <AlertTriangle class="w-5 h-5 text-red-400 mr-2" />
          <span class="text-red-200 font-medium">Error</span>
        </div>
        <p class="text-red-100">
          {{ errorMessage }}
        </p>
      </div>

      <!-- Main Content -->
      <div v-if="!showError" class="space-y-6">
        <!-- Directory Selection -->
        <div
          class="bg-slate-800 rounded-lg p-6 border border-slate-700 transition-all duration-300"
          :class="{ 'border-blue-500 bg-slate-800/50': isDragging }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <div class="text-center">
            <h2 class="text-xl font-semibold text-slate-100 mb-4">Select Directory to Scan</h2>
            <p class="text-slate-400 mb-6">
              Choose a folder to analyze its contents and storage usage
            </p>

            <!-- Drag and Drop Visual Feedback -->
            <div
              v-if="isDragging"
              class="border-2 border-dashed border-blue-500 bg-blue-500/10 rounded-lg p-8 mb-4 transition-all duration-300"
            >
              <div class="text-blue-300">
                <div class="text-4xl mb-2">📁</div>
                <p class="text-lg font-medium">Drop folder here to scan</p>
                <p class="text-sm opacity-75">Or click Browse to select</p>
              </div>
            </div>

            <div v-else class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p class="text-blue-300 text-sm font-medium">
                🔍 Files are only scanned for analysis - they are NOT moved or copied
              </p>
            </div>

            <div class="flex flex-col items-center gap-4">
              <Button variant="secondary" class="w-full justify-start" @click="selectDirectory">
                📁 Select Directory to Scan
              </Button>

              <!-- Directory Selection Progress -->
              <div v-if="isSelectingDirectory" class="w-full bg-slate-700 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-slate-300 text-sm">Opening directory dialog...</span>
                  <span class="text-slate-300 text-sm">{{ directorySelectionProgress }}%</span>
                </div>
                <div class="w-full bg-slate-600 rounded-full h-2">
                  <div
                    class="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                    :style="{ width: `${directorySelectionProgress}%` }"
                  />
                </div>
              </div>

              <Button v-if="selectedPath" variant="primary" class="w-full" @click="startScan">
                <Search class="w-4 h-4 mr-3" />
                Start Scan
              </Button>
            </div>
          </div>
        </div>

        <!-- Recent Directories -->
        <div
          v-if="recentDirectories.length > 0"
          class="bg-slate-800 rounded-lg p-6 border border-slate-700"
        >
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-100">Recent Directories</h3>
            <Button variant="ghost" size="sm" @click="clearRecentDirectories"> ❌ Clear </Button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(dir, index) in recentDirectories"
              :key="index"
              class="flex items-center justify-between p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors cursor-pointer group"
              @click="selectRecentDirectory(dir)"
            >
              <div class="flex items-center space-x-3">
                <div class="text-blue-400">📁</div>
                <p class="text-slate-200 font-mono text-sm truncate flex-1">
                  {{ dir }}
                </p>
              </div>
              <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="text-blue-400 text-sm">Scan</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Path Display -->
        <div v-if="selectedPath" class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold text-slate-100">Selected Directory</h3>
            <Button variant="ghost" size="sm" @click="clearError"> ❌ Clear </Button>
          </div>
          <p class="text-slate-300 font-mono">
            {{ selectedPath }}
          </p>
        </div>

        <!-- Progress Indicator -->
        <div v-if="store.isAnalyzing" class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-100">Scanning Progress</h3>
            <div class="flex items-center space-x-2">
              <div class="w-5 h-5 text-blue-400 animate-spin">⚡</div>
              <span class="text-slate-300">{{ progressPercent }}%</span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="w-full bg-slate-700 rounded-full h-3 mb-4">
            <div
              class="bg-linear-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>

          <!-- Progress Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-400">Current File:</span>
              <p class="text-slate-200 font-mono truncate">
                {{ currentFile }}
              </p>
            </div>
            <div>
              <span class="text-slate-400">Files Scanned:</span>
              <p class="text-slate-200">
                {{ filesScanned.toLocaleString() }}
              </p>
            </div>
            <div v-if="totalBytes > 0">
              <span class="text-slate-400">Total Size:</span>
              <p class="text-slate-200">
                {{ formatBytes(totalBytes) }}
              </p>
            </div>
            <div v-if="estimatedTimeRemaining">
              <span class="text-slate-400">Est. Time Remaining:</span>
              <p class="text-slate-200">{{ estimatedTimeRemaining }}s</p>
            </div>
          </div>

          <!-- Cancel Button -->
          <div class="mt-4 flex justify-center">
            <Button variant="secondary" class="text-red-400 hover:text-red-300" @click="cancelScan">
              ❌ Cancel Scan
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

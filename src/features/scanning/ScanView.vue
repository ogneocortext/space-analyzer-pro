<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import {
  FolderOpen,
  Scan,
  CheckCircle2,
  FileText,
  HardDrive,
  Activity,
  Loader2,
} from "lucide-vue-next";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const router = useRouter();
const selectedPath = ref(store.path);

// Sync with store
watch(selectedPath, (newPath) => {
  store.path = newPath;
});

// Auto-redirect to dashboard when complete
watch(
  () => store.status,
  (newStatus) => {
    if (newStatus === "complete" && store.analysisResult) {
      // Wait 3 seconds so user can see completion, then redirect
      setTimeout(() => {
        router.push("/");
      }, 3000);
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

async function startScan() {
  if (!selectedPath.value) return;
  await store.handleAnalysis(false);
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
    }
  };
  input.click();
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

    <!-- Path Selection -->
    <div
      class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50"
    >
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 bg-blue-500/20 rounded-lg">
          <FolderOpen class="w-5 h-5 text-blue-400" />
        </div>
        <h2 class="text-lg font-semibold text-slate-100">Select Directory</h2>
      </div>

      <div class="space-y-4">
        <div class="flex gap-3">
          <div class="flex-1 relative">
            <input
              v-model="selectedPath"
              type="text"
              placeholder="Enter directory path..."
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <div v-if="selectedPath" class="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle2 class="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <Button variant="secondary" class="px-6" @click="selectDirectory"> Browse </Button>
        </div>

        <div class="grid grid-cols-3 gap-3">
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

    <!-- Start Scan -->
    <div class="flex justify-center">
      <button
        :disabled="!selectedPath || store.isAnalysisRunning"
        class="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:shadow-none transition-all duration-300"
        @click="startScan"
      >
        <Loader2 v-if="store.isAnalysisRunning" class="w-5 h-5 animate-spin" />
        <Scan v-else class="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span>{{ store.isAnalysisRunning ? "Scanning..." : "Start Scan" }}</span>
      </button>
    </div>

    <!-- Progress -->
    <div v-if="store.isAnalysisRunning || store.status === 'complete'" class="space-y-4">
      <div
        class="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50"
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
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <FileText class="w-4 h-4 text-blue-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">Files</span>
            </div>
            <div class="text-3xl font-bold text-blue-400">
              {{ filesScanned.toLocaleString() }}
            </div>
          </div>

          <div class="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <HardDrive class="w-4 h-4 text-emerald-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">Scanned</span>
            </div>
            <div class="text-3xl font-bold text-emerald-400">
              {{ formatSize(totalBytes) }}
            </div>
          </div>

          <div class="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
            <div class="flex items-center gap-2 mb-2">
              <Activity class="w-4 h-4 text-purple-400" />
              <span class="text-xs text-slate-500 uppercase tracking-wider">Progress</span>
            </div>
            <div class="text-3xl font-bold text-purple-400">{{ progressPercent }}%</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mb-6">
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              :class="[
                'h-full rounded-full transition-all duration-500 ease-out',
                store.status === 'complete'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-blue-600 to-blue-400 animate-pulse',
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

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
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
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">Scan Directory</h1>

    <!-- Path Selection -->
    <Card title="Select Directory">
      <div class="space-y-4">
        <div class="flex gap-2">
          <input
            v-model="selectedPath"
            type="text"
            placeholder="Enter directory path..."
            class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Button variant="secondary" @click="selectDirectory"> Browse </Button>
        </div>
        <div class="text-sm text-slate-400 space-y-2">
          <p>Select a directory for <strong class="text-slate-300">local analysis only</strong>.</p>
          <ul class="list-disc list-inside space-y-1 text-slate-500">
            <li>Files stay in place - nothing is moved or uploaded</li>
            <li>Analysis runs locally on your machine</li>
            <li>Results display in dashboard and feed AI insights</li>
          </ul>
        </div>
      </div>
    </Card>

    <!-- Start Scan -->
    <div class="flex justify-center">
      <Button
        variant="primary"
        size="lg"
        :loading="store.isAnalysisRunning"
        :disabled="!selectedPath || store.isAnalysisRunning"
        @click="startScan"
      >
        {{ store.isAnalysisRunning ? "Scanning..." : "Start Scan" }}
      </Button>
    </div>

    <!-- Progress -->
    <div v-if="store.isAnalysisRunning || store.status === 'complete'" class="space-y-4">
      <Card :title="store.status === 'complete' ? 'Scan Complete!' : 'Scanning Progress'">
        <div class="space-y-4">
          <!-- Stats Grid -->
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-blue-400">
                {{ filesScanned }}
              </div>
              <div class="text-xs text-slate-500">Files</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-emerald-400">
                {{ formatSize(totalBytes) }}
              </div>
              <div class="text-xs text-slate-500">Scanned</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-purple-400">{{ progressPercent }}%</div>
              <div class="text-xs text-slate-500">Complete</div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              :class="[
                'h-full rounded-full transition-all duration-500 ease-out',
                store.status === 'complete' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse',
              ]"
              :style="{ width: progressPercent + '%' }"
            />
          </div>

          <!-- Current File -->
          <div class="space-y-2">
            <p class="text-sm text-slate-400 text-center">
              {{
                store.status === "complete"
                  ? "Analysis finished successfully!"
                  : "Recently scanned files:"
              }}
            </p>
            <div
              v-if="store.status !== 'complete' && store.recentlyScannedFiles.length > 0"
              class="bg-slate-800/50 rounded-lg p-3 max-h-64 overflow-y-auto"
            >
              <ul class="space-y-2">
                <li
                  v-for="(file, index) in store.recentlyScannedFiles"
                  :key="index"
                  class="text-xs text-slate-300 break-all font-mono leading-relaxed"
                >
                  {{ file }}
                </li>
              </ul>
            </div>
            <p
              v-else-if="store.status !== 'complete'"
              class="text-sm text-slate-500 text-center break-all px-4"
            >
              {{ currentFile }}
            </p>
          </div>
        </div>
      </Card>
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

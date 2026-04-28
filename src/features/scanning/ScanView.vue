<script setup lang="ts">
import { ref, watch } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const selectedPath = ref(store.path);

// Sync with store
watch(selectedPath, (newPath) => {
  store.path = newPath;
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
    <div v-if="store.isAnalysisRunning" class="space-y-4">
      <Card title="Scanning Progress">
        <div class="space-y-4">
          <div class="flex justify-between text-sm">
            <span class="text-slate-400">Files scanned:</span>
            <span class="text-slate-200">{{ store.progressData.files }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-400">Data scanned:</span>
            <span class="text-slate-200">{{ formatSize(store.progressData.totalSize) }}</span>
          </div>
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 rounded-full transition-all duration-300"
              :style="{ width: store.progressData.percentage + '%' }"
            />
          </div>
          <p class="text-sm text-slate-500 text-center">
            {{ store.progressData.currentFile }}
          </p>
        </div>
      </Card>
    </div>

    <!-- Results Summary -->
    <div v-if="store.analysisResult && !store.isAnalysisRunning" class="space-y-4">
      <Card title="Scan Complete">
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center">
            <div class="text-3xl font-bold text-blue-400">
              {{ store.analysisResult.totalFiles.toLocaleString() }}
            </div>
            <div class="text-sm text-slate-400">Files Found</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-emerald-400">
              {{ formatSize(store.analysisResult.totalSize) }}
            </div>
            <div class="text-sm text-slate-400">Total Size</div>
          </div>
        </div>
        <div class="flex justify-center mt-4">
          <Button variant="primary" @click="$router.push('/')"> View Dashboard </Button>
        </div>
      </Card>
    </div>
  </div>
</template>

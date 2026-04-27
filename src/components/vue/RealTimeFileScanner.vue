<template>
  <div class="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
    <!-- Header -->
    <div class="bg-slate-900/50 px-4 py-3 border-b border-slate-700">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <Activity class="w-4 h-4 text-cyan-400 animate-pulse" />
          <span class="text-sm font-medium text-white">Real-time File Scanner</span>
        </div>
        <div class="flex items-center gap-3">
          <!-- Speed metrics -->
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <div class="flex items-center gap-1">
              <Zap class="w-3 h-3 text-yellow-400" />
              <span>{{ metrics.filesPerSecond.toFixed(0) }} files/s</span>
            </div>
            <div class="flex items-center gap-1">
              <Activity class="w-3 h-3 text-emerald-400" />
              <span>{{ metrics.mbPerSecond.toFixed(1) }} MB/s</span>
            </div>
            <div v-if="metrics.etaSeconds > 0" class="flex items-center gap-1">
              <Clock class="w-3 h-3 text-blue-400" />
              <span>ETA: {{ formatTime(metrics.etaSeconds) }}</span>
            </div>
          </div>
          <!-- Pause/Resume button -->
          <button
            class="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            :title="isPaused ? 'Resume scrolling' : 'Pause scrolling'"
            @click="isPaused = !isPaused"
          >
            <Play v-if="isPaused" class="w-3 h-3 text-white" />
            <Pause v-else class="w-3 h-3 text-white" />
          </button>
        </div>
      </div>

      <!-- Progress bar with stats -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">{{ progress.files.toLocaleString() }} files scanned</span>
          <span class="text-cyan-400 font-medium">
            {{ progress.percentage > 0 ? `${progress.percentage.toFixed(1)}%` : "Initializing..." }}
          </span>
        </div>
        <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-300 relative"
            :style="{ width: `${Math.max(1, progress.percentage)}%` }"
          >
            <div class="absolute inset-0 bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    </div>

    <!-- Category distribution -->
    <div
      v-if="topCategories.length > 0"
      class="px-4 py-2 bg-slate-900/30 border-b border-slate-700"
    >
      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span>Top categories:</span>
        <span
          v-for="[category, count] in topCategories"
          :key="category"
          class="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300"
        >
          {{ category }}: {{ count }}
        </span>
      </div>
    </div>

    <!-- Current file -->
    <div
      v-if="progress.currentFile && !progress.completed"
      class="px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20"
    >
      <div class="flex items-center gap-2 text-xs text-cyan-300">
        <File class="w-3 h-3" />
        <span class="truncate">Scanning: {{ formatFileName(progress.currentFile) }}</span>
      </div>
    </div>

    <!-- Scanned files list -->
    <div ref="scrollRef" class="h-64 overflow-y-auto p-2 space-y-1" style="max-height: 256px">
      <div
        v-if="recentFiles.length === 0 && progress.files === 0"
        class="text-center text-slate-500 text-sm py-8"
      >
        Waiting for scan to start...
      </div>
      <div
        v-else-if="recentFiles.length === 0 && progress.files > 0"
        class="text-center text-slate-400 text-sm py-8"
      >
        <div class="flex items-center justify-center gap-2 mb-2">
          <Activity class="w-4 h-4 animate-spin" />
          <span>Scanning {{ progress.files.toLocaleString() }} files...</span>
        </div>
        <div class="text-xs text-slate-500">{{ Math.round(progress.percentage) }}% complete</div>
      </div>
      <div
        v-for="(file, index) in recentFiles"
        v-else
        :key="`${file.path}-${index}`"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
      >
        <File class="w-3 h-3 text-slate-400 shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="text-xs text-white truncate">
            {{ formatFileName(file.name, file.path) }}
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span class="truncate">{{ file.category || "Other" }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div
      v-if="progress.completed"
      class="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/20"
    >
      <div class="flex items-center justify-between text-xs text-emerald-300">
        <span>Scan complete!</span>
        <span
          >{{ progress.files.toLocaleString() }} files processed •
          {{ formatFileSize(metrics.totalSize) }} total</span
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { File, Activity, Zap, Clock, Pause, Play } from "lucide-vue-next";

interface ScannedFile {
  name: string;
  path: string;
  size: number;
  category: string;
}

interface ProgressData {
  files: number;
  percentage: number;
  currentFile: string;
  completed: boolean;
}

interface Props {
  scannedFiles?: ScannedFile[];
  progress?: ProgressData;
}

const props = withDefaults(defineProps<Props>(), {
  scannedFiles: () => [],
  progress: () => ({ files: 0, percentage: 0, currentFile: "", completed: false }),
});

const scrollRef = ref<HTMLDivElement>();
const isPaused = ref(false);
const startTime = ref(Date.now());
const recentFiles = ref<ScannedFile[]>([]);

// Add current file to recent files when it changes
watch(
  () => props.progress.currentFile,
  (newFile) => {
    if (
      newFile &&
      newFile !== "Analysis complete" &&
      newFile !== "Analysis failed" &&
      !newFile.startsWith("Scanned")
    ) {
      const category = getCategoryFromFileName(newFile);
      recentFiles.value.unshift({
        name: newFile,
        path: newFile,
        size: 0,
        category,
      });
      // Keep only last 50 files
      if (recentFiles.value.length > 50) {
        recentFiles.value = recentFiles.value.slice(0, 50);
      }
    }
  }
);

// Auto-scroll to bottom when new files are added
watch(
  () => recentFiles.value,
  async () => {
    if (scrollRef.value && !isPaused.value) {
      await nextTick();
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  },
  { deep: true }
);

// Reset startTime when scan starts
watch(
  () => props.progress.files,
  (newFiles, oldFiles) => {
    if (oldFiles === 0 && newFiles > 0) {
      startTime.value = Date.now();
    }
  }
);

// Calculate speed metrics
const metrics = computed(() => {
  const elapsedSeconds = (Date.now() - startTime.value) / 1000;
  const filesPerSecond = elapsedSeconds > 0 ? props.progress.files / elapsedSeconds : 0;

  const totalSize = recentFiles.value.reduce((acc, file) => acc + file.size, 0);
  const mbPerSecond = elapsedSeconds > 0 ? totalSize / 1024 / 1024 / elapsedSeconds : 0;

  // Estimate remaining time
  let etaSeconds = 0;
  if (props.progress.percentage > 0 && props.progress.percentage < 100 && filesPerSecond > 0) {
    const remainingPercentage = 100 - props.progress.percentage;
    const remainingFiles = (props.progress.files / props.progress.percentage) * remainingPercentage;
    etaSeconds = remainingFiles / filesPerSecond;
  }

  // Category distribution
  const categoryCount: Record<string, number> = {};
  recentFiles.value.forEach((file) => {
    const category = file.category || "Other";
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  return {
    filesPerSecond,
    mbPerSecond,
    etaSeconds,
    categoryCount,
    totalSize,
  };
});

// Deduplicate scanned files by path
const _uniqueScannedFiles = computed(() => {
  const seen = new Set();
  return props.scannedFiles.filter((file) => {
    const key = file.path;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const topCategories = computed(() => {
  return Object.entries(metrics.value.categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
});

const formatFileSize = (bytes: number) => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "Calculating...";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const formatFileName = (name: string, path?: string) => {
  if (!name) return "Unknown file";
  // If it's a hash (git or any 40-char hex), try to get a better name from the path
  if (/^[a-f0-9]{40}$/.test(name)) {
    if (path) {
      const pathParts = path.split(/[/\\]/);
      // Get the last meaningful part from path
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = pathParts[i];
        if (part && part !== name && part.length > 0 && !/^[a-f0-9]{40}$/.test(part)) {
          return part;
        }
      }
    }
    // If no good path found, show abbreviated hash
    return `Hash: ${name.substring(0, 8)}...`;
  }
  // Truncate long names
  if (name.length > 50) {
    return name.substring(0, 47) + "...";
  }
  return name;
};

const getCategoryFromFileName = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const categories: Record<string, string> = {
    js: "Code",
    ts: "Code",
    tsx: "Code",
    jsx: "Code",
    vue: "Code",
    py: "Code",
    rs: "Code",
    cpp: "Code",
    c: "Code",
    h: "Code",
    java: "Code",
    go: "Code",
    php: "Code",
    jpg: "Images",
    jpeg: "Images",
    png: "Images",
    gif: "Images",
    svg: "Images",
    webp: "Images",
    bmp: "Images",
    md: "Documents",
    txt: "Documents",
    pdf: "Documents",
    doc: "Documents",
    docx: "Documents",
    rtf: "Documents",
    odt: "Documents",
    mp3: "Audio",
    wav: "Audio",
    flac: "Audio",
    aac: "Audio",
    ogg: "Audio",
    m4a: "Audio",
    mp4: "Video",
    avi: "Video",
    mkv: "Video",
    mov: "Video",
    wmv: "Video",
    flv: "Video",
    zip: "Archives",
    rar: "Archives",
    "7z": "Archives",
    tar: "Archives",
    gz: "Archives",
  };
  return categories[ext] || "Other";
};
</script>

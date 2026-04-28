<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const displayCount = ref(50);
const minSize = ref(10 * 1024 * 1024); // 10MB default
const selectedFiles = ref<Set<string>>(new Set());

// Get largest files sorted by size
const largestFiles = computed(() => {
  if (!store.analysisResult?.files) return [];
  
  return store.analysisResult.files
    .filter((f: any) => (f.size || 0) >= minSize.value)
    .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
    .slice(0, displayCount.value)
    .map((f: any, index: number) => ({
      ...f,
      rank: index + 1,
    }));
});

// Statistics
const stats = computed(() => {
  if (!largestFiles.value.length) return null;
  
  const totalSize = largestFiles.value.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
  const avgSize = totalSize / largestFiles.value.length;
  
  return {
    count: largestFiles.value.length,
    totalSize,
    avgSize,
    percentage: (totalSize / (store.analysisResult?.totalSize || 1)) * 100,
  };
});

// Toggle file selection
function toggleSelection(path: string) {
  if (selectedFiles.value.has(path)) {
    selectedFiles.value.delete(path);
  } else {
    selectedFiles.value.add(path);
  }
}

// Select all visible
function selectAll() {
  largestFiles.value.forEach((f: any) => selectedFiles.value.add(f.path));
}

// Clear selection
function clearSelection() {
  selectedFiles.value.clear();
}

// Copy path to clipboard
async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    alert("Path copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

// Get file icon based on extension
function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mp3: '🎵',
    wav: '🎵',
    zip: '📦',
    rar: '📦',
    exe: '⚙️',
    dll: '⚙️',
    iso: '💿',
  };
  return icons[ext] || '📄';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Largest Files</h1>
        <p class="text-slate-400 mt-1">Find the biggest space consumers on your drive</p>
      </div>
      <div class="flex items-center gap-4">
        <label class="text-sm text-slate-400">Min size:</label>
        <select
          v-model="minSize"
          class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        >
          <option :value="1 * 1024 * 1024">1 MB</option>
          <option :value="10 * 1024 * 1024">10 MB</option>
          <option :value="100 * 1024 * 1024">100 MB</option>
          <option :value="1024 * 1024 * 1024">1 GB</option>
        </select>
        <select
          v-model="displayCount"
          class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        >
          <option :value="25">Top 25</option>
          <option :value="50">Top 50</option>
          <option :value="100">Top 100</option>
          <option :value="250">Top 250</option>
        </select>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <!-- Stats -->
      <div v-if="stats" class="grid grid-cols-4 gap-4">
        <Card title="Files Found">
          <div class="text-2xl font-bold text-blue-400">{{ stats.count }}</div>
          <div class="text-sm text-slate-500">over {{ formatSize(minSize) }}</div>
        </Card>
        <Card title="Total Size">
          <div class="text-2xl font-bold text-purple-400">{{ formatSize(stats.totalSize) }}</div>
          <div class="text-sm text-slate-500">of scanned data</div>
        </Card>
        <Card title="Average Size">
          <div class="text-2xl font-bold text-emerald-400">{{ formatSize(stats.avgSize) }}</div>
          <div class="text-sm text-slate-500">per file</div>
        </Card>
        <Card title="Storage Impact">
          <div class="text-2xl font-bold text-orange-400">{{ stats.percentage.toFixed(1) }}%</div>
          <div class="text-sm text-slate-500">of total storage</div>
        </Card>
      </div>

      <!-- Selection Actions -->
      <div v-if="selectedFiles.size > 0" class="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <span class="text-blue-400">{{ selectedFiles.size }} files selected</span>
        <Button variant="secondary" size="sm" @click="clearSelection">Clear</Button>
      </div>

      <!-- File List -->
      <Card :title="`Top ${displayCount} Largest Files`">
        <div class="space-y-2">
          <!-- Header -->
          <div class="flex items-center gap-4 p-2 text-sm font-medium text-slate-500 border-b border-slate-700">
            <input
              type="checkbox"
              :checked="selectedFiles.size === largestFiles.length && largestFiles.length > 0"
              @change="selectedFiles.size === largestFiles.length ? clearSelection() : selectAll()"
              class="rounded border-slate-600 bg-slate-800"
            />
            <span class="w-12">Rank</span>
            <span class="flex-1">File</span>
            <span class="w-24 text-right">Size</span>
            <span class="w-24 text-right">Modified</span>
            <span class="w-20 text-right">Actions</span>
          </div>

          <!-- Files -->
          <div
            v-for="file in largestFiles"
            :key="file.path"
            class="flex items-center gap-4 p-2 rounded hover:bg-slate-800/50 transition-colors"
            :class="selectedFiles.has(file.path) ? 'bg-blue-500/10' : ''"
          >
            <input
              type="checkbox"
              :checked="selectedFiles.has(file.path)"
              @change="toggleSelection(file.path)"
              class="rounded border-slate-600 bg-slate-800"
            />
            <span class="w-12 text-slate-500 font-mono">#{{ file.rank }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ getFileIcon(file.name) }}</span>
                <span class="font-medium text-slate-200 truncate" :title="file.name">{{ file.name }}</span>
              </div>
              <div class="text-sm text-slate-500 truncate" :title="file.path">{{ file.path }}</div>
            </div>
            <span class="w-24 text-right font-medium" :class="file.size > 1024 * 1024 * 1024 ? 'text-red-400' : 'text-slate-200'">
              {{ formatSize(file.size) }}
            </span>
            <span class="w-24 text-right text-sm text-slate-400">{{ formatDate(file.modified) }}</span>
            <div class="w-20 text-right">
              <button
                class="text-slate-400 hover:text-blue-400 transition-colors"
                title="Copy path"
                @click="copyPath(file.path)"
              >
                📋
              </button>
            </div>
          </div>
        </div>
      </Card>

      <!-- Empty State -->
      <div v-if="largestFiles.length === 0" class="p-8 text-center">
        <p class="text-slate-400">No files found above {{ formatSize(minSize) }} threshold.</p>
        <p class="text-sm text-slate-500 mt-2">Try lowering the minimum size filter.</p>
      </div>
    </template>
  </div>
</template>

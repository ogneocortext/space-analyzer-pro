<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";
import {
  Search,
  X,
  FolderOpen,
  FileText,
  Image,
  Video,
  Music,
  Code,
  Archive,
  FileQuestion,
  Zap,
  AlertCircle,
  Loader2,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
  Filter,
  Trash2,
  ExternalLink,
  Eye,
  Maximize2,
  Grid3x3,
} from "lucide-vue-next";

const store = useAnalysisStore();
const searchQuery = ref("");
const selectedCategory = ref<string>("all");
const sortBy = ref<"name" | "size" | "category">("name");
const viewMode = ref<"list" | "grid" | "preview" | "canvas">("list");
const selectedFile = ref<any>(null);
const showPreviewModal = ref(false);
const errorMessage = ref("");
const showError = ref(false);
const isLoading = computed(() => store.isLoading || false);
const isDeleting = ref<string | null>(null);
const hasData = computed(() => store.analysisResult !== null);
const successMessage = ref("");

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

function clearError() {
  showError.value = false;
  errorMessage.value = "";
}

function clearSearch() {
  searchQuery.value = "";
}

// Category icon mapping
const categoryIcons: Record<string, any> = {
  documents: FileText,
  images: Image,
  videos: Video,
  audio: Music,
  code: Code,
  archives: Archive,
};

function getCategoryIcon(category: string) {
  return categoryIcons[category] || FileQuestion;
}

// AI Summary Modal State
const showSummaryModal = ref(false);
const summaryLoading = ref(false);
const summaryData = ref<{
  fileName: string;
  filePath: string;
  summary: string;
  fileType: string;
  cached: boolean;
  tokensUsed: number;
  responseTime: number;
} | null>(null);
const summaryError = ref<string | null>(null);

interface FileItem {
  name: string;
  path: string;
  size: number;
  category: string;
  // Windows API fields
  created?: string;
  accessed?: string;
  has_ads?: boolean;
  ads_count?: number;
  is_compressed?: boolean;
  compressed_size?: number;
  is_sparse?: boolean;
  is_reparse_point?: boolean;
  reparse_tag?: number;
  owner?: string;
  is_hard_link?: boolean;
  hard_link_count?: number;
}

const categories = computed(() => {
  const cats = new Set<string>();
  store.analysisResult?.files?.forEach((f: FileItem) => cats.add(f.category));
  return ["all", ...Array.from(cats)];
});

const filteredFiles = computed(() => {
  let files: FileItem[] = store.analysisResult?.files || [];

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    files = files.filter(
      (f: FileItem) =>
        f.name.toLowerCase().includes(query) || f.category.toLowerCase().includes(query)
    );
  }

  // Category filter
  if (selectedCategory.value !== "all") {
    files = files.filter((f: FileItem) => f.category === selectedCategory.value);
  }

  // Sort
  files = [...files].sort((a, b) => {
    switch (sortBy.value) {
      case "size":
        return b.size - a.size;
      case "category":
        return a.category.localeCompare(b.category);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return files;
});

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getOwnerShortName(owner: string): string {
  if (!owner) return "";
  // Extract username from DOMAIN\username format
  const parts = owner.split("\\");
  const username = parts[parts.length - 1];
  // Return first 8 characters to keep it short
  return username.length > 8 ? username.substring(0, 8) : username;
}

// AI Summary Function
async function getAISummary(file: FileItem) {
  summaryLoading.value = true;
  summaryError.value = null;
  showSummaryModal.value = true;
  summaryData.value = null;

  try {
    const response = await fetch("http://localhost:8080/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: file.path,
        model: "phi4-mini:latest",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get summary");
    }

    const data = await response.json();
    summaryData.value = {
      fileName: file.name,
      filePath: file.path,
      summary: data.summary,
      fileType: data.fileType,
      cached: data.cached,
      tokensUsed: data.tokensUsed,
      responseTime: data.responseTime,
    };
  } catch (err: any) {
    summaryError.value = err.message || "An error occurred";
  } finally {
    summaryLoading.value = false;
  }
}

function closeSummaryModal() {
  showSummaryModal.value = false;
  summaryData.value = null;
  summaryError.value = null;
}

async function revealFile(filePath: string) {
  try {
    await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/files/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
  } catch (err) {
    console.error("Failed to reveal file:", err);
  }
}

function openPreview(file: any) {
  selectedFile.value = file;
  showPreviewModal.value = true;
}

function closePreview() {
  selectedFile.value = null;
  showPreviewModal.value = false;
}

function getFilePreviewType(file: any): string {
  const ext = file.extension?.toLowerCase() || "";
  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico"];
  const videoExts = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"];
  const audioExts = ["mp3", "wav", "flac", "aac", "ogg", "m4a"];
  const textExts = ["txt", "md", "json", "xml", "csv", "log", "ini", "config"];
  const codeExts = [
    "js",
    "ts",
    "vue",
    "py",
    "java",
    "cpp",
    "c",
    "h",
    "cs",
    "php",
    "rb",
    "go",
    "rs",
  ];

  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (textExts.includes(ext) || codeExts.includes(ext)) return "text";
  return "unknown";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function deleteFile(filePath: string) {
  if (!confirm(`Are you sure you want to permanently delete this file?\n\n${filePath}`)) {
    return;
  }

  isDeleting.value = filePath;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/files/delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete file");
    }

    // Success - remove from UI locally
    if (store.analysisResult?.files) {
      const fileIndex = store.analysisResult.files.findIndex((f: any) => f.path === filePath);
      if (fileIndex !== -1) {
        store.analysisResult.files.splice(fileIndex, 1);
      }
    }

    successMessage.value = "File deleted successfully";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : "Failed to delete file";
    showError.value = true;
  } finally {
    isDeleting.value = null;
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">File Browser</h1>

    <div
      v-if="showError"
      class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-red-300 text-sm">{{ errorMessage }}</p>
      </div>
      <button @click="clearError" class="text-red-400 hover:text-red-300 transition-colors">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Success Message -->
    <div
      v-if="successMessage"
      class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3"
    >
      <div class="flex-1">
        <p class="text-emerald-400 text-sm">{{ successMessage }}</p>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="!hasData && !isLoading" class="text-center py-16 px-4">
      <div class="mb-6">
        <div
          class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <FolderOpen class="w-12 h-12 text-slate-600" />
        </div>
        <h3 class="text-xl font-semibold text-slate-200 mb-2">No Scan Data Available</h3>
        <p class="text-slate-400 max-w-md mx-auto mb-6">
          You need to scan a directory first before you can browse files.
        </p>
      </div>
      <Button variant="primary" size="lg" @click="$router.push('/scan')">
        <Search class="w-5 h-5 mr-2" />
        Scan Directory
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-4">
      <div class="flex items-center justify-center py-12">
        <div class="flex items-center gap-3 text-slate-400">
          <Loader2 class="w-6 h-6 animate-spin" />
          <span>Loading files...</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <Card v-if="hasData" padding="sm">
      <div class="flex flex-wrap gap-4 items-center filter-container">
        <!-- Search -->
        <div class="flex-1 min-w-[200px] relative">
          <Search class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search files..."
            class="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-10 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            v-if="searchQuery"
            @click="clearSearch"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Category Filter -->
        <div class="relative">
          <Filter class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            v-model="selectedCategory"
            class="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-slate-100 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
          >
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
            </option>
          </select>
          <ArrowUpDown
            class="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>

        <!-- Sort -->
        <div class="relative">
          <ArrowUpDown class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            v-model="sortBy"
            class="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-slate-100 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="category">Category</option>
          </select>
        </div>

        <!-- View Toggle -->
        <div class="flex gap-1 bg-slate-800 rounded-lg p-1 view-toggle">
          <button
            :class="[
              'px-3 py-1.5 rounded text-sm flex items-center gap-1',
              viewMode === 'list'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200',
            ]"
            @click="viewMode = 'list'"
          >
            <LayoutList class="w-4 h-4" />
            List
          </button>
          <button
            :class="[
              'px-3 py-1.5 rounded text-sm flex items-center gap-1',
              viewMode === 'grid'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200',
            ]"
            @click="viewMode = 'grid'"
          >
            <LayoutGrid class="w-4 h-4" />
            Grid
          </button>
          <button
            :class="[
              'px-3 py-1.5 rounded text-sm flex items-center gap-1',
              viewMode === 'preview'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200',
            ]"
            @click="viewMode = 'preview'"
          >
            <Eye class="w-4 h-4" />
            Preview
          </button>
          <button
            :class="[
              'px-3 py-1.5 rounded text-sm flex items-center gap-1',
              viewMode === 'canvas'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200',
            ]"
            @click="viewMode = 'canvas'"
          >
            <Grid3x3 class="w-4 h-4" />
            Canvas
          </button>
        </div>
      </div>
    </Card>

    <!-- Results Count -->
    <p v-if="hasData" class="text-slate-400">
      Showing {{ filteredFiles.length.toLocaleString() }} of
      {{ (store.analysisResult?.files?.length || 0).toLocaleString() }} files
      <span v-if="searchQuery" class="text-slate-500">(filtered by "{{ searchQuery }}")</span>
    </p>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="space-y-2 file-list files-container">
      <div
        v-for="file in filteredFiles.slice(0, 100)"
        :key="file.path"
        class="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <component :is="getCategoryIcon(file.category)" class="w-5 h-5 text-slate-400" />
          </div>
          <div class="flex-1">
            <p class="font-medium text-slate-200">
              {{ file.name }}
            </p>
            <p class="text-sm text-slate-500 truncate">
              {{ file.path }}
            </p>
            <div class="flex gap-1 mt-1 flex-wrap">
              <span
                v-if="file.owner"
                class="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-xs"
                :title="file.owner"
                >{{ getOwnerShortName(file.owner) }}</span
              >
              <span
                v-if="file.is_hard_link"
                class="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
                >HL</span
              >
              <span
                v-if="file.has_ads"
                class="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                >ADS</span
              >
              <span
                v-if="file.is_compressed"
                class="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs"
                >CMP</span
              >
              <span
                v-if="file.is_sparse"
                class="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs"
                >SPS</span
              >
              <span
                v-if="file.is_reparse_point"
                class="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-xs"
                >RPT</span
              >
            </div>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400">{{
            file.category
          }}</span>
          <p class="text-sm text-slate-300 mt-1">
            {{ formatSize(file.size) }}
          </p>
          <p
            v-if="file.compressed_size && file.is_compressed"
            class="text-xs text-emerald-400 mt-1"
          >
            {{ formatSize(file.compressed_size) }} compressed
          </p>
          <div class="flex items-center gap-2 mt-2">
            <button
              class="px-3 py-1 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs rounded-lg transition-all flex items-center gap-1"
              @click="getAISummary(file)"
            >
              <Zap class="w-3 h-3" />
              AI Summary
            </button>
            <button
              @click="revealFile(file.path)"
              class="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
              title="Reveal in Explorer"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
            <button
              @click="deleteFile(file.path)"
              :disabled="isDeleting === file.path"
              class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              :class="{ 'opacity-50 cursor-not-allowed': isDeleting === file.path }"
              title="Delete File"
            >
              <Trash2 v-if="isDeleting !== file.path" class="w-4 h-4" />
              <div
                v-else
                class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"
              ></div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      <div
        v-for="file in filteredFiles.slice(0, 100)"
        :key="file.path"
        class="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
      >
        <div class="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-3">
          <component :is="getCategoryIcon(file.category)" class="w-6 h-6 text-slate-400" />
        </div>
        <p class="font-medium text-slate-200 truncate">
          {{ file.name }}
        </p>
        <p class="text-sm text-slate-400">
          {{ formatSize(file.size) }}
        </p>
        <div class="flex gap-1 mt-2 flex-wrap">
          <span
            v-if="file.is_hard_link"
            class="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
            >HL</span
          >
          <span
            v-if="file.has_ads"
            class="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
            >ADS</span
          >
          <span
            v-if="file.is_compressed"
            class="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs"
            >CMP</span
          >
          <span
            v-if="file.is_sparse"
            class="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs"
            >SPS</span
          >
          <span
            v-if="file.is_reparse_point"
            class="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-xs"
            >RPT</span
          >
        </div>
        <span class="inline-block mt-2 px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500">{{
          file.category
        }}</span>
        <div class="grid grid-cols-2 gap-2 mt-3">
          <button
            class="px-3 py-1.5 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs rounded-lg transition-all flex items-center justify-center gap-1"
            @click="getAISummary(file)"
          >
            <Zap class="w-3 h-3" />
            AI
          </button>
          <div class="flex items-center justify-end gap-1">
            <button
              @click="revealFile(file.path)"
              class="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
              title="Reveal in Explorer"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
            <button
              @click="deleteFile(file.path)"
              :disabled="isDeleting === file.path"
              class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              :class="{ 'opacity-50 cursor-not-allowed': isDeleting === file.path }"
              title="Delete File"
            >
              <Trash2 v-if="isDeleting !== file.path" class="w-4 h-4" />
              <div
                v-else
                class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"
              ></div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview View -->
    <div v-else-if="viewMode === 'preview'" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="file in filteredFiles.slice(0, 50)"
          :key="file.path"
          class="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer transition-all hover:shadow-lg"
          @click="openPreview(file)"
        >
          <div class="flex items-start gap-4">
            <div
              class="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"
            >
              <component :is="getCategoryIcon(file.category)" class="w-8 h-8 text-slate-400" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-slate-200 truncate mb-1">
                {{ file.name }}
              </p>
              <p class="text-sm text-slate-400 mb-2">
                {{ formatFileSize(file.size) }}
              </p>
              <div class="flex gap-1 flex-wrap">
                <span class="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                  {{ file.category }}
                </span>
                <span
                  v-if="file.is_hard_link"
                  class="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
                  >HL</span
                >
                <span
                  v-if="file.has_ads"
                  class="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                  >ADS</span
                >
              </div>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              class="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded transition-colors"
              @click.stop="getAISummary(file)"
            >
              <Zap class="w-3 h-3 inline mr-1" />
              AI
            </button>
            <button
              class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
              @click.stop="revealFile(file.path)"
            >
              <ExternalLink class="w-3 h-3 inline mr-1" />
              Reveal
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Canvas View -->
    <div v-else-if="viewMode === 'canvas'" class="space-y-4">
      <div class="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-100">Canvas Visualization</h3>
          <div class="text-sm text-slate-400">
            {{ filteredFiles.length }} files • Click to preview
          </div>
        </div>
        <div class="relative h-96 bg-slate-950 rounded-lg overflow-hidden">
          <canvas ref="canvasRef" class="w-full h-full"></canvas>
          <div class="absolute inset-0 flex items-center justify-center text-slate-500">
            <div class="text-center">
              <Grid3x3 class="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Interactive canvas visualization</p>
              <p class="text-sm opacity-75">Coming soon - D3.js integration</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Results (with data) -->
    <div v-if="hasData && filteredFiles.length === 0 && !isLoading" class="text-center py-12">
      <div
        class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <Search class="w-8 h-8 text-slate-600" />
      </div>
      <p class="text-slate-400 mb-2">No files match your search</p>
      <p v-if="searchQuery" class="text-slate-500 text-sm mb-4">
        Try adjusting your search or filters
      </p>
      <Button
        variant="secondary"
        @click="
          searchQuery = '';
          selectedCategory = 'all';
        "
      >
        Clear Filters
      </Button>
    </div>

    <!-- AI Summary Modal -->
    <div
      v-if="showSummaryModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click="closeSummaryModal"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Zap class="w-5 h-5 text-violet-400" />
            AI Summary
          </h3>
          <button
            class="text-slate-400 hover:text-slate-200 transition-colors"
            @click="closeSummaryModal"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="summaryLoading" class="text-center py-8">
          <div class="inline-flex items-center gap-3">
            <div
              class="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"
            />
            <p class="text-slate-300">Analyzing file with AI...</p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="summaryError" class="text-center py-6">
          <div class="text-red-400 mb-2">
            <AlertCircle class="w-8 h-8 mx-auto" />
          </div>
          <p class="text-red-300">
            {{ summaryError }}
          </p>
        </div>

        <!-- Success State -->
        <div v-else-if="summaryData" class="space-y-4">
          <!-- File Info -->
          <div class="bg-slate-800/50 rounded-lg p-3">
            <p class="text-sm text-slate-400 mb-1">File</p>
            <p class="font-medium text-slate-200">
              {{ summaryData.fileName }}
            </p>
            <p class="text-xs text-slate-500 truncate">
              {{ summaryData.filePath }}
            </p>
          </div>

          <!-- Summary -->
          <div>
            <p class="text-sm text-slate-400 mb-2">Summary</p>
            <p class="text-slate-200 leading-relaxed">
              {{ summaryData.summary }}
            </p>
          </div>

          <!-- Metadata -->
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="px-2 py-1 bg-violet-500/20 text-violet-300 rounded">
              Type: {{ summaryData.fileType }}
            </span>
            <span
              v-if="summaryData.cached"
              class="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded"
            >
              Cached
            </span>
            <span class="px-2 py-1 bg-slate-700 text-slate-300 rounded">
              {{ summaryData.tokensUsed }} tokens
            </span>
            <span class="px-2 py-1 bg-slate-700 text-slate-300 rounded">
              {{ summaryData.responseTime }}ms
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- File Preview Modal -->
    <div
      v-if="showPreviewModal && selectedFile"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click="closePreview"
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <component
              :is="getCategoryIcon(selectedFile.category)"
              class="w-5 h-5 text-slate-400"
            />
            File Preview
          </h3>
          <button
            class="text-slate-400 hover:text-slate-200 transition-colors"
            @click="closePreview"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- File Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 class="text-sm font-medium text-slate-400 mb-2">File Details</h4>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-slate-500">Name:</span>
                <span class="text-slate-200 truncate ml-2">{{ selectedFile.name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Size:</span>
                <span class="text-slate-200">{{ formatFileSize(selectedFile.size) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Category:</span>
                <span class="text-slate-200">{{ selectedFile.category }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Type:</span>
                <span class="text-slate-200">{{ getFilePreviewType(selectedFile) }}</span>
              </div>
              <div v-if="selectedFile.modified_time" class="flex justify-between">
                <span class="text-slate-500">Modified:</span>
                <span class="text-slate-200">{{
                  new Date(selectedFile.modified_time * 1000).toLocaleDateString()
                }}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="text-sm font-medium text-slate-400 mb-2">Path</h4>
            <div class="bg-slate-800 rounded-lg p-3">
              <p class="text-slate-300 text-sm font-mono break-all">{{ selectedFile.path }}</p>
            </div>
          </div>
        </div>

        <!-- Preview Area -->
        <div class="mb-6">
          <h4 class="text-sm font-medium text-slate-400 mb-2">Preview</h4>
          <div class="bg-slate-800 rounded-lg p-6 min-h-[200px] flex items-center justify-center">
            <!-- Image Preview -->
            <div v-if="getFilePreviewType(selectedFile) === 'image'" class="text-center">
              <Image class="w-16 h-16 text-slate-500 mx-auto mb-2" />
              <p class="text-slate-400">Image preview coming soon</p>
            </div>

            <!-- Video Preview -->
            <div v-else-if="getFilePreviewType(selectedFile) === 'video'" class="text-center">
              <Video class="w-16 h-16 text-slate-500 mx-auto mb-2" />
              <p class="text-slate-400">Video preview coming soon</p>
            </div>

            <!-- Audio Preview -->
            <div v-else-if="getFilePreviewType(selectedFile) === 'audio'" class="text-center">
              <Music class="w-16 h-16 text-slate-500 mx-auto mb-2" />
              <p class="text-slate-400">Audio preview coming soon</p>
            </div>

            <!-- Text/Code Preview -->
            <div v-else-if="getFilePreviewType(selectedFile) === 'text'" class="text-center">
              <FileText class="w-16 h-16 text-slate-500 mx-auto mb-2" />
              <p class="text-slate-400">Text preview coming soon</p>
            </div>

            <!-- Unknown File Type -->
            <div v-else class="text-center">
              <FileQuestion class="w-16 h-16 text-slate-500 mx-auto mb-2" />
              <p class="text-slate-400">Preview not available for this file type</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            class="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
            @click="getAISummary(selectedFile)"
          >
            <Zap class="w-4 h-4 inline mr-2" />
            AI Analysis
          </button>
          <button
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            @click="revealFile(selectedFile.path)"
          >
            <ExternalLink class="w-4 h-4 inline mr-2" />
            Reveal in Explorer
          </button>
          <button
            class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            @click="deleteFile(selectedFile.path)"
          >
            <Trash2 class="w-4 h-4 inline mr-2" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

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
} from "lucide-vue-next";

const store = useAnalysisStore();
const searchQuery = ref("");
const selectedCategory = ref<string>("all");
const sortBy = ref<"name" | "size" | "category">("name");
const viewMode = ref<"list" | "grid">("list");
const errorMessage = ref("");
const showError = ref(false);
const isLoading = computed(() => store.isLoading || false);
const hasData = computed(() => store.analysisResult !== null);

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
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">File Browser</h1>

    <!-- Error Message -->
    <div
      v-if="showError"
      class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-red-300 text-sm">{{ errorMessage }}</p>
      </div>
      <button @click="clearError" class="text-red-400 hover:text-red-300 transition-colors">
        <X class="w-4 h-4" />
      </button>
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
      <div class="flex flex-wrap gap-4 items-center">
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
        <div class="flex gap-1 bg-slate-800 rounded-lg p-1">
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
    <div v-if="viewMode === 'list'" class="space-y-2">
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
          <button
            class="mt-2 px-3 py-1 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs rounded-lg transition-all flex items-center gap-1"
            @click="getAISummary(file)"
          >
            <Zap class="w-3 h-3" />
            AI Summary
          </button>
        </div>
      </div>
    </div>

    <!-- Grid View -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        <button
          class="mt-2 w-full px-3 py-1.5 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs rounded-lg transition-all flex items-center justify-center gap-1"
          @click="getAISummary(file)"
        >
          <Zap class="w-3 h-3" />
          AI Summary
        </button>
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
  </div>
</template>

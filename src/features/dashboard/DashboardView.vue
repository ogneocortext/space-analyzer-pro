<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";
import SkeletonLoader from "../../components/shared/SkeletonLoader.vue";
import PerformanceMonitor from "../../components/performance/PerformanceMonitor.vue";
import PerformanceInsights from "../../components/performance/PerformanceInsights.vue";
import {
  RefreshCw,
  FolderOpen,
  HardDrive,
  Layers,
  FileWarning,
  ArrowLeft,
  Search,
  Zap,
  Database,
} from "lucide-vue-next";

const store = useAnalysisStore();
const activeTab = ref<"overview" | "files" | "insights" | "windows">("overview");
const selectedCategory = ref<string | null>(null);
const errorMessage = ref("");
const showError = ref(false);
const isRefreshing = ref(false);

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

async function refreshData() {
  if (!store.analysisResult) return;
  isRefreshing.value = true;
  try {
    await store.handleAnalysis(false);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Failed to refresh data";
    showError.value = true;
  } finally {
    isRefreshing.value = false;
  }
}

function clearError() {
  showError.value = false;
  errorMessage.value = "";
}

const isLoading = computed(() => store.isLoading || false);
const hasData = computed(() => store.analysisResult !== null);
const totalFiles = computed(() => store.analysisResult?.totalFiles || 0);
const totalSize = computed(() => store.analysisResult?.totalSize || 0);
const files = computed(() => store.analysisResult?.files || []);
const windowsStats = computed(() => store.analysisResult?.windowsStats);

const fileCategories = computed(() => {
  const cats: Record<string, number> = {};
  files.value.forEach((file) => {
    cats[file.category] = (cats[file.category] || 0) + 1;
  });
  return cats;
});

const largestFiles = computed(() => {
  return [...files.value].sort((a, b) => b.size - a.size).slice(0, 5);
});

const hasWindowsData = computed(() => {
  const stats = windowsStats.value;
  return (
    stats &&
    (stats.hardLinkCount > 0 ||
      stats.adsCount > 0 ||
      stats.compressedCount > 0 ||
      stats.sparseCount > 0 ||
      stats.reparsePointCount > 0)
  );
});

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getCategoryFiles(category: string) {
  return files.value.filter((f) => f.category === category);
}

function getCategoryStats(category: string) {
  const catFiles = getCategoryFiles(category);
  const extensions: Record<string, number> = {};
  let totalSize = 0;

  catFiles.forEach((file) => {
    const ext = file.extension || "(no extension)";
    extensions[ext] = (extensions[ext] || 0) + 1;
    totalSize += file.size || 0;
  });

  return {
    count: catFiles.length,
    totalSize,
    extensions: Object.entries(extensions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10),
  };
}

function selectCategory(category: string) {
  selectedCategory.value = category;
}

function clearCategorySelection() {
  selectedCategory.value = null;
}

function getCategorizationReason(file: (typeof files.value)[0]): string {
  if (file.extension) {
    return `Extension: .${file.extension}`;
  }
  if (file.path?.includes("node_modules")) {
    return "Path: node_modules";
  }
  if (file.path?.toLowerCase().includes("windows")) {
    return "Path: Windows system";
  }
  return "Pattern matching";
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-4">
      <h1 class="text-2xl font-bold text-slate-100">Dashboard</h1>
      <div class="flex gap-2">
        <Button
          v-if="hasData"
          variant="secondary"
          size="sm"
          @click="refreshData"
          :disabled="isRefreshing || isLoading"
        >
          <RefreshCw class="w-4 h-4 mr-1" :class="{ 'animate-spin': isRefreshing }" />
          {{ isRefreshing ? "Refreshing..." : "Refresh" }}
        </Button>
        <Button
          v-for="tab in ['overview', 'files', 'insights', 'windows']"
          :key="tab"
          :variant="activeTab === tab ? 'primary' : 'secondary'"
          size="sm"
          @click="activeTab = tab"
        >
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </Button>
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="showError"
      class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
    >
      <FileWarning class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-red-300 text-sm">{{ errorMessage }}</p>
      </div>
      <button @click="clearError" class="text-red-400 hover:text-red-300 transition-colors">
        <span class="sr-only">Dismiss</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-6">
      <SkeletonLoader type="header" />
      <SkeletonLoader type="card-grid" :count="4" />
      <SkeletonLoader type="card" />
    </div>

    <!-- No Data State -->
    <div v-else-if="!hasData" class="text-center py-16 px-4">
      <div class="mb-6">
        <div
          class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <FolderOpen class="w-12 h-12 text-slate-600" />
        </div>
        <h3 class="text-xl font-semibold text-slate-200 mb-2">No Analysis Data Available</h3>
        <p class="text-slate-400 max-w-md mx-auto">
          Start a scan to analyze your file system and view insights about your storage usage.
        </p>
      </div>
      <Button variant="primary" size="lg" @click="$router.push('/scan')">
        <Search class="w-5 h-5 mr-2" />
        Start Scan
      </Button>
    </div>

    <!-- Overview Tab -->
    <div v-else-if="activeTab === 'overview'" class="space-y-6">
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <Database class="w-5 h-5 text-blue-400" />
            </div>
            <div class="text-sm text-slate-400">Total Files</div>
          </div>
          <div class="text-3xl font-bold text-blue-400">{{ totalFiles.toLocaleString() }}</div>
        </Card>

        <Card>
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 bg-emerald-500/20 rounded-lg">
              <HardDrive class="w-5 h-5 text-emerald-400" />
            </div>
            <div class="text-sm text-slate-400">Total Size</div>
          </div>
          <div class="text-3xl font-bold text-emerald-400">{{ formatSize(totalSize) }}</div>
        </Card>

        <Card>
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 bg-purple-500/20 rounded-lg">
              <Layers class="w-5 h-5 text-purple-400" />
            </div>
            <div class="text-sm text-slate-400">Categories</div>
          </div>
          <div class="text-3xl font-bold text-purple-400">
            {{ Object.keys(fileCategories).length }}
          </div>
        </Card>

        <Card>
          <div class="flex items-center gap-3 mb-2">
            <div class="p-2 bg-amber-500/20 rounded-lg">
              <FileWarning class="w-5 h-5 text-amber-400" />
            </div>
            <div class="text-sm text-slate-400">Large Files (100MB+)</div>
          </div>
          <div class="text-3xl font-bold text-amber-400">
            {{ files.filter((f) => f.size > 1024 * 1024 * 100).length }}
          </div>
        </Card>
      </div>

      <!-- Recent Activity Section -->
      <Card title="Recent Activity" v-if="hasData">
        <div class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-slate-200">Latest Scans & Actions</h3>
            <Button variant="secondary" size="sm" @click="refreshData">
              <RefreshCw class="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div class="p-2 bg-blue-500/20 rounded-lg">
                <Database class="w-4 h-4 text-blue-400" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-200">Last Scan Completed</div>
                <div class="text-xs text-slate-400">
                  {{
                    store.analysisResult?.summary?.scan_time
                      ? new Date(store.analysisResult.summary.scan_time).toLocaleString()
                      : "Unknown"
                  }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium text-blue-400">
                  {{ totalFiles.toLocaleString() }}
                </div>
                <div class="text-xs text-slate-400">files scanned</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div class="p-2 bg-emerald-500/20 rounded-lg">
                <HardDrive class="w-4 h-4 text-emerald-400" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-200">Storage Analyzed</div>
                <div class="text-xs text-slate-400">Total storage space processed</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium text-emerald-400">{{ formatSize(totalSize) }}</div>
                <div class="text-xs text-slate-400">total size</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div class="p-2 bg-purple-500/20 rounded-lg">
                <Layers class="w-4 h-4 text-purple-400" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-200">Categories Identified</div>
                <div class="text-xs text-slate-400">File categories processed</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium text-purple-400">
                  {{ Object.keys(fileCategories).length }}
                </div>
                <div class="text-xs text-slate-400">categories</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <div class="p-2 bg-amber-500/20 rounded-lg">
                <Zap class="w-4 h-4 text-amber-400" />
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-200">Performance Metrics</div>
                <div class="text-xs text-slate-400">Scan performance data</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium text-amber-400">
                  {{
                    store.analysisResult?.performance?.scan_duration_ms
                      ? `${store.analysisResult.performance.scan_duration_ms}ms`
                      : "N/A"
                  }}
                </div>
                <div class="text-xs text-slate-400">scan time</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- Performance Monitoring Section -->
      <div v-if="store.analysisResult?.performance" class="space-y-4">
        <PerformanceMonitor :performance="store.analysisResult.performance" :is-loading="false" />

        <PerformanceInsights
          :performance="store.analysisResult.performance"
          :scan-size="store.analysisResult.summary?.total_files || 0"
          :scan-duration="store.analysisResult.performance?.scan_duration_ms || 0"
        />
      </div>

      <!-- Category Distribution -->
      <Card
        title="File Categories"
        v-if="Object.keys(fileCategories).length > 0 && !selectedCategory"
      >
        <div class="space-y-2">
          <div
            v-for="(count, category) in fileCategories"
            :key="category"
            class="flex items-center justify-between p-2 hover:bg-slate-800/50 rounded cursor-pointer transition-colors group"
            @click="selectCategory(category)"
          >
            <div class="flex items-center gap-3">
              <span class="text-slate-300 group-hover:text-blue-400 transition-colors">{{
                category
              }}</span>
              <svg
                class="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <span class="text-slate-400">{{ count }} files</span>
          </div>
          <p class="text-xs text-slate-500 mt-4">Click a category to explore files</p>
        </div>
      </Card>

      <!-- Category Detail View -->
      <Card v-if="selectedCategory" :title="`${selectedCategory} Files`">
        <div class="space-y-4">
          <!-- Back button and stats -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-700">
            <Button variant="secondary" size="sm" @click="clearCategorySelection">
              <ArrowLeft class="w-4 h-4 mr-1" />
              Back to Categories
            </Button>
            <div class="text-sm text-slate-400">
              {{ getCategoryStats(selectedCategory).count }} files ·
              {{ formatSize(getCategoryStats(selectedCategory).totalSize) }}
            </div>
          </div>

          <!-- Extension breakdown -->
          <div class="bg-slate-800/50 rounded-lg p-3">
            <h4 class="text-sm font-medium text-slate-300 mb-2">Top Extensions</h4>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="[ext, count] in getCategoryStats(selectedCategory).extensions"
                :key="ext"
                class="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
              >
                .{{ ext }}: {{ count }}
              </span>
            </div>
          </div>

          <!-- File list -->
          <div class="space-y-1 max-h-96 overflow-y-auto">
            <div
              v-for="file in getCategoryFiles(selectedCategory).slice(0, 100)"
              :key="file.path"
              class="flex items-center justify-between py-2 px-2 hover:bg-slate-800/50 rounded text-sm"
            >
              <div class="flex-1 min-w-0">
                <p class="text-slate-300 truncate" :title="file.name">{{ file.name }}</p>
                <p class="text-xs text-slate-500 truncate" :title="file.path">{{ file.path }}</p>
                <p class="text-xs text-blue-400">{{ getCategorizationReason(file) }}</p>
              </div>
              <span class="text-slate-400 text-xs whitespace-nowrap ml-4">{{
                formatSize(file.size)
              }}</span>
            </div>
            <p
              v-if="getCategoryFiles(selectedCategory).length > 100"
              class="text-center text-slate-500 text-sm py-2"
            >
              Showing 100 of {{ getCategoryFiles(selectedCategory).length }} files
            </p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Files Tab -->
    <div v-else-if="activeTab === 'files'" class="space-y-4">
      <Card title="All Files">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-2 text-slate-400 font-medium">Name</th>
                <th class="pb-2 text-slate-400 font-medium">Category</th>
                <th class="pb-2 text-slate-400 font-medium text-right">Size</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              <tr v-for="file in files.slice(0, 50)" :key="file.path" class="text-slate-300">
                <td class="py-2">{{ file.name }}</td>
                <td class="py-2">
                  <span class="px-2 py-1 rounded text-xs bg-slate-800">{{ file.category }}</span>
                </td>
                <td class="py-2 text-right text-slate-400">{{ formatSize(file.size) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="files.length > 50" class="text-center text-slate-500 mt-4">
            Showing 50 of {{ files.length }} files
          </p>
        </div>
      </Card>
    </div>

    <!-- Insights Tab -->
    <div v-else-if="activeTab === 'insights'" class="space-y-4">
      <Card title="Largest Files">
        <div class="space-y-2">
          <div
            v-for="file in largestFiles"
            :key="file.path"
            class="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
          >
            <span class="text-slate-300 truncate max-w-md">{{ file.name }}</span>
            <span class="text-amber-400 font-medium">{{ formatSize(file.size) }}</span>
          </div>
        </div>
      </Card>

      <Card title="Storage Analysis">
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-400">Total Scanned</span>
              <span class="text-slate-300">{{ formatSize(totalSize) }}</span>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                :style="{ width: '100%' }"
              ></div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4 pt-2">
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-400">
                {{ files.length.toLocaleString() }}
              </div>
              <div class="text-xs text-slate-400">Files Scanned</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-emerald-400">
                {{ formatSize(totalSize / (files.length || 1)) }}
              </div>
              <div class="text-xs text-slate-400">Avg File Size</div>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Windows Tab -->
    <div v-else-if="activeTab === 'windows'" class="space-y-4">
      <div v-if="!hasWindowsData" class="text-center py-12">
        <div
          class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Zap class="w-8 h-8 text-slate-600" />
        </div>
        <p class="text-slate-400 mb-2">Windows NTFS Features Not Available</p>
        <p class="text-sm text-slate-500 max-w-md mx-auto">
          Advanced Windows features (hard links, alternate data streams, compression info) require
          elevated permissions or native scanner integration.
        </p>
      </div>

      <div v-else class="space-y-4">
        <Card title="Windows NTFS Analysis">
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div class="p-4 bg-slate-800/50 rounded-lg">
              <div class="text-2xl font-bold text-blue-400">
                {{ windowsStats?.hardLinkCount || 0 }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Hard Links</div>
              <div class="text-xs text-emerald-400 mt-1">
                {{ formatSize(windowsStats?.hardLinkSavings || 0) }} saved
              </div>
            </div>

            <div class="p-4 bg-slate-800/50 rounded-lg">
              <div class="text-2xl font-bold text-purple-400">
                {{ windowsStats?.adsCount || 0 }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Alternate Data Streams</div>
              <div class="text-xs text-slate-500 mt-1">Hidden data detected</div>
            </div>

            <div class="p-4 bg-slate-800/50 rounded-lg">
              <div class="text-2xl font-bold text-amber-400">
                {{ windowsStats?.compressedCount || 0 }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Compressed Files</div>
              <div class="text-xs text-emerald-400 mt-1">
                {{ formatSize(windowsStats?.compressedSavings || 0) }} saved
              </div>
            </div>

            <div class="p-4 bg-slate-800/50 rounded-lg">
              <div class="text-2xl font-bold text-cyan-400">
                {{ windowsStats?.sparseCount || 0 }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Sparse Files</div>
              <div class="text-xs text-slate-500 mt-1">Unallocated regions</div>
            </div>

            <div class="p-4 bg-slate-800/50 rounded-lg">
              <div class="text-2xl font-bold text-rose-400">
                {{ windowsStats?.reparsePointCount || 0 }}
              </div>
              <div class="text-sm text-slate-400 mt-1">Reparse Points</div>
              <div class="text-xs text-slate-500 mt-1">Symlinks/Junctions</div>
            </div>
          </div>
        </Card>

        <Card title="Files with Windows Features">
          <div class="space-y-2">
            <div
              v-for="file in files
                .filter(
                  (f) =>
                    f.has_ads ||
                    f.is_compressed ||
                    f.is_sparse ||
                    f.is_reparse_point ||
                    f.is_hard_link
                )
                .slice(0, 20)"
              :key="file.path"
              class="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
            >
              <div class="flex-1">
                <p class="text-slate-300 truncate">{{ file.name }}</p>
                <div class="flex gap-2 mt-1">
                  <span
                    v-if="file.is_hard_link"
                    class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
                    >Hard Link</span
                  >
                  <span
                    v-if="file.has_ads"
                    class="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                    >ADS</span
                  >
                  <span
                    v-if="file.is_compressed"
                    class="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs"
                    >Compressed</span
                  >
                  <span
                    v-if="file.is_sparse"
                    class="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs"
                    >Sparse</span
                  >
                  <span
                    v-if="file.is_reparse_point"
                    class="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-xs"
                    >Reparse</span
                  >
                </div>
              </div>
              <span class="text-slate-400 text-sm">{{ formatSize(file.size) }}</span>
            </div>
            <p
              v-if="
                files.filter(
                  (f) =>
                    f.has_ads ||
                    f.is_compressed ||
                    f.is_sparse ||
                    f.is_reparse_point ||
                    f.is_hard_link
                ).length === 0
              "
              class="text-center text-slate-500 py-4"
            >
              No files with Windows features detected
            </p>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

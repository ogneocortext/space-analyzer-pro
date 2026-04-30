<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const activeTab = ref<"overview" | "files" | "insights" | "windows">("overview");
const selectedCategory = ref<string | null>(null);

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
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-100">Dashboard</h1>
      <div class="flex gap-2">
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

    <!-- No Data State -->
    <div v-if="!hasData" class="text-center py-12">
      <p class="text-slate-400 mb-4">No analysis data available</p>
      <Button variant="primary" @click="$router.push('/scan')"> Start Scan </Button>
    </div>

    <!-- Overview Tab -->
    <div v-else-if="activeTab === 'overview'" class="space-y-6">
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div class="text-3xl font-bold text-blue-400">{{ totalFiles.toLocaleString() }}</div>
          <div class="text-sm text-slate-400">Total Files</div>
        </Card>

        <Card>
          <div class="text-3xl font-bold text-emerald-400">{{ formatSize(totalSize) }}</div>
          <div class="text-sm text-slate-400">Total Size</div>
        </Card>

        <Card>
          <div class="text-3xl font-bold text-purple-400">
            {{ Object.keys(fileCategories).length }}
          </div>
          <div class="text-sm text-slate-400">Categories</div>
        </Card>

        <Card>
          <div class="text-3xl font-bold text-amber-400">
            {{ files.filter((f) => f.size > 1024 * 1024 * 100).length }}
          </div>
          <div class="text-sm text-slate-400">Large Files (100MB+)</div>
        </Card>
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
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
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
              <span class="text-slate-400">Storage Used</span>
              <span class="text-slate-300">{{ formatSize(totalSize) }}</span>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full" style="width: 60%"></div>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Windows Tab -->
    <div v-else-if="activeTab === 'windows'" class="space-y-4">
      <div v-if="!hasWindowsData" class="text-center py-12">
        <p class="text-slate-400 mb-4">No Windows API data available</p>
        <p class="text-sm text-slate-500">
          Windows-specific features require the Rust native scanner on Windows
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

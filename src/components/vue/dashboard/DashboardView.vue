<template>
  <div data-testid="dashboard-view" class="p-6 lg:p-8 bg-slate-900 min-h-screen">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p class="text-slate-400">Overview of your storage analysis</p>
        </div>
        <div class="flex gap-2">
          <button
            class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            aria-label="Browse files"
            @click="navigateToBrowser"
          >
            <FolderOpen :size="16" aria-hidden="true" />
            Browse Files
          </button>
          <button
            class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            aria-label="Export report"
            @click="exportReport"
          >
            <Download :size="16" aria-hidden="true" />
            Export
          </button>
          <button
            class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            aria-label="New analysis"
            @click="navigateToLanding"
          >
            <RefreshCw :size="16" aria-hidden="true" />
            New Analysis
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!analysisStore.data"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <FolderOpen :size="64" class="text-slate-600 mb-4" aria-hidden="true" />
      <h2 class="text-2xl font-semibold text-white mb-2">No Data Available</h2>
      <p class="text-slate-400 mb-6">Run an analysis to see your storage dashboard</p>
      <button
        class="bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        aria-label="Start analysis"
        @click="navigateToLanding"
      >
        Start Analysis
      </button>
    </div>

    <!-- Dashboard Content -->
    <div v-else class="space-y-8">
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
          @click="showFileDetails = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <Folder class="text-cyan-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Total Files</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ analysisStore.data.files?.length?.toLocaleString() || 0 }}
          </div>
          <div class="text-xs text-slate-500 mt-1">Click for details</div>
        </div>

        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
          @click="showSizeDetails = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <HardDrive class="text-emerald-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Total Size</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ formatBytes(analysisStore.data.totalSize || 0) }}
          </div>
          <div class="text-xs text-slate-500 mt-1">Click for breakdown</div>
        </div>

        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
          @click="selectedCategory = null"
        >
          <div class="flex items-center gap-3 mb-2">
            <FolderTree class="text-purple-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Categories</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ Object.keys(analysisStore.data.categories || {}).length }}
          </div>
          <div class="text-xs text-slate-500 mt-1">Click category below</div>
        </div>

        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
          @click="showAnalysisInfo = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <Clock class="text-amber-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Analysis Time</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ formatAnalysisTime(analysisStore.data.analysis_time_ms) }}
          </div>
          <div class="text-xs text-slate-500 mt-1">Click for info</div>
        </div>
      </div>

      <!-- Enhanced File Attributes Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-700/50 transition-all"
          @click="showEnhancedFileDetails = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <File class="text-blue-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">File Attributes</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ getFileAttributesCount() }}
          </div>
          <div class="text-xs text-slate-500 mt-1">Click for details</div>
        </div>

        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-emerald-500 hover:bg-slate-700/50 transition-all"
          @click="showEnhancedFileDetails = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <HardDrive class="text-emerald-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Compressed Files</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ getCompressedFilesCount() }}
          </div>
          <div class="text-xs text-slate-500 mt-1">{{ getCompressedSizeSavings() }}</div>
        </div>

        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-amber-500 hover:bg-slate-700/50 transition-all"
          @click="showEnhancedFileDetails = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <FolderTree class="text-amber-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Hard Links</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ analysisStore.data.hard_link_count || 0 }}
          </div>
          <div class="text-xs text-slate-500 mt-1">
            {{ formatBytes(analysisStore.data.hard_link_savings || 0) }}
          </div>
        </div>

        <div
          class="bg-slate-800/50 rounded-xl p-6 border border-slate-700 cursor-pointer hover:border-purple-500 hover:bg-slate-700/50 transition-all"
          @click="showEnhancedFileDetails = true"
        >
          <div class="flex items-center gap-3 mb-2">
            <File class="text-purple-400" :size="24" aria-hidden="true" />
            <span class="text-slate-400 text-sm">Special Files</span>
          </div>
          <div class="text-3xl font-bold text-white">
            {{ getSpecialFilesCount() }}
          </div>
          <div class="text-xs text-slate-500 mt-1">Sparse/Reparse/ADS</div>
        </div>
      </div>

      <!-- File Attributes Visualization -->
      <FileAttributesVisualization :files="analysisStore.data?.files || []" />

      <!-- Timestamp Analysis -->
      <TimestampAnalysis :files="analysisStore.data?.files || []" />

      <!-- Hard Links Analysis -->
      <HardLinksAnalysis
        :files="analysisStore.data?.files || []"
        :hard-link-count="analysisStore.data?.hard_link_count"
        :hard-link-savings="analysisStore.data?.hard_link_savings"
      />

      <!-- Storage Gauge -->
      <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 class="text-xl font-semibold text-white mb-4">Storage Usage</h2>
        <StorageGauge
          :used="analysisStore.data.totalSize || 0"
          :total="(analysisStore.data.totalSize || 0) * 1.5 || 1"
          :categories="categoryData"
        />
      </div>

      <!-- Category Breakdown -->
      <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h2 class="text-xl font-semibold text-white mb-4">Category Breakdown</h2>
        <div class="space-y-4">
          <div
            v-for="(category, name) in sortedCategories"
            :key="name"
            class="flex items-center gap-4 cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
            :class="{ 'bg-slate-700/50': selectedCategory === name }"
            @click="selectCategory(name)"
          >
            <div
              class="w-4 h-4 rounded-full shrink-0"
              :style="{ backgroundColor: getCategoryColor(name) }"
              aria-hidden="true"
            />
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <span class="text-white font-medium">{{ name }}</span>
                <span class="text-slate-400 text-sm">{{ formatBytes(category.size) }}</span>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all duration-300"
                  :style="{
                    width: `${((category.size / (analysisStore.data.totalSize || 1)) * 100).toFixed(1)}%`,
                    backgroundColor: getCategoryColor(name),
                  }"
                />
              </div>
            </div>
            <ChevronRight
              v-if="selectedCategory === name"
              class="text-cyan-400"
              :size="20"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <!-- Category Detail Panel -->
      <Transition name="slide">
        <div v-if="selectedCategory" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-white">{{ selectedCategory }} Details</h2>
            <button
              class="text-slate-400 hover:text-white transition-colors"
              aria-label="Close details"
              @click="selectedCategory = null"
            >
              <X :size="20" aria-hidden="true" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-slate-700/50 rounded-lg p-4">
              <div class="text-slate-400 text-sm mb-1">File Count</div>
              <div class="text-2xl font-bold text-white">
                {{ analysisStore.data.categories?.[selectedCategory]?.count || 0 }}
              </div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-4">
              <div class="text-slate-400 text-sm mb-1">Total Size</div>
              <div class="text-2xl font-bold text-white">
                {{ formatBytes(analysisStore.data.categories?.[selectedCategory]?.size || 0) }}
              </div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-4">
              <div class="text-slate-400 text-sm mb-1">Percentage</div>
              <div class="text-2xl font-bold text-white">
                {{ getCategoryPercentage(selectedCategory) }}%
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="text-lg font-medium text-white mb-3">Sample Files</h3>
            <div
              v-for="(file, index) in getCategoryFiles(selectedCategory)"
              :key="index"
              class="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg text-sm"
            >
              <File class="text-slate-400" :size="16" aria-hidden="true" />
              <span class="text-white truncate flex-1">{{ file.name }}</span>
              <span class="text-slate-400">{{ formatBytes(file.size) }}</span>
            </div>
            <div
              v-if="getCategoryFiles(selectedCategory).length === 0"
              class="text-slate-400 text-sm"
            >
              No individual file data available
            </div>
          </div>

          <div class="mt-6 flex gap-2">
            <button
              class="bg-cyan-500 hover:bg-cyan-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              @click="navigateToBrowser"
            >
              Browse {{ selectedCategory }} Files
            </button>
            <button
              class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              @click="exportCategoryReport(selectedCategory)"
            >
              Export Category Report
            </button>
          </div>
        </div>
      </Transition>

      <!-- AI Insights -->
      <div
        v-if="analysisStore.data.ai_insights"
        class="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
      >
        <h2 class="text-xl font-semibold text-white mb-4">AI Insights</h2>
        <div class="space-y-3">
          <div
            v-if="analysisStore.data.ai_insights.optimization_suggestions?.length"
            class="bg-slate-700/30 rounded-lg p-4"
          >
            <h3 class="text-cyan-400 font-medium mb-2">Optimization Suggestions</h3>
            <ul class="space-y-1">
              <li
                v-for="(
                  suggestion, index
                ) in analysisStore.data.ai_insights.optimization_suggestions.slice(0, 5)"
                :key="index"
                class="text-slate-300 text-sm flex items-start gap-2"
              >
                <span class="text-cyan-400">•</span>
                {{ suggestion }}
              </li>
            </ul>
          </div>

          <div
            v-if="analysisStore.data.ai_insights.large_files?.length"
            class="bg-slate-700/30 rounded-lg p-4"
          >
            <h3 class="text-amber-400 font-medium mb-2">Large Files</h3>
            <ul class="space-y-1">
              <li
                v-for="(file, index) in analysisStore.data.ai_insights.large_files.slice(0, 5)"
                :key="index"
                class="text-slate-300 text-sm"
              >
                {{ file }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- File Details Modal -->
      <Transition name="modal">
        <div
          v-if="showFileDetails"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="showFileDetails = false"
        >
          <div
            class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-white">File Details</h2>
              <button class="text-slate-400 hover:text-white" @click="showFileDetails = false">
                <X :size="20" />
              </button>
            </div>
            <div class="space-y-2">
              <div
                v-for="(file, index) in analysisStore.data.files?.slice(0, 20)"
                :key="index"
                class="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg text-sm"
              >
                <File class="text-slate-400" :size="16" />
                <span class="text-white truncate flex-1">{{ file.name }}</span>
                <span class="text-slate-400">{{ formatBytes(file.size) }}</span>
              </div>
              <div v-if="!analysisStore.data.files?.length" class="text-slate-400 text-center py-4">
                No file details available
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Size Details Modal -->
      <Transition name="modal">
        <div
          v-if="showSizeDetails"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="showSizeDetails = false"
        >
          <div
            class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-white">Size Breakdown</h2>
              <button class="text-slate-400 hover:text-white" @click="showSizeDetails = false">
                <X :size="20" />
              </button>
            </div>
            <div class="space-y-4">
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Total Size</div>
                <div class="text-2xl font-bold text-white">
                  {{ formatBytes(analysisStore.data.totalSize || 0) }}
                </div>
              </div>
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Average File Size</div>
                <div class="text-2xl font-bold text-white">
                  {{
                    formatBytes(
                      (analysisStore.data.totalSize || 0) /
                        Math.max(analysisStore.data.files?.length || 1, 1)
                    )
                  }}
                </div>
              </div>
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Largest File</div>
                <div class="text-lg font-bold text-white">
                  {{
                    analysisStore.data.files?.sort((a: any, b: any) => b.size - a.size)[0]?.name ||
                    "N/A"
                  }}
                </div>
                <div class="text-slate-400 text-sm">
                  {{
                    formatBytes(
                      analysisStore.data.files?.sort((a: any, b: any) => b.size - a.size)[0]
                        ?.size || 0
                    )
                  }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Analysis Info Modal -->
      <Transition name="modal">
        <div
          v-if="showAnalysisInfo"
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          @click.self="showAnalysisInfo = false"
        >
          <div
            class="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-700"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-semibold text-white">Analysis Information</h2>
              <button class="text-slate-400 hover:text-white" @click="showAnalysisInfo = false">
                <X :size="20" />
              </button>
            </div>
            <div class="space-y-4">
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Analysis Time</div>
                <div class="text-2xl font-bold text-white">
                  {{ analysisStore.data.analysisTime || "N/A" }}
                </div>
              </div>
              <div v-if="analysisStore.data.strategy" class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Strategy</div>
                <div class="text-lg font-bold text-white">
                  {{ analysisStore.data.strategy }}
                </div>
              </div>
              <div v-if="analysisStore.data.directoryPath" class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Directory</div>
                <div class="text-sm text-white truncate">
                  {{ analysisStore.data.directoryPath }}
                </div>
              </div>
              <div v-if="analysisStore.data.tools?.length" class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Tools Used</div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(tool, index) in analysisStore.data.tools"
                    :key="index"
                    class="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded"
                  >
                    {{ tool }}
                  </span>
                </div>
              </div>
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Analysis Type</div>
                <div class="text-lg font-bold text-white">
                  {{ analysisStore.data.analysisType || "Standard" }}
                </div>
              </div>
              <div v-if="analysisStore.data.dependencyGraph" class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">Dependency Graph</div>
                <div class="text-sm text-white">
                  {{ analysisStore.data.dependencyGraph.nodes?.length || 0 }} nodes,
                  {{ analysisStore.data.dependencyGraph.edges?.length || 0 }} edges
                </div>
              </div>

              <!-- USN Journal Status -->
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">USN Journal</div>
                <div class="text-sm text-white">
                  <div class="flex items-center gap-2 mb-1">
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="analysisStore.data.usn_journal_id ? 'bg-emerald-500' : 'bg-slate-500'"
                    ></div>
                    {{ analysisStore.data.usn_journal_id ? "Available" : "Not Used" }}
                  </div>
                  <div v-if="analysisStore.data.usn_journal_id" class="text-xs text-slate-400">
                    Journal ID: {{ analysisStore.data.usn_journal_id }}
                  </div>
                  <div v-if="analysisStore.data.last_usn" class="text-xs text-slate-400">
                    Last USN: {{ analysisStore.data.last_usn }}
                  </div>
                </div>
              </div>

              <!-- MFT Scanning Status -->
              <div class="bg-slate-700/30 rounded-lg p-4">
                <div class="text-slate-400 text-sm mb-1">MFT Scanning</div>
                <div class="text-sm text-white">
                  <div class="flex items-center gap-2 mb-1">
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="analysisStore.data.mft_scanned ? 'bg-emerald-500' : 'bg-slate-500'"
                    ></div>
                    {{ analysisStore.data.mft_scanned ? "Enabled" : "Disabled" }}
                  </div>
                  <div class="flex items-center gap-2">
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="
                        analysisStore.data.hard_links_enumerated ? 'bg-emerald-500' : 'bg-slate-500'
                      "
                    ></div>
                    {{
                      analysisStore.data.hard_links_enumerated
                        ? "Hard Links Enumerated"
                        : "Hard Links Not Enumerated"
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Enhanced File Details Modal -->
      <EnhancedFileDetailsModal
        :show="showEnhancedFileDetails"
        :files="analysisStore.data?.files || []"
        :selected-file="selectedFileForDetails"
        @close="showEnhancedFileDetails = false"
        @file-selected="selectedFileForDetails = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { useRouter } from "vue-router";
import {
  Folder,
  HardDrive,
  FolderTree,
  Clock,
  FolderOpen,
  Download,
  RefreshCw,
  ChevronRight,
  X,
  File,
} from "lucide-vue-next";
import StorageGauge from "../StorageGauge.vue";
import EnhancedFileDetailsModal from "../analysis/EnhancedFileDetailsModal.vue";
import FileAttributesVisualization from "../analysis/FileAttributesVisualization.vue";
import TimestampAnalysis from "../analysis/TimestampAnalysis.vue";
import HardLinksAnalysis from "../analysis/HardLinksAnalysis.vue";
import { analysisStoreKey, getCategoryColorKey } from "../../../types/injection";

interface CategoryData {
  size: number;
  count?: number;
  files?: Array<{ name: string; size: number; path: string }>;
  [key: string]: unknown;
}

const router = useRouter();
const analysisStore = inject(analysisStoreKey)!;
const getCategoryColor = inject(getCategoryColorKey)!;
const selectedCategory = ref<string | null>(null);
const showFileDetails = ref(false);
const showSizeDetails = ref(false);
const showAnalysisInfo = ref(false);
const showEnhancedFileDetails = ref(false);
const selectedFileForDetails = ref<any>(null);

const navigateToBrowser = () => {
  router.push("/browser");
};

const navigateToLanding = () => {
  router.push("/");
};

const exportReport = () => {
  if (!analysisStore.data) return;
  const dataStr = JSON.stringify(analysisStore.data, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-report-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportCategoryReport = (category: string) => {
  if (!analysisStore.data?.categories) return;
  const categoryData = analysisStore.data.categories[category];
  const dataStr = JSON.stringify({ category, data: categoryData }, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `space-analyzer-${category.toLowerCase()}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const selectCategory = (name: string) => {
  if (selectedCategory.value === name) {
    selectedCategory.value = null;
  } else {
    selectedCategory.value = name;
  }
};

const getCategoryPercentage = (category: string): string => {
  if (!analysisStore.data?.categories || !analysisStore.data.totalSize) return "0";
  const categorySize = analysisStore.data.categories[category]?.size || 0;
  return ((categorySize / analysisStore.data.totalSize) * 100).toFixed(1);
};

const getCategoryFiles = (category: string): Array<{ name: string; size: number }> => {
  if (!analysisStore.data?.categories) return [];
  const categoryData = analysisStore.data.categories[category] as CategoryData;
  if (categoryData.files && categoryData.files.length > 0) {
    return categoryData.files.slice(0, 10).map((f) => ({ name: f.name, size: f.size }));
  }
  // Generate sample files if no individual file data
  const count = categoryData.count || 0;
  const size = categoryData.size || 0;
  const sampleFiles: Array<{ name: string; size: number }> = [];
  for (let i = 0; i < Math.min(count, 10); i++) {
    sampleFiles.push({
      name: `${category.toLowerCase()}_file_${i + 1}`,
      size: size / Math.max(count, 1),
    });
  }
  return sampleFiles;
};

const categoryData = computed(() => {
  if (!analysisStore.data?.categories) return [];
  return Object.entries(analysisStore.data.categories).map(
    ([name, data]: [string, CategoryData]) => ({
      name,
      size: data.size || 0,
      color: getCategoryColor(name),
    })
  );
});

const sortedCategories = computed(() => {
  if (!analysisStore.data?.categories) return {};
  const categories = analysisStore.data.categories;
  const sorted = Object.entries(categories).sort(
    ([, a]: [string, CategoryData], [, b]: [string, CategoryData]) => b.size - a.size
  );
  return Object.fromEntries(sorted);
});

const formatBytes = (bytes: number) => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatAnalysisTime = (ms: number | null | undefined): string => {
  if (!ms || isNaN(ms)) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const getFileAttributesCount = (): number => {
  if (!analysisStore.data?.files) return 0;
  return analysisStore.data.files.filter(
    (file: any) =>
      file.is_compressed ||
      file.is_sparse ||
      file.is_reparse_point ||
      file.has_ads ||
      file.is_hard_link ||
      file.file_hash
  ).length;
};

const getCompressedFilesCount = (): number => {
  if (!analysisStore.data?.files) return 0;
  return analysisStore.data.files.filter((file: any) => file.is_compressed).length;
};

const getCompressedSizeSavings = (): string => {
  if (!analysisStore.data?.files) return "0 B";
  const compressedFiles = analysisStore.data.files.filter(
    (file: any) => file.is_compressed && file.compressed_size && file.size
  );
  const totalSavings = compressedFiles.reduce(
    (acc: number, file: any) => acc + (file.size - file.compressed_size),
    0
  );
  return formatBytes(totalSavings);
};

const getSpecialFilesCount = (): number => {
  if (!analysisStore.data?.files) return 0;
  return analysisStore.data.files.filter(
    (file: any) => file.is_sparse || file.is_reparse_point || file.has_ads
  ).length;
};
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

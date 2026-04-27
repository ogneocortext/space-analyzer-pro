<template>
  <div
    data-testid="landing-page"
    class="flex flex-col min-h-screen bg-slate-900 text-white relative"
  >
    <!-- Animated Background - simplified for better performance -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
    </div>

    <div class="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
      <div class="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <!-- Left Side - Hero Content -->
        <div
          class="space-y-8 lg:space-y-12 text-center lg:text-left animate-in fade-in slide-in-from-left-12 duration-600"
        >
          <div
            class="flex justify-center lg:justify-start animate-in zoom-in duration-500 delay-200"
          >
            <div class="relative">
              <div
                class="absolute inset-0 bg-linear-to-r from-[#00B4D8] to-purple-500 blur-2xl opacity-20 rounded-full"
                aria-hidden="true"
              />
              <div
                data-testid="app-logo"
                class="relative bg-slate-800/50 p-4 lg:p-6 rounded-full border border-white/20 shadow-lg"
              >
                <BrainCircuit
                  :size="80"
                  class="text-transparent bg-linear-to-r from-[#00B4D8] to-purple-500 bg-clip-text w-12 h-12 lg:w-20 lg:h-20"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <h1
            data-testid="app-title"
            class="text-4xl lg:text-5xl text-transparent bg-linear-to-r from-[#00B4D8] to-purple-500 bg-clip-text leading-tight animate-in fade-in slide-in-from-bottom-5 duration-500 delay-300"
          >
            Space Analyzer Pro
          </h1>

          <p
            class="text-sm lg:text-base text-slate-300 leading-relaxed font-normal animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400"
          >
            AI-Powered Intelligence for Your Digital Universe
          </p>

          <!-- Feature Highlights -->
          <div
            class="grid grid-cols-2 gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500"
          >
            <div
              v-for="(feature, index) in features"
              :key="feature.text"
              class="bg-slate-800/50 backdrop-blur border-2 border-white/20 rounded-xl p-4 cursor-pointer hover:border-[#00B4D8] hover:scale-103 transition-all duration-200"
              :style="{ animationDelay: `${0.6 + index * 0.05}s` }"
            >
              <div class="flex flex-col items-center text-center">
                <span class="text-2xl lg:text-3xl mb-2">{{ feature.icon }}</span>
                <span class="text-sm font-medium text-white mb-1">{{ feature.text }}</span>
                <span class="text-xs text-slate-300">{{ feature.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side - Input Card -->
        <div
          class="w-full max-w-md mx-auto animate-in fade-in slide-in-from-right-12 duration-600 delay-300"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop="handleDrop"
        >
          <div
            :class="[
              'bg-slate-800/50 p-4 lg:p-6 space-y-3 lg:space-y-4 backdrop-blur-lg border border-white/20 rounded-xl',
              isDragOver ? 'border-2 border-dashed border-[#00B4D8] bg-[#00B4D8]/10' : '',
            ]"
          >
            <div data-testid="directory-input-section">
              <label for="directory-path" class="block text-sm font-medium text-slate-300 mb-2"
                >Target Directory</label
              >
              <div class="relative">
                <Folder
                  class="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
                  :size="20"
                />
                <input
                  id="directory-path"
                  v-model.trim="analysisStore.path"
                  data-testid="directory-path-input"
                  name="directory-path"
                  type="text"
                  class="w-full pl-12 pr-20 font-mono text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  placeholder="Enter directory path..."
                  autocomplete="off"
                  @input="handlePathChange(analysisStore.path)"
                  @keydown.enter="handleEnterKey"
                  @keydown.esc="appStore.showPathPicker && appStore.togglePathPicker()"
                />
                <div
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1"
                >
                  <button
                    class="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    aria-label="Copy path"
                    title="Copy path"
                    @click="handleCopyPath"
                  >
                    <Check v-if="copied" :size="16" class="text-[#00B4D8]" aria-hidden="true" />
                    <Copy v-else :size="16" class="text-slate-300" aria-hidden="true" />
                  </button>
                  <button
                    v-if="appStore.recentPaths.length > 0"
                    class="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    aria-label="Recent paths"
                    title="Recent paths"
                    @click="appStore.togglePathPicker"
                  >
                    <FolderOpen :size="16" class="text-slate-300" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <!-- Recent paths dropdown -->
              <Transition name="dropdown">
                <div
                  v-if="appStore.showPathPicker && appStore.recentPaths.length > 0"
                  class="mt-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
                >
                  <button
                    v-for="path in appStore.recentPaths"
                    :key="path"
                    class="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors first:border-b border-slate-700"
                    @click="selectRecentPath(path)"
                  >
                    {{ path }}
                  </button>
                </div>
              </Transition>
            </div>

            <!-- Backend status indicator -->
            <div data-testid="backend-status" class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    'w-2 h-2 rounded-full',
                    appStore.isBackendOnline ? 'bg-[#00B4D8] animate-pulse' : 'bg-red-400',
                  ]"
                />
                <span :class="appStore.isBackendOnline ? 'text-[#00B4D8]' : 'text-red-400'">
                  {{ appStore.isBackendOnline ? "Backend Online" : "Backend Offline" }}
                </span>
              </div>
              <button
                class="text-slate-500 hover:text-slate-300 text-xs"
                aria-label="Download debug logs"
                title="Download debug logs"
                @click="downloadDebugLogs"
              >
                📋 Logs
              </button>
            </div>

            <!-- AI toggle -->
            <div data-testid="ai-toggle" class="flex items-center justify-between">
              <label class="text-sm text-slate-300">Enable AI Analysis</label>
              <button
                data-testid="ai-toggle-button"
                :class="[
                  'relative w-12 h-6 rounded-full transition-colors',
                  analysisStore.useAI ? 'bg-[#00B4D8]' : 'bg-slate-600',
                ]"
                :aria-pressed="analysisStore.useAI"
                aria-label="Toggle AI analysis"
                @click="toggleAI"
              >
                <div
                  :class="[
                    'absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform',
                    analysisStore.useAI ? 'translate-x-6' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>

            <!-- AI Model Selection -->
            <div v-if="analysisStore.useAI" data-testid="ai-panel" class="space-y-2">
              <label class="text-sm text-slate-300">AI Model</label>
              <select
                data-testid="ai-model-select"
                class="w-full bg-slate-700 border border-slate-600 rounded-lg text-white text-sm p-2 focus:outline-none focus:border-[#00B4D8]"
                value="qwen2.5:7b"
              >
                <option value="qwen2.5:7b">Qwen 2.5 (7B)</option>
                <option value="qwen2.5:14b">Qwen 2.5 (14B)</option>
                <option value="phi4-mini:latest">Phi 4 Mini</option>
                <option value="gemma3:4b">Gemma 3 (4B)</option>
                <option value="deepseek-coder:6.7b-instruct">DeepSeek Coder</option>
              </select>
              <div data-testid="ai-status" class="text-xs text-slate-400">
                {{ appStore.isBackendOnline ? "AI Service: Available" : "AI Service: Offline" }}
              </div>
            </div>

            <Transition name="error">
              <div
                v-if="analysisStore.error"
                class="bg-orange-500/10 border border-orange-500 text-orange-400 px-4 py-3 rounded-xl flex items-center gap-2"
                role="alert"
              >
                <AlertTriangle :size="18" aria-hidden="true" />
                {{ analysisStore.error }}
              </div>
            </Transition>

            <div
              v-if="analysisStore.isAnalysisRunning"
              data-testid="progress-section"
              class="space-y-3"
            >
              <div class="flex justify-between text-sm text-slate-300">
                <span>{{ analysisStore.status }}</span>
                <span>{{ Math.round(analysisStore.progress) }}%</span>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-2">
                <div
                  data-testid="progress-bar"
                  class="bg-[#00B4D8] h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${analysisStore.progress}%` }"
                  :title="`Analysis progress: ${Math.round(analysisStore.progress)}%`"
                />
              </div>
              <!-- Real-time file scanner -->
              <RealTimeFileScanner
                :scanned-files="analysisStore.scannedFiles"
                :progress="analysisStore.progressData"
              />
            </div>

            <button
              v-else
              data-testid="start-analysis-button"
              type="button"
              :disabled="!appStore.isBackendOnline || analysisStore.isAnalysisRunning"
              class="bg-[#00B4D8] hover:bg-[#0095b8] text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full"
              :aria-label="
                analysisStore.isAnalysisRunning
                  ? 'Analysis in progress'
                  : analysisStore.useAI
                    ? 'Start AI Analysis'
                    : 'Start Standard Analysis'
              "
              @click="handleStartAnalysis"
            >
              <Play :size="20" aria-hidden="true" />
              {{
                analysisStore.isAnalysisRunning
                  ? "Analyzing..."
                  : analysisStore.useAI
                    ? "Start AI Analysis"
                    : "Start Standard Analysis"
              }}
            </button>

            <Transition name="results">
              <div
                v-if="analysisStore.data"
                data-testid="scan-results"
                class="pt-4 border-t border-slate-700 space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500 max-h-96 overflow-y-auto"
              >
                <div class="flex items-center justify-between mb-3">
                  <span class="text-sm text-slate-300">Analysis Complete</span>
                  <span class="text-xs text-emerald-400">✓</span>
                </div>

                <!-- Storage Gauge -->
                <StorageGauge
                  :used="analysisStore.data.totalSize || 0"
                  :total="(analysisStore.data.totalSize || 0) * 1.5 || 1"
                  :categories="categoryData"
                />

                <div data-testid="statistics" class="grid grid-cols-2 gap-3">
                  <div data-testid="file-count" class="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ analysisStore.data.files?.length || 0 }}
                    </div>
                    <div class="text-xs text-slate-300">Files</div>
                  </div>
                  <div data-testid="total-size" class="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                      {{
                        analysisStore.data.totalSize
                          ? `${(analysisStore.data.totalSize / 1024 / 1024).toFixed(1)}`
                          : "0"
                      }}
                    </div>
                    <div class="text-xs text-slate-300">MB</div>
                  </div>
                </div>

                <!-- 3D Visualization Preview -->
                <div data-testid="visualization" class="mt-4 bg-slate-800/50 rounded-lg p-4">
                  <h4 class="text-sm font-medium text-white mb-2">3D Visualization</h4>
                  <div
                    class="h-32 bg-slate-900 rounded-lg flex items-center justify-center text-slate-400 text-xs"
                  >
                    {{
                      analysisStore.data?.files?.length > 0
                        ? `Ready to visualize ${analysisStore.data.files.length} files`
                        : "Run analysis to enable 3D visualization"
                    }}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="space-y-2 mt-4">
                  <h4 class="text-sm font-medium text-white mb-2">Quick Actions</h4>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      :disabled="!analysisStore.data"
                      class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'Browse Files' : 'Run analysis first'"
                      aria-label="Browse files"
                      @click="navigateToBrowser"
                    >
                      <FolderOpen :size="16" class="mr-1" aria-hidden="true" />
                      Browse Files
                    </button>
                    <button
                      :disabled="!analysisStore.data"
                      class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'View Dashboard' : 'Run analysis first'"
                      aria-label="View dashboard"
                      @click="navigateToDashboard"
                    >
                      <BarChart3 :size="16" class="mr-1" aria-hidden="true" />
                      View Dashboard
                    </button>
                    <button
                      :disabled="!analysisStore.data"
                      class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'Export Report' : 'Run analysis first'"
                      aria-label="Export report"
                      @click="exportReport"
                    >
                      <Download :size="16" class="mr-1" aria-hidden="true" />
                      Export Report
                    </button>
                    <button
                      :disabled="!analysisStore.data"
                      class="bg-[#00B4D8] hover:bg-[#0095b8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                      :title="analysisStore.data ? 'View 3D Visualization' : 'Run analysis first'"
                      aria-label="View 3D visualization"
                      @click="navigateToVisualization"
                    >
                      <Box :size="16" class="mr-1" aria-hidden="true" />
                      3D Visualization
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch } from "vue";
import {
  BrainCircuit,
  Folder,
  Play,
  AlertTriangle,
  FolderOpen,
  BarChart3,
  Download,
  Copy,
  Check,
  Box,
} from "lucide-vue-next";
import RealTimeFileScanner from "../RealTimeFileScanner.vue";
import StorageGauge from "../StorageGauge.vue";
import {
  analysisStoreKey,
  appStoreKey,
  handlePathChangeKey,
  toggleAIKey,
  handleSelectRecentPathKey,
  navigateToDashboardKey,
  navigateToBrowserKey,
  navigateToVisualizationKey,
  exportReportKey,
  cleanupSuggestionsKey,
  getCategoryColorKey,
} from "../../../types/injection";

// Color constants
const _COLORS = {
  PRIMARY: "#00B4D8",
  PRIMARY_HOVER: "#0095b8",
  PURPLE: "#9333EA",
  EMERALD: "#10B981",
  AMBER: "#F59E0B",
  ORANGE: "#F97316",
  RED: "#EF4444",
  BLUE: "#3B82F6",
  SLATE_700: "#334155",
  SLATE_800: "#1e293b",
  SLATE_900: "#0f172a",
} as const;

// Simple logger that saves to window object for inspection
declare global {
  interface Window {
    __debugLogs?: Array<{ timestamp: string; tag: string; data: unknown[] }>;
  }
}

const log = (tag: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, tag, data: args };
  if (typeof window !== "undefined") {
    window.__debugLogs = window.__debugLogs || [];
    window.__debugLogs.push(entry);
  }
};

// Inject stores and functions from App.vue
const analysisStore = inject(analysisStoreKey)!;
const appStore = inject(appStoreKey)!;
const handlePathChange = inject(handlePathChangeKey)!;
const toggleAI = inject(toggleAIKey)!;
const handleSelectRecentPath = inject(handleSelectRecentPathKey)!;
const navigateToDashboard = inject(navigateToDashboardKey)!;
const navigateToBrowser = inject(navigateToBrowserKey)!;
const navigateToVisualization = inject(navigateToVisualizationKey)!;
const exportReport = inject(exportReportKey)!;
const _cleanupSuggestions = inject(cleanupSuggestionsKey)!;
const getCategoryColor = inject(getCategoryColorKey)!;

const copied = ref(false);
const isDragOver = ref(false);

// Watch for store changes
watch(
  () => analysisStore.data,
  (newData) => {
    log("LANDING_DATA", newData);
  },
  { deep: true }
);

watch(
  () => analysisStore.status,
  (newStatus) => {
    log("LANDING_STATUS", newStatus);
  }
);

watch(
  () => analysisStore.isAnalysisRunning,
  (newVal) => {
    log("LANDING_RUNNING", newVal);
  }
);

log("LANDING_MOUNT", "LandingPage mounted", { analysisStore });

const downloadDebugLogs = () => {
  const logs = window.__debugLogs || [];
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `debug-logs-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleStartAnalysis = async () => {
  log("BUTTON_CLICK", "Start Analysis button clicked");
  try {
    await analysisStore.handleAnalysis(analysisStore.useAI);
    log("BUTTON_COMPLETE", "Analysis completed");
  } catch (err) {
    log("BUTTON_ERROR", err);
  }
};

const features = [
  { icon: "🧠", text: "Neural Analysis", desc: "AI-powered file relationships" },
  { icon: "⚡", text: "Lightning Fast", desc: "Instant scanning results" },
  { icon: "🤖", text: "AI Insights", desc: "Smart recommendations" },
  { icon: "📊", text: "Smart Reports", desc: "Detailed analytics" },
];

interface CategoryData {
  size: number;
  [key: string]: unknown;
}

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

const _truncatePath = (path: string, maxLength: number = 40) => {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return path;
  return `${parts[0]}\\...\\${parts[parts.length - 1]}`;
};

const handleCopyPath = async () => {
  try {
    await navigator.clipboard.writeText(analysisStore.path);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (err) {
    console.error("Failed to copy path:", err);
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  const droppedFile = e.dataTransfer?.files[0];
  if (droppedFile) {
    // Type-safe path extraction for Electron/NW.js environments
    const droppedPath =
      "path" in droppedFile ? (droppedFile as { path: string }).path : droppedFile.name;
    handlePathChange(droppedPath);
  }
};

const handleEnterKey = () => {
  if (appStore.isBackendOnline && !analysisStore.isAnalysisRunning) {
    analysisStore.handleAnalysis(analysisStore.useAI);
  }
};

const selectRecentPath = (path: string) => {
  handleSelectRecentPath(path);
  appStore.togglePathPicker();
};
</script>

<style scoped>
/* CSS animations for Vue transitions */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-50px);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInFromRight {
  from {
    transform: translateX(50px);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInFromBottom {
  from {
    transform: translateY(20px);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes zoomIn {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-in {
  animation-fill-mode: both;
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

.slide-in-from-left-12 {
  animation: slideInFromLeft 0.6s ease-out;
}

.slide-in-from-right-12 {
  animation: slideInFromRight 0.6s ease-out;
}

.slide-in-from-bottom-5 {
  animation: slideInFromBottom 0.5s ease-out;
}

.slide-in-from-bottom-4 {
  animation: slideInFromBottom 0.5s ease-out;
}

.zoom-in {
  animation: zoomIn 0.5s ease-out;
}

.hover\:scale-103:hover {
  transform: scale(1.03);
}

/* Transition classes */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.error-enter-active,
.error-leave-active {
  transition: all 0.3s ease;
}

.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.results-enter-active {
  transition: all 0.5s ease;
}

.results-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
</style>

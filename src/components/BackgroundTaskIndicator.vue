<template>
  <div
    v-if="store.isAnalysisRunning"
    class="flex items-center gap-3"
    role="status"
    aria-live="polite"
  >
    <!-- Background Task Indicator -->
    <div
      class="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg"
      role="progressbar"
      :aria-valuenow="store.progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Analysis progress"
    >
      <div class="relative">
        <Activity class="w-4 h-4 text-blue-400 animate-pulse" aria-hidden="true" />
        <div
          class="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping"
          aria-hidden="true"
        />
      </div>
      <div class="flex flex-col min-w-0">
        <span class="text-xs font-medium text-blue-300" aria-live="polite"
          >Scanning in Progress</span
        >
        <div class="flex items-center gap-2">
          <div
            class="flex-1 w-24 bg-slate-700 rounded-full h-1.5 overflow-hidden"
            aria-hidden="true"
          >
            <div
              class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${store.progress}%` }"
            />
          </div>
          <span class="text-xs text-slate-400" aria-label="Progress percentage"
            >{{ store.progress }}%</span
          >
        </div>
      </div>
    </div>

    <!-- Quick Actions Dropdown -->
    <div ref="dropdownRef" class="relative">
      <button
        class="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        :class="{ 'bg-slate-800': dropdownOpen }"
        :aria-expanded="dropdownOpen"
        aria-haspopup="true"
        aria-label="Analysis actions menu"
        tabindex="0"
        @click="toggleDropdown"
        @keydown.enter="toggleDropdown"
        @keydown.space.prevent="toggleDropdown"
        @keydown.escape="closeDropdown"
      >
        <ChevronDown
          class="w-4 h-4 text-slate-400"
          :class="{ 'rotate-180': dropdownOpen }"
          aria-hidden="true"
        />
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="dropdownOpen"
        class="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[9999]"
        @click.stop
      >
        <div class="p-4 border-b border-slate-700">
          <h3 class="text-sm font-semibold text-white mb-2">Background Analysis</h3>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-400">Status:</span>
              <span class="text-xs font-medium text-blue-400">{{ store.status }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-400">Files Scanned:</span>
              <span class="text-xs font-medium text-white">{{
                store.progressData.files?.toLocaleString() || 0
              }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-400">Current File:</span>
              <span
                class="text-xs font-medium text-white truncate max-w-[150px]"
                :title="store.progressData.currentFile"
              >
                {{ getFileName(store.progressData.currentFile) }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-slate-400">Path:</span>
              <span
                class="text-xs font-medium text-white truncate max-w-[150px]"
                :title="store.path"
              >
                {{ getDirectoryName(store.path) }}
              </span>
            </div>
          </div>
        </div>

        <div class="p-2">
          <div class="space-y-1">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition-colors text-left"
              @click="goToScanPage"
            >
              <Eye class="w-4 h-4" />
              View Scan Details
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors text-left"
              @click="cancelAnalysis"
            >
              <X class="w-4 h-4" />
              Cancel Analysis
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAnalysisStore } from "@/store";
import { Activity, ChevronDown, Eye, X } from "lucide-vue-next";

const store = useAnalysisStore();
const router = useRouter();
const dropdownOpen = ref(false);
const dropdownRef = ref<HTMLElement>();

const toggleDropdown = () => {
  dropdownOpen.value = !dropdownOpen.value;
};

const closeDropdown = () => {
  dropdownOpen.value = false;
};

const goToScanPage = () => {
  router.push("/scan");
  dropdownOpen.value = false;
};

const cancelAnalysis = async () => {
  if (confirm("Are you sure you want to cancel the background analysis?")) {
    await store.cancelAnalysis();
    dropdownOpen.value = false;
  }
};

const getFileName = (filePath: string) => {
  if (!filePath) return "Starting...";
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
};

const getDirectoryName = (fullPath: string) => {
  if (!fullPath) return "Unknown";
  const parts = fullPath.split(/[/\\]/);
  return parts[parts.length - 2] || fullPath;
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    dropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped>
@keyframes ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.animate-ping {
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
</style>

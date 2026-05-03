<template>
  <div class="ai-cleanup-suggestions">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <SparklesIcon class="w-5 h-5 text-purple-500" />
        <h3 class="text-lg font-semibold">AI Cleanup Suggestions</h3>
        <span
          v-if="recommendations.length > 0"
          class="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full"
        >
          {{ recommendations.length }} found
        </span>
      </div>
      <div class="flex gap-2">
        <button
          @click="loadRecommendations"
          :disabled="loading"
          class="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCwIcon v-if="loading" class="w-4 h-4 animate-spin" />
          <RefreshCwIcon v-else class="w-4 h-4" />
          {{ loading ? "Analyzing..." : "Analyze" }}
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
      <div class="flex items-start gap-2">
        <AlertCircleIcon class="w-5 h-5 text-red-500 mt-0.5" />
        <div>
          <p class="text-red-700 font-medium">{{ error }}</p>
          <p v-if="errorCode === 'AI_SERVICE_OFFLINE'" class="text-red-600 text-sm mt-1">
            Start the Python AI service with:
            <code class="bg-red-100 px-1.5 py-0.5 rounded">npm run ai:start</code>
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && recommendations.length === 0" class="space-y-3">
      <div v-for="i in 3" :key="i" class="p-4 bg-gray-100 rounded-lg animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="recommendations.length === 0 && !loading && !error"
      class="p-6 text-center bg-gray-50 rounded-lg"
    >
      <SparklesIcon class="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p class="text-gray-600">No cleanup suggestions yet</p>
      <p class="text-sm text-gray-500 mt-1">Click Analyze to get AI-powered recommendations</p>
    </div>

    <!-- Recommendations List -->
    <div v-else class="space-y-3">
      <div
        v-for="(rec, index) in sortedRecommendations"
        :key="rec.file_path"
        class="p-4 border rounded-lg transition-all"
        :class="[
          selected.has(rec.file_path)
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-200 hover:border-purple-300',
          getActionColor(rec.action),
        ]"
      >
        <div class="flex items-start gap-3">
          <!-- Selection Checkbox -->
          <input
            type="checkbox"
            :checked="selected.has(rec.file_path)"
            @change="toggleSelection(rec.file_path)"
            class="mt-1 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
          />

          <!-- Action Icon -->
          <div
            class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            :class="getActionBgColor(rec.action)"
          >
            {{ getActionIcon(rec.action) }}
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <p class="font-medium text-gray-900 truncate" :title="rec.file_path">
                {{ getFileName(rec.file_path) }}
              </p>
              <span
                class="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getConfidenceBadgeClass(rec.confidence)"
              >
                {{ formatConfidence(rec.confidence) }}
              </span>
            </div>

            <p class="text-sm text-gray-600 mt-1">{{ rec.reason }}</p>

            <!-- File Path (truncated) -->
            <p class="text-xs text-gray-400 mt-1 truncate" :title="rec.file_path">
              {{ rec.file_path }}
            </p>

            <!-- Action Badge -->
            <div class="flex items-center gap-2 mt-2">
              <span
                class="px-2 py-0.5 text-xs rounded-full font-medium capitalize"
                :class="getActionBadgeClass(rec.action)"
              >
                {{ rec.action }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div v-if="selected.size > 0" class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div class="flex items-center justify-between">
        <span class="text-purple-700 font-medium">
          {{ selected.size }} file{{ selected.size === 1 ? "" : "s" }} selected
        </span>
        <div class="flex gap-2">
          <button
            @click="applyAction('delete')"
            class="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5"
          >
            <Trash2Icon class="w-4 h-4" />
            Delete Selected
          </button>
          <button
            @click="applyAction('archive')"
            class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
          >
            <ArchiveIcon class="w-4 h-4" />
            Archive Selected
          </button>
          <button
            @click="clearSelection"
            class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  SparklesIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  Trash2Icon,
  ArchiveIcon,
} from "lucide-vue-next";
import PythonAIService, {
  type CleanupRecommendation,
  type DirectoryAnalysis,
} from "@/services/PythonAIService";

const props = defineProps<{
  directoryPath: string;
  files: Array<{
    path: string;
    name: string;
    size: number;
    extension: string;
    modified_time?: number;
  }>;
}>();

const emit = defineEmits<{
  (e: "apply", files: string[], action: "delete" | "archive"): void;
}>();

const aiService = new PythonAIService();

const loading = ref(false);
const error = ref("");
const errorCode = ref("");
const recommendations = ref<CleanupRecommendation[]>([]);
const selected = ref(new Set<string>());

const sortedRecommendations = computed(() => {
  return [...recommendations.value].sort((a, b) => b.confidence - a.confidence);
});

async function loadRecommendations() {
  loading.value = true;
  error.value = "";
  errorCode.value = "";

  try {
    // Prepare analysis data
    const analysis = prepareDirectoryAnalysis();

    // Get recommendations from AI service
    const recs = await aiService.predictCleanup(analysis);
    recommendations.value = recs;

    // Clear selection when loading new recommendations
    selected.value.clear();
  } catch (err) {
    console.error("Failed to load recommendations:", err);
    error.value = err instanceof Error ? err.message : "Unknown error";

    // Check for specific error code
    if (err instanceof Error && err.message.includes("AI_SERVICE_OFFLINE")) {
      errorCode.value = "AI_SERVICE_OFFLINE";
    }
  } finally {
    loading.value = false;
  }
}

function prepareDirectoryAnalysis(): DirectoryAnalysis {
  const now = Date.now() / 1000;
  const oneYearAgo = now - 365 * 24 * 60 * 60;

  const fileTypes: Record<string, number> = {};
  const ageDistribution: Record<string, number> = {
    "<30d": 0,
    "30-90d": 0,
    "90-365d": 0,
    ">365d": 0,
  };

  let totalSize = 0;
  const largestFiles = [...props.files].sort((a, b) => b.size - a.size).slice(0, 20);

  props.files.forEach((file) => {
    // Count file types
    const ext = file.extension || "unknown";
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;

    // Count by age
    const modifiedTime = file.modified_time || now;
    const age = now - modifiedTime;
    if (age < 30 * 24 * 60 * 60) {
      ageDistribution["<30d"]++;
    } else if (age < 90 * 24 * 60 * 60) {
      ageDistribution["30-90d"]++;
    } else if (age < 365 * 24 * 60 * 60) {
      ageDistribution["90-365d"]++;
    } else {
      ageDistribution[">365d"]++;
    }

    totalSize += file.size;
  });

  return {
    directory_path: props.directoryPath,
    total_files: props.files.length,
    total_size: totalSize,
    file_types: fileTypes,
    age_distribution: ageDistribution,
    largest_files: largestFiles.map((f) => ({
      path: f.path,
      name: f.name,
      size: f.size,
      extension: f.extension,
      modified_time: f.modified_time || now,
    })),
  };
}

function toggleSelection(filePath: string) {
  if (selected.value.has(filePath)) {
    selected.value.delete(filePath);
  } else {
    selected.value.add(filePath);
  }
}

function clearSelection() {
  selected.value.clear();
}

function applyAction(action: "delete" | "archive") {
  const files = Array.from(selected.value);
  emit("apply", files, action);
  selected.value.clear();
}

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    delete: "🗑️",
    archive: "📦",
    review: "👀",
  };
  return icons[action] || "❓";
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    delete: "border-l-4 border-l-red-400",
    archive: "border-l-4 border-l-blue-400",
    review: "border-l-4 border-l-yellow-400",
  };
  return colors[action] || "";
}

function getActionBgColor(action: string): string {
  const colors: Record<string, string> = {
    delete: "bg-red-100",
    archive: "bg-blue-100",
    review: "bg-yellow-100",
  };
  return colors[action] || "bg-gray-100";
}

function getActionBadgeClass(action: string): string {
  const classes: Record<string, string> = {
    delete: "bg-red-100 text-red-700",
    archive: "bg-blue-100 text-blue-700",
    review: "bg-yellow-100 text-yellow-700",
  };
  return classes[action] || "bg-gray-100 text-gray-700";
}

function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

function getConfidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-100 text-green-700";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}
</script>

<style scoped>
.ai-cleanup-suggestions {
  @apply w-full;
}
</style>

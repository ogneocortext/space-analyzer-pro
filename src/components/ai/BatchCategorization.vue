<template>
  <div class="batch-categorization">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <BrainIcon class="w-5 h-5 text-indigo-500" />
        <h3 class="text-lg font-semibold">AI Batch Categorization</h3>
      </div>
      <button
        @click="categorizeFiles"
        :disabled="loading || uncategorizedFiles.length === 0"
        class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
      >
        <LoaderIcon v-if="loading" class="w-4 h-4 animate-spin" />
        <BrainIcon v-else class="w-4 h-4" />
        {{ loading ? "Categorizing..." : `Categorize ${uncategorizedFiles.length} Files` }}
      </button>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-red-700 text-sm"
    >
      {{ error }}
    </div>

    <!-- Progress -->
    <div v-if="loading && progress.total > 0" class="mb-4">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>Processing...</span>
        <span>{{ progress.current }} / {{ progress.total }}</span>
      </div>
      <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-indigo-600 transition-all duration-300"
          :style="{ width: `${(progress.current / progress.total) * 100}%` }"
        ></div>
      </div>
    </div>

    <!-- Results -->
    <div v-if="results.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
      <div
        v-for="result in results"
        :key="result.path"
        class="flex items-center justify-between p-3 bg-white border rounded-lg"
      >
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <span class="text-xl">{{ getFileIcon(result.path) }}</span>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-gray-900 truncate" :title="result.path">
              {{ getFileName(result.path) }}
            </p>
            <p class="text-xs text-gray-500 truncate" :title="result.path">
              {{ result.path }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <FileCategoryBadge
            :category="result.predicted_category"
            :confidence="result.confidence"
            :show-confidence="true"
          />
          <button
            @click="acceptCategory(result)"
            class="p-1.5 text-green-600 hover:bg-green-100 rounded-lg"
            title="Accept category"
          >
            <CheckIcon class="w-4 h-4" />
          </button>
          <button
            @click="rejectCategory(result)"
            class="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"
            title="Reject and skip"
          >
            <XIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="uncategorizedFiles.length === 0" class="p-6 text-center bg-gray-50 rounded-lg">
      <CheckCircleIcon class="w-12 h-12 text-green-400 mx-auto mb-3" />
      <p class="text-gray-600">All files are categorized!</p>
      <p class="text-sm text-gray-500 mt-1">No uncategorized files found</p>
    </div>

    <!-- Instructions -->
    <div v-else class="p-4 bg-indigo-50 rounded-lg">
      <p class="text-sm text-indigo-700">
        <BrainIcon class="w-4 h-4 inline mr-1" />
        Click "Categorize" to use AI to automatically categorize
        {{ uncategorizedFiles.length }} uncategorized files.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { BrainIcon, LoaderIcon, CheckIcon, XIcon, CheckCircleIcon } from "lucide-vue-next";
import FileCategoryBadge from "./FileCategoryBadge.vue";
import PythonAIService, {
  type CategoryPrediction,
  type FileData,
} from "@/services/PythonAIService";

const props = defineProps<{
  files: Array<{
    path: string;
    name?: string;
    size: number;
    extension?: string;
    modified_time?: number;
    category?: string;
  }>;
}>({
  files: () => [],
});

const emit = defineEmits<{
  (e: "categorized", path: string, category: string): void;
}>();

const aiService = new PythonAIService();

const loading = ref(false);
const error = ref("");
const progress = ref({ current: 0, total: 0 });
const results = ref<CategoryPrediction[]>([]);

const uncategorizedFiles = computed(() => {
  return props.files.filter((f) => !f.category || f.category === "other");
});

async function categorizeFiles() {
  if (uncategorizedFiles.value.length === 0) return;

  loading.value = true;
  error.value = "";
  results.value = [];
  progress.value = { current: 0, total: uncategorizedFiles.value.length };

  try {
    // Convert files to FileData format
    const fileData: FileData[] = uncategorizedFiles.value.map((f) =>
      PythonAIService.toFileData({
        path: f.path,
        name: f.name,
        size: f.size,
        extension: f.extension,
        modified_time: f.modified_time,
      })
    );

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < fileData.length; i += batchSize) {
      const batch = fileData.slice(i, i + batchSize);

      const predictions = await aiService.predictCategoriesBatch(batch);
      results.value.push(...predictions);

      progress.value.current = Math.min(i + batchSize, fileData.length);
    }
  } catch (err) {
    console.error("Batch categorization failed:", err);
    error.value = err instanceof Error ? err.message : "Categorization failed";
  } finally {
    loading.value = false;
  }
}

function acceptCategory(result: CategoryPrediction) {
  emit("categorized", result.path, result.predicted_category);
  // Remove from results
  results.value = results.value.filter((r) => r.path !== result.path);
}

function rejectCategory(result: CategoryPrediction) {
  // Just remove from results
  results.value = results.value.filter((r) => r.path !== result.path);
}

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function getFileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";

  const icons: Record<string, string> = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    txt: "📃",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    mp4: "🎬",
    avi: "🎬",
    mov: "🎬",
    mp3: "🎵",
    wav: "🎵",
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    js: "💻",
    ts: "💻",
    py: "🐍",
    json: "📊",
    csv: "📊",
    exe: "⚙️",
  };

  return icons[ext] || "📁";
}
</script>

<style scoped>
.batch-categorization {
  @apply w-full;
}
</style>

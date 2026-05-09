<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <BarChart3 class="w-6 h-6 text-blue-400" aria-hidden="true" />
        <div>
          <h2 id="results-heading" class="text-xl font-semibold">Analysis Results</h2>
          <p class="text-sm text-gray-400" aria-live="polite">
            {{ displayResults.length }} results found
          </p>
        </div>
      </div>
      <div class="flex gap-2" role="toolbar" aria-label="Analysis actions">
        <button
          class="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Refresh analysis results"
          title="Refresh results"
          @click="onRefresh"
        >
          <RefreshCw class="w-4 h-4" aria-hidden="true" />
          <span>Refresh</span>
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Save analysis results to database"
          title="Save results"
          @click="handleSave"
        >
          <Database class="w-4 h-4" aria-hidden="true" />
          <span>Save</span>
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label="Load saved analysis results"
          title="Load results"
          @click="handleLoad"
        >
          <Upload class="w-4 h-4" aria-hidden="true" />
          <span>Load</span>
        </button>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Export analysis results"
          title="Export results"
          @click="onExport"
        >
          <Download class="w-4 h-4" aria-hidden="true" />
          <span>Export</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 flex-wrap" role="group" aria-label="Filter analysis results">
      <button
        v-for="filter in filters"
        :key="filter.id"
        :class="[
          'px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
          selectedFilter === filter.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
        ]"
        :aria-pressed="selectedFilter === filter.id"
        :aria-label="`Filter by ${filter.label}`"
        :title="`Filter results by ${filter.label}`"
        @click="selectedFilter = filter.id"
      >
        <component :is="filter.icon" class="w-4 h-4 inline mr-2" aria-hidden="true" />
        {{ filter.label }}
      </button>
    </div>

    <!-- Page Filter -->
    <div class="flex gap-2 items-center">
      <label for="page-select" class="text-sm text-gray-400">Page:</label>
      <select
        id="page-select"
        v-model="selectedPage"
        class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Select page to filter results"
      >
        <option value="all">All Pages</option>
        <option v-for="page in uniquePages" :key="page" :value="page">
          {{ page }}
        </option>
      </select>
    </div>

    <!-- Results List -->
    <div class="space-y-3" role="list" aria-label="Analysis results">
      <div
        v-for="result in displayResults"
        :key="result.id"
        class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors focus-within:border-blue-500"
        role="listitem"
        tabindex="0"
        :aria-label="`Analysis result: ${result.title || result.page}, ${result.type}, ${result.model}`"
        @keydown.enter="selectResult(result)"
        @keydown.space="selectResult(result)"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div
              :class="['p-2 rounded-lg', result.success ? 'bg-green-500/20' : 'bg-red-500/20']"
              aria-hidden="true"
            >
              <CheckCircle v-if="result.success" class="w-5 h-5 text-green-400" />
              <AlertTriangle v-else class="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 :id="`result-${result.id}`" class="font-semibold text-white">
                {{ result.title || result.page }}
              </h3>
              <div class="flex items-center gap-2 text-sm text-gray-400">
                <component :is="getTypeIcon(result.type)" class="w-4 h-4" aria-hidden="true" />
                <span>{{ result.type }}</span>
                <span aria-hidden="true">•</span>
                <span>{{ result.model }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400">{{ formatResponseTime(result.responseTime) }}</span>
            <button
              class="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              @click="toggleExpand(result.id)"
            >
              <Eye v-if="!expandedResults.has(result.id)" class="w-4 h-4 text-gray-400" />
              <Eye v-else class="w-4 h-4 text-gray-400 rotate-180" />
            </button>
          </div>
        </div>

        <div v-if="expandedResults.has(result.id)" class="mt-3 pt-3 border-t border-gray-700">
          <p class="text-sm text-gray-300">
            {{ result.analysis || "No analysis available" }}
          </p>
          <div class="mt-2 text-xs text-gray-500">
            {{ new Date(result.timestamp).toLocaleString() }}
          </div>
        </div>
      </div>

      <div v-if="displayResults.length === 0" class="text-center py-12 text-gray-400">
        <BarChart3 class="w-12 h-12 mx-auto mb-4" />
        <p>No results found</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  BarChart3,
  Download,
  RefreshCw,
  Eye,
  Code,
  Layers,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Database,
  Upload,
} from "lucide-vue-next";

export const RESULT_TYPES = {
  ALL: "all",
  VISION: "vision",
  CODE: "code",
  COMBINED: "combined",
} as const;

export type ResultTypeType = (typeof RESULT_TYPES)[keyof typeof RESULT_TYPES];

export const ANALYSIS_TYPES = {
  VISION: "vision",
  CODE: "code",
  COMBINED: "combined",
} as const;

export type AnalysisTypeType = (typeof ANALYSIS_TYPES)[keyof typeof ANALYSIS_TYPES];

interface AnalysisResult {
  id: string;
  page: string;
  model: string;
  role: string;
  type: "vision" | "code" | "combined";
  success: boolean;
  analysis?: string;
  timestamp: string;
  responseTime: number;
  title?: string;
}

interface AnalysisResultsProps {
  results?: AnalysisResult[];
  onRefresh?: () => void;
  onExport?: () => void;
  onSave?: (results: AnalysisResult[]) => void;
  onLoad?: (results: AnalysisResult[]) => void;
}

const props = withDefaults(defineProps<AnalysisResultsProps>(), {
  results: () => [],
  onRefresh: () => {},
  onExport: () => {},
  onSave: () => {},
  onLoad: () => {},
});

const selectedFilter = ref<ResultTypeType>(RESULT_TYPES.ALL);
const selectedPage = ref<string>("all");
const expandedResults = ref<Set<string>>(new Set());

const filters = [
  { id: RESULT_TYPES.ALL, label: "All", icon: BarChart3 },
  { id: RESULT_TYPES.VISION, label: "Vision", icon: Eye },
  { id: RESULT_TYPES.CODE, label: "Code", icon: Code },
  { id: RESULT_TYPES.COMBINED, label: "Combined", icon: Layers },
];

const mockResults: AnalysisResult[] = [
  {
    id: "1",
    type: "vision",
    page: "dashboard",
    title: "Dashboard UI Enhancement",
    success: true,
    analysis:
      "Implemented responsive design improvements with better accessibility features and enhanced user interactions.",
    timestamp: "2026-01-19T02:03:58.114Z",
    responseTime: 2341,
    model: "gpt-4-vision",
    role: "assistant",
  },
  {
    id: "2",
    type: "code",
    page: "neural",
    title: "Neural Network Performance",
    success: true,
    analysis:
      "Optimized neural physics calculations with Web Workers, achieving 60fps animations and reduced memory usage.",
    timestamp: "2026-01-19T02:03:58.114Z",
    responseTime: 15678,
    model: "gpt-4",
    role: "assistant",
  },
  {
    id: "3",
    type: "combined",
    page: "chat",
    title: "AI Chat Integration",
    success: true,
    analysis:
      "Successfully integrated drag-and-drop functionality for file analysis with natural language processing capabilities.",
    timestamp: "2026-01-19T02:03:58.114Z",
    responseTime: 8934,
    model: "gpt-4-vision",
    role: "assistant",
  },
  {
    id: "4",
    type: "code",
    page: "development",
    title: "Code Quality Improvements",
    success: true,
    analysis:
      "Code quality improvements implemented with proper error handling and performance monitoring. TypeScript strict mode enabled for better type safety.",
    timestamp: "2026-01-19T02:03:58.114Z",
    responseTime: 4567,
    model: "gpt-4",
    role: "assistant",
  },
];

const displayResults = computed(() => {
  const resultsToUse = props.results.length > 0 ? props.results : mockResults;

  return resultsToUse.filter((result) => {
    const filterMatch =
      selectedFilter.value === RESULT_TYPES.ALL || result.type === selectedFilter.value;
    const pageMatch = selectedPage.value === "all" || result.page === selectedPage.value;
    return filterMatch && pageMatch;
  });
});

const uniquePages = computed(() => {
  const resultsToUse = props.results.length > 0 ? props.results : mockResults;
  return [...new Set(resultsToUse.map((r) => r.page))];
});

const getTypeIcon = (type: string) => {
  switch (type) {
    case "vision":
      return Eye;
    case "code":
      return Code;
    case "combined":
      return Layers;
    default:
      return TrendingUp;
  }
};

const formatResponseTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const toggleExpand = (id: string) => {
  if (expandedResults.value.has(id)) {
    expandedResults.value.delete(id);
  } else {
    expandedResults.value.add(id);
  }
};

const handleSave = () => {
  try {
    const resultsToSave = displayResults.value;
    const saveData = {
      results: resultsToSave,
      timestamp: new Date().toISOString(),
      version: "1.0",
    };

    // Save to localStorage
    localStorage.setItem("analysis-results", JSON.stringify(saveData));

    // Call parent onSave callback if provided
    if (props.onSave) {
      props.onSave(resultsToSave);
    }

    // Show success message
    console.log(`Saved ${resultsToSave.length} analysis results to localStorage`);

    // Optional: Show user feedback
    alert(`Successfully saved ${resultsToSave.length} analysis results!`);
  } catch (error) {
    console.error("Failed to save analysis results:", error);
    alert("Failed to save analysis results. Please try again.");
  }
};

const handleLoad = () => {
  try {
    // Load from localStorage
    const savedData = localStorage.getItem("analysis-results");

    if (!savedData) {
      alert("No saved analysis results found.");
      return;
    }

    const parsedData = JSON.parse(savedData);

    if (!parsedData.results || !Array.isArray(parsedData.results)) {
      alert("Invalid saved data format.");
      return;
    }

    // Validate and load results
    const loadedResults: AnalysisResult[] = parsedData.results
      .map((item: unknown) => {
        // Basic validation
        if (
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "type" in item &&
          "success" in item
        ) {
          return item as AnalysisResult;
        }
        return null;
      })
      .filter((item): item is AnalysisResult => item !== null);

    if (loadedResults.length === 0) {
      alert("No valid analysis results found in saved data.");
      return;
    }

    // Call parent onLoad callback if provided
    if (props.onLoad) {
      props.onLoad(loadedResults);
    }

    // Show success message
    console.log(`Loaded ${loadedResults.length} analysis results from localStorage`);
    alert(`Successfully loaded ${loadedResults.length} analysis results!`);
  } catch (error) {
    console.error("Failed to load analysis results:", error);
    alert("Failed to load analysis results. The data may be corrupted.");
  }
};
</script>

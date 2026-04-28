<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <BarChart3 class="w-6 h-6 text-blue-400" />
        <div>
          <h2 class="text-xl font-semibold">Analysis Results</h2>
          <p class="text-sm text-gray-400">{{ displayResults.length }} results found</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="onRefresh"
          class="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <RefreshCw class="w-4 h-4" />
          <span>Refresh</span>
        </button>
        <button
          @click="onExport"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download class="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="filter in filters"
        :key="filter.id"
        @click="selectedFilter = filter.id"
        :class="[
          'px-4 py-2 rounded-lg transition-colors',
          selectedFilter === filter.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        ]"
      >
        <component :is="filter.icon" class="w-4 h-4 inline mr-2" />
        {{ filter.label }}
      </button>
    </div>

    <!-- Page Filter -->
    <div class="flex gap-2 items-center">
      <label class="text-sm text-gray-400">Page:</label>
      <select
        v-model="selectedPage"
        class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
      >
        <option value="all">All Pages</option>
        <option v-for="page in uniquePages" :key="page" :value="page">{{ page }}</option>
      </select>
    </div>

    <!-- Results List -->
    <div class="space-y-3">
      <div
        v-for="result in displayResults"
        :key="result.id"
        class="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'p-2 rounded-lg',
                result.success ? 'bg-green-500/20' : 'bg-red-500/20'
              ]"
            >
              <CheckCircle v-if="result.success" class="w-5 h-5 text-green-400" />
              <AlertTriangle v-else class="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 class="font-semibold text-white">{{ result.title || result.page }}</h3>
              <div class="flex items-center gap-2 text-sm text-gray-400">
                <component :is="getTypeIcon(result.type)" class="w-4 h-4" />
                <span>{{ result.type }}</span>
                <span>•</span>
                <span>{{ result.model }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400">{{ formatResponseTime(result.responseTime) }}</span>
            <button
              @click="toggleExpand(result.id)"
              class="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Eye v-if="!expandedResults.has(result.id)" class="w-4 h-4 text-gray-400" />
              <Eye v-else class="w-4 h-4 text-gray-400 rotate-180" />
            </button>
          </div>
        </div>

        <div v-if="expandedResults.has(result.id)" class="mt-3 pt-3 border-t border-gray-700">
          <p class="text-sm text-gray-300">{{ result.analysis || 'No analysis available' }}</p>
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
import { ref, computed } from 'vue';
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
} from 'lucide-vue-next';

export const RESULT_TYPES = {
  ALL: 'all',
  VISION: 'vision',
  CODE: 'code',
  COMBINED: 'combined',
} as const;

export type ResultTypeType = (typeof RESULT_TYPES)[keyof typeof RESULT_TYPES];

export const ANALYSIS_TYPES = {
  VISION: 'vision',
  CODE: 'code',
  COMBINED: 'combined',
} as const;

export type AnalysisTypeType = (typeof ANALYSIS_TYPES)[keyof typeof ANALYSIS_TYPES];

interface AnalysisResult {
  id: string;
  page: string;
  model: string;
  role: string;
  type: 'vision' | 'code' | 'combined';
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
}

const props = withDefaults(defineProps<AnalysisResultsProps>(), {
  results: () => [],
  onRefresh: () => {},
  onExport: () => {},
});

const selectedFilter = ref<ResultTypeType>(RESULT_TYPES.ALL);
const selectedPage = ref<string>('all');
const expandedResults = ref<Set<string>>(new Set());

const filters = [
  { id: RESULT_TYPES.ALL, label: 'All', icon: BarChart3 },
  { id: RESULT_TYPES.VISION, label: 'Vision', icon: Eye },
  { id: RESULT_TYPES.CODE, label: 'Code', icon: Code },
  { id: RESULT_TYPES.COMBINED, label: 'Combined', icon: Layers },
];

const mockResults: AnalysisResult[] = [
  {
    id: '1',
    type: 'vision',
    page: 'dashboard',
    title: 'Dashboard UI Enhancement',
    success: true,
    analysis:
      'Implemented responsive design improvements with better accessibility features and enhanced user interactions.',
    timestamp: '2026-01-19T02:03:58.114Z',
    responseTime: 2341,
    model: 'gpt-4-vision',
    role: 'assistant',
  },
  {
    id: '2',
    type: 'code',
    page: 'neural',
    title: 'Neural Network Performance',
    success: true,
    analysis:
      'Optimized neural physics calculations with Web Workers, achieving 60fps animations and reduced memory usage.',
    timestamp: '2026-01-19T02:03:58.114Z',
    responseTime: 15678,
    model: 'gpt-4',
    role: 'assistant',
  },
  {
    id: '3',
    type: 'combined',
    page: 'chat',
    title: 'AI Chat Integration',
    success: true,
    analysis:
      'Successfully integrated drag-and-drop functionality for file analysis with natural language processing capabilities.',
    timestamp: '2026-01-19T02:03:58.114Z',
    responseTime: 8934,
    model: 'gpt-4-vision',
    role: 'assistant',
  },
  {
    id: '4',
    type: 'code',
    page: 'development',
    title: 'Code Quality Improvements',
    success: true,
    analysis:
      'Code quality improvements implemented with proper error handling and performance monitoring. TypeScript strict mode enabled for better type safety.',
    timestamp: '2026-01-19T02:03:58.114Z',
    responseTime: 4567,
    model: 'gpt-4',
    role: 'assistant',
  },
];

const displayResults = computed(() => {
  const resultsToUse = props.results.length > 0 ? props.results : mockResults;

  return resultsToUse.filter((result) => {
    const filterMatch =
      selectedFilter.value === RESULT_TYPES.ALL || result.type === selectedFilter.value;
    const pageMatch = selectedPage.value === 'all' || result.page === selectedPage.value;
    return filterMatch && pageMatch;
  });
});

const uniquePages = computed(() => {
  const resultsToUse = props.results.length > 0 ? props.results : mockResults;
  return [...new Set(resultsToUse.map((r) => r.page))];
});

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'vision':
      return Eye;
    case 'code':
      return Code;
    case 'combined':
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
</script>

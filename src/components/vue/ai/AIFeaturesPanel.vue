<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <BrainCircuit class="w-6 h-6 text-purple-400" />
        <div>
          <h2 class="text-xl font-semibold">AI Features</h2>
          <p class="text-sm text-gray-400">
            {{ lastUpdate ? `Last updated: ${lastUpdate.toLocaleString()}` : 'Ready to analyze' }}
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="loadRecommendations"
          :disabled="isLoading"
          class="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw v-if="isLoading" class="w-4 h-4 animate-spin" />
          <RefreshCw v-else class="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-gray-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
          activeTab === tab.id
            ? 'border-purple-500 text-purple-400'
            : 'border-transparent text-gray-400 hover:text-gray-300'
        ]"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-900/20 border border-red-800 rounded-lg p-4">
      <p class="text-red-400">{{ error }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <RefreshCw class="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
        <p class="text-gray-400">Loading AI features...</p>
      </div>
    </div>

    <!-- Recommendations Tab -->
    <div v-if="activeTab === 'recommendations' && !isLoading" class="space-y-4">
      <div v-if="recommendations.length === 0" class="text-center py-12 text-gray-400">
        <BrainCircuit class="w-12 h-12 mx-auto mb-4" />
        <p>No recommendations available</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="(rec, index) in recommendations"
          :key="index"
          :class="[
            'border rounded-lg p-4',
            rec.priority === 'high' ? 'border-red-800 bg-red-900/10' :
            rec.priority === 'medium' ? 'border-yellow-800 bg-yellow-900/10' :
            'border-green-800 bg-green-900/10'
          ]"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <component
                :is="getPriorityIcon(rec.priority)"
                :class="[
                  'w-5 h-5',
                  rec.priority === 'high' ? 'text-red-400' :
                  rec.priority === 'medium' ? 'text-yellow-400' :
                  'text-green-400'
                ]"
              />
              <h3 class="font-semibold">{{ rec.title }}</h3>
            </div>
            <span
              :class="[
                'text-xs px-2 py-1 rounded',
                rec.priority === 'high' ? 'bg-red-800 text-red-200' :
                rec.priority === 'medium' ? 'bg-yellow-800 text-yellow-200' :
                'bg-green-800 text-green-200'
              ]"
            >
              {{ rec.priority }}
            </span>
          </div>
          <p class="text-sm text-gray-300 mb-3">{{ rec.description }}</p>
          <div v-if="rec.potentialSavings" class="flex items-center gap-2 text-sm text-green-400 mb-3">
            <TrendingUp class="w-4 h-4" />
            <span>Potential savings: {{ formatFileSize(rec.potentialSavings) }}</span>
          </div>
          <button
            @click="executeAction(rec.action)"
            class="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
          >
            <CheckCircle class="w-4 h-4" />
            <span>{{ rec.action }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Performance Tab -->
    <div v-if="activeTab === 'performance' && !isLoading" class="space-y-4">
      <div v-if="!performanceMetrics" class="text-center py-12 text-gray-400">
        <Activity class="w-12 h-12 mx-auto mb-4" />
        <p>No performance data available</p>
        <button
          @click="loadPerformanceMetrics"
          class="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Load Performance Metrics
        </button>
      </div>
      <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Zap class="w-5 h-5 text-yellow-400" />
            <p class="text-sm text-gray-400">Files/Second</p>
          </div>
          <p class="text-2xl font-bold">{{ performanceMetrics.filesPerSecond.toFixed(2) }}</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Shield class="w-5 h-5 text-blue-400" />
            <p class="text-sm text-gray-400">Cache Hit Rate</p>
          </div>
          <p class="text-2xl font-bold">{{ (performanceMetrics.cacheHitRate * 100).toFixed(1) }}%</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <BarChart3 class="w-5 h-5 text-green-400" />
            <p class="text-sm text-gray-400">Batches Processed</p>
          </div>
          <p class="text-2xl font-bold">{{ performanceMetrics.batchesProcessed }}</p>
        </div>
        <div class="bg-gray-800 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <Clock class="w-5 h-5 text-purple-400" />
            <p class="text-sm text-gray-400">Total Time</p>
          </div>
          <p class="text-2xl font-bold">{{ performanceMetrics.categorizationTime.toFixed(2) }}s</p>
        </div>
      </div>
    </div>

    <!-- Search Tab -->
    <div v-if="activeTab === 'search'" class="space-y-4">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search recommendations..."
          class="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white"
        />
      </div>
      <div v-if="filteredRecommendations.length === 0" class="text-center py-12 text-gray-400">
        <p>No results found for "{{ searchQuery }}"</p>
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="(rec, index) in filteredRecommendations"
          :key="index"
          class="border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors"
        >
          <h3 class="font-semibold mb-1">{{ rec.title }}</h3>
          <p class="text-sm text-gray-400">{{ rec.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  BrainCircuit,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  FileText,
  Settings,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronRight,
  Star,
  Shield,
  Activity,
} from 'lucide-vue-next';
import { bridge } from '../../services/AnalysisBridge';

interface AIFeaturesPanelProps {
  directoryPath?: string;
  onNavigate?: (view: string) => void;
}

interface AIRecommendation {
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  files?: any[];
  potentialSavings?: number;
  suggestions?: any[];
}

interface PerformanceMetrics {
  filesPerSecond: number;
  cacheHitRate: number;
  batchesProcessed: number;
  categorizationTime: number;
  totalFiles: number;
}

const props = defineProps<AIFeaturesPanelProps>();
const emit = defineEmits<{
  navigate: [view: string];
}>();

const recommendations = ref<AIRecommendation[]>([]);
const performanceMetrics = ref<PerformanceMetrics | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const lastUpdate = ref<Date | null>(null);
const activeTab = ref<'recommendations' | 'performance' | 'search'>('recommendations');
const searchQuery = ref('');

const tabs = [
  { id: 'recommendations' as const, label: 'Recommendations', icon: Star },
  { id: 'performance' as const, label: 'Performance', icon: Activity },
  { id: 'search' as const, label: 'Search', icon: Search },
];

const filteredRecommendations = computed(() => {
  if (!searchQuery.value) return recommendations.value;
  const query = searchQuery.value.toLowerCase();
  return recommendations.value.filter(
    (rec) =>
      rec.title.toLowerCase().includes(query) ||
      rec.description.toLowerCase().includes(query)
  );
});

watch(
  () => props.directoryPath,
  (newPath) => {
    if (newPath) {
      loadRecommendations();
    }
  },
  { immediate: true }
);

const loadRecommendations = async () => {
  if (!props.directoryPath) return;

  isLoading.value = true;
  error.value = null;

  try {
    const result = await bridge.getAIRecommendations(props.directoryPath);
    if (result.success) {
      recommendations.value = result.recommendations;
      lastUpdate.value = new Date();
    } else {
      error.value = 'Failed to load recommendations';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    isLoading.value = false;
  }
};

const loadPerformanceMetrics = async () => {
  if (!props.directoryPath) return;

  try {
    const result = await bridge.categorizeFilesOptimized(props.directoryPath, {
      batchSize: 100,
      useCache: true,
    });

    if (result.success) {
      performanceMetrics.value = {
        filesPerSecond: result.results.performance.filesPerSecond,
        cacheHitRate: result.results.performance.cacheHitRate,
        batchesProcessed: result.results.performance.batchesProcessed,
        categorizationTime: result.metadata.totalTime,
        totalFiles: result.metadata.totalFiles,
      };
      lastUpdate.value = new Date();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
};

const executeAction = (action: string) => {
  console.warn('Executing action:', action);
  // Implement action execution logic
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'high':
      return AlertTriangle;
    case 'medium':
      return Target;
    case 'low':
      return CheckCircle;
    default:
      return CheckCircle;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

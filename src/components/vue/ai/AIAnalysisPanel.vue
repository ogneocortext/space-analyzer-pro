<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center space-x-3 min-w-0 flex-1">
        <BrainCircuit class="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 flex-shrink-0" />
        <div class="min-w-0 flex-1">
          <h2 class="text-lg sm:text-xl font-semibold truncate">AI Analysis</h2>
          <p class="text-xs sm:text-sm text-gray-400 truncate">
            {{ lastAnalysis ? `Last analyzed: ${lastAnalysis.toLocaleString()}` : 'Ready to analyze your file system' }}
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-2 flex-shrink-0">
        <button
          @click="performAIAnalysis"
          :disabled="isAnalyzing || !analysisData"
          class="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-sm"
        >
          <Loader2 v-if="isAnalyzing" class="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
          <RefreshCw v-else class="w-3 h-3 sm:w-4 sm:h-4" />
          <span class="hidden sm:inline">{{ isAnalyzing ? 'Analyzing...' : 'Re-analyze' }}</span>
        </button>

        <button
          @click="exportAnalysis"
          :disabled="insights.length === 0"
          class="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors text-sm"
        >
          <Download class="w-3 h-3 sm:w-4 sm:h-4" />
          <span class="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>

    <!-- Progress Bar -->
    <div v-if="isAnalyzing" class="bg-gray-800 rounded-lg p-3 sm:p-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <span class="text-xs sm:text-sm text-gray-300">AI Analysis in Progress</span>
        <span class="text-xs sm:text-sm text-gray-400">{{ analysisProgress }}%</span>
      </div>
      <div class="w-full bg-gray-700 rounded-full h-2">
        <div
          class="bg-purple-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${analysisProgress}%` }"
        />
      </div>
    </div>

    <!-- Stats Overview -->
    <div v-if="insights.length > 0" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <div class="bg-gray-800 rounded-lg p-3 sm:p-4">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs sm:text-sm text-gray-400 truncate">Total Insights</p>
            <p class="text-xl sm:text-2xl font-bold truncate">{{ insights.length }}</p>
          </div>
          <BarChart3 class="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0 ml-2" />
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-3 sm:p-4">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs sm:text-sm text-gray-400 truncate">High Impact</p>
            <p class="text-xl sm:text-2xl font-bold text-red-400 truncate">
              {{ getImpactStats().high }}
            </p>
          </div>
          <AlertTriangle class="w-6 h-6 sm:w-8 sm:h-8 text-red-400 flex-shrink-0 ml-2" />
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-3 sm:p-4">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs sm:text-sm text-gray-400 truncate">Recommendations</p>
            <p class="text-xl sm:text-2xl font-bold text-yellow-400 truncate">
              {{ recommendations.length }}
            </p>
          </div>
          <TrendingUp class="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0 ml-2" />
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-3 sm:p-4">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-xs sm:text-sm text-gray-400 truncate">Space Analyzed</p>
            <p class="text-lg sm:text-2xl font-bold text-green-400 truncate">
              {{ formatFileSize(analysisData?.totalSize || 0) }}
            </p>
          </div>
          <FileText class="w-6 h-6 sm:w-8 sm:h-8 text-green-400 flex-shrink-0 ml-2" />
        </div>
      </div>
    </div>

    <!-- Category Filter -->
    <div v-if="insights.length > 0" class="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600">
      <button
        v-for="category in categories"
        :key="category.id"
        @click="selectedCategory = category.id"
        :class="[
          'flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex-shrink-0',
          selectedCategory === category.id ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        ]"
      >
        <component :is="category.icon" class="w-3 h-3 sm:w-4 sm:h-4" />
        <span class="text-xs sm:text-sm">{{ category.label }}</span>
      </button>
    </div>

    <!-- Insights List -->
    <div class="space-y-2 sm:space-y-3">
      <div
        v-for="(insight, index) in filteredInsights"
        :key="index"
        :class="['border rounded-lg p-3 sm:p-4', impactColors[insight.impact]]"
      >
        <div class="flex items-start space-x-2 sm:space-x-3">
          <component
            :is="categoryIcons[insight.type] || CheckCircle"
            class="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0"
          />
          <div class="flex-1 min-w-0">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 class="font-medium text-sm sm:text-base truncate">{{ insight.title }}</h3>
              <div class="flex items-center space-x-2 flex-shrink-0">
                <span class="text-xs px-2 py-1 bg-gray-800 rounded truncate">
                  {{ insight.category }}
                </span>
                <span
                  :class="[
                    'text-xs px-2 py-1 rounded truncate',
                    insight.impact === 'high' ? 'bg-red-800 text-red-200' : 
                    insight.impact === 'medium' ? 'bg-yellow-800 text-yellow-200' : 
                    'bg-green-800 text-green-200'
                  ]"
                >
                  {{ insight.impact }}
                </span>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-gray-300 break-words">
              {{ insight.description }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="filteredInsights.length === 0 && !isAnalyzing" class="text-center py-6 sm:py-8 text-gray-400">
        <BrainCircuit class="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4" />
        <h3 class="text-base sm:text-lg font-medium mb-2">No Insights Yet</h3>
        <p class="text-xs sm:text-sm px-4">
          {{ insights.length === 0 ? 'Run an analysis to get AI-powered insights about your file system' : 'No insights found for the selected category' }}
        </p>
      </div>
    </div>

    <!-- Recommendations -->
    <div v-if="recommendations.length > 0" class="bg-gray-800 rounded-lg p-4 sm:p-6">
      <h3 class="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center space-x-2">
        <TrendingUp class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
        <span>AI Recommendations</span>
      </h3>
      <div class="space-y-2 sm:space-y-3">
        <div v-for="(rec, index) in recommendations" :key="index" class="flex items-start space-x-2 sm:space-x-3">
          <span class="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-medium">
            {{ index + 1 }}
          </span>
          <p class="text-xs sm:text-sm text-gray-300 break-words">{{ rec }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  BrainCircuit,
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  BarChart3,
  Loader2,
  RefreshCw,
  Download,
  Share,
} from 'lucide-vue-next';
import { ollamaService } from '../../services/OllamaService';

interface AIAnalysisPanelProps {
  analysisData: any;
  onRecommendationsUpdate?: (recommendations: string[]) => void;
}

interface AIInsight {
  type: 'finding' | 'recommendation' | 'warning' | 'optimization';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

const props = defineProps<AIAnalysisPanelProps>();
const emit = defineEmits<{
  recommendationsUpdate: [recommendations: string[]];
}>();

const insights = ref<AIInsight[]>([]);
const recommendations = ref<string[]>([]);
const isAnalyzing = ref(false);
const lastAnalysis = ref<Date | null>(null);
const analysisProgress = ref(0);
const selectedCategory = ref<string>('all');

const categories = [
  { id: 'all', label: 'All Insights', icon: BarChart3 },
  { id: 'storage', label: 'Storage', icon: FileText },
  { id: 'performance', label: 'Performance', icon: Zap },
  { id: 'organization', label: 'Organization', icon: Target },
  { id: 'cleanup', label: 'Cleanup', icon: AlertTriangle },
];

const impactColors = {
  high: 'text-red-400 bg-red-900/20 border-red-800',
  medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
  low: 'text-green-400 bg-green-900/20 border-green-800',
};

const categoryIcons = {
  storage: FileText,
  performance: Zap,
  organization: Target,
  cleanup: AlertTriangle,
  finding: CheckCircle,
  recommendation: TrendingUp,
  warning: AlertTriangle,
  optimization: BrainCircuit,
};

watch(
  () => props.analysisData,
  (newData) => {
    if (newData) {
      performAIAnalysis();
    }
  },
  { immediate: true }
);

const performAIAnalysis = async () => {
  isAnalyzing.value = true;
  analysisProgress.value = 0;

  try {
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      analysisProgress.value = Math.min(analysisProgress.value + 10, 90);
    }, 200);

    // Get AI insights
    const insightsText = await ollamaService.analyzeFileStructure(props.analysisData);
    const aiRecommendations = await ollamaService.generateRecommendations(props.analysisData);

    clearInterval(progressInterval);
    analysisProgress.value = 100;

    // Parse insights into structured format
    const parsedInsights = parseInsights(insightsText);
    insights.value = parsedInsights;
    recommendations.value = aiRecommendations;
    lastAnalysis.value = new Date();

    props.onRecommendationsUpdate?.(aiRecommendations);
    emit('recommendationsUpdate', aiRecommendations);

    setTimeout(() => {
      isAnalyzing.value = false;
      analysisProgress.value = 0;
    }, 1000);
  } catch (error) {
    console.error('AI Analysis failed:', error);
    isAnalyzing.value = false;
    analysisProgress.value = 0;
  }
};

const parseInsights = (insightsText: string): AIInsight[] => {
  const parsedInsights: AIInsight[] = [];

  // Parse the AI response into structured insights
  const lines = insightsText.split('\n').filter((line) => line.trim());

  lines.forEach((line, index) => {
    let type: AIInsight['type'] = 'finding';
    let impact: AIInsight['impact'] = 'medium';
    let category = 'storage';

    // Determine type and impact based on keywords
    if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('critical')) {
      type = 'warning';
      impact = 'high';
    } else if (
      line.toLowerCase().includes('recommend') ||
      line.toLowerCase().includes('suggest')
    ) {
      type = 'recommendation';
    } else if (
      line.toLowerCase().includes('optimize') ||
      line.toLowerCase().includes('improve')
    ) {
      type = 'optimization';
    }

    // Determine category
    if (line.toLowerCase().includes('performance') || line.toLowerCase().includes('speed')) {
      category = 'performance';
    } else if (
      line.toLowerCase().includes('organize') ||
      line.toLowerCase().includes('structure')
    ) {
      category = 'organization';
    } else if (line.toLowerCase().includes('cleanup') || line.toLowerCase().includes('delete')) {
      category = 'cleanup';
    }

    parsedInsights.push({
      type,
      title: `Insight ${index + 1}`,
      description: line.trim(),
      impact,
      category,
    });
  });

  return parsedInsights;
};

const filteredInsights = computed(() => {
  return selectedCategory.value === 'all'
    ? insights.value
    : insights.value.filter((insight) => insight.category === selectedCategory.value);
});

const getImpactStats = () => {
  const stats = {
    high: insights.value.filter((i) => i.impact === 'high').length,
    medium: insights.value.filter((i) => i.impact === 'medium').length,
    low: insights.value.filter((i) => i.impact === 'low').length,
  };
  return stats;
};

const exportAnalysis = () => {
  const report = {
    timestamp: new Date().toISOString(),
    analysisData: props.analysisData,
    insights: insights.value,
    recommendations: recommendations.value,
    summary: {
      totalInsights: insights.value.length,
      impactStats: getImpactStats(),
      categories: [...new Set(insights.value.map((i) => i.category))],
    },
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-analysis-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

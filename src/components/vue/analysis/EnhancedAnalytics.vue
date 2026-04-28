<template>
  <div ref="containerRef" :class="['enhanced-analytics space-y-6', isAnimating ? 'animate-pulse' : '']">
    <!-- Header -->
    <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Enhanced Analytics</h2>
          <p class="text-gray-600">
            Comprehensive MoE analysis insights and performance metrics
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            Live
          </span>
          <span class="text-sm text-gray-500">
            Last: {{ new Date(data.lastAnalysis).toLocaleTimeString() }}
          </span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="flex space-x-1 border-b border-gray-200">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="selectedTab = tab.id"
          :class="[
            'flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors',
            selectedTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="transition-all duration-300 ease-in-out">
      <div v-if="selectedTab === 'overview'" class="space-y-6">
        <!-- Key Metrics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-blue-100 rounded-lg">
                <Activity class="w-5 h-5 text-blue-600" />
              </div>
              <span class="text-2xl font-bold text-gray-900">{{ data.totalAnalyses }}</span>
            </div>
            <h3 class="text-sm font-medium text-gray-600">Total Analyses</h3>
            <p class="text-xs text-gray-500 mt-1">Across all pages and models</p>
          </div>

          <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-green-100 rounded-lg">
                <CheckCircle class="w-5 h-5 text-green-600" />
              </div>
              <span class="text-2xl font-bold text-green-600">{{ successRate.toFixed(1) }}%</span>
            </div>
            <h3 class="text-sm font-medium text-gray-600">Success Rate</h3>
            <p class="text-xs text-gray-500 mt-1">
              {{ data.successfulAnalyses }}/{{ data.totalAnalyses }} successful
            </p>
          </div>

          <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-purple-100 rounded-lg">
                <Clock class="w-5 h-5 text-purple-600" />
              </div>
              <span class="text-2xl font-bold text-gray-900">{{ avgResponseTimeSeconds }}s</span>
            </div>
            <h3 class="text-sm font-medium text-gray-600">Avg Response Time</h3>
            <p class="text-xs text-gray-500 mt-1">Per analysis</p>
          </div>

          <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="p-2 bg-orange-100 rounded-lg">
                <Zap class="w-5 h-5 text-orange-600" />
              </div>
              <span class="text-2xl font-bold text-gray-900">{{ data.modelsUsed.length }}</span>
            </div>
            <h3 class="text-sm font-medium text-gray-600">AI Models</h3>
            <p class="text-xs text-gray-500 mt-1">Active in analysis</p>
          </div>
        </div>

        <!-- Analysis Types Breakdown -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Analysis Types</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
              <Eye class="w-5 h-5 text-blue-600" />
              <div>
                <p class="font-medium text-blue-900">Vision Analysis</p>
                <p class="text-sm text-blue-700">{{ data.visionAnalyses }} analyses</p>
              </div>
            </div>
            <div class="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
              <Code class="w-5 h-5 text-green-600" />
              <div>
                <p class="font-medium text-green-900">Code Analysis</p>
                <p class="text-sm text-green-700">{{ data.codeAnalyses }} analyses</p>
              </div>
            </div>
            <div class="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
              <Layers class="w-5 h-5 text-purple-600" />
              <div>
                <p class="font-medium text-purple-900">Combined Analysis</p>
                <p class="text-sm text-purple-700">{{ data.combinedAnalyses }} analyses</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Pages Analyzed -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Pages Analyzed</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="page in data.pagesAnalyzed"
              :key="page"
              class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
            >
              {{ page }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="selectedTab === 'performance'" class="space-y-6">
        <!-- Performance Metrics -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p class="font-medium text-gray-900">Average Response Time</p>
                <p class="text-sm text-gray-600">Time per analysis</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-gray-900">{{ avgResponseTimeSeconds }}s</p>
                <p class="text-sm text-gray-600">Optimal: &lt;30s</p>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p class="font-medium text-gray-900">Success Rate</p>
                <p class="text-sm text-gray-600">Analysis completion rate</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-green-600">{{ successRate.toFixed(1) }}%</p>
                <p class="text-sm text-gray-600">Target: &gt;90%</p>
              </div>
            </div>

            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p class="font-medium text-gray-900">Total Execution Time</p>
                <p class="text-sm text-gray-600">Complete analysis cycle</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-gray-900">11.2m</p>
                <p class="text-sm text-gray-600">For 15 analyses</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Recommendations -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h3>
          <div class="space-y-3">
            <div class="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle class="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p class="font-medium text-yellow-900">Optimize Response Time</p>
                <p class="text-sm text-yellow-700">
                  Current average is {{ avgResponseTimeSeconds }}s - consider optimizing model selection
                </p>
              </div>
            </div>
            <div class="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle class="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p class="font-medium text-green-900">Good Success Rate</p>
                <p class="text-sm text-green-700">
                  {{ successRate.toFixed(1) }}% success rate is acceptable
                </p>
              </div>
            </div>
            <div class="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <Zap class="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p class="font-medium text-blue-900">Enable Parallel Processing</p>
                <p class="text-sm text-blue-700">
                  Run multiple models simultaneously to reduce total time
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedTab === 'models'" class="space-y-6">
        <!-- Model Performance -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">AI Model Performance</h3>
          <div class="space-y-4">
            <div
              v-for="model in data.modelsUsed"
              :key="model"
              class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <div
                  :class="['w-2 h-2 rounded-full', getModelInfo(model).success ? 'bg-green-500' : 'bg-red-500']"
                />
                <div>
                  <p class="font-medium text-gray-900">{{ model }}</p>
                  <p class="text-sm text-gray-600">{{ getModelInfo(model).type }} Analysis</p>
                </div>
              </div>
              <div class="text-right">
                <p
                  :class="['text-sm font-medium', getModelInfo(model).success ? 'text-green-600' : 'text-red-600']"
                >
                  {{ getModelInfo(model).success ? '✅ Working' : '⚠️ Issues' }}
                </p>
                <p class="text-xs text-gray-500">{{ getModelInfo(model).avgTime }}s avg</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Model Recommendations -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Model Optimization</h3>
          <div class="space-y-3">
            <div class="p-3 bg-red-50 rounded-lg">
              <p class="font-medium text-red-900 mb-1">Fix deepseek-coder:6.7b</p>
              <p class="text-sm text-red-700">
                Technical Architect model experiencing response format issues
              </p>
            </div>
            <div class="p-3 bg-blue-50 rounded-lg">
              <p class="font-medium text-blue-900 mb-1">Optimize codellama:7b-python</p>
              <p class="text-sm text-blue-700">Consider faster alternatives for code analysis</p>
            </div>
            <div class="p-3 bg-green-50 rounded-lg">
              <p class="font-medium text-green-900 mb-1">Excellent Vision Models</p>
              <p class="text-sm text-green-700">llava:7b and qwen2.5-coder performing well</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedTab === 'insights'" class="space-y-6">
        <!-- Key Insights -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">AI-Powered Insights</h3>
          <div class="space-y-4">
            <div class="p-4 bg-blue-50 rounded-lg">
              <h4 class="font-medium text-blue-900 mb-2">🎯 Priority 1: Visual Hierarchy</h4>
              <p class="text-sm text-blue-700">
                Enhanced typography, spacing, and layout structure implemented
              </p>
            </div>
            <div class="p-4 bg-green-50 rounded-lg">
              <h4 class="font-medium text-green-900 mb-2">🏗️ Priority 2: Code Architecture</h4>
              <p class="text-sm text-green-700">
                Modular component structure with performance optimizations
              </p>
            </div>
            <div class="p-4 bg-purple-50 rounded-lg">
              <h4 class="font-medium text-purple-900 mb-2">🔗 Priority 3: Integration</h4>
              <p class="text-sm text-purple-700">Unified design system with consistent styling</p>
            </div>
            <div class="p-4 bg-orange-50 rounded-lg">
              <h4 class="font-medium text-orange-900 mb-2">🎨 Priority 4: UX Enhancements</h4>
              <p class="text-sm text-orange-700">
                Accessibility improvements and interaction design
              </p>
            </div>
          </div>
        </div>

        <!-- Implementation Status -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Implementation Status</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <CheckCircle class="w-5 h-5 text-green-600" />
                <span class="font-medium text-green-900">Visual Improvements</span>
              </div>
              <span class="text-sm text-green-700">✅ Complete</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <CheckCircle class="w-5 h-5 text-green-600" />
                <span class="font-medium text-green-900">Performance Optimization</span>
              </div>
              <span class="text-sm text-green-700">✅ Complete</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div class="flex items-center space-x-3">
                <AlertTriangle class="w-5 h-5 text-yellow-600" />
                <span class="font-medium text-yellow-900">Model Fixes</span>
              </div>
              <span class="text-sm text-yellow-700">⚠️ In Progress</span>
            </div>
          </div>
        </div>

        <!-- Action Items -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Next Actions</h3>
          <div class="space-y-2">
            <button
              @click="onRunAnalysis"
              class="w-full p-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Run Enhanced Analysis
            </button>
            <button class="w-full p-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              View Detailed Report
            </button>
            <button class="w-full p-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              Export Analytics Data
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  Code,
  Eye,
  Layers,
} from 'lucide-vue-next';

interface AnalyticsData {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageResponseTime: number;
  visionAnalyses: number;
  codeAnalyses: number;
  combinedAnalyses: number;
  pagesAnalyzed: string[];
  modelsUsed: string[];
  lastAnalysis: string;
}

interface EnhancedAnalyticsProps {
  data?: AnalyticsData;
  onRunAnalysis?: () => void;
}

const props = withDefaults(defineProps<EnhancedAnalyticsProps>(), {
  data: () => ({
    totalAnalyses: 15,
    successfulAnalyses: 12,
    failedAnalyses: 3,
    averageResponseTime: 15243,
    visionAnalyses: 6,
    codeAnalyses: 6,
    combinedAnalyses: 3,
    pagesAnalyzed: ['Landing', 'Dashboard', 'Explorer'],
    modelsUsed: [
      'llava:7b',
      'deepseek-coder:6.7b',
      'codegemma:7b-instruct',
      'qwen2.5-coder:7b-instruct',
      'codellama:7b-python',
    ],
    lastAnalysis: new Date().toISOString(),
  }),
  onRunAnalysis: () => {},
});

const selectedTab = ref<'overview' | 'performance' | 'models' | 'insights'>('overview');
const isAnimating = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
  { id: 'models', label: 'Models', icon: Layers },
  { id: 'insights', label: 'Insights', icon: Target },
];

const successRate = computed(() => {
  return props.data.totalAnalyses > 0
    ? (props.data.successfulAnalyses / props.data.totalAnalyses) * 100
    : 0;
});

const avgResponseTimeSeconds = computed(() => {
  return (props.data.averageResponseTime / 1000).toFixed(1);
});

const getModelInfo = (model: string) => {
  const modelData: Record<string, { type: string; success: boolean; avgTime: number }> = {
    'llava:7b': { type: 'Vision', success: true, avgTime: 15.2 },
    'deepseek-coder:6.7b': { type: 'Code', success: false, avgTime: 0 },
    'codegemma:7b-instruct': { type: 'Combined', success: true, avgTime: 15.3 },
    'qwen2.5-coder:7b-instruct': { type: 'Vision', success: true, avgTime: 15.5 },
    'codellama:7b-python': { type: 'Code', success: true, avgTime: 31.4 },
  };

  return modelData[model] || { type: 'Unknown', success: false, avgTime: 0 };
};

// Animation on tab change
watch(selectedTab, () => {
  isAnimating.value = true;
  setTimeout(() => {
    isAnimating.value = false;
  }, 500);
});
</script>

<style scoped>
/* Additional styles if needed */
</style>

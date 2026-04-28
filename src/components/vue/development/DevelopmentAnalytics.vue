<template>
  <div class="development-analytics">
    <div v-if="isAnalyzing" class="development-analytics loading">
      <div class="loading-spinner">
        <Clock :size="24" class="animate-spin" />
        <p>Analyzing project structure...</p>
      </div>
    </div>

    <template v-else>
      <div class="analytics-header">
        <h2>Development Analytics</h2>
        <p>Comprehensive analysis of your project's code quality and performance</p>
      </div>

      <div class="tabs">
        <button
          :class="['tab', activeTab === 'duplication' ? 'active' : '']"
          @click="activeTab = 'duplication'"
        >
          <Code2 :size="16" />
          Code Duplication
        </button>
        <button
          :class="['tab', activeTab === 'performance' ? 'active' : '']"
          @click="activeTab = 'performance'"
        >
          <Zap :size="16" />
          Build Performance
        </button>
        <button
          :class="['tab', activeTab === 'dependencies' ? 'active' : '']"
          @click="activeTab = 'dependencies'"
        >
          <BarChart3 :size="16" />
          Dependencies
        </button>
      </div>

      <div class="tab-content">
        <Transition name="fade" mode="out-in">
          <div v-if="activeTab === 'duplication'" key="duplication">
            <div v-if="duplicationData" class="analytics-section">
              <div class="section-header">
                <h3>
                  <Code2 :size="20" />
                  Code Duplication Analysis
                </h3>
                <div class="metrics-summary">
                  <div class="metric">
                    <span class="metric-value">
                      {{ (duplicationData.overallDuplication || 0).toFixed(1) }}%
                    </span>
                    <span class="metric-label">Overall Duplication</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">{{ duplicationData.similarFiles?.length || 0 }}</span>
                    <span class="metric-label">Similar Files</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">{{ duplicationData.totalDuplicatedLines || 0 }}</span>
                    <span class="metric-label">Duplicated Lines</span>
                  </div>
                </div>
              </div>

              <div class="charts-grid">
                <div class="chart-container">
                  <h4>Similarity Distribution</h4>
                  <div class="pie-chart-placeholder">
                    <div class="pie-chart">
                      <div class="pie-segment" style="background: #10b981; width: 25%" />
                      <div class="pie-segment" style="background: #f59e0b; width: 25%" />
                      <div class="pie-segment" style="background: #ef4444; width: 25%" />
                      <div class="pie-segment" style="background: #dc2626; width: 25%" />
                    </div>
                    <div class="pie-legend">
                      <div class="legend-item">
                        <div class="legend-color" style="background: #10b981" />
                        <span>0-20%</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #f59e0b" />
                        <span>20-50%</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #ef4444" />
                        <span>50-80%</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #dc2626" />
                        <span>80-100%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="chart-container">
                  <h4>File Similarity Analysis</h4>
                  <div class="bar-chart-placeholder">
                    <div class="bar-chart">
                      <div
                        v-for="i in 5"
                        :key="i"
                        class="bar-group"
                      >
                        <div class="bar" style="background: #3b82f6; height: 60%" />
                        <div class="bar" style="background: #10b981; height: 40%" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="duplicationData.recommendations?.length > 0" class="recommendations">
                <h4>
                  <Target :size="16" />
                  Optimization Recommendations
                </h4>
                <ul>
                  <li v-for="(rec, index) in duplicationData.recommendations" :key="index">
                    {{ rec }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'performance'" key="performance">
            <div v-if="performanceData" class="analytics-section">
              <div class="section-header">
                <h3>
                  <Zap :size="20" />
                  Build Performance Analysis
                </h3>
                <div class="metrics-summary">
                  <div class="metric">
                    <span class="metric-value">
                      {{ ((performanceData.averageBuildTime || 0) / 1000).toFixed(1) }}s
                    </span>
                    <span class="metric-label">Avg Build Time</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">
                      {{ ((performanceData.averageBundleSize || 0) / (1024 * 1024)).toFixed(1) }}MB
                    </span>
                    <span class="metric-label">Avg Bundle Size</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">{{ performanceData.optimizationScore || 0 }}%</span>
                    <span class="metric-label">Optimization Score</span>
                  </div>
                </div>
              </div>

              <div class="charts-grid">
                <div class="chart-container">
                  <h4>Build Performance Trends</h4>
                  <div class="line-chart-placeholder">
                    <svg viewBox="0 0 300 150" class="line-chart">
                      <polyline
                        points="0,100 50,80 100,60 150,70 200,40 250,50 300,30"
                        fill="none"
                        stroke="#3b82f6"
                        stroke-width="2"
                      />
                      <polyline
                        points="0,120 50,100 100,90 150,80 200,70 250,60 300,50"
                        fill="none"
                        stroke="#10b981"
                        stroke-width="2"
                      />
                    </svg>
                  </div>
                </div>

                <div class="chart-container">
                  <h4>Current Performance Metrics</h4>
                  <div class="metrics-list">
                    <div class="metric-item">
                      <div class="metric-info">
                        <span class="metric-name">Build Time</span>
                        <span class="metric-value">45.2s</span>
                      </div>
                      <div class="metric-bar" style="width: 45%; background: #3b82f6" />
                    </div>
                    <div class="metric-item">
                      <div class="metric-info">
                        <span class="metric-name">Bundle Size</span>
                        <span class="metric-value">2.3MB</span>
                      </div>
                      <div class="metric-bar" style="width: 65%; background: #10b981" />
                    </div>
                    <div class="metric-item">
                      <div class="metric-info">
                        <span class="metric-name">Optimization</span>
                        <span class="metric-value">78%</span>
                      </div>
                      <div class="metric-bar" style="width: 78%; background: #f59e0b" />
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="performanceData.recommendations?.length > 0" class="recommendations">
                <h4>
                  <TrendingUp :size="16" />
                  Performance Improvements
                </h4>
                <ul>
                  <li v-for="(rec, index) in performanceData.recommendations" :key="index">
                    {{ rec }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'dependencies'" key="dependencies">
            <div v-if="dependencyData" class="analytics-section">
              <div class="section-header">
                <h3>
                  <BarChart3 :size="20" />
                  Dependency Analysis
                </h3>
                <div class="metrics-summary">
                  <div class="metric">
                    <span class="metric-value">{{ dependencyData.totalDependencies || 0 }}</span>
                    <span class="metric-label">Total Dependencies</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">{{ dependencyData.unusedDependencies?.length || 0 }}</span>
                    <span class="metric-label">Unused</span>
                  </div>
                  <div class="metric">
                    <span class="metric-value">
                      {{ dependencyData.outdatedDependencies?.length || 0 }}
                    </span>
                    <span class="metric-label">Outdated</span>
                  </div>
                </div>
              </div>

              <div class="charts-grid">
                <div class="chart-container">
                  <h4>Dependency Distribution</h4>
                  <div class="pie-chart-placeholder">
                    <div class="pie-chart">
                      <div class="pie-segment" style="background: #3b82f6; width: 40%" />
                      <div class="pie-segment" style="background: #10b981; width: 30%" />
                      <div class="pie-segment" style="background: #ef4444; width: 15%" />
                      <div class="pie-segment" style="background: #f59e0b; width: 15%" />
                    </div>
                    <div class="pie-legend">
                      <div class="legend-item">
                        <div class="legend-color" style="background: #3b82f6" />
                        <span>Production</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #10b981" />
                        <span>Development</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #ef4444" />
                        <span>Unused</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-color" style="background: #f59e0b" />
                        <span>Outdated</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="chart-container">
                  <h4>Security Issues</h4>
                  <div class="security-issues">
                    <div class="no-issues">
                      <CheckCircle :size="16" />
                      <span>No security issues found</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="dependencyData.recommendations?.length > 0" class="recommendations">
                <h4>
                  <AlertTriangle :size="16" />
                  Dependency Optimization
                </h4>
                <ul>
                  <li v-for="(rec, index) in dependencyData.recommendations" :key="index">
                    {{ rec }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Code2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  BarChart3,
} from 'lucide-vue-next';

interface DevelopmentAnalyticsProps {
  projectPath: string;
}

const props = defineProps<DevelopmentAnalyticsProps>();

const activeTab = ref<'duplication' | 'performance' | 'dependencies'>('duplication');
const isAnalyzing = ref(false);

const duplicationData = ref<any>(null);
const performanceData = ref<any>(null);
const dependencyData = ref<any>(null);

onMounted(() => {
  const runAnalysis = async () => {
    isAnalyzing.value = true;
    try {
      // Placeholder for actual analysis
      await new Promise((resolve) => setTimeout(resolve, 1000));

      duplicationData.value = {
        overallDuplication: 12.5,
        similarFiles: [{ similarity: 0.85, lines: 150 }, { similarity: 0.72, lines: 200 }],
        totalDuplicatedLines: 350,
        duplicationRanges: { low: 5, medium: 3, high: 2, critical: 1 },
        recommendations: ['Extract common utility functions', 'Create shared components'],
      };

      performanceData.value = {
        averageBuildTime: 45000,
        averageBundleSize: 2400000,
        optimizationScore: 78,
        buildHistory: [{ buildTime: 45000, bundleSize: 2400000, optimizationScore: 78 }],
        recommendations: ['Enable code splitting', 'Optimize asset loading'],
      };

      dependencyData.value = {
        totalDependencies: 45,
        unusedDependencies: [],
        outdatedDependencies: [],
        productionDependencies: 30,
        devDependencies: 15,
        securityIssues: [],
        recommendations: ['Update outdated packages', 'Remove unused dependencies'],
      };
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      isAnalyzing.value = false;
    }
  };

  runAnalysis();
});
</script>

<style scoped>
.development-analytics {
  @apply bg-gray-900 rounded-lg p-6;
}

.loading {
  @apply flex items-center justify-center py-12;
}

.loading-spinner {
  @apply flex flex-col items-center gap-4;
}

.loading-spinner p {
  @apply text-gray-400;
}

.analytics-header {
  @apply mb-6;
}

.analytics-header h2 {
  @apply text-2xl font-bold text-white mb-2;
}

.analytics-header p {
  @apply text-gray-400;
}

.tabs {
  @apply flex gap-2 mb-6 border-b border-gray-700;
}

.tab {
  @apply flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors border-b-2 border-transparent;
}

.tab.active {
  @apply text-white border-blue-500;
}

.tab-content {
  @apply min-h-96;
}

.analytics-section {
  @apply space-y-6;
}

.section-header {
  @apply flex items-center justify-between pb-4 border-b border-gray-700;
}

.section-header h3 {
  @apply flex items-center gap-2 text-lg font-semibold text-white;
}

.metrics-summary {
  @apply flex gap-6;
}

.metric {
  @apply flex flex-col;
}

.metric-value {
  @apply text-xl font-bold text-white;
}

.metric-label {
  @apply text-xs text-gray-400;
}

.charts-grid {
  @apply grid grid-cols-1 lg:grid-cols-2 gap-6;
}

.chart-container {
  @apply bg-gray-800 rounded-lg p-4;
}

.chart-container h4 {
  @apply text-sm font-medium text-white mb-4;
}

.pie-chart-placeholder {
  @apply flex flex-col items-center;
}

.pie-chart {
  @apply w-48 h-48 rounded-full flex overflow-hidden;
}

.pie-segment {
  @apply h-full;
}

.pie-legend {
  @apply mt-4 space-y-2;
}

.legend-item {
  @apply flex items-center gap-2 text-sm text-gray-300;
}

.legend-color {
  @apply w-3 h-3 rounded;
}

.bar-chart-placeholder {
  @apply h-48 flex items-end justify-center gap-4;
}

.bar-chart {
  @apply flex items-end gap-2 h-full;
}

.bar-group {
  @apply flex items-end gap-1 h-full;
}

.bar {
  @apply w-6 rounded-t;
}

.line-chart-placeholder {
  @apply h-48 flex items-center justify-center;
}

.line-chart {
  @apply w-full h-full;
}

.metrics-list {
  @apply space-y-4;
}

.metric-item {
  @apply space-y-2;
}

.metric-info {
  @apply flex justify-between text-sm;
}

.metric-name {
  @apply text-gray-300;
}

.metric-bar {
  @apply h-2 rounded-full;
}

.security-issues {
  @apply space-y-2;
}

.security-issue {
  @apply flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-sm;
}

.no-issues {
  @apply flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded text-green-400;
}

.recommendations {
  @apply p-4 bg-gray-800 rounded-lg;
}

.recommendations h4 {
  @apply flex items-center gap-2 text-sm font-medium text-white mb-3;
}

.recommendations ul {
  @apply space-y-2 text-sm text-gray-300 list-disc list-inside;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

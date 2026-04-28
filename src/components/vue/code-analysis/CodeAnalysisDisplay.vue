<template>
  <div style="display: flex; flex-direction: column; gap: 1.5rem">
    <!-- Health Overview -->
    <div v-if="healthMetrics" class="health-metrics">
      <div class="health-metric-item">
        <div class="health-metric-label">Code Health Score</div>
        <div class="health-metric-value">
          <div class="health-score" :style="{ color: getHealthColor(healthMetrics.healthScore) }">
            {{ healthMetrics.healthScore }}%
          </div>
          <div class="health-issues">
            {{ healthMetrics.filesWithIssues }} of {{ healthMetrics.totalFiles }} files have issues
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats">
        <div class="quick-stat-item">
          <div class="quick-stat-label">Errors</div>
          <div class="quick-stat-value">
            {{ healthMetrics.issuesBySeverity.error || 0 }}
          </div>
        </div>
        <div class="quick-stat-item">
          <div class="quick-stat-label">Warnings</div>
          <div class="quick-stat-value">
            {{ healthMetrics.issuesBySeverity.warning || 0 }}
          </div>
        </div>
        <div class="quick-stat-item">
          <div class="quick-stat-label">Info</div>
          <div class="quick-stat-value">
            {{ healthMetrics.issuesBySeverity.info || 0 }}
          </div>
        </div>
        <div class="quick-stat-item">
          <div class="quick-stat-label">Total Issues</div>
          <div class="quick-stat-value">
            {{ healthMetrics.totalIssues }}
          </div>
        </div>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="category-tabs">
      <button
        v-for="category in ['overview', 'dependencies', 'unused', 'bugs']"
        :key="category"
        :class="['category-tab', selectedCategory === category ? 'active' : '']"
        @click="selectedCategory = category"
      >
        <TrendingUp v-if="category === 'overview'" :size="14" />
        <Package v-if="category === 'dependencies'" :size="14" />
        <Trash2 v-if="category === 'unused'" :size="14" />
        <Bug v-if="category === 'bugs'" :size="14" />
        {{ category.charAt(0).toUpperCase() + category.slice(1) }}
      </button>
    </div>

    <!-- Content Based on Selected Category -->
    <div class="content-container">
      <div v-if="selectedCategory === 'overview'" class="overview-tab">
        <p>Overview tab content - To be implemented</p>
      </div>

      <div v-if="selectedCategory === 'dependencies'" class="dependencies-tab">
        <p>Dependencies tab content - To be implemented</p>
      </div>

      <div v-if="selectedCategory === 'unused'" class="unused-code-tab">
        <p>Unused code tab content - To be implemented</p>
      </div>

      <div v-if="selectedCategory === 'bugs'" class="bugs-tab">
        <p>Bugs tab content - To be implemented</p>
      </div>
    </div>

    <!-- Recommendations -->
    <div
      v-if="healthMetrics?.recommendations && healthMetrics.recommendations.length > 0"
      class="recommendations"
    >
      <h4 class="recommendation-title">Recommendations</h4>
      <div class="recommendation-list">
        <div
          v-for="(rec, index) in healthMetrics.recommendations"
          :key="index"
          class="recommendation-item"
        >
          <div class="recommendation-header">
            <div class="recommendation-title">
              {{ rec }}
            </div>
          </div>
          <div class="recommendation-description">
            {{ rec }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  Code,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Package,
  Trash2,
  Bug,
  FileText,
  GitBranch,
  TrendingUp,
  Shield,
  Zap,
  Download,
  Eye,
  EyeOff,
} from "lucide-vue-next";

interface ProjectHealthMetrics {
  healthScore: number;
  filesWithIssues: number;
  totalFiles: number;
  issuesBySeverity: { error: number; warning: number; info: number };
  totalIssues: number;
  issuesByType: Record<string, number>;
  recommendations: string[];
}

interface DependencyHealthAnalysis {
  missingDependencies: Array<{ dependency: string; installCommand: string; files: string[] }>;
  unusedImports: Array<{ file: string; imports: string[]; linesToRemove: number[] }>;
  unusedVariables: Array<{ file: string; variables: Array<{ name: string; type: string }> }>;
  deadCode: Array<{
    file: string;
    functions: Array<{ name: string; line: number; reason: string }>;
    classes: Array<{ name: string; line: number; reason: string }>;
  }>;
  potentialBugs: Array<{
    file: string;
    issues: Array<{ type: string; line: number; description: string; suggestion: string }>;
  }>;
  undefinedVariables: Array<{
    file: string;
    variables: Array<{ name: string; line: number; usageCount: number }>;
  }>;
}

interface CodeIssue {
  type: string;
  line: number;
  description: string;
  suggestion: string;
}

interface CodeAnalysisDisplayProps {
  healthMetrics: ProjectHealthMetrics | null;
  dependencyAnalysis: DependencyHealthAnalysis | null;
  onFixIssue?: (issue: CodeIssue) => void;
  onInstallDependency?: (dependency: string, command: string) => void;
  loading?: boolean;
}

defineProps<CodeAnalysisDisplayProps>();

const selectedCategory = ref("overview");

const getHealthColor = (score: number): string => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#ef4444";
  return "#6b7280";
};
</script>

<style scoped>
.health-metrics {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-6;
}

.health-metric-item {
  @apply mb-4;
}

.health-metric-label {
  @apply text-sm text-gray-400 mb-2;
}

.health-metric-value {
  @apply flex items-center gap-4;
}

.health-score {
  @apply text-3xl font-bold;
}

.health-issues {
  @apply text-sm text-gray-400;
}

.quick-stats {
  @apply grid grid-cols-4 gap-4;
}

.quick-stat-item {
  @apply bg-slate-700/50 rounded-lg p-3 text-center;
}

.quick-stat-label {
  @apply text-xs text-gray-400 mb-1;
}

.quick-stat-value {
  @apply text-xl font-bold text-white;
}

.category-tabs {
  @apply flex gap-2;
}

.category-tab {
  @apply flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors;
}

.category-tab.active {
  @apply bg-blue-600 text-white;
}

.content-container {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-6;
}

.recommendations {
  @apply bg-slate-800/50 border border-slate-700 rounded-lg p-6;
}

.recommendation-title {
  @apply text-lg font-semibold text-white mb-4;
}

.recommendation-list {
  @apply space-y-3;
}

.recommendation-item {
  @apply bg-slate-700/50 rounded-lg p-4;
}

.recommendation-header {
  @apply mb-2;
}

.recommendation-description {
  @apply text-sm text-gray-400;
}
</style>

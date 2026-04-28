<template>
  <div class="actionable-prediction-container">
    <!-- Dependency Analysis Modal -->
    <div v-if="showDependencyAnalysis && dependencyAnalysis" class="actionable-modal-overlay">
      <div class="actionable-modal">
        <div class="actionable-modal-header">
          <h2 class="actionable-modal-title">Dependency Impact Analysis</h2>
          <button
            @click="showDependencyAnalysis = false"
            class="actionable-close-btn"
            aria-label="Close dependency analysis"
          >
            <X :size="20" />
          </button>
        </div>
        <DependencyImpactAnalyzer
          :analysis="dependencyAnalysis"
          :loading="analyzingDependencies"
          @execute-action="executeActionWithConfirmation"
        />
      </div>
    </div>

    <div v-if="!insights || insights.length === 0" class="no-insights">
      <BrainCircuit :size="48" class="actionable-no-insights-icon" />
      <h3 class="actionable-no-insights-text">No Actionable Insights Available</h3>
      <p class="actionable-no-insights-text">
        Run more analyses to generate actionable predictions
      </p>
    </div>

    <template v-else>
      <div
        v-for="(insight, index) in insights"
        :key="index"
        class="glass-panel actionable-category-panel"
      >
        <!-- Header -->
        <div class="actionable-category-header">
          <div class="actionable-category-icon">
            <component :is="getCategoryIcon(extractCategoryFromReasoning(insight.reasoning))" :size="16" />
          </div>
          <h4 class="actionable-category-title">
            {{ extractCategoryFromReasoning(insight.reasoning).charAt(0).toUpperCase() + extractCategoryFromReasoning(insight.reasoning).slice(1) }} Category
          </h4>
          <div class="actionable-category-stats">
            <div class="actionable-stat-item">
              <span class="actionable-stat-label">Files</span>
              <span class="actionable-stat-value">{{ getFilesByCategory(extractCategoryFromReasoning(insight.reasoning)).length }}</span>
            </div>
            <div class="actionable-stat-item">
              <span class="actionable-stat-label">Total Size</span>
              <span class="actionable-stat-value">
                {{ (getFilesByCategory(extractCategoryFromReasoning(insight.reasoning)).reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1) }}MB
              </span>
            </div>
            <div class="actionable-stat-item">
              <span class="actionable-stat-label">Large Files</span>
              <span class="actionable-stat-value">{{ getHighImpactFiles(extractCategoryFromReasoning(insight.reasoning)).length }}</span>
            </div>
          </div>
        </div>

        <!-- Primary Driver -->
        <div class="actionable-primary-driver">
          <h5 class="actionable-primary-driver-title">Primary Driver</h5>
          <div class="actionable-primary-driver-content">
            <AlertTriangle :size="14" class="actionable-primary-driver-icon" />
            {{ insight.reasoning.primaryFactor }}
          </div>
        </div>

        <!-- Actionable Items -->
        <div class="actionable-actions">
          <h5 class="actionable-actions-title">Recommended Actions</h5>
          <div class="actionable-actions-list">
            <div
              v-for="(action, actionIndex) in getRecommendedActions(insight, extractCategoryFromReasoning(insight.reasoning))"
              :key="actionIndex"
              class="actionable-action-item"
            >
              <div class="actionable-action-icon">
                <component :is="getActionIcon(action.type)" :size="16" />
              </div>
              <div class="actionable-action-content">
                <h6 class="actionable-action-title">{{ action.label }}</h6>
                <p class="actionable-action-description">{{ action.description }}</p>
              </div>
              <div class="actionable-action-priority">
                <span :class="`actionable-priority-${action.priority}`">
                  {{ action.priority }}
                </span>
                <button
                  @click="executeAction(action.type, extractCategoryFromReasoning(insight.reasoning), insight)"
                  :disabled="selectedAction === `${action.type}-${extractCategoryFromReasoning(insight.reasoning)}` || analyzingDependencies"
                  class="actionable-execute-btn"
                  :style="{
                    background: selectedAction === `${action.type}-${extractCategoryFromReasoning(insight.reasoning)}` ? '#6b7280' : '#3b82f6',
                    cursor: selectedAction === `${action.type}-${extractCategoryFromReasoning(insight.reasoning)}` || analyzingDependencies ? 'not-allowed' : 'pointer'
                  }"
                >
                  <template v-if="selectedAction === `${action.type}-${extractCategoryFromReasoning(insight.reasoning)}`">
                    <div class="spinner" />
                    {{ actionProgress[`${action.type}-${extractCategoryFromReasoning(insight.reasoning)}`] || 0 }}%
                  </template>
                  <template v-else-if="analyzingDependencies">
                    <GitBranch :size="14" />
                    Analyzing Dependencies...
                  </template>
                  <template v-else>
                    <component :is="getActionIcon(action.type)" :size="16" />
                    Execute
                    <Shield v-if="['delete', 'move', 'archive'].includes(action.type)" :size="12" style="margin-left: 0.25rem" />
                  </template>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- High Impact Files Preview -->
        <div v-if="getHighImpactFiles(extractCategoryFromReasoning(insight.reasoning)).length > 0">
          <h5 class="high-impact-title">
            High Impact Files (Top {{ getHighImpactFiles(extractCategoryFromReasoning(insight.reasoning)).length }})
          </h5>
          <div class="high-impact-files">
            <div
              v-for="(file, fileIndex) in getHighImpactFiles(extractCategoryFromReasoning(insight.reasoning)).slice(0, 5)"
              :key="fileIndex"
              class="high-impact-file"
            >
              <component :is="getCategoryIcon(file.category || 'unknown')" :size="16" />
              <span class="file-name">{{ file.path?.split(/[/\\]/).pop() || file.name }}</span>
              <span class="file-size">{{ (file.size / (1024 * 1024)).toFixed(1) }}MB</span>
            </div>
            <div v-if="getHighImpactFiles(extractCategoryFromReasoning(insight.reasoning)).length > 5" class="more-files">
              ... and {{ getHighImpactFiles(extractCategoryFromReasoning(insight.reasoning)).length - 5 }} more files
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  AlertTriangle,
  GitBranch,
  AlertCircle,
  TrendingUp,
  Clock,
  Calendar,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Archive,
  Trash2,
  FolderOpen,
  BrainCircuit,
  Download,
  Move,
  FileText,
  Image,
  Video,
  Music,
  Code,
  HardDrive,
  Shield,
} from 'lucide-vue-next';
import DependencyImpactAnalyzer from './DependencyImpactAnalyzer.vue';

interface PredictiveInsight {
  type: string;
  reasoning: {
    primaryFactor: string;
    contributingFactors: string[];
    trendAnalysis?: {
      direction: string;
    };
  };
}

interface ActionablePredictionProps {
  insights: PredictiveInsight[];
  onAction: (action: string, target: string, files?: any[]) => void;
  files: any[];
  categories: { [key: string]: any };
}

const props = defineProps<ActionablePredictionProps>();

const selectedAction = ref<string | null>(null);
const actionProgress = ref<{ [key: string]: number }>({});
const dependencyAnalysis = ref<any>(null);
const analyzingDependencies = ref(false);
const showDependencyAnalysis = ref(false);

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'documents':
      return FileText;
    case 'images':
      return Image;
    case 'videos':
      return Video;
    case 'audio':
      return Music;
    case 'code':
      return Code;
    case 'executables':
      return HardDrive;
    default:
      return FileText;
  }
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'cleanup':
      return Trash2;
    case 'organize':
      return FolderOpen;
    case 'archive':
      return Archive;
    case 'move':
      return Move;
    case 'analyze':
      return BrainCircuit;
    default:
      return Target;
  }
};

const extractCategoryFromReasoning = (reasoning: any): string => {
  const primaryFactor = reasoning.primaryFactor.toLowerCase();
  const categories = [
    'documents',
    'images',
    'videos',
    'audio',
    'code',
    'executables',
    'system',
    'temp',
    'archives',
  ];

  for (const category of categories) {
    if (primaryFactor.includes(category)) {
      return category;
    }
  }

  for (const factor of reasoning.contributingFactors) {
    const factorLower = factor.toLowerCase();
    for (const category of categories) {
      if (factorLower.includes(category)) {
        return category;
      }
    }
  }

  return 'unknown';
};

const getFilesByCategory = (category: string) => {
  return props.files.filter(
    (file) =>
      file.category?.toLowerCase() === category.toLowerCase() ||
      file.path?.toLowerCase().includes(category.toLowerCase())
  );
};

const getHighImpactFiles = (category: string, limit = 10) => {
  const categoryFiles = getFilesByCategory(category);
  return categoryFiles.sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, limit);
};

const executeAction = async (action: string, target: string, insight: PredictiveInsight) => {
  selectedAction.value = `${action}-${target}`;
  actionProgress.value = { ...actionProgress.value, [`${action}-${target}`]: 0 };

  try {
    if (['delete', 'move', 'archive'].includes(action)) {
      await analyzeDependencies(action, target, insight);
    }

    if (
      dependencyAnalysis.value &&
      (dependencyAnalysis.value.overallRisk === 'critical' || dependencyAnalysis.value.overallRisk === 'high')
    ) {
      showDependencyAnalysis.value = true;
      return;
    }

    switch (action) {
      case 'cleanup':
        await executeCleanup(target, insight);
        break;
      case 'organize':
        await executeOrganization(target, insight);
        break;
      case 'archive':
        await executeArchive(target, insight);
        break;
      case 'analyze':
        await executeAnalysis(target, insight);
        break;
      default:
        console.log(`Unknown action: ${action} on ${target}`);
    }

    props.onAction(action, target, getFilesByCategory(target));
  } catch (error) {
    console.error(`Failed to execute ${action} on ${target}:`, error);
  } finally {
    selectedAction.value = null;
    actionProgress.value = { ...actionProgress.value, [`${action}-${target}`]: 100 };
  }
};

const analyzeDependencies = async (action: string, target: string, insight: PredictiveInsight) => {
  analyzingDependencies.value = true;

  try {
    // Placeholder for dependency analysis
    console.log('Analyzing dependencies for', action, target);
  } catch (error) {
    console.error('Failed to analyze dependencies:', error);
  } finally {
    analyzingDependencies.value = false;
  }
};

const executeActionWithConfirmation = async (action: string, alternative?: string) => {
  const actualAction = alternative || action;

  switch (actualAction) {
    case 'cleanup':
      await executeCleanup(dependencyAnalysis.value?.targetFiles[0]?.split('/')[0] || '', {} as any);
      break;
    case 'organize':
      await executeOrganization(dependencyAnalysis.value?.targetFiles[0]?.split('/')[0] || '', {} as any);
      break;
    case 'archive':
      await executeArchive(dependencyAnalysis.value?.targetFiles[0]?.split('/')[0] || '', {} as any);
      break;
    case 'move':
      await executeMove(dependencyAnalysis.value?.targetFiles[0]?.split('/')[0] || '', {} as any);
      break;
    default:
      console.log(`Executing alternative action: ${actualAction}`);
  }

  showDependencyAnalysis.value = false;
  dependencyAnalysis.value = null;
};

const executeCleanup = async (target: string, insight: PredictiveInsight) => {
  const targetFiles = getFilesByCategory(target);

  for (let i = 0; i <= 100; i += 10) {
    actionProgress.value = { ...actionProgress.value, [`cleanup-${target}`]: i };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`Cleaned up ${targetFiles.length} files from ${target} category`);
};

const executeOrganization = async (target: string, insight: PredictiveInsight) => {
  const targetFiles = getFilesByCategory(target);

  for (let i = 0; i <= 100; i += 20) {
    actionProgress.value = { ...actionProgress.value, [`organize-${target}`]: i };
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(`Organized ${targetFiles.length} files in ${target} category`);
};

const executeArchive = async (target: string, insight: PredictiveInsight) => {
  const targetFiles = getHighImpactFiles(target);

  for (let i = 0; i <= 100; i += 25) {
    actionProgress.value = { ...actionProgress.value, [`archive-${target}`]: i };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`Archived ${targetFiles.length} large files from ${target} category`);
};

const executeAnalysis = async (target: string, insight: PredictiveInsight) => {
  for (let i = 0; i <= 100; i += 10) {
    actionProgress.value = { ...actionProgress.value, [`analyze-${target}`]: i };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`Analyzed ${target} category for detailed insights`);
};

const executeMove = async (target: string, insight: PredictiveInsight) => {
  const targetFiles = getFilesByCategory(target);

  for (let i = 0; i <= 100; i += 20) {
    actionProgress.value = { ...actionProgress.value, [`move-${target}`]: i };
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log(`Moved ${targetFiles.length} files from ${target} category`);
};

const getRecommendedActions = (insight: PredictiveInsight, category: string) => {
  const actions: {
    type: string;
    label: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }[] = [];

  switch (insight.type) {
    case 'growth':
      if (insight.reasoning.trendAnalysis?.direction === 'increasing') {
        actions.push({
          type: 'cleanup',
          label: 'Smart Cleanup',
          description: `Remove unnecessary ${category} files to slow growth`,
          priority: 'high',
        });
        actions.push({
          type: 'archive',
          label: 'Archive Large Files',
          description: `Move large ${category} files to archive storage`,
          priority: 'medium',
        });
      }
      break;

    case 'cleanup':
      actions.push({
        type: 'cleanup',
        label: 'Quick Cleanup',
        description: `Remove temp and unnecessary ${category} files`,
        priority: 'high',
      });
      break;

    case 'organization':
      actions.push({
        type: 'organize',
        label: 'Auto-Organize',
        description: `Create subfolders and organize ${category} files`,
        priority: 'medium',
      });
      break;

    case 'security':
      actions.push({
        type: 'analyze',
        label: 'Security Scan',
        description: `Analyze ${category} files for security risks`,
        priority: 'high',
      });
      break;
  }

  return actions;
};
</script>

<style scoped>
.actionable-prediction-container {
  @apply space-y-4;
}

.no-insights {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.actionable-no-insights-icon {
  @apply text-gray-400 mb-4;
}

.actionable-no-insights-text {
  @apply text-gray-400;
}

.actionable-modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
}

.actionable-modal {
  @apply bg-gray-800 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto;
}

.actionable-modal-header {
  @apply flex items-center justify-between p-4 border-b border-gray-700;
}

.actionable-modal-title {
  @apply text-lg font-semibold text-white;
}

.actionable-close-btn {
  @apply text-gray-400 hover:text-white transition-colors;
}

.glass-panel {
  @apply bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4;
}

.actionable-category-panel {
  @apply space-y-4;
}

.actionable-category-header {
  @apply flex items-center gap-3 pb-4 border-b border-gray-700;
}

.actionable-category-icon {
  @apply text-blue-400;
}

.actionable-category-title {
  @apply text-base font-semibold text-white;
}

.actionable-category-stats {
  @apply flex gap-4 ml-auto;
}

.actionable-stat-item {
  @apply flex flex-col;
}

.actionable-stat-label {
  @apply text-xs text-gray-400;
}

.actionable-stat-value {
  @apply text-sm font-medium text-white;
}

.actionable-primary-driver {
  @apply p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg;
}

.actionable-primary-driver-title {
  @apply text-xs font-medium text-yellow-400 mb-1;
}

.actionable-primary-driver-content {
  @apply flex items-center gap-2 text-sm text-white;
}

.actionable-primary-driver-icon {
  @apply text-yellow-400;
}

.actionable-actions {
  @apply space-y-3;
}

.actionable-actions-title {
  @apply text-sm font-medium text-white mb-2;
}

.actionable-actions-list {
  @apply space-y-2;
}

.actionable-action-item {
  @apply flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg;
}

.actionable-action-icon {
  @apply text-gray-400;
}

.actionable-action-content {
  @apply flex-1;
}

.actionable-action-title {
  @apply text-sm font-medium text-white;
}

.actionable-action-description {
  @apply text-xs text-gray-400;
}

.actionable-action-priority {
  @apply flex items-center gap-2;
}

.actionable-priority-high {
  @apply px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium;
}

.actionable-priority-medium {
  @apply px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium;
}

.actionable-priority-low {
  @apply px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium;
}

.actionable-execute-btn {
  @apply px-4 py-2 text-white rounded-lg font-bold flex items-center gap-2 text-sm;
}

.spinner {
  @apply w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin;
}

.high-impact-title {
  @apply text-sm font-medium text-white mb-2;
}

.high-impact-files {
  @apply grid gap-2 max-h-48 overflow-y-auto;
}

.high-impact-file {
  @apply flex items-center gap-2 p-2 bg-gray-700/30 rounded text-sm;
}

.file-name {
  @apply flex-1 text-white;
}

.file-size {
  @apply text-gray-400;
}

.more-files {
  @apply text-center text-gray-400 text-xs py-2;
}
</style>

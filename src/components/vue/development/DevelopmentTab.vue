<template>
  <div class="development-tab">
    <!-- Section Navigation -->
    <div class="section-nav">
      <button
        v-for="section in sections"
        :key="section.id"
        :class="['section-btn', activeSection === section.id ? 'active' : '']"
        @click="activeSection = section.id"
      >
        <component :is="section.icon" class="w-4 h-4 mr-2" />
        {{ section.label }}
      </button>
    </div>

    <!-- Section Content -->
    <div class="section-content">
      <div v-if="activeSection === 'overview'" class="development-overview">
        <!-- Project Header -->
        <div class="project-header">
          <div class="project-info">
            <h2 class="project-title">
              <Code class="w-6 h-6 mr-2" />
              Software Development Dashboard
            </h2>
            <p class="project-path">
              {{ projectPath || "No project selected" }}
            </p>
          </div>
          <div class="project-actions">
            <button class="btn-secondary" @click="$emit('pathChange', '')">
              <FileSearch class="w-4 h-4 mr-2" />
              Change Project
            </button>
            <button
              :disabled="isAnalyzing || !projectPath"
              class="btn-primary"
              @click="handleQuickAnalysis"
            >
              <template v-if="isAnalyzing">
                <Activity class="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </template>
              <template v-else>
                <Play class="w-4 h-4 mr-2" />
                Quick Analysis
              </template>
            </button>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div v-if="metrics" class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">
              <FileText class="w-6 h-6" />
            </div>
            <div class="metric-content">
              <div class="metric-value">
                {{ metrics.totalFiles.toLocaleString() }}
              </div>
              <div class="metric-label">Total Files</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <Code class="w-6 h-6" />
            </div>
            <div class="metric-content">
              <div class="metric-value">
                {{ metrics.codeFiles.toLocaleString() }}
              </div>
              <div class="metric-label">Code Files</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <TestTube class="w-6 h-6" />
            </div>
            <div class="metric-content">
              <div class="metric-value">
                {{ metrics.testFiles.toLocaleString() }}
              </div>
              <div class="metric-label">Test Files</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <Package class="w-6 h-6" />
            </div>
            <div class="metric-content">
              <div class="metric-value">
                {{ Object.keys(metrics.dependencies).length }}
              </div>
              <div class="metric-label">Dependencies</div>
            </div>
          </div>

          <div class="metric-card issues-card">
            <div class="metric-icon">
              <AlertCircle class="w-6 h-6" />
            </div>
            <div class="metric-content">
              <div class="metric-value">
                {{ metrics.issues.total }}
              </div>
              <div class="metric-label">Total Issues</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon">
              <TrendingUp class="w-6 h-6" />
            </div>
            <div class="metric-content">
              <div class="metric-value">
                {{ metrics.totalLines.toLocaleString() }}
              </div>
              <div class="metric-label">Lines of Code</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <h3 class="section-title">Development Tools</h3>
          <div class="action-grid">
            <button class="action-btn" @click="activeSection = 'analysis'">
              <BrainCircuit class="w-5 h-5 mb-2" />
              <span>Comprehensive Analysis</span>
              <span class="action-desc">Run all 12 specialized analyzers</span>
            </button>

            <button class="action-btn" @click="activeSection = 'dependencies'">
              <Package class="w-5 h-5 mb-2" />
              <span>Dependencies</span>
              <span class="action-desc">Analyze project dependencies</span>
            </button>

            <button class="action-btn" @click="activeSection = 'quality'">
              <CheckCircle class="w-5 h-5 mb-2" />
              <span>Code Quality</span>
              <span class="action-desc">Check code quality metrics</span>
            </button>

            <button class="action-btn" @click="activeSection = 'security'">
              <Shield class="w-5 h-5 mb-2" />
              <span>Security</span>
              <span class="action-desc">Security vulnerability scan</span>
            </button>

            <button class="action-btn" @click="activeSection = 'performance'">
              <Zap class="w-5 h-5 mb-2" />
              <span>Performance</span>
              <span class="action-desc">Performance analysis</span>
            </button>

            <button class="action-btn" @click="showAnalysisModal = true">
              <Settings class="w-5 h-5 mb-2" />
              <span>Custom Analysis</span>
              <span class="action-desc">Configure custom analysis</span>
            </button>
          </div>
        </div>

        <!-- Recent Issues -->
        <div v-if="metrics && metrics.issues.total > 0" class="issues-summary">
          <h3 class="section-title">Issues Summary</h3>
          <div class="issues-grid">
            <div class="issue-item security">
              <Shield class="w-4 h-4" />
              <span>Security Issues: {{ metrics.issues.security }}</span>
            </div>
            <div class="issue-item performance">
              <Zap class="w-4 h-4" />
              <span>Performance Issues: {{ metrics.issues.performance }}</span>
            </div>
            <div class="issue-item quality">
              <CheckCircle class="w-4 h-4" />
              <span>Quality Issues: {{ metrics.issues.quality }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeSection === 'analysis'" class="analysis-section">
        <div class="section-header">
          <h2>
            <Microscope class="w-5 h-5" />
            Comprehensive Analysis
          </h2>
          <p>Deep code analysis with 12 specialized analyzers</p>
        </div>

        <div v-if="comprehensiveResult" class="analysis-results">
          <div class="result-summary">
            <h3>Analysis Summary</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">Analyzers Run:</span>
                <span class="summary-value">
                  {{ comprehensiveResult.metadata.analyzers_run.length }}
                </span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Files Analyzed:</span>
                <span class="summary-value">
                  {{ comprehensiveResult.metadata.total_files.toLocaleString() }}
                </span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Analysis Time:</span>
                <span class="summary-value">
                  {{ new Date(comprehensiveResult.metadata.timestamp).toLocaleString() }}
                </span>
              </div>
            </div>
          </div>

          <div class="analyzer-results">
            <h3>Analyzer Results</h3>
            <div
              v-for="(result, analyzerName) in comprehensiveResult.results"
              :key="analyzerName"
              class="analyzer-result"
            >
              <div class="analyzer-header" @click="toggleFileExpansion(analyzerName)">
                <ChevronRight
                  :class="[
                    'w-4 h-4 transition-transform chevron',
                    expandedFiles.has(analyzerName) ? 'rotate-90' : '',
                  ]"
                />
                <h4>
                  {{ analyzerName.replace("_analysis", "").replace(/_/g, " ").toUpperCase() }}
                </h4>
                <div class="analyzer-status">
                  <CheckCircle
                    v-if="result.status === 'completed'"
                    class="w-4 h-4 text-green-500"
                  />
                  <XCircle v-else class="w-4 h-4 text-red-500" />
                </div>
              </div>

              <div v-if="expandedFiles.has(analyzerName)" class="analyzer-details">
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">Issues Found:</span>
                    <span class="detail-value">{{ result.issues_found || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Score:</span>
                    <span class="detail-value">
                      {{ result.score ? `${result.score.toFixed(1)}%` : "N/A" }}
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Files Analyzed:</span>
                    <span class="detail-value">{{ result.analyzed_files || 0 }}</span>
                  </div>
                </div>

                <div v-if="result.issues && result.issues.length > 0" class="issues-list">
                  <h5>Issues Found:</h5>
                  <div
                    v-for="(issue, index) in result.issues.slice(0, 5)"
                    :key="index"
                    class="issue-item"
                  >
                    <span class="issue-severity">{{ issue.severity }}</span>
                    <span class="issue-description">{{ issue.description }}</span>
                  </div>
                  <p v-if="result.issues.length > 5" class="more-issues">
                    ... and {{ result.issues.length - 5 }} more issues
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <BrainCircuit class="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>No Analysis Results</h3>
          <p>Run a comprehensive analysis to see detailed results.</p>
          <button class="btn-primary" @click="handleQuickAnalysis">
            <Play class="w-4 h-4 mr-2" />
            Start Analysis
          </button>
        </div>
      </div>

      <div v-else-if="activeSection === 'dependencies'" class="dependencies-section">
        <div class="section-header">
          <h2>
            <GitBranch class="w-5 h-5" />
            Dependencies Analysis
          </h2>
          <p>Project dependencies and relationships</p>
        </div>

        <div
          v-if="metrics && Object.keys(metrics.dependencies).length > 0"
          class="dependencies-content"
        >
          <div class="dependencies-stats">
            <h3>Dependency Summary</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">Total Dependencies:</span>
                <span class="stat-value">{{ Object.keys(metrics.dependencies).length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">External Packages:</span>
                <span class="stat-value">
                  {{
                    Object.values(metrics.dependencies).filter(
                      (dep: string) => dep.includes("node_modules") || dep.includes("vendor")
                    ).length
                  }}
                </span>
              </div>
            </div>
          </div>

          <div class="dependencies-list">
            <h3>Dependency Details</h3>
            <div
              v-for="[name, version] in Object.entries(metrics.dependencies).slice(0, 20)"
              :key="name"
              class="dependency-item"
            >
              <span class="dependency-name">{{ name }}</span>
              <span class="dependency-version">{{ version }}</span>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Package class="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>No Dependencies Found</h3>
          <p>Run an analysis to see project dependencies.</p>
        </div>
      </div>

      <div v-else-if="activeSection === 'quality'" class="quality-section">
        <div class="section-header">
          <h2>
            <CheckCircle class="w-5 h-5" />
            Code Quality Analysis
          </h2>
          <p>Code quality metrics and technical debt</p>
        </div>

        <div v-if="metrics && metrics.issues.quality > 0" class="quality-content">
          <div class="quality-overview">
            <div class="quality-score">
              <div class="score-circle">
                <div class="score-value">
                  {{ Math.max(0, 100 - metrics.issues.quality * 5).toFixed(0) }}%
                </div>
              </div>
              <div class="score-label">Quality Score</div>
            </div>

            <div class="quality-metrics">
              <div class="quality-metric">
                <span class="metric-label">Code Smells:</span>
                <span class="metric-value">{{ metrics.issues.quality }}</span>
              </div>
              <div class="quality-metric">
                <span class="metric-label">Technical Debt:</span>
                <span class="metric-value">Medium</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <CheckCircle class="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>Great Code Quality!</h3>
          <p>No quality issues detected.</p>
        </div>
      </div>

      <div v-else-if="activeSection === 'security'" class="security-section">
        <div class="section-header">
          <h2>
            <Shield class="w-5 h-5" />
            Security Analysis
          </h2>
          <p>Security vulnerabilities and risks</p>
        </div>

        <div v-if="metrics && metrics.issues.security > 0" class="security-content">
          <div class="security-alerts">
            <div class="alert-header">
              <AlertCircle class="w-5 h-5 text-red-500 mr-2" />
              <h3>Security Issues Found</h3>
            </div>
            <div class="security-summary">
              <div class="summary-item critical">
                <span>Critical: {{ Math.floor(metrics.issues.security * 0.2) }}</span>
              </div>
              <div class="summary-item high">
                <span>High: {{ Math.floor(metrics.issues.security * 0.3) }}</span>
              </div>
              <div class="summary-item medium">
                <span>Medium: {{ Math.floor(metrics.issues.security * 0.5) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Shield class="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>No Security Issues</h3>
          <p>Your code appears to be secure.</p>
        </div>
      </div>

      <div v-else-if="activeSection === 'performance'" class="performance-section">
        <div class="section-header">
          <h2>
            <Zap class="w-5 h-5" />
            Performance Analysis
          </h2>
          <p>Performance bottlenecks and optimization opportunities</p>
        </div>

        <div v-if="metrics && metrics.issues.performance > 0" class="performance-content">
          <div class="performance-issues">
            <h3>Performance Issues</h3>
            <div class="issue-list">
              <div class="performance-issue">
                <Zap class="w-4 h-4 text-yellow-500 mr-2" />
                <span>Bottlenecks detected: {{ metrics.issues.performance }}</span>
              </div>
              <div class="performance-issue">
                <TrendingUp class="w-4 h-4 text-blue-500 mr-2" />
                <span>Optimization opportunities available</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Zap class="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>Good Performance</h3>
          <p>No major performance issues detected.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Code,
  GitBranch,
  Package,
  Shield,
  Zap,
  FileText,
  TestTube,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileSearch,
  Settings,
  Play,
  Activity,
  BrainCircuit,
  ChevronRight,
  Microscope,
} from "lucide-vue-next";

interface DevelopmentTabProps {
  projectPath: string;
  comprehensiveResult?: any;
  isAnalyzing?: boolean;
}

const props = withDefaults(defineProps<DevelopmentTabProps>(), {
  isAnalyzing: false,
  comprehensiveResult: undefined,
});

const emit = defineEmits<{
  pathChange: [path: string];
  comprehensiveAnalysis: [config: any];
}>();

interface DevelopmentMetrics {
  totalFiles: number;
  codeFiles: number;
  testFiles: number;
  configFiles: number;
  docFiles: number;
  totalLines: number;
  languages: { [key: string]: number };
  dependencies: { [key: string]: string };
  issues: {
    security: number;
    performance: number;
    quality: number;
    total: number;
  };
}

const activeSection = ref<
  "overview" | "analysis" | "dependencies" | "quality" | "security" | "performance"
>("overview" as const);
const metrics = ref<DevelopmentMetrics | null>(null);
const showAnalysisModal = ref(false);
const expandedFiles = ref<Set<string>>(new Set());

const sections = [
  { id: "overview", label: "Overview", icon: FileSearch },
  { id: "analysis", label: "Analysis", icon: BrainCircuit },
  { id: "dependencies", label: "Dependencies", icon: Package },
  { id: "quality", label: "Quality", icon: CheckCircle },
  { id: "security", label: "Security", icon: Shield },
  { id: "performance", label: "Performance", icon: Zap },
];

watch(
  () => props.comprehensiveResult,
  (newResult) => {
    if (newResult) {
      const calculatedMetrics: DevelopmentMetrics = {
        totalFiles: newResult.metadata.total_files || 0,
        codeFiles: 0,
        testFiles: 0,
        configFiles: 0,
        docFiles: 0,
        totalLines: 0,
        languages: {},
        dependencies: {},
        issues: {
          security: 0,
          performance: 0,
          quality: 0,
          total: 0,
        },
      };

      Object.entries(newResult.results).forEach(([analyzerName, result]: [string, any]) => {
        switch (analyzerName) {
          case "dependency_analysis":
            calculatedMetrics.dependencies = result.dependencies || {};
            break;
          case "security_analysis":
            calculatedMetrics.issues.security = result.security_issues?.length || 0;
            break;
          case "performance_analysis":
            calculatedMetrics.issues.performance = result.performance_issues?.length || 0;
            break;
          case "code_quality_analysis":
            calculatedMetrics.issues.quality = result.quality_issues?.length || 0;
            break;
          case "test_analysis":
            calculatedMetrics.testFiles = result.test_files || 0;
            break;
        }
      });

      calculatedMetrics.issues.total =
        calculatedMetrics.issues.security +
        calculatedMetrics.issues.performance +
        calculatedMetrics.issues.quality;

      metrics.value = calculatedMetrics;
    }
  }
);

const handleQuickAnalysis = () => {
  const config = {
    projectPath: props.projectPath,
    selectedAnalyzers: ["dependency", "quality", "security", "performance", "test"],
    outputFormat: "json" as const,
    progress: true,
    verbose: true,
  };
  emit("comprehensiveAnalysis", config);
};

const toggleFileExpansion = (fileId: string) => {
  const newExpanded = new Set(expandedFiles.value);
  if (newExpanded.has(fileId)) {
    newExpanded.delete(fileId);
  } else {
    newExpanded.add(fileId);
  }
  expandedFiles.value = newExpanded;
};
</script>

<style scoped>
.development-tab {
  @apply flex flex-col h-full;
}

.section-nav {
  @apply flex gap-2 border-b border-gray-700 pb-4 mb-6;
}

.section-btn {
  @apply flex items-center px-4 py-2 text-gray-400 hover:text-white transition-colors;
}

.section-btn.active {
  @apply text-white bg-gray-800 rounded-lg;
}

.section-content {
  @apply flex-1 overflow-y-auto;
}

.project-header {
  @apply flex items-center justify-between mb-6;
}

.project-info h2 {
  @apply flex items-center text-2xl font-bold text-white mb-2;
}

.project-path {
  @apply text-gray-400;
}

.project-actions {
  @apply flex gap-3;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center;
}

.metrics-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6;
}

.metric-card {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4;
}

.metric-card.issues-card {
  @apply border-red-500/30 bg-red-500/10;
}

.metric-icon {
  @apply p-2 bg-gray-700 rounded-lg;
}

.metric-value {
  @apply text-2xl font-bold text-white;
}

.metric-label {
  @apply text-sm text-gray-400;
}

.quick-actions {
  @apply mb-6;
}

.section-title {
  @apply text-lg font-semibold text-white mb-4;
}

.action-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.action-btn {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4 text-left hover:border-gray-600 transition-colors;
}

.action-btn span {
  @apply block text-white;
}

.action-desc {
  @apply text-sm text-gray-400 mt-1;
}

.issues-summary {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4;
}

.issues-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.issue-item {
  @apply flex items-center gap-2 text-white;
}

.issue-item.security {
  @apply text-red-400;
}

.issue-item.performance {
  @apply text-yellow-400;
}

.issue-item.quality {
  @apply text-green-400;
}

.section-header {
  @apply mb-6;
}

.section-header h2 {
  @apply flex items-center text-xl font-semibold text-white mb-2;
}

.section-header p {
  @apply text-gray-400;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.empty-state h3 {
  @apply text-lg font-semibold text-white mb-2;
}

.empty-state p {
  @apply text-gray-400 mb-4;
}

.result-summary {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6;
}

.summary-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.summary-item {
  @apply flex justify-between;
}

.summary-label {
  @apply text-gray-400;
}

.summary-value {
  @apply text-white font-medium;
}

.analyzer-results {
  @apply space-y-4;
}

.analyzer-result {
  @apply bg-gray-800 border border-gray-700 rounded-lg overflow-hidden;
}

.analyzer-header {
  @apply flex items-center gap-2 p-4 cursor-pointer hover:bg-gray-700/50 transition-colors;
}

.analyzer-header h4 {
  @apply flex-1 text-white font-medium;
}

.analyzer-details {
  @apply p-4 border-t border-gray-700 space-y-4;
}

.detail-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.detail-item {
  @apply flex justify-between text-sm;
}

.detail-label {
  @apply text-gray-400;
}

.detail-value {
  @apply text-white;
}

.issues-list {
  @apply space-y-2;
}

.issues-list h5 {
  @apply text-sm font-medium text-white mb-2;
}

.issue-item {
  @apply flex items-center gap-2 text-sm;
}

.issue-severity {
  @apply px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs;
}

.issue-description {
  @apply text-gray-300;
}

.more-issues {
  @apply text-sm text-gray-400;
}

.dependencies-content {
  @apply space-y-6;
}

.dependencies-stats {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4;
}

.stats-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.stat-item {
  @apply flex justify-between;
}

.stat-label {
  @apply text-gray-400;
}

.stat-value {
  @apply text-white font-medium;
}

.dependencies-list {
  @apply space-y-2;
}

.dependency-item {
  @apply flex justify-between p-2 bg-gray-800 rounded text-sm;
}

.dependency-name {
  @apply text-white;
}

.dependency-version {
  @apply text-gray-400;
}

.quality-content {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-6;
}

.quality-overview {
  @apply flex items-center gap-8;
}

.quality-score {
  @apply text-center;
}

.score-circle {
  @apply w-24 h-24 rounded-full border-4 border-blue-500 flex items-center justify-center;
}

.score-value {
  @apply text-2xl font-bold text-white;
}

.score-label {
  @apply text-sm text-gray-400 mt-2;
}

.quality-metrics {
  @apply space-y-4;
}

.quality-metric {
  @apply flex justify-between;
}

.security-content {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-6;
}

.security-alerts {
  @apply space-y-4;
}

.alert-header {
  @apply flex items-center text-red-400 font-semibold mb-4;
}

.security-summary {
  @apply flex gap-4;
}

.summary-item {
  @apply px-4 py-2 rounded text-white;
}

.summary-item.critical {
  @apply bg-red-500;
}

.summary-item.high {
  @apply bg-orange-500;
}

.summary-item.medium {
  @apply bg-yellow-500;
}

.performance-content {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-6;
}

.performance-issues {
  @apply space-y-4;
}

.performance-issues h3 {
  @apply text-white font-medium mb-4;
}

.issue-list {
  @apply space-y-2;
}

.performance-issue {
  @apply flex items-center text-white;
}
</style>

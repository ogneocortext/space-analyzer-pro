<!--
  Analysis Progress Widget
  Displays analysis progress and current status
-->
<template>
  <div class="analysis-progress">
    <div class="progress-header">
      <h3 class="progress-title">Analysis Progress</h3>
      <div class="progress-status">
        <div :class="['status-indicator', status]">
          <component :is="getStatusIcon()" class="w-4 h-4" />
        </div>
        <span class="status-text">{{ getStatusText() }}</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar-container">
      <div class="progress-info">
        <span class="progress-percentage">{{ percentage }}%</span>
        <span class="progress-text">{{ currentStep }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${percentage}%` }"></div>
      </div>
    </div>

    <!-- Current Step Details -->
    <div v-if="currentStepDetails" class="step-details">
      <div class="step-header">
        <h4>{{ currentStep }}</h4>
        <div class="step-timer">
          <Clock class="w-4 h-4" />
          <span>{{ formatTime(stepTimer) }}</span>
        </div>
      </div>
      <div class="step-description">
        <p>{{ currentStepDetails.description }}</p>
        <div v-if="currentStepDetails.substeps" class="substeps">
          <div
            v-for="(substep, index) in currentStepDetails.substeps"
            :key="index"
            :class="['substep', { completed: substep.completed, active: substep.active }]"
          >
            <div class="substep-icon">
              <CheckCircle v-if="substep.completed" class="w-4 h-4 completed" />
              <Circle v-else-if="substep.active" class="w-4 h-4 active" />
              <Circle v-else class="w-4 h-4 pending" />
            </div>
            <span class="substep-name">{{ substep.name }}</span>
            <span v-if="substep.duration" class="substep-duration">
              {{ formatDuration(substep.duration) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Analyzer Progress -->
    <div v-if="analyzers.length > 0" class="analyzers-progress">
      <h4 class="section-title">Analyzers</h4>
      <div class="analyzers-grid">
        <div
          v-for="analyzer in analyzers"
          :key="analyzer.id"
          :class="['analyzer-item', analyzer.status]"
        >
          <div class="analyzer-icon">
            <component :is="getAnalyzerIcon(analyzer.id)" class="w-5 h-5" />
          </div>
          <div class="analyzer-content">
            <div class="analyzer-name">{{ analyzer.name }}</div>
            <div class="analyzer-status">
              <span :class="['status-text', analyzer.status]">
                {{ getAnalyzerStatusText(analyzer.status) }}
              </span>
              <span v-if="analyzer.progress" class="progress-text"> {{ analyzer.progress }}% </span>
            </div>
            <div v-if="analyzer.status === 'running'" class="analyzer-progress">
              <div class="mini-progress-bar">
                <div class="mini-progress-fill" :style="{ width: `${analyzer.progress}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div v-if="performance" class="performance-metrics">
      <h4 class="section-title">Performance</h4>
      <div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-icon">
            <Activity class="w-4 h-4" />
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ performance.filesPerSecond.toFixed(1) }}</div>
            <div class="metric-label">Files/sec</div>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-icon">
            <Cpu class="w-4 h-4" />
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ (performance.cpuUsage * 100).toFixed(1) }}%</div>
            <div class="metric-label">CPU</div>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-icon">
            <Database class="w-4 h-4" />
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ formatBytes(performance.memoryUsage) }}</div>
            <div class="metric-label">Memory</div>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-icon">
            <HardDrive class="w-4 h-4" />
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ formatBytes(performance.diskIO) }}</div>
            <div class="metric-label">Disk I/O</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estimated Time Remaining -->
    <div v-if="estimatedTimeRemaining" class="time-remaining">
      <div class="time-icon">
        <Clock class="w-5 h-5" />
      </div>
      <div class="time-content">
        <div class="time-label">Estimated time remaining</div>
        <div class="time-value">{{ formatDuration(estimatedTimeRemaining) }}</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="progress-actions">
      <button
        v-if="isRunning"
        @click="$emit('cancel-analysis')"
        class="action-btn cancel"
        aria-label="Cancel analysis"
      >
        <X class="w-4 h-4" />
        <span>Cancel</span>
      </button>

      <button
        v-if="isCompleted"
        @click="$emit('view-results')"
        class="action-btn primary"
        aria-label="View results"
      >
        <Eye class="w-4 h-4" />
        <span>View Results</span>
      </button>

      <button
        v-if="hasError"
        @click="$emit('retry-analysis')"
        class="action-btn secondary"
        aria-label="Retry analysis"
      >
        <RefreshCw class="w-4 h-4" />
        <span>Retry</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  CheckCircle,
  Circle,
  Clock,
  Activity,
  Cpu,
  Database,
  HardDrive,
  X,
  Eye,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle as CheckCircleIcon,
} from "lucide-vue-next";
import { analysisService } from "../../../services/AnalysisService";

interface AnalyzerProgress {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  duration?: number;
  startTime?: number;
}

interface StepDetails {
  name: string;
  description: string;
  substeps?: Array<{
    name: string;
    completed: boolean;
    active: boolean;
    duration?: number;
  }>;
}

interface PerformanceMetrics {
  filesPerSecond: number;
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
}

interface Props {
  isRunning?: boolean;
  isCompleted?: boolean;
  hasError?: boolean;
  percentage?: number;
  currentStep?: string;
  analyzers?: AnalyzerProgress[];
  performance?: PerformanceMetrics;
}

interface Emits {
  (e: "cancel-analysis"): void;
  (e: "view-results"): void;
  (e: "retry-analysis"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isRunning: false,
  isCompleted: false,
  hasError: false,
  percentage: 0,
  currentStep: "",
  analyzers: () => [],
});

const emit = defineEmits<Emits>();

// State
const currentStepDetails = ref<StepDetails | null>(null);
const stepTimer = ref(0);
const estimatedTimeRemaining = ref(0);

// Computed
const status = computed(() => {
  if (props.hasError) return "error";
  if (props.isCompleted) return "completed";
  if (props.isRunning) return "running";
  return "pending";
});

const getStatusIcon = () => {
  switch (status.value) {
    case "running":
      return Play;
    case "completed":
      return CheckCircleIcon;
    case "error":
      return AlertTriangle;
    case "cancelled":
      return X;
    default:
      return Circle;
  }
};

const getStatusText = () => {
  switch (status.value) {
    case "running":
      return "Analysis in progress";
    case "completed":
      return "Analysis completed";
    case "error":
      return "Analysis failed";
    case "cancelled":
      return "Analysis cancelled";
    default:
      return "Analysis pending";
  }
};

const getAnalyzerIcon = (analyzerId: string) => {
  const icons: Record<string, any> = {
    "code-structure": "Code",
    "security-scan": "Shield",
    "performance-audit": "Zap",
    "duplicate-finder": "Copy",
    "size-analyzer": "Database",
    "dependency-mapper": "GitBranch",
    "timestamp-analyzer": "Clock",
    "hard-link-analyzer": "Link",
  };
  return icons[analyzerId] || "Settings";
};

const getAnalyzerStatusText = (analyzerStatus: string) => {
  switch (analyzerStatus) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
};

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

const formatDuration = (ms: number): string => {
  return formatTime(ms);
};

const formatBytes = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Timer for step tracking
let timerInterval: number;

// Initialize step details based on current step
const updateStepDetails = () => {
  const stepDetails: Record<string, StepDetails> = {
    "Initializing...": {
      name: "Initializing Analysis",
      description: "Setting up analysis environment and preparing analyzers",
      substeps: [
        { name: "Loading configuration", completed: false, active: true },
        { name: "Initializing analyzers", completed: false, active: false },
        { name: "Preparing workspace", completed: false, active: false },
      ],
    },
    "Scanning files...": {
      name: "Scanning Files",
      description: "Discovering and cataloging files for analysis",
      substeps: [
        { name: "File system scan", completed: false, active: true },
        { name: "Building file tree", completed: false, active: false },
        { name: "Collecting metadata", completed: false, active: false },
      ],
    },
    "Running analyzers...": {
      name: "Running Analyzers",
      description: "Executing selected analyzers on discovered files",
      substeps: props.analyzers.map((analyzer) => ({
        name: analyzer.name,
        completed: analyzer.status === "completed",
        active: analyzer.status === "running",
        duration: analyzer.duration,
      })),
    },
    "Generating insights...": {
      name: "Generating Insights",
      description: "Analyzing results and generating insights and recommendations",
      substeps: [
        { name: "Processing results", completed: false, active: true },
        { name: "Generating insights", completed: false, active: false },
        { name: "Creating recommendations", completed: false, active: false },
      ],
    },
    "Finalizing...": {
      name: "Finalizing Analysis",
      description: "Finalizing results and preparing output",
      substeps: [
        { name: "Compiling report", completed: false, active: true },
        { name: "Saving results", completed: false, active: false },
        { name: "Cleaning up", completed: false, active: false },
      ],
    },
  };

  currentStepDetails.value = stepDetails[props.currentStep] || null;
};

// Estimate time remaining
const estimateTimeRemaining = () => {
  if (!props.isRunning || props.percentage === 0) {
    estimatedTimeRemaining.value = 0;
    return;
  }

  // Simple estimation based on current progress
  const elapsed = stepTimer.value;
  const estimatedTotal = (elapsed / props.percentage) * 100;
  estimatedTimeRemaining.value = estimatedTotal - elapsed;
};

// Watch for changes
watch(
  () => props.currentStep,
  () => {
    updateStepDetails();
    stepTimer.value = 0;
  }
);

watch(
  () => props.percentage,
  () => {
    estimateTimeRemaining();
  }
);

// Timer
onMounted(() => {
  timerInterval = window.setInterval(() => {
    if (props.isRunning) {
      stepTimer.value += 1000;
      estimateTimeRemaining();
    }
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});
</script>

<style scoped>
.analysis-progress {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.progress-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.progress-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.running {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  animation: pulse 2s infinite;
}

.status-indicator.completed {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-indicator.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.status-indicator.cancelled {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

.status-indicator.pending {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

.status-text {
  font-weight: 500;
  color: #e5e7eb;
}

.progress-bar-container {
  margin-bottom: 1.5rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-percentage {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
}

.progress-text {
  font-size: 0.875rem;
  color: #9ca3af;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #374151;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.step-details {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.step-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.step-timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.step-description {
  color: #e5e7eb;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.substeps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.substep {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: #1f2937;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.substep.completed {
  background: rgba(34, 197, 94, 0.1);
}

.substep.active {
  background: rgba(59, 130, 246, 0.1);
}

.substep-icon {
  flex-shrink: 0;
}

.substep-icon.completed {
  color: #22c55e;
}

.substep-icon.active {
  color: #3b82f6;
  animation: pulse 2s infinite;
}

.substep-icon.pending {
  color: #6b7280;
}

.substep-name {
  flex: 1;
  color: #e5e7eb;
}

.substep-duration {
  font-size: 0.75rem;
  color: #9ca3af;
}

.analyzers-progress {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 1rem 0;
}

.analyzers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.analyzer-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.analyzer-item.completed {
  background: rgba(34, 197, 94, 0.1);
  border-color: #22c55e;
}

.analyzer-item.failed {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

.analyzer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 0.375rem;
  color: #3b82f6;
  flex-shrink: 0;
}

.analyzer-item.completed .analyzer-icon {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.analyzer-item.failed .analyzer-icon {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.analyzer-content {
  flex: 1;
  min-width: 0;
}

.analyzer-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 0.25rem;
}

.analyzer-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.status-text.pending {
  color: #6b7280;
}

.status-text.running {
  color: #3b82f6;
}

.status-text.completed {
  color: #22c55e;
}

.status-text.failed {
  color: #ef4444;
}

.progress-text {
  color: #9ca3af;
}

.analyzer-progress {
  width: 100%;
  height: 4px;
  background: #374151;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.mini-progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.performance-metrics {
  margin-bottom: 1.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 0.375rem;
  color: #3b82f6;
  flex-shrink: 0;
}

.metric-content {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.metric-value {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: #9ca3af;
}

.time-remaining {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.time-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 0.5rem;
  color: #3b82f6;
}

.time-content {
  flex: 1;
}

.time-label {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-bottom: 0.25rem;
}

.time-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
}

.progress-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.cancel {
  background: #374151;
  color: #ef4444;
  border-color: #4b5563;
}

.action-btn.cancel:hover {
  background: #4b5563;
  color: #f87171;
}

.action-btn.primary {
  background: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
}

.action-btn.primary:hover {
  background: #2563eb;
  color: #ffffff;
}

.action-btn.secondary {
  background: #6b7280;
  color: #ffffff;
  border-color: #6b7280;
}

.action-btn.secondary:hover {
  background: #4b5563;
  color: #ffffff;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .progress-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .analyzers-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .time-remaining {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }

  .progress-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn {
    justify-content: center;
  }
}
</style>

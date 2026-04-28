<template>
  <div
    v-if="isRunning || progress > 0"
    :class="['bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4 sm:p-6 shadow-2xl', className]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-blue-500/20 rounded-lg">
          <Activity class="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-white">Analysis in Progress</h3>
          <p class="text-sm text-slate-400">
            {{ analysisId ? `ID: ${analysisId.slice(-8)}` : 'Processing directory' }}
          </p>
        </div>
      </div>

      <!-- Enhanced Control Buttons -->
      <div class="flex items-center space-x-2">
        <!-- Speed Control -->
        <div v-if="onSpeedChange" class="flex items-center space-x-1 bg-slate-700 rounded-lg p-1">
          <button
            v-for="speed in ['slow', 'normal', 'fast'] as const"
            :key="speed"
            @click="onSpeedChange(speed)"
            :class="[
              'px-2 py-1 text-xs rounded transition-colors',
              currentSpeed === speed
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-600'
            ]"
            :aria-label="`Set speed to ${speed}`"
          >
            {{ speed === 'slow' ? '🐢' : speed === 'normal' ? '🚶' : '🏃' }}
          </button>
        </div>

        <!-- Depth Control -->
        <div v-if="onDepthChange" class="flex items-center space-x-1 bg-slate-700 rounded-lg p-1">
          <button
            @click="onDepthChange(Math.max(1, currentDepth - 1))"
            class="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
            aria-label="Decrease depth"
          >
            -
          </button>
          <span class="px-2 py-1 text-xs text-slate-300">{{ currentDepth }}</span>
          <button
            @click="onDepthChange(Math.min(10, currentDepth + 1))"
            class="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
            aria-label="Increase depth"
          >
            +
          </button>
        </div>

        <button
          v-if="onPause && onResume"
          @click="togglePause"
          class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          :aria-label="isPaused ? 'Resume analysis' : 'Pause analysis'"
        >
          <Play v-if="isPaused" :size="16" />
          <Pause v-else :size="16" />
        </button>
        <button
          v-if="onCancel"
          @click="onCancel"
          class="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
          aria-label="Cancel analysis"
        >
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- Status and Current Stage -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span :class="['text-sm font-medium', getStatusColor()]">{{ getMeaningfulStatus() }}</span>
        <span class="text-sm text-slate-400">{{ progress }}% Complete</span>
      </div>

      <!-- Current File Information -->
      <div
        v-if="currentFile && currentFile !== 'Starting analysis...'"
        class="text-xs text-slate-500 mb-2 truncate"
      >
        Currently: {{ currentFile }}
      </div>

      <!-- File Count Information -->
      <div v-if="totalFiles > 0" class="flex items-center justify-between text-xs text-slate-400">
        <span>Files: {{ processedFiles || 0 }} / {{ totalFiles }}</span>
        <span>Elapsed: {{ formatElapsedTime(elapsedTime) }}</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mb-4">
      <div class="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          :class="['h-full transition-all duration-300 ease-out', getProgressColor()]"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>

    <!-- Detailed Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <div class="text-center">
        <div class="text-lg font-semibold text-white">{{ (processedFiles || 0).toLocaleString() }}</div>
        <div class="text-xs text-slate-400">Files Processed</div>
      </div>

      <div v-if="totalFiles > 0" class="text-center">
        <div class="text-lg font-semibold text-white">{{ totalFiles.toLocaleString() }}</div>
        <div class="text-xs text-slate-400">Total Files</div>
      </div>

      <div class="text-center">
        <div class="text-lg font-semibold text-white">{{ formatElapsedTime(elapsedTime) }}</div>
        <div class="text-xs text-slate-400">Elapsed Time</div>
      </div>

      <div v-if="estimatedCompletion !== null" class="text-center">
        <div class="text-lg font-semibold text-white">{{ formatTime(estimatedCompletion) }}</div>
        <div class="text-xs text-slate-400">Estimated Remaining</div>
      </div>
    </div>

    <!-- Current File -->
    <div v-if="currentFile" class="mb-4">
      <div class="flex items-center space-x-2">
        <FileSearch :size="14" class="text-slate-400 flex-shrink-0" />
        <span class="text-sm text-slate-300 truncate">{{ currentFile }}</span>
      </div>
    </div>

    <!-- Stage Progress -->
    <div class="border-t border-slate-700 pt-4">
      <h4 class="text-sm font-medium text-white mb-3">Analysis Stages</h4>
      <div class="space-y-2">
        <div v-for="(stage, index) in ANALYSIS_STAGES" :key="stage.name" class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <CheckCircle v-if="isStageCompleted(stage, index)" :size="16" class="text-green-400" />
            <component
              v-else-if="isStageActive(stage, index)"
              :is="stage.icon"
              :size="16"
              class="text-blue-400 animate-pulse"
            />
            <component v-else :is="stage.icon" :size="16" class="text-slate-600" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span
                :class="[
                  'text-sm font-medium',
                  isStageCompleted(stage, index)
                    ? 'text-green-400'
                    : isStageActive(stage, index)
                      ? 'text-blue-400'
                      : 'text-slate-400'
                ]"
              >
                {{ stage.name }}
              </span>
              <span class="text-xs text-slate-500">{{ stage.estimatedDuration }}s</span>
            </div>
            <div v-if="isStageActive(stage, index)" class="w-full bg-slate-700 rounded-full h-1">
              <div
                class="bg-blue-500 h-1 rounded-full transition-all duration-300"
                :style="{ width: `${getStageProgress(stage, index)}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Metrics (Development Only) -->
    <div v-if="isDevelopment" class="border-t border-slate-700 pt-4 mt-4">
      <h4 class="text-xs font-medium text-slate-400 mb-2">Debug Info</h4>
      <div class="text-xs text-slate-500 font-mono">
        Progress: {{ progress.toFixed(2) }}% | Elapsed: {{ formatElapsedTime(elapsedTime) }} | Stage:
        {{ currentStage?.name || 'Unknown' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Clock,
  FileSearch,
  HardDrive,
  Activity,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-vue-next';

interface AnalysisProgressProps {
  isRunning: boolean;
  progress: number;
  status: string;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
  estimatedTimeRemaining?: number;
  analysisId?: string;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSpeedChange?: (speed: 'slow' | 'normal' | 'fast') => void;
  onDepthChange?: (depth: number) => void;
  currentSpeed?: 'slow' | 'normal' | 'fast';
  currentDepth?: number;
  realtimeData?: any;
  className?: string;
}

interface ProgressStage {
  name: string;
  description: string;
  icon: any;
  estimatedDuration: number;
}

const props = withDefaults(defineProps<AnalysisProgressProps>(), {
  totalFiles: 0,
  processedFiles: 0,
  currentSpeed: 'normal',
  currentDepth: 5,
  className: '',
});

const ANALYSIS_STAGES: ProgressStage[] = [
  {
    name: 'Initializing',
    description: 'Setting up analysis environment',
    icon: Activity,
    estimatedDuration: 5,
  },
  {
    name: 'Directory Scan',
    description: 'Scanning directory structure',
    icon: FileSearch,
    estimatedDuration: 30,
  },
  {
    name: 'File Analysis',
    description: 'Analyzing individual files',
    icon: HardDrive,
    estimatedDuration: 120,
  },
  {
    name: 'Dependency Analysis',
    description: 'Building file relationships',
    icon: Activity,
    estimatedDuration: 45,
  },
  {
    name: 'Finalizing',
    description: 'Generating insights and reports',
    icon: CheckCircle,
    estimatedDuration: 15,
  },
];

const startTime = ref(Date.now());
const elapsedTime = ref(0);
const isPaused = ref(false);
let interval: number | null = null;

const isDevelopment = computed(() => process.env.NODE_ENV === 'development');

const currentStage = computed(() => {
  const stageIndex = Math.floor((props.progress / 100) * ANALYSIS_STAGES.length);
  return ANALYSIS_STAGES[Math.min(stageIndex, ANALYSIS_STAGES.length - 1)];
});

const estimatedCompletion = computed(() => {
  if (!props.isRunning || props.progress <= 0) return null;

  const elapsed = elapsedTime.value / 1000;
  const remainingProgress = (100 - props.progress) / 100;
  const estimatedTotal = elapsed / (props.progress / 100);

  return Math.max(0, estimatedTotal - elapsed);
});

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};

const formatElapsedTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  return formatTime(seconds);
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getProgressColor = () => {
  if (props.progress < 25) return 'bg-blue-500';
  if (props.progress < 50) return 'bg-yellow-500';
  if (props.progress < 75) return 'bg-orange-500';
  return 'bg-green-500';
};

const getStatusColor = () => {
  if (!props.isRunning) return 'text-gray-400';
  if (props.progress < 25) return 'text-blue-400';
  if (props.progress < 50) return 'text-yellow-400';
  if (props.progress < 75) return 'text-orange-400';
  return 'text-green-400';
};

const getMeaningfulStatus = () => {
  if (
    props.status &&
    (props.status.includes('🔍') ||
      props.status.includes('🧠') ||
      props.status.includes('🤖') ||
      props.status.includes('💡') ||
      props.status.includes('📊') ||
      props.status.includes('✅'))
  ) {
    return props.status;
  }

  if (
    props.status &&
    (props.status.includes('Scanning:') ||
      props.status.includes('Analyzing:') ||
      props.status.includes('Found') ||
      props.status.includes('Generating') ||
      props.status.includes('Finalizing'))
  ) {
    return props.status;
  }

  if (props.progress >= 0 && props.progress < 25) return '🔍 Scanning directory structure...';
  if (props.progress >= 25 && props.progress < 75) return '🤖 Running AI categorization...';
  if (props.progress >= 75 && props.progress < 90) return '💡 Generating AI recommendations...';
  if (props.progress >= 90 && props.progress < 100) return '📊 Finalizing analysis results...';
  if (props.progress >= 100) return '✅ Analysis complete!';

  return currentStage.value.description;
};

const isStageActive = (stage: ProgressStage, index: number) => {
  return index === Math.floor((props.progress / 100) * ANALYSIS_STAGES.length);
};

const isStageCompleted = (stage: ProgressStage, index: number) => {
  const stageProgress = Math.min(
    100,
    Math.max(0, ((props.progress / 100) * ANALYSIS_STAGES.length - index) * 100)
  );
  return stageProgress >= 100;
};

const getStageProgress = (stage: ProgressStage, index: number) => {
  return Math.min(
    100,
    Math.max(0, ((props.progress / 100) * ANALYSIS_STAGES.length - index) * 100)
  );
};

const togglePause = () => {
  if (isPaused.value) {
    props.onResume?.();
    isPaused.value = false;
  } else {
    props.onPause?.();
    isPaused.value = true;
  }
};

const updateElapsedTime = () => {
  if (props.isRunning && !isPaused.value) {
    elapsedTime.value = Date.now() - startTime.value;
  }
};

onMounted(() => {
  interval = window.setInterval(updateElapsedTime, 1000);
});

onUnmounted(() => {
  if (interval !== null) {
    clearInterval(interval);
  }
});

watch(
  () => props.isRunning,
  (newRunning) => {
    if (newRunning) {
      startTime.value = Date.now();
    }
  }
);
</script>

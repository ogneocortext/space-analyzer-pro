<template>
  <div v-if="errors.length > 0" :class="['space-y-3', className]">
    <div
      v-for="error in errors"
      :key="error.id"
      :class="['border rounded-lg p-4 transition-all duration-200', getErrorColor(error.type)]"
    >
      <!-- Error Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-start space-x-3 flex-1">
          <div class="shrink-0 mt-0.5">
            <component :is="getErrorIcon(error.type)" class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <h4 class="font-semibold text-sm">{{ getErrorTitle(error.type) }}</h4>
              <span class="text-xs opacity-75">{{ formatTimestamp(error.timestamp) }}</span>
            </div>
            <p class="text-sm mt-1 leading-relaxed">{{ error.message }}</p>
          </div>
        </div>

        <div class="flex items-center space-x-1 shrink-0">
          <button
            @click="toggleExpanded(error.id)"
            class="p-1 hover:bg-black/20 rounded transition-colors"
            :aria-label="expandedErrors.has(error.id) ? 'Collapse error details' : 'Expand error details'"
          >
            <Info class="w-4 h-4" />
          </button>
          <button
            v-if="onDismiss"
            @click="onDismiss(error.id)"
            class="p-1 hover:bg-black/20 rounded transition-colors"
            aria-label="Dismiss error"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Error Details -->
      <div v-if="expandedErrors.has(error.id)" class="mt-4 pt-4 border-t border-current/20">
        <div v-if="error.details" class="mb-4">
          <h5 class="text-sm font-medium mb-2">Details:</h5>
          <p class="text-xs opacity-90 leading-relaxed">{{ error.details }}</p>
        </div>

        <!-- Recovery Actions -->
        <div v-if="error.recoveryActions && error.recoveryActions.length > 0">
          <h5 class="text-sm font-medium mb-3">Suggested Actions:</h5>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(action, index) in error.recoveryActions"
              :key="index"
              @click="handleRecoveryAction(error, action.action)"
              :class="[
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                action.primary
                  ? 'bg-current/20 hover:bg-current/30 text-current'
                  : 'bg-white/10 hover:bg-white/20 text-current'
              ]"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <!-- Error Context (for debugging) -->
        <details v-if="error.context && isDevelopment" class="mt-4">
          <summary class="text-xs cursor-pointer opacity-75 hover:opacity-100">
            Technical Details
          </summary>
          <pre class="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto">
            {{ JSON.stringify(error.context, null, 2) }}
          </pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  AlertTriangle,
  X,
  RefreshCw,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-vue-next';

enum ErrorType {
  NETWORK = 'network',
  BACKEND = 'backend',
  ANALYSIS = 'analysis',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
}

interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

interface AppError {
  id: string;
  type: ErrorType;
  message: string;
  details?: string;
  timestamp: Date;
  recoveryActions?: RecoveryAction[];
  context?: any;
}

interface ErrorDisplayProps {
  errors: AppError[];
  onDismiss?: (errorId: string) => void;
  onRetry?: (error: AppError) => void;
  className?: string;
}

const props = withDefaults(defineProps<ErrorDisplayProps>(), {
  className: '',
});

const expandedErrors = ref<Set<string>>(new Set());
const isDevelopment = computed(() => process.env.NODE_ENV === 'development');

const toggleExpanded = (errorId: string) => {
  if (expandedErrors.value.has(errorId)) {
    expandedErrors.value.delete(errorId);
  } else {
    expandedErrors.value.add(errorId);
  }
};

const getErrorIcon = (type: ErrorType) => {
  switch (type) {
    case ErrorType.NETWORK:
      return WifiOff;
    case ErrorType.BACKEND:
      return AlertCircle;
    case ErrorType.ANALYSIS:
      return Clock;
    case ErrorType.PERMISSION:
      return Shield;
    case ErrorType.TIMEOUT:
      return Clock;
    case ErrorType.VALIDATION:
      return AlertTriangle;
    default:
      return AlertCircle;
  }
};

const getErrorTitle = (type: ErrorType) => {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Connection Error';
    case ErrorType.BACKEND:
      return 'Backend Error';
    case ErrorType.ANALYSIS:
      return 'Analysis Error';
    case ErrorType.PERMISSION:
      return 'Permission Error';
    case ErrorType.TIMEOUT:
      return 'Timeout Error';
    case ErrorType.VALIDATION:
      return 'Validation Error';
    default:
      return 'Error';
  }
};

const getErrorColor = (type: ErrorType) => {
  switch (type) {
    case ErrorType.NETWORK:
      return 'border-red-500/50 bg-red-500/10 text-red-400';
    case ErrorType.BACKEND:
      return 'border-orange-500/50 bg-orange-500/10 text-orange-400';
    case ErrorType.ANALYSIS:
      return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400';
    case ErrorType.PERMISSION:
      return 'border-purple-500/50 bg-purple-500/10 text-purple-400';
    case ErrorType.TIMEOUT:
      return 'border-blue-500/50 bg-blue-500/10 text-blue-400';
    case ErrorType.VALIDATION:
      return 'border-pink-500/50 bg-pink-500/10 text-pink-400';
    default:
      return 'border-gray-500/50 bg-gray-500/10 text-gray-400';
  }
};

const formatTimestamp = (timestamp: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return timestamp.toLocaleDateString();
};

const handleRecoveryAction = async (error: AppError, action: () => void | Promise<void>) => {
  try {
    await action();
  } catch (recoveryError) {
    console.error('Recovery action failed:', recoveryError);
  }
};
</script>

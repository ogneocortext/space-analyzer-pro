<template>
  <div class="analysis-data-source-badge">
    <!-- Real Data Badge -->
    <div v-if="dataSource === 'real'" class="badge badge-real" :title="tooltip">
      <span class="icon">✅</span>
      <span class="text">Real Analysis Data</span>
      <span v-if="toolsUsed.length" class="tools">
        ({{ toolsUsed.join(', ') }})
      </span>
    </div>

    <!-- Simulated Data Badge -->
    <div v-else-if="dataSource === 'simulated'" class="badge badge-simulated" :title="tooltip">
      <span class="icon">⚠️</span>
      <span class="text">Simulated Data</span>
      <button
        v-if="showInstallButton"
        class="install-btn"
        @click="onInstallClick"
        :disabled="isInstalling"
      >
        {{ isInstalling ? 'Installing...' : 'Install Tools' }}
      </button>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="badge badge-error" :title="error">
      <span class="icon">❌</span>
      <span class="text">Analysis Failed</span>
      <button
        v-if="showRetryButton"
        class="retry-btn"
        @click="onRetryClick"
        :disabled="isRetrying"
      >
        {{ isRetrying ? 'Retrying...' : 'Retry' }}
      </button>
    </div>

    <!-- Unknown State -->
    <div v-else class="badge badge-unknown">
      <span class="icon">❓</span>
      <span class="text">Data Source Unknown</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  dataSource: 'real' | 'simulated' | 'error' | 'unknown';
  toolsUsed?: string[];
  error?: string;
  showInstallButton?: boolean;
  showRetryButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  toolsUsed: () => [],
  showInstallButton: true,
  showRetryButton: true,
});

const emit = defineEmits<{
  (e: 'install'): void;
  (e: 'retry'): void;
}>();

const isInstalling = ref(false);
const isRetrying = ref(false);

const tooltip = computed(() => {
  if (props.dataSource === 'real') {
    return `Analysis performed using: ${props.toolsUsed.join(', ')}`;
  }
  if (props.dataSource === 'simulated') {
    return 'This data is simulated for demonstration. Install ESLint to get real analysis.';
  }
  return '';
});

const onInstallClick = async () => {
  isInstalling.value = true;
  emit('install');
  // Reset after 3 seconds
  setTimeout(() => {
    isInstalling.value = false;
  }, 3000);
};

const onRetryClick = async () => {
  isRetrying.value = true;
  emit('retry');
  // Reset after 3 seconds
  setTimeout(() => {
    isRetrying.value = false;
  }, 3000);
};
</script>

<style scoped>
.analysis-data-source-badge {
  display: inline-flex;
  align-items: center;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.badge-real {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-simulated {
  background-color: rgba(251, 191, 36, 0.1);
  color: #d97706;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.badge-error {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-unknown {
  background-color: rgba(156, 163, 175, 0.1);
  color: #6b7280;
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.icon {
  font-size: 1rem;
}

.text {
  font-weight: 600;
}

.tools {
  font-size: 0.75rem;
  opacity: 0.8;
  font-weight: 400;
}

.install-btn,
.retry-btn {
  margin-left: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.install-btn {
  background-color: #d97706;
  color: white;
}

.install-btn:hover:not(:disabled) {
  background-color: #b45309;
}

.retry-btn {
  background-color: #dc2626;
  color: white;
}

.retry-btn:hover:not(:disabled) {
  background-color: #b91c1c;
}

.install-btn:disabled,
.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

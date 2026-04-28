<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-icon">
      <AlertTriangle :size="48" />
    </div>
    <h3 class="error-title">Component Error</h3>
    <p class="error-message">
      The application encountered an unexpected error.
    </p>
    <details v-if="showErrorDetails" class="error-details">
      <summary>Error Details</summary>
      <pre class="error-stack">{{ error?.stack }}</pre>
    </details>
    <button @click="resetError" class="retry-button">
      Try Again
    </button>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';

interface Props {
  fallback?: any;
  showErrorDetails?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showErrorDetails: false,
});

const hasError = ref(false);
const error = ref<Error | null>(null);

onErrorCaptured((err: Error) => {
  console.error('ErrorBoundary caught an error:', err);
  hasError.value = true;
  error.value = err;
  return false;
});

const resetError = () => {
  hasError.value = false;
  error.value = null;
};
</script>

<style scoped>
.error-boundary {
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  margin: 20px;
  color: #ffffff;
  min-height: 200px;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 20px;
  color: #ef4444;
}

.error-title {
  color: #ef4444;
  margin-bottom: 10px;
}

.error-message {
  color: #94a3b8;
  margin-bottom: 20px;
}

.error-details {
  text-align: left;
  margin-top: 20px;
}

.error-details summary {
  cursor: pointer;
  color: #10b981;
}

.error-stack {
  background: #1e293b;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  font-size: 12px;
  color: #cbd5e1;
  margin-top: 10px;
}

.retry-button {
  padding: 10px 20px;
  background-color: #ef4444;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: #dc2626;
}
</style>

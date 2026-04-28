<template>
  <div v-if="hasError" class="error-boundary-wrapper">
    <div class="error-boundary-content">
      <div class="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="animate-pulse">
          <path
            d="M12 2L1 21H23L12 2Z"
            stroke="#ef4444"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M12 8V12" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
          <path d="M12 16H12.01" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>

      <h2 class="error-title">Something went wrong</h2>
      <p class="error-message">
        We're sorry, but something unexpected happened. Don't worry, your data is safe.
      </p>

      <details v-if="isDevelopment && error" class="error-details">
        <summary>Error Details (Development)</summary>
        <pre class="error-stack">
          {{ error.toString() }}
          {{ error.stack ? `\n\nStack Trace:\n${error.stack}` : "" }}
        </pre>
      </details>

      <div class="error-actions">
        <button
          v-if="retryCount < 3"
          class="btn-primary"
          :disabled="retryCount >= 3"
          @click="handleRetry"
        >
          Try Again ({{ retryCount }}/3)
        </button>
        <button class="btn-secondary" @click="handleReset">Reset Component</button>
        <button class="btn-ghost" @click="handleRefresh">Refresh Page</button>
      </div>

      <div class="error-hint">
        If this problem persists, please contact support with the error details above.
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, onUnmounted } from "vue";

interface Props {
  fallback?: any;
  onError?: (error: Error, errorInfo: any) => void;
  isolate?: boolean;
}

const props = defineProps<Props>();

const hasError = ref(false);
const error = ref<Error | null>(null);
const errorInfo = ref<any>(null);
const retryCount = ref(0);
const retryTimeoutId = ref<number | null>(null);

const isDevelopment = true; // Simplified for Vue

onErrorCaptured((err: Error, instance: any, info: string) => {
  hasError.value = true;
  error.value = err;
  errorInfo.value = { componentStack: info };

  logError(err, { componentStack: info });

  if (props.onError) {
    props.onError(err, { componentStack: info });
  }

  return false;
});

const logError = (err: Error, info: any) => {
  const errorDetails = {
    message: err.message,
    stack: err.stack,
    componentStack: info.componentStack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    retryCount: retryCount.value,
  };

  if (isDevelopment) {
    console.group("Error Boundary Caught Error");
    console.error("Error:", err);
    console.error("Error Info:", info);
    console.error("Details:", errorDetails);
    console.groupEnd();
  }

  if (!isDevelopment) {
    reportError(errorDetails);
  }
};

const reportError = async (errorDetails: any) => {
  try {
    await fetch("/api/errors/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(errorDetails),
    });
  } catch (reportingError) {
    console.error("Failed to report error:", reportingError);
  }
};

const handleRetry = () => {
  const maxRetries = 3;
  const newRetryCount = retryCount.value + 1;

  if (newRetryCount <= maxRetries) {
    hasError.value = false;
    error.value = null;
    errorInfo.value = null;
    retryCount.value = newRetryCount;

    const delay = Math.pow(2, newRetryCount) * 1000;
    retryTimeoutId.value = window.setTimeout(() => {
      retryCount.value = 0;
    }, delay);
  } else {
    console.warn("Max retry attempts reached for component");
  }
};

const handleReset = () => {
  hasError.value = false;
  error.value = null;
  errorInfo.value = null;
  retryCount.value = 0;
};

const handleRefresh = () => {
  window.location.reload();
};

onUnmounted(() => {
  if (retryTimeoutId.value) {
    clearTimeout(retryTimeoutId.value);
  }
});
</script>

<style scoped>
.error-boundary-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(239, 68, 68, 0.02));
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
}

.error-boundary-content {
  max-width: 500px;
  text-align: center;
}

.error-icon {
  margin-bottom: 1.5rem;
  color: #ef4444;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 0.75rem;
}

.error-message {
  color: #94a3b8;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.error-details {
  margin: 1.5rem 0;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  color: #10b981;
  font-weight: 500;
  padding: 0.5rem;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 0.375rem;
}

.error-stack {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #1e293b;
  border-radius: 0.375rem;
  overflow: auto;
  font-size: 0.75rem;
  color: #cbd5e1;
  white-space: pre-wrap;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin: 1.5rem 0;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary,
.btn-ghost {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #ef4444;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #dc2626;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #3b82f6;
  color: white;
  border: none;
}

.btn-secondary:hover {
  background: #2563eb;
}

.btn-ghost {
  background: transparent;
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.btn-ghost:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
}

.error-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 1rem;
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

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>

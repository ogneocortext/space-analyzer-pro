<template>
  <div v-if="!hasError" class="error-boundary">
    <slot />
  </div>

  <div v-else class="error-fallback">
    <div class="error-container">
      <div class="error-icon">
        <AlertTriangle :size="48" />
      </div>
      <div class="error-content">
        <h3>Something went wrong</h3>
        <p>{{ errorMessage }}</p>
        <div class="error-actions">
          <button class="btn btn-primary" @click="retry">
            <RefreshCw :size="16" />
            Retry
          </button>
          <button class="btn btn-secondary" @click="reportError">
            <Bug :size="16" />
            Report Issue
          </button>
        </div>
        <details v-if="showDetails" class="error-details">
          <summary>Error Details</summary>
          <pre>{{ errorStack }}</pre>
        </details>
        <button class="btn btn-outline btn-sm" @click="showDetails = !showDetails">
          {{ showDetails ? "Hide" : "Show" }} Details
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, onMounted, onUnmounted } from "vue";
import { AlertTriangle, RefreshCw, Bug } from "lucide-vue-next";

interface Props {
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: any) => void;
  maxRetries?: number;
}

const props = withDefaults(defineProps<Props>(), {
  fallbackMessage: "An unexpected error occurred while rendering this component.",
  maxRetries: 3,
});

const emit = defineEmits<{
  error: [error: Error, errorInfo: any];
  retry: [];
}>();

const hasError = ref(false);
const errorMessage = ref("");
const errorStack = ref("");
const retryCount = ref(0);
const showDetails = ref(false);
let asyncErrorHandler: ((event: PromiseRejectionEvent) => void) | null = null;

const handleAsyncError = (event: PromiseRejectionEvent) => {
  console.error("ErrorBoundary caught async error:", event.reason);

  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

  hasError.value = true;
  errorMessage.value = props.fallbackMessage;
  errorStack.value = error.stack || `Async error: ${event.reason}`;

  emit("error", error, { type: "unhandledRejection", reason: event.reason });

  if (props.onError) {
    props.onError(error, { type: "unhandledRejection", reason: event.reason });
  }

  // Prevent the default browser behavior
  event.preventDefault();
};

const retry = () => {
  if (retryCount.value < props.maxRetries) {
    hasError.value = false;
    errorMessage.value = "";
    errorStack.value = "";
    retryCount.value++;
    emit("retry");
  }
};

const reportError = () => {
  // Create error report data
  const errorReport = {
    message: errorMessage.value,
    stack: errorStack.value,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    retryCount: retryCount.value,
  };

  // Log to console for development
  console.error("Error Boundary Report:", errorReport);

  // Store in localStorage for potential later reporting
  const reports = JSON.parse(localStorage.getItem("errorReports") || "[]");
  reports.push(errorReport);
  localStorage.setItem("errorReports", JSON.stringify(reports.slice(-10))); // Keep last 10 reports

  // Try to send to error tracking service if available
  try {
    if (window.navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(errorReport)], { type: "application/json" });
      navigator.sendBeacon("/api/error-report", blob);
    }
  } catch (e) {
    console.warn("Failed to send error report:", e);
  }
};

onErrorCaptured((error: Error, instance, info) => {
  console.error("Error Boundary caught error:", error, info);

  hasError.value = true;
  errorMessage.value = props.fallbackMessage;
  errorStack.value = error.stack || "No stack trace available";

  emit("error", error, info);

  if (props.onError) {
    props.onError(error, info);
  }

  // Prevent error from propagating
  return false;
});

onMounted(() => {
  // Reset error state when component is remounted
  if (hasError.value) {
    console.log("Error boundary remounted after error");
  }

  // Register async error handler
  asyncErrorHandler = handleAsyncError;
  window.addEventListener("unhandledrejection", asyncErrorHandler);
});

onUnmounted(() => {
  // Clean up async error handler
  if (asyncErrorHandler) {
    window.removeEventListener("unhandledrejection", asyncErrorHandler);
    asyncErrorHandler = null;
  }
});
</script>

<style scoped>
.error-boundary {
  display: contents;
}

.error-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 2rem;
  background: #1a1a1a;
  border: 1px solid #dc2626;
  border-radius: 8px;
  margin: 1rem;
}

.error-container {
  text-align: center;
  max-width: 500px;
}

.error-icon {
  color: #dc2626;
  margin-bottom: 1rem;
}

.error-content h3 {
  color: #dc2626;
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
}

.error-content p {
  color: #ccc;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1rem;
}

.error-details {
  margin: 1rem 0;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  color: #4a90e2;
  font-weight: 600;
  padding: 0.5rem;
  border: 1px solid #4a90e2;
  border-radius: 4px;
  background: #1e293b;
}

.error-details pre {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.75rem;
  color: #e2e8f0;
  margin-top: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #4a90e2;
  color: white;
}

.btn-primary:hover {
  background: #357abd;
}

.btn-secondary {
  background: #666;
  color: white;
}

.btn-secondary:hover {
  background: #555;
}

.btn-outline {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
}

.btn-outline:hover {
  background: #333;
  border-color: #4a90e2;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}
</style>

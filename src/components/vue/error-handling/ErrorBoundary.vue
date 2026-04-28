<template>
  <slot v-if="!hasError" />
  <div v-else class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
    <div class="max-w-2xl w-full bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl overflow-hidden">
      <!-- Error Header -->
      <div class="bg-red-500/20 border-b border-red-500/30 p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-red-500/30 rounded-full flex items-center justify-center">
            <AlertTriangle class="w-6 h-6 text-red-400" />
          </div>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-white">Application Error</h1>
            <p class="text-red-200 mt-1">
              {{ isolate ? 'This component has been isolated due to an error.' : 'Something went wrong in the application.' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Error Details -->
      <div class="p-6 space-y-6">
        <!-- Error Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white/5 rounded-lg p-4 border border-white/10">
            <div class="text-sm text-slate-300 mb-1">Error ID</div>
            <div class="font-mono text-sm text-white">{{ errorId }}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-4 border border-white/10">
            <div class="text-sm text-slate-300 mb-1">Time</div>
            <div class="font-mono text-sm text-white">{{ new Date().toLocaleString() }}</div>
          </div>
          <div class="bg-white/5 rounded-lg p-4 border border-white/10">
            <div class="text-sm text-slate-300 mb-1">Component</div>
            <div class="font-mono text-sm text-white truncate">
              {{ componentName || 'Unknown' }}
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-white/5 rounded-lg p-4 border border-white/10">
          <div class="flex items-center gap-2 mb-2">
            <Bug class="w-4 h-4 text-red-400" />
            <span class="text-sm text-slate-300">Error Message</span>
          </div>
          <div class="text-white font-mono text-sm bg-black/30 p-3 rounded border border-white/10">
            {{ error.message }}
          </div>
        </div>

        <!-- Stack Trace -->
        <div v-if="errorStack" class="bg-white/5 rounded-lg p-4 border border-white/10">
          <div class="flex items-center gap-2 mb-2">
            <ExternalLink class="w-4 h-4 text-blue-400" />
            <span class="text-sm text-slate-300">Stack Trace</span>
          </div>
          <div class="text-white font-mono text-xs bg-black/30 p-3 rounded border border-white/10 max-h-40 overflow-auto">
            {{ errorStack }}
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="handleReset"
            class="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 rounded-lg transition-colors"
          >
            <RefreshCw class="w-4 h-4" />
            Try Again
          </button>

          <button
            @click="handleReload"
            class="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 rounded-lg transition-colors"
          >
            <RefreshCw class="w-4 h-4" />
            Reload Page
          </button>

          <button
            @click="handleGoHome"
            class="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 rounded-lg transition-colors"
          >
            <ExternalLink class="w-4 h-4" />
            Go Home
          </button>
        </div>

        <!-- Help Text -->
        <div class="text-xs text-slate-400 bg-white/5 rounded-lg p-4 border border-white/10">
          <p class="mb-2">
            <strong>Troubleshooting:</strong>
          </p>
          <ul class="list-disc list-inside space-y-1">
            <li>Try refreshing the page to reset the application state</li>
            <li>Clear your browser cache and cookies if the error persists</li>
            <li>Check your internet connection if the error involves network requests</li>
            <li>Contact support with the error ID above if the problem continues</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { AlertTriangle, RefreshCw, Bug, ExternalLink } from 'lucide-vue-next';

interface ErrorBoundaryProps {
  isolate?: boolean;
  onError?: (error: Error, instance: any, info: string) => void;
}

const props = withDefaults(defineProps<ErrorBoundaryProps>(), {
  isolate: false,
});

const hasError = ref(false);
const error = ref<Error | null>(null);
const errorStack = ref<string>('');
const errorId = ref('');
const componentName = ref('');

onErrorCaptured((err, instance, info) => {
  hasError.value = true;
  error.value = err;
  errorStack.value = err.stack || '';
  errorId.value = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  componentName.value = info || 'Unknown';

  // Log error details for debugging
  console.error('ErrorBoundary caught an error:', {
    error: err.message,
    stack: err.stack,
    info,
    errorId: errorId.value,
  });

  // Call custom error handler if provided
  if (props.onError) {
    props.onError(err, instance, info);
  }

  // Prevent error from propagating further
  return false;
});

const handleReset = () => {
  hasError.value = false;
  error.value = null;
  errorStack.value = '';
  errorId.value = '';
  componentName.value = '';
};

const handleReload = () => {
  window.location.reload();
};

const handleGoHome = () => {
  window.location.href = '/';
};
</script>

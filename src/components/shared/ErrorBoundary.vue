<template>
  <div v-if="error" class="error-boundary p-6 rounded-lg bg-red-900/20 border border-red-500/30">
    <div class="flex items-start gap-4">
      <div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-red-200 mb-2">{{ title }}</h3>
        <p class="text-red-300/80 mb-4">{{ errorMessage }}</p>
        <div class="flex gap-3">
          <button
            @click="retry"
            class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            v-if="showDetails"
            @click="toggleDetails"
            class="px-4 py-2 text-red-400/70 hover:text-red-300 transition-colors"
          >
            {{ showErrorDetails ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>
        <pre v-if="showErrorDetails" class="mt-4 p-3 bg-red-950/50 rounded text-xs text-red-300/60 overflow-auto">{{ error.stack }}</pre>
      </div>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, computed } from 'vue';

interface Props {
  title?: string;
  fallbackMessage?: string;
  showDetails?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  fallbackMessage: 'An unexpected error occurred. Please try again.',
  showDetails: false,
});

const error = ref<Error | null>(null);
const showErrorDetails = ref(false);

const errorMessage = computed(() => {
  if (!error.value) return '';
  return error.value.message || props.fallbackMessage;
});

onErrorCaptured((err: Error) => {
  error.value = err;
  console.error('ErrorBoundary caught:', err);
  return false; // Prevent error from propagating
});

const retry = () => {
  error.value = null;
  showErrorDetails.value = false;
};

const toggleDetails = () => {
  showErrorDetails.value = !showErrorDetails.value;
};
</script>

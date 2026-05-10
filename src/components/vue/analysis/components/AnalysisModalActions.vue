<!--
  Analysis Modal Actions Component
  Modal action buttons (cancel/confirm)
-->
<template>
  <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
    <button
      @click="$emit('cancel')"
      :disabled="isLoading"
      class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ cancelText }}
    </button>
    <button
      @click="$emit('confirm')"
      :disabled="isLoading"
      class="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
      <Play v-else class="w-4 h-4" />
      {{ confirmText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Play, Loader2 } from 'lucide-vue-next';

interface Props {
  isLoading?: boolean;
  cancelText?: string;
  confirmText?: string;
}

interface Emits {
  (e: 'cancel'): void;
  (e: 'confirm'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  cancelText: 'Cancel',
  confirmText: 'Confirm',
});

defineEmits<Emits>();
</script>

<style scoped>
/* Action button styles are handled by Tailwind classes */
</style>
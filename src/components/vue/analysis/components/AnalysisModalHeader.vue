<!--
  Analysis Modal Header Component
  Modal header with title, subtitle, and close button
-->
<template>
  <div class="flex items-center justify-between p-6 border-b border-gray-700">
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center"
      >
        <component :is="icon" class="w-6 h-6 text-white" />
      </div>
      <div>
        <h2 class="text-xl font-semibold text-white">{{ title }}</h2>
        <p class="text-gray-400 text-sm">{{ subtitle }}</p>
      </div>
    </div>
    <button
      @click="$emit('close')"
      class="text-gray-400 hover:text-white transition-colors"
      title="Close modal"
    >
      <X class="w-6 h-6" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

interface Props {
  title: string;
  subtitle: string;
  icon: any;
}

interface Emits {
  (e: 'close'): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
/* Header styles are handled by Tailwind classes */
</style>
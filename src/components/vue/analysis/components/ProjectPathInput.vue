<!--
  Project Path Input Component
  Input field for project path selection
-->
<template>
  <div>
    <label class="block text-sm font-medium text-gray-300 mb-2">Project Path</label>
    <div class="relative">
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        type="text"
        :placeholder="placeholder"
        class="w-full px-4 py-2 pr-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
      />
      <button
        @click="$emit('browse')"
        class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
        title="Browse for folder"
      >
        <Folder class="w-4 h-4" />
      </button>
    </div>
    <p v-if="suggestion" class="text-xs text-gray-500 mt-1">
      {{ suggestion }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { Folder } from 'lucide-vue-next';

interface Props {
  modelValue: string;
  placeholder?: string;
  suggestion?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'browse'): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
/* Input styles are handled by Tailwind classes */
</style>
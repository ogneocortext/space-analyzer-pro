<template>
  <div v-if="file" class="mt-6 bg-slate-800 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-lg font-semibold text-white">File Details</h4>
      <button
        @click="$emit('close')"
        class="text-slate-400 hover:text-slate-200 transition-colors"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span class="text-slate-400">Name:</span>
        <span class="text-white ml-2">{{ file.name }}</span>
      </div>
      <div>
        <span class="text-slate-400">Size:</span>
        <span class="text-white ml-2">{{ formatBytes(file.size) }}</span>
      </div>
      <div>
        <span class="text-slate-400">Type:</span>
        <span class="text-white ml-2">{{ file.extension || 'Unknown' }}</span>
      </div>
      <div>
        <span class="text-slate-400">Modified:</span>
        <span class="text-white ml-2">{{ formatDate(file.timestamps?.modified || file.modified || 'Unknown') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

interface FileItem {
  name: string;
  path: string;
  size: number;
  category: string;
  extension?: string;
  timestamps?: {
    created?: string;
    modified: string;
    accessed?: string;
  };
  modified?: string;
}

interface Props {
  file: FileItem | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}
</script>

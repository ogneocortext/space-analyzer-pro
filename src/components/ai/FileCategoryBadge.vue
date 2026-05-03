<template>
  <span
    class="file-category-badge inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
    :class="badgeClasses"
    :title="tooltip"
  >
    <span class="text-sm">{{ icon }}</span>
    <span>{{ displayCategory }}</span>
    <span
      v-if="confidence && showConfidence"
      class="ml-0.5 text-[10px] opacity-75"
    >
      {{ formatConfidence }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  category: string;
  confidence?: number;
  showConfidence?: boolean;
  size?: 'sm' | 'md' | 'lg';
}>({
  showConfidence: false,
  size: 'sm',
});

const displayCategory = computed(() => {
  return props.category.charAt(0).toUpperCase() + props.category.slice(1);
});

const icon = computed(() => {
  const icons: Record<string, string> = {
    documents: '📄',
    images: '🖼️',
    videos: '🎬',
    audio: '🎵',
    archives: '📦',
    code: '💻',
    data: '📊',
    executables: '⚙️',
    other: '📁',
  };
  return icons[props.category.toLowerCase()] || '📁';
});

const tooltip = computed(() => {
  if (props.confidence) {
    return `Category: ${props.category} (${(props.confidence * 100).toFixed(0)}% confidence)`;
  }
  return `Category: ${props.category}`;
});

const formatConfidence = computed(() => {
  if (!props.confidence) return '';
  return `${(props.confidence * 100).toFixed(0)}%`;
});

const badgeClasses = computed(() => {
  const baseClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const colorClasses: Record<string, string> = {
    documents: 'bg-blue-100 text-blue-700 border border-blue-200',
    images: 'bg-green-100 text-green-700 border border-green-200',
    videos: 'bg-red-100 text-red-700 border border-red-200',
    audio: 'bg-purple-100 text-purple-700 border border-purple-200',
    archives: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    code: 'bg-gray-100 text-gray-700 border border-gray-200',
    data: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    executables: 'bg-orange-100 text-orange-700 border border-orange-200',
    other: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  const categoryKey = props.category.toLowerCase();
  const colors = colorClasses[categoryKey] || colorClasses.other;
  const size = baseClasses[props.size || 'sm'];

  return `${colors} ${size}`;
});
</script>

<style scoped>
.file-category-badge {
  @apply transition-colors duration-200;
}
</style>

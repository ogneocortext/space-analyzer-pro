<!--
  Analyzer Selection Component
  Grid of available analyzers with selection functionality
-->
<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <label class="block text-sm font-medium text-gray-300">
        Available Analyzers ({{ selectedAnalyzers.length }} selected)
      </label>
      <div class="flex gap-2">
        <button
          @click="$emit('select-all')"
          class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          Select All
        </button>
        <button
          @click="$emit('select-none')"
          class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="analyzer in availableAnalyzers"
        :key="analyzer.id"
        @click="toggleAnalyzer(analyzer.id)"
        :class="[
          'p-4 border rounded-lg cursor-pointer transition-all',
          selectedAnalyzers.includes(analyzer.id)
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-gray-600 bg-gray-800 hover:border-gray-500',
        ]"
      >
        <div class="flex items-start gap-3">
          <div
            :class="[
              'p-2 rounded-lg',
              selectedAnalyzers.includes(analyzer.id)
                ? 'bg-cyan-500/20'
                : 'bg-gray-700',
            ]"
          >
            <component
              :is="getAnalyzerIcon(analyzer.id)"
              :class="[
                'w-4 h-4',
                selectedAnalyzers.includes(analyzer.id)
                  ? 'text-cyan-400'
                  : 'text-gray-400',
              ]"
            />
          </div>
          <div class="flex-1">
            <h4
              :class="[
                'font-medium text-sm',
                selectedAnalyzers.includes(analyzer.id)
                  ? 'text-cyan-400'
                  : 'text-white',
              ]"
            >
              {{ analyzer.name }}
            </h4>
            <p class="text-xs text-gray-400 mt-1">{{ analyzer.description }}</p>
            <div class="flex items-center gap-2 mt-2">
              <span
                :class="[
                  'px-2 py-0.5 text-xs rounded-full',
                  getAnalyzerCategoryStyle(analyzer.category),
                ]"
              >
                {{ analyzer.category }}
              </span>
              <span class="text-xs text-gray-500">
                {{ analyzer.estimatedTime }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selection Summary -->
    <div v-if="selectedAnalyzers.length > 0" class="mt-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-300">
          Selected: {{ selectedAnalyzers.length }} analyzers
        </span>
        <span class="text-xs text-gray-500">
          Estimated time: {{ totalEstimatedTime }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyzerDefinition } from '../../../services/AnalysisService';

interface Props {
  selectedAnalyzers: string[];
  availableAnalyzers: AnalyzerDefinition[];
}

interface Emits {
  (e: 'update:selected-analyzers', value: string[]): void;
  (e: 'select-all'): void;
  (e: 'select-none'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Computed
const totalEstimatedTime = computed(() => {
  const selected = props.availableAnalyzers.filter(analyzer => 
    props.selectedAnalyzers.includes(analyzer.id)
  );
  
  // Simple time estimation - in real app would be more sophisticated
  const totalMinutes = selected.length * 2; // 2 minutes per analyzer
  
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }
});

// Methods
const toggleAnalyzer = (analyzerId: string) => {
  const newSelection = props.selectedAnalyzers.includes(analyzerId)
    ? props.selectedAnalyzers.filter(id => id !== analyzerId)
    : [...props.selectedAnalyzers, analyzerId];
  
  emit('update:selected-analyzers', newSelection);
};

const getAnalyzerIcon = (analyzerId: string) => {
  const icons: Record<string, any> = {
    'code-structure': 'Code',
    'security-scan': 'Shield',
    'performance-audit': 'Zap',
    'duplicate-finder': 'Copy',
    'size-analyzer': 'Database',
    'dependency-mapper': 'GitBranch',
    'timestamp-analyzer': 'Clock',
    'hard-link-analyzer': 'Link',
  };
  return icons[analyzerId] || 'Settings';
};

const getAnalyzerCategoryStyle = (category: string) => {
  const styles: Record<string, string> = {
    'code': 'bg-blue-500/20 text-blue-400',
    'security': 'bg-red-500/20 text-red-400',
    'performance': 'bg-yellow-500/20 text-yellow-400',
    'storage': 'bg-green-500/20 text-green-400',
    'general': 'bg-gray-500/20 text-gray-400',
  };
  return styles[category] || styles.general;
};
</script>

<style scoped>
/* Selection styles are handled by Tailwind classes */
</style>
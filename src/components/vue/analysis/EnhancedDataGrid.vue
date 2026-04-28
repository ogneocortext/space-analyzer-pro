<template>
  <div :class="['content-section polished-card', className]">
    <!-- Header -->
    <div class="content-section-header">
      <div>
        <h3 class="content-section-title flex items-center gap-2">
          {{ title }}
          <button
            class="text-slate-400 hover:text-slate-300 transition-colors focus-enhanced"
            @click="toggleSort"
            :title="`Sort by value (${sortOrder === 'asc' ? 'ascending' : 'descending'})`"
            :aria-label="`Sort ${title} by value`"
          >
            <ChevronUp v-if="sortOrder === 'asc'" class="w-4 h-4" />
            <ChevronDown v-else class="w-4 h-4" />
          </button>
        </h3>
        <p v-if="subtitle" class="content-section-subtitle">{{ subtitle }}</p>
      </div>
      <div class="text-sm text-slate-400">{{ data.length }} items</div>
    </div>

    <!-- Data Grid -->
    <div class="data-grid">
      <div
        v-for="item in sortedData"
        :key="item.id"
        class="data-card"
        role="button"
        tabindex="0"
        @click="onItemClick?.(item)"
        @keydown="handleKeyDown($event, item)"
        :aria-label="`${item.name}: ${formatValue(item.value)}`"
      >
        <div class="flex items-center justify-center mb-3">
          <component :is="getIcon(item)" class="w-5 h-5" />
        </div>

        <div class="data-value">{{ formatValue(item.value) }}</div>

        <div class="data-label text-xs">{{ item.name }}</div>

        <div
          v-if="item.change !== undefined"
          :class="[
            'data-change flex items-center justify-center gap-1 mt-2',
            item.change >= 0 ? 'positive' : 'negative'
          ]"
        >
          <TrendingUp v-if="item.change >= 0" class="w-3 h-3" />
          <TrendingDown v-else class="w-3 h-3" />
          {{ Math.abs(item.change) }}%
        </div>

        <!-- Expandable Description -->
        <div
          v-if="expandable && item.description"
          class="mt-3 pt-3 border-t border-slate-700"
        >
          <button
            class="expand-toggle w-full text-xs"
            @click.stop="toggleExpanded(item.id)"
            @keydown="handleExpandKeyDown($event, item.id)"
            :aria-expanded="expandedItems.has(item.id) ? 'true' : 'false'"
            :aria-controls="`description-${item.id}`"
          >
            {{ expandedItems.has(item.id) ? 'Show less' : 'Show more' }}
          </button>

          <div
            :id="`description-${item.id}`"
            :class="['content-expandable', expandedItems.has(item.id) ? 'expanded' : '']"
          >
            <p class="text-xs text-slate-400 mt-2">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Footer -->
    <div class="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-sm">
      <div class="text-slate-400">
        Total: {{ formatValue(data.reduce((sum, item) => sum + item.value, 0)) }}
      </div>
      <div class="text-slate-400">
        Sorted: {{ sortOrder === 'asc' ? 'Low to High' : 'High to Low' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  FolderOpen,
  File,
  HardDrive,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';

interface DataItem {
  id: string;
  name: string;
  value: number;
  change?: number;
  icon?: any;
  color?: string;
  description?: string;
}

interface EnhancedDataGridProps {
  title: string;
  subtitle?: string;
  data: DataItem[];
  expandable?: boolean;
  className?: string;
  onItemClick?: (item: DataItem) => void;
}

const props = withDefaults(defineProps<EnhancedDataGridProps>(), {
  expandable: false,
  className: '',
  onItemClick: undefined,
});

const expandedItems = ref<Set<string>>(new Set());
const sortOrder = ref<'asc' | 'desc'>('desc');

const toggleExpanded = (id: string) => {
  const newExpanded = new Set(expandedItems.value);
  if (newExpanded.has(id)) {
    newExpanded.delete(id);
  } else {
    newExpanded.add(id);
  }
  expandedItems.value = newExpanded;
};

const toggleSort = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};

const sortedData = computed(() => {
  return [...props.data].sort((a, b) => {
    const comparison = a.value - b.value;
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});

const formatValue = (value: number) => {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}GB`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}MB`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}KB`;
  }
  return `${value}B`;
};

const getIcon = (item: DataItem) => {
  if (item.icon) return item.icon;

  if (
    item.name.toLowerCase().includes('folder') ||
    item.name.toLowerCase().includes('directory')
  ) {
    return FolderOpen;
  } else if (item.name.toLowerCase().includes('file')) {
    return File;
  } else if (
    item.name.toLowerCase().includes('storage') ||
    item.name.toLowerCase().includes('disk')
  ) {
    return HardDrive;
  }

  return 'div';
};

const handleKeyDown = (e: KeyboardEvent, item: DataItem) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    props.onItemClick?.(item);
  }
};

const handleExpandKeyDown = (e: KeyboardEvent, id: string) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
    e.preventDefault();
    toggleExpanded(id);
  }
};
</script>

<style scoped>
.content-section {
  @apply bg-slate-800 rounded-lg p-6 border border-slate-700;
}

.content-section-header {
  @apply flex items-center justify-between mb-4;
}

.content-section-title {
  @apply text-lg font-semibold text-white;
}

.content-section-subtitle {
  @apply text-sm text-slate-400;
}

.data-grid {
  @apply grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4;
}

.data-card {
  @apply bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer;
}

.data-value {
  @apply text-white font-bold text-lg;
}

.data-label {
  @apply text-slate-400;
}

.data-change {
  @apply text-xs;
}

.data-change.positive {
  @apply text-green-400;
}

.data-change.negative {
  @apply text-red-400;
}

.expand-toggle {
  @apply text-slate-400 hover:text-slate-300 transition-colors;
}

.content-expandable {
  @apply overflow-hidden transition-all duration-300 max-h-0;
}

.content-expandable.expanded {
  @apply max-h-40;
}

.polished-card {
  @apply bg-slate-800 rounded-lg border border-slate-700 shadow-lg;
}
</style>

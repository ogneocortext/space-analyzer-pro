<template>
  <div ref="chartRef" :class="['chart-container polished-card', className]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
          <component :is="getChartIcon()" class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-white">{{ title }}</h3>
          <p v-if="subtitle" class="text-sm text-slate-400">{{ subtitle }}</p>
        </div>
      </div>
      <button
        class="text-slate-400 hover:text-slate-300 transition-colors focus-enhanced"
        title="Chart information"
        :aria-label="`Information about ${title} chart`"
      >
        <Info class="w-4 h-4" />
      </button>
    </div>

    <!-- Chart Content -->
    <div class="relative">
      <div v-if="type === 'bar'" class="space-y-3">
        <div
          v-for="item in data"
          :key="item.name"
          class="relative group cursor-pointer"
          @mousemove="(e) => handleMouseMove(e, item)"
          @mouseleave="handleMouseLeave"
          @click="handleItemClick(item)"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-slate-300">{{ item.name }}</span>
            <span class="text-sm text-slate-400">{{ item.value.toLocaleString() }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
            <div
              :class="['h-full transition-all duration-300', hoveredItem === item.name ? 'brightness-110' : '']"
              :style="{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color || '#3b82f6'
              }"
            />
          </div>
        </div>
      </div>

      <div v-else-if="type === 'pie'" class="relative">
        <div class="w-48 h-48 mx-auto">
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <g
              v-for="(item, index) in data"
              :key="item.name"
            >
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                :stroke="item.color || '#3b82f6'"
                stroke-width="20"
                :stroke-dasharray="`${getPieAngle(item)} ${360 - getPieAngle(item)}`"
                :stroke-dashoffset="`-${getPreviousAngles(index)}`"
                transform="rotate(-90 50 50)"
                :class="['cursor-pointer transition-all duration-300', hoveredItem === item.name ? 'opacity-80' : '']"
                @mousemove="(e) => handleMouseMove(e, item)"
                @mouseleave="handleMouseLeave"
                @click="handleItemClick(item)"
              />
            </g>
          </svg>
        </div>
      </div>

      <div v-else class="text-slate-400">Chart type not implemented</div>

      <!-- Tooltip -->
      <div
        v-if="showTooltip && tooltip.visible"
        class="chart-tooltip visible"
        :style="{
          left: `${tooltip.x}px`,
          top: `${tooltip.y - 40}px`,
          transform: 'translateX(-50%)'
        }"
        v-html="tooltip.content"
      />
    </div>

    <!-- Legend -->
    <div v-if="showLegend" class="chart-legend">
      <div
        v-for="item in data"
        :key="item.name"
        class="legend-item"
      >
        <div class="legend-color" :style="{ backgroundColor: item.color || '#3b82f6' }" />
        <span>{{ item.name }}</span>
        <span
          v-if="item.change !== undefined"
          :class="['data-change', item.change >= 0 ? 'positive' : 'negative']"
        >
          {{ item.change >= 0 ? '+' : '' }}{{ item.change }}%
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { BarChart3, PieChart, TrendingUp, Info } from 'lucide-vue-next';

interface ChartData {
  name: string;
  value: number;
  color?: string;
  change?: number;
}

interface EnhancedChartProps {
  title: string;
  subtitle?: string;
  data: ChartData[];
  type: 'bar' | 'pie' | 'line';
  showLegend?: boolean;
  showTooltip?: boolean;
  className?: string;
  onDataPointClick?: (data: ChartData) => void;
}

const props = withDefaults(defineProps<EnhancedChartProps>(), {
  showLegend: true,
  showTooltip: true,
  className: '',
  onDataPointClick: undefined,
});

const tooltip = ref<{
  x: number;
  y: number;
  content: string;
  visible: boolean;
}>({
  x: 0,
  y: 0,
  content: '',
  visible: false,
});

const hoveredItem = ref<string | null>(null);
const chartRef = ref<HTMLDivElement | null>(null);

const maxValue = computed(() => {
  return Math.max(...props.data.map((d) => d.value));
});

const getTotalValue = () => {
  return props.data.reduce((sum, d) => sum + d.value, 0);
};

const getPieAngle = (item: ChartData) => {
  const percentage = (item.value / getTotalValue()) * 100;
  return (percentage / 100) * 360;
};

const getPreviousAngles = (index: number) => {
  return props.data.slice(0, index).reduce((sum, d) => {
    const prevPercentage = (d.value / getTotalValue()) * 100;
    return sum + (prevPercentage / 100) * 360;
  }, 0);
};

const handleMouseMove = (e: MouseEvent, item: ChartData) => {
  if (!props.showTooltip) return;

  const rect = chartRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const content = `
    <div class="font-semibold">${item.name}</div>
    <div class="text-sm">Value: ${item.value.toLocaleString()}</div>
    ${item.change !== undefined ? `<div class="text-xs ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}">Change: ${item.change >= 0 ? '+' : ''}${item.change}%</div>` : ''}
  `;

  tooltip.value = { x, y, content, visible: true };
  hoveredItem.value = item.name;
};

const handleMouseLeave = () => {
  tooltip.value.visible = false;
  hoveredItem.value = null;
};

const handleItemClick = (item: ChartData) => {
  if (props.onDataPointClick) {
    props.onDataPointClick(item);
  }
};

const getChartIcon = () => {
  switch (props.type) {
    case 'bar':
      return BarChart3;
    case 'pie':
      return PieChart;
    case 'line':
      return TrendingUp;
    default:
      return BarChart3;
  }
};
</script>

<style scoped>
.chart-container {
  @apply bg-slate-800 rounded-lg p-6 border border-slate-700;
}

.chart-tooltip {
  @apply absolute bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg pointer-events-none z-10 opacity-0 transition-opacity;
}

.chart-tooltip.visible {
  @apply opacity-100;
}

.chart-legend {
  @apply mt-4 flex flex-wrap gap-3;
}

.legend-item {
  @apply flex items-center gap-2 text-sm text-slate-300;
}

.legend-color {
  @apply w-3 h-3 rounded;
}

.data-change {
  @apply text-xs font-medium;
}

.data-change.positive {
  @apply text-green-400;
}

.data-change.negative {
  @apply text-red-400;
}
</style>

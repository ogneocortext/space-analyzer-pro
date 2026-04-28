<template>
  <div class="bg-gray-900 rounded-lg p-6 border border-gray-700">
    <!-- Header with controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
      <h2 class="text-xl font-bold text-white">File Analysis Visualization</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="button in chartTypeButtons"
          :key="button.type"
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            chartType === button.type
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
          ]"
          :aria-label="`Switch to ${button.label} chart`"
          :title="`View as ${button.label} Chart`"
          @click="chartType = button.type"
        >
          <component :is="button.icon" :size="16" />
          {{ button.label }}
        </button>
        <button
          :class="[
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            isDarkTheme ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-blue-600 text-white',
          ]"
          :aria-label="isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'"
          :title="isDarkTheme ? 'Light Theme' : 'Dark Theme'"
          @click="toggleTheme"
        >
          <Sun v-if="isDarkTheme" :size="16" />
          <Moon v-else :size="16" />
          {{ isDarkTheme ? "Light" : "Dark" }}
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg"
    >
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4" />
      <div class="text-gray-400">Loading chart data...</div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg border border-red-500"
    >
      <div class="text-red-400 mb-4">
        <Info :size="48" />
      </div>
      <div class="text-red-400 text-center">
        <div class="font-semibold mb-2">Error loading chart</div>
        <div class="text-sm">
          {{ error }}
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!chartData || chartData.length === 0"
      class="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-lg"
    >
      <div class="text-gray-400 mb-4">
        <Info :size="48" />
      </div>
      <div class="text-gray-400 text-center">
        <div class="font-semibold mb-2">No data available</div>
        <div class="text-sm">Run an analysis to see visualizations</div>
      </div>
    </div>

    <!-- Chart Container -->
    <div v-else class="bg-gray-800 rounded-lg p-4 border border-gray-600">
      <div class="chart-container" style="height: 400px">
        <!-- Simple bar chart visualization -->
        <div v-if="chartType === CHART_TYPES.BAR" class="bar-chart">
          <div
            v-for="(item, index) in chartData"
            :key="index"
            class="bar-item"
            :style="{ height: getBarHeight(item) }"
          >
            <div class="bar-label">
              {{ item.name }}
            </div>
            <div class="bar-value">
              {{ formatFileSize(getValue(item)) }}
            </div>
          </div>
        </div>

        <!-- Simple line chart visualization -->
        <div v-else-if="chartType === CHART_TYPES.LINE" class="line-chart">
          <svg width="100%" height="100%" viewBox="0 0 600 400">
            <polyline :points="getLinePoints()" fill="none" :stroke="COLORS[0]" stroke-width="3" />
            <circle
              v-for="(point, index) in chartData"
              :key="index"
              :cx="getPointX(index)"
              :cy="getPointY(index)"
              r="6"
              :fill="COLORS[0]"
            />
          </svg>
        </div>

        <!-- Simple pie chart visualization -->
        <div
          v-else-if="chartType === CHART_TYPES.PIE || chartType === CHART_TYPES.DOUGHNUT"
          class="pie-chart"
        >
          <svg width="100%" height="100%" viewBox="0 0 400 400">
            <circle
              v-for="(slice, index) in pieSlices"
              :key="index"
              cx="200"
              cy="200"
              :r="chartType === CHART_TYPES.DOUGHNUT ? 120 : 150"
              fill="transparent"
              :stroke="COLORS[index % COLORS.length]"
              :stroke-width="chartType === CHART_TYPES.DOUGHNUT ? 60 : 30"
              :stroke-dasharray="`${slice.circumference} ${slice.remaining}`"
              :stroke-dashoffset="slice.offset"
              transform="rotate(-90 200 200)"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="data && data.datasets" class="mt-4 flex flex-wrap gap-4 justify-center">
      <div v-for="(dataset, index) in data.datasets" :key="index" class="flex items-center gap-2">
        <div class="w-4 h-4 rounded" :style="{ backgroundColor: COLORS[index % COLORS.length] }" />
        <span class="text-sm text-gray-300">{{ dataset.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Donut,
  Sun,
  Moon,
  Info,
} from "lucide-vue-next";

// Chart type constants
const CHART_TYPES = {
  BAR: "bar",
  LINE: "line",
  PIE: "pie",
  DOUGHNUT: "doughnut",
} as const;

type ChartTypeType = (typeof CHART_TYPES)[keyof typeof CHART_TYPES];

// Enhanced color palette for better accessibility
const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#84cc16", // Lime
  "#ec4899", // Pink
  "#6b7280", // Gray
];

// Dark theme colors
const DARK_THEME = {
  background: "#0f172a",
  text: "#f8fafc",
  grid: "#334155",
  tooltip: "#1e293b",
};

// Light theme colors
const LIGHT_THEME = {
  background: "#ffffff",
  text: "#0f172a",
  grid: "#e2e8f0",
  tooltip: "#f8fafc",
};

interface AnalysisData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
}

interface AnalysisChartProps {
  data: AnalysisData;
  isLoading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<AnalysisChartProps>(), {
  isLoading: false,
  error: null,
});

const chartType = ref<ChartTypeType>(CHART_TYPES.BAR);
const isDarkTheme = ref(true);

// Convert Chart.js data format to Recharts format
const chartData = computed(() => {
  if (!props.data || !props.data.labels || !props.data.datasets || props.data.labels.length === 0) {
    return [];
  }

  return props.data.labels.map((label, index) => {
    const dataPoint: Record<string, any> = { name: label };
    props.data.datasets.forEach((dataset, datasetIndex) => {
      dataPoint[dataset.label] = dataset.data[index] || 0;
    });
    return dataPoint;
  });
});

// Chart type buttons configuration
const chartTypeButtons = computed(() => [
  { type: CHART_TYPES.BAR, icon: BarChart3, label: "Bar" },
  { type: CHART_TYPES.LINE, icon: LineChartIcon, label: "Line" },
  { type: CHART_TYPES.PIE, icon: PieChartIcon, label: "Pie" },
  { type: CHART_TYPES.DOUGHNUT, icon: Donut, label: "Doughnut" },
]);

// Toggle theme
const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
};

// Format file size for tooltips
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Get value from data point
const getValue = (item: Record<string, any>): number => {
  const keys = Object.keys(item).filter((key) => key !== "name");
  return keys.length > 0 ? item[keys[0]] : 0;
};

// Get bar height for visualization
const getBarHeight = (item: Record<string, any>): string => {
  const value = getValue(item);
  const maxValue = Math.max(...chartData.value.map((d) => getValue(d)));
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return `${Math.max(percentage, 5)}%`;
};

// Get line points for SVG
const getLinePoints = (): string => {
  return chartData.value
    .map((item, index) => {
      const x = getPointX(index);
      const y = getPointY(index);
      return `${x},${y}`;
    })
    .join(" ");
};

// Get point X coordinate
const getPointX = (index: number): number => {
  const width = 600;
  const padding = 50;
  const availableWidth = width - padding * 2;
  const step = availableWidth / (chartData.value.length - 1 || 1);
  return padding + step * index;
};

// Get point Y coordinate
const getPointY = (index: number): number => {
  const height = 400;
  const padding = 50;
  const availableHeight = height - padding * 2;
  const value = getValue(chartData.value[index]);
  const maxValue = Math.max(...chartData.value.map((d) => getValue(d)));
  const percentage = maxValue > 0 ? value / maxValue : 0;
  return height - padding - percentage * availableHeight;
};

// Calculate pie slices
const pieSlices = computed(() => {
  if (!props.data || !props.data.labels || !props.data.datasets) {
    return [];
  }

  const total = props.data.datasets[0]?.data.reduce((sum, val) => sum + val, 0) || 0;
  let offset = 0;
  const circumference = 2 * Math.PI * 150;

  return props.data.labels.map((label, index) => {
    const value = props.data.datasets[0]?.data[index] || 0;
    const percentage = total > 0 ? value / total : 0;
    const sliceCircumference = percentage * circumference;
    const sliceOffset = offset;
    offset += sliceCircumference;

    return {
      circumference: sliceCircumference,
      remaining: circumference - sliceCircumference,
      offset: -sliceOffset,
    };
  });
});
</script>

<style scoped>
.chart-container {
  @apply relative w-full h-full;
}

.bar-chart {
  @apply flex items-end justify-around h-full gap-2 px-4;
}

.bar-item {
  @apply relative flex flex-col items-center justify-end bg-blue-500 rounded-t transition-all hover:bg-blue-600;
  width: 8%;
  min-height: 20px;
}

.bar-label {
  @apply absolute bottom-0 left-0 right-0 text-xs text-white text-center p-1 truncate;
}

.bar-value {
  @apply absolute -top-6 text-xs text-gray-300;
}

.line-chart {
  @apply w-full h-full;
}

.pie-chart {
  @apply flex items-center justify-center w-full h-full;
}
</style>

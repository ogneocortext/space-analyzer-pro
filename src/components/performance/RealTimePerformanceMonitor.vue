<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Card } from "@/design-system/components";
import { Activity, HardDrive, Cpu, MemoryStick, Clock, TrendingUp } from "lucide-vue-next";

interface RealTimeMetrics {
  timestamp: number;
  filesPerSecond: number;
  bytesPerSecond: number;
  memoryUsage: number;
  diskReads: number;
  cpuUsage: number;
  ioWaitTime: number;
}

const props = defineProps<{
  isActive: boolean;
  currentMetrics?: RealTimeMetrics;
}>();

// Chart data
const chartData = ref<RealTimeMetrics[]>([]);
const maxDataPoints = 60; // Keep last 60 data points (1 minute at 1-second intervals)

// Real-time updates
let updateInterval: NodeJS.Timeout | null = null;

onMounted(() => {
  if (props.isActive) {
    startRealTimeUpdates();
  }
});

onUnmounted(() => {
  stopRealTimeUpdates();
});

function startRealTimeUpdates() {
  updateInterval = setInterval(() => {
    if (props.currentMetrics) {
      addDataPoint(props.currentMetrics);
    }
  }, 1000);
}

function stopRealTimeUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

function addDataPoint(metrics: RealTimeMetrics) {
  chartData.value.push(metrics);
  if (chartData.value.length > maxDataPoints) {
    chartData.value.shift();
  }
}

// Computed properties for chart visualization
const throughputData = computed(() => {
  return chartData.value.map((point) => point.filesPerSecond);
});

const memoryData = computed(() => {
  return chartData.value.map((point) => point.memoryUsage);
});

const cpuData = computed(() => {
  return chartData.value.map((point) => point.cpuUsage);
});

const currentThroughput = computed(() => {
  const latest = chartData.value[chartData.value.length - 1];
  return latest?.filesPerSecond || 0;
});

const currentMemoryUsage = computed(() => {
  const latest = chartData.value[chartData.value.length - 1];
  return latest?.memoryUsage || 0;
});

const currentCpuUsage = computed(() => {
  const latest = chartData.value[chartData.value.length - 1];
  return latest?.cpuUsage || 0;
});

const averageThroughput = computed(() => {
  if (chartData.value.length === 0) return 0;
  const sum = chartData.value.reduce((acc, point) => acc + point.filesPerSecond, 0);
  return sum / chartData.value.length;
});

const peakThroughput = computed(() => {
  if (chartData.value.length === 0) return 0;
  return Math.max(...chartData.value.map((point) => point.filesPerSecond));
});

const performanceTrend = computed(() => {
  if (chartData.value.length < 10) return "stable";
  const recent = chartData.value.slice(-10);
  const older = chartData.value.slice(-20, -10);

  const recentAvg = recent.reduce((acc, point) => acc + point.filesPerSecond, 0) / recent.length;
  const olderAvg =
    older.length > 0
      ? older.reduce((acc, point) => acc + point.filesPerSecond, 0) / older.length
      : recentAvg;

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (change > 10) return "improving";
  if (change < -10) return "declining";
  return "stable";
});

const trendIcon = computed(() => {
  switch (performanceTrend.value) {
    case "improving":
      return TrendingUp;
    case "declining":
      return TrendingUp; // Will be rotated in CSS
    default:
      return Activity;
  }
});

const trendColor = computed(() => {
  switch (performanceTrend.value) {
    case "improving":
      return "text-green-600";
    case "declining":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
});
</script>

<template>
  <Card class="real-time-performance-monitor">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <Activity class="w-5 h-5" :class="{ 'animate-pulse': isActive }" />
          Real-Time Performance
        </h3>
        <div class="flex items-center gap-2">
          <div class="text-sm" :class="trendColor">
            <component
              :is="trendIcon"
              class="w-4 h-4"
              :class="{ 'rotate-180': performanceTrend === 'declining' }"
            />
            {{ performanceTrend }}
          </div>
          <div
            class="w-2 h-2 rounded-full"
            :class="{ 'bg-green-500 animate-pulse': isActive, 'bg-gray-400': !isActive }"
          ></div>
        </div>
      </div>
    </template>

    <div v-if="!isActive" class="text-center py-8 text-gray-500">
      <Activity class="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <p>Performance monitoring will start during scanning</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Current Metrics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="metric-card">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp class="w-4 h-4" />
            Throughput
          </div>
          <div class="text-2xl font-bold text-gray-900">
            {{ currentThroughput.toLocaleString() }}
          </div>
          <div class="text-xs text-gray-500">files/sec</div>
        </div>

        <div class="metric-card">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <MemoryStick class="w-4 h-4" />
            Memory
          </div>
          <div class="text-2xl font-bold text-gray-900">
            {{ currentMemoryUsage.toLocaleString() }}
          </div>
          <div class="text-xs text-gray-500">MB</div>
        </div>

        <div class="metric-card">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <Cpu class="w-4 h-4" />
            CPU
          </div>
          <div class="text-2xl font-bold text-gray-900">{{ currentCpuUsage.toFixed(1) }}%</div>
          <div class="text-xs text-gray-500">usage</div>
        </div>

        <div class="metric-card">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <HardDrive class="w-4 h-4" />
            Disk I/O
          </div>
          <div class="text-2xl font-bold text-gray-900">
            {{ currentMetrics?.diskReads?.toLocaleString() || 0 }}
          </div>
          <div class="text-xs text-gray-500">reads</div>
        </div>
      </div>

      <!-- Performance Summary -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="summary-card">
          <div class="summary-label">Average Throughput</div>
          <div class="summary-value">
            {{ averageThroughput.toFixed(0).toLocaleString() }} files/sec
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Peak Throughput</div>
          <div class="summary-value text-green-600">
            {{ peakThroughput.toLocaleString() }} files/sec
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Data Points</div>
          <div class="summary-value">{{ chartData.length }} / {{ maxDataPoints }}</div>
        </div>
      </div>

      <!-- Mini Charts -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="chart-card">
          <div class="chart-title">Throughput Trend</div>
          <div class="chart-container">
            <svg viewBox="0 0 200 60" class="w-full h-full">
              <polyline
                :points="
                  throughputData
                    .map(
                      (value, index) =>
                        `${(index / (throughputData.length - 1)) * 200},${60 - (value / Math.max(...throughputData)) * 60}`
                    )
                    .join(' ')
                "
                fill="none"
                stroke="rgb(34, 197, 94)"
                stroke-width="2"
              />
              <polyline
                :points="
                  throughputData
                    .map(
                      (value, index) =>
                        `${(index / (throughputData.length - 1)) * 200},${60 - (value / Math.max(...throughputData)) * 60}`
                    )
                    .join(' ')
                "
                fill="rgba(34, 197, 94, 0.1)"
              />
            </svg>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-title">Memory Usage</div>
          <div class="chart-container">
            <svg viewBox="0 0 200 60" class="w-full h-full">
              <polyline
                :points="
                  memoryData
                    .map(
                      (value, index) =>
                        `${(index / (memoryData.length - 1)) * 200},${60 - (value / Math.max(...memoryData)) * 60}`
                    )
                    .join(' ')
                "
                fill="none"
                stroke="rgb(59, 130, 246)"
                stroke-width="2"
              />
              <polyline
                :points="
                  memoryData
                    .map(
                      (value, index) =>
                        `${(index / (memoryData.length - 1)) * 200},${60 - (value / Math.max(...memoryData)) * 60}`
                    )
                    .join(' ')
                "
                fill="rgba(59, 130, 246, 0.1)"
              />
            </svg>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-title">CPU Usage</div>
          <div class="chart-container">
            <svg viewBox="0 0 200 60" class="w-full h-full">
              <polyline
                :points="
                  cpuData
                    .map(
                      (value, index) =>
                        `${(index / (cpuData.length - 1)) * 200},${60 - (value / 100) * 60}`
                    )
                    .join(' ')
                "
                fill="none"
                stroke="rgb(251, 146, 60)"
                stroke-width="2"
              />
              <polyline
                :points="
                  cpuData
                    .map(
                      (value, index) =>
                        `${(index / (cpuData.length - 1)) * 200},${60 - (value / 100) * 60}`
                    )
                    .join(' ')
                "
                fill="rgba(251, 146, 60, 0.1)"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Performance Alerts -->
      <div v-if="currentCpuUsage > 80 || currentMemoryUsage > 500" class="alert-card">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-red-800">
            Performance Alert:
            {{ currentCpuUsage > 80 ? "High CPU usage" : "High memory usage" }} detected
          </span>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped>
/* Real-Time Performance Monitor - Basic Tailwind Classes */
.real-time-performance-monitor {
  transition: all 0.3s ease;
}

/* Metric Cards - Consistent with PerformanceMonitor */
.metric-card {
  padding: 0.75rem;
  background-color: rgb(248 250 252);
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
}

/* Summary Cards - Highlighted information */
.summary-card {
  padding: 0.75rem;
  background-color: rgb(239 246 255);
  border-radius: 0.5rem;
  border: 1px solid rgb(219 234 254);
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(29 78 216);
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: rgb(30 58 138);
}

/* Chart Cards - Data visualization containers */
.chart-card {
  padding: 0.75rem;
  background-color: rgb(248 250 252);
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
}

.chart-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(55 65 81);
  margin-bottom: 0.5rem;
}

.chart-container {
  height: 4rem;
  width: 100%;
}

/* Alert Cards - Warning and error states */
.alert-card {
  padding: 0.75rem;
  background-color: rgb(254 242 242);
  border: 1px solid rgb(252 165 165);
  border-radius: 0.5rem;
}

/* Animation Classes - Consistent timing */
.rotate-180 {
  transform: rotate(180deg);
}

/* Status Indicators */
.status-active {
  background-color: rgb(34 197 94);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.status-inactive {
  background-color: rgb(156 163 175);
}

/* Trend Indicators */
.trend-improving {
  color: rgb(34 197 94);
}

.trend-declining {
  color: rgb(239 68 68);
}

.trend-stable {
  color: rgb(107 114 128);
}
</style>

<script setup lang="ts">
import { computed } from "vue";
import { Card } from "@/design-system/components";
import type { PerformanceMetrics } from "@/services/AnalysisBridge";

interface Props {
  performance: PerformanceMetrics | null;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
});

// Computed properties for formatted values
const scanDuration = computed(() => {
  if (!props.performance?.scan_duration_ms) return "0ms";
  const duration = props.performance.scan_duration_ms;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}m`;
});

const throughputColor = computed(() => {
  const fps = props.performance?.files_per_second || 0;
  if (fps > 1000) return "text-green-600";
  if (fps > 500) return "text-yellow-600";
  return "text-red-600";
});

const memoryUsageColor = computed(() => {
  const memory = props.performance?.memory_peak_mb || 0;
  if (memory < 100) return "text-green-600";
  if (memory < 500) return "text-yellow-600";
  return "text-red-600";
});

const diskEfficiency = computed(() => {
  if (!props.performance?.disk_reads || !props.performance?.disk_bytes_read) return null;
  const avgFileSize = props.performance.disk_bytes_read / props.performance.disk_reads;
  return avgFileSize;
});

const cacheEfficiency = computed(() => {
  const hits = props.performance?.cache_hits || 0;
  const misses = props.performance?.cache_misses || 0;
  const total = hits + misses;
  if (total === 0) return null;
  return (hits / total) * 100;
});

const cpuUsageColor = computed(() => {
  const cpu = props.performance?.cpu_usage_percent || 0;
  if (cpu < 50) return "text-green-600";
  if (cpu < 80) return "text-yellow-600";
  return "text-red-600";
});

const performanceGrade = computed(() => {
  const fps = props.performance?.files_per_second || 0;
  const memory = props.performance?.memory_peak_mb || 0;
  const cpu = props.performance?.cpu_usage_percent || 0;

  let score = 100;

  // Files per second scoring
  if (fps > 1000) score += 0;
  else if (fps > 500) score -= 10;
  else score -= 25;

  // Memory usage scoring
  if (memory < 100) score += 0;
  else if (memory < 500) score -= 10;
  else score -= 25;

  // CPU usage scoring
  if (cpu < 50) score += 0;
  else if (cpu < 80) score -= 10;
  else score -= 25;

  if (score >= 90) return { grade: "A", color: "text-green-600" };
  if (score >= 80) return { grade: "B", color: "text-yellow-600" };
  if (score >= 70) return { grade: "C", color: "text-orange-600" };
  return { grade: "D", color: "text-red-600" };
});
</script>

<template>
  <Card class="performance-monitor" :class="{ loading: isLoading }">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Performance Monitor</h3>
        <div class="flex items-center gap-2">
          <div class="text-sm" :class="performanceGrade.color">
            Grade: {{ performanceGrade.grade }}
          </div>
          <div v-if="isLoading" class="animate-spin">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!performance" class="text-center py-8 text-gray-500">
      No performance data available
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Scan Duration -->
      <div class="metric-card">
        <div class="metric-label">Scan Duration</div>
        <div class="metric-value">{{ scanDuration }}</div>
        <div class="metric-subtitle">Total time</div>
      </div>

      <!-- Throughput -->
      <div class="metric-card">
        <div class="metric-label">Files/Second</div>
        <div class="metric-value" :class="throughputColor">
          {{ performance.files_per_second?.toLocaleString() || "N/A" }}
        </div>
        <div class="metric-subtitle">Processing speed</div>
      </div>

      <!-- Data Throughput -->
      <div class="metric-card">
        <div class="metric-label">Data/Second</div>
        <div class="metric-value">{{ formatBytes(performance.bytes_per_second || 0) }}/s</div>
        <div class="metric-subtitle">Data processed</div>
      </div>

      <!-- Memory Usage -->
      <div class="metric-card">
        <div class="metric-label">Peak Memory</div>
        <div class="metric-value" :class="memoryUsageColor">
          {{ performance.memory_peak_mb?.toLocaleString() || "N/A" }} MB
        </div>
        <div class="metric-subtitle">Memory usage</div>
      </div>

      <!-- Current Memory -->
      <div class="metric-card" v-if="performance.memory_current_mb">
        <div class="metric-label">Current Memory</div>
        <div class="metric-value">{{ performance.memory_current_mb.toLocaleString() }} MB</div>
        <div class="metric-subtitle">Current usage</div>
      </div>

      <!-- Disk Operations -->
      <div class="metric-card">
        <div class="metric-label">Disk Reads</div>
        <div class="metric-value">
          {{ performance.disk_reads?.toLocaleString() || "N/A" }}
        </div>
        <div class="metric-subtitle">{{ formatBytes(performance.disk_bytes_read || 0) }} total</div>
      </div>

      <!-- Cache Performance -->
      <div class="metric-card" v-if="cacheEfficiency !== null">
        <div class="metric-label">Cache Hit Rate</div>
        <div
          class="metric-value"
          :class="
            cacheEfficiency! > 80
              ? 'text-green-600'
              : cacheEfficiency! > 60
                ? 'text-yellow-600'
                : 'text-red-600'
          "
        >
          {{ cacheEfficiency?.toFixed(1) }}%
        </div>
        <div class="metric-subtitle">
          {{ performance.cache_hits || 0 }} hits /
          {{ (performance.cache_hits || 0) + (performance.cache_misses || 0) }} total
        </div>
      </div>

      <!-- CPU Usage -->
      <div class="metric-card" v-if="performance.cpu_usage_percent">
        <div class="metric-label">CPU Usage</div>
        <div class="metric-value" :class="cpuUsageColor">
          {{ performance.cpu_usage_percent?.toFixed(1) }}%
        </div>
        <div class="metric-subtitle">Processor usage</div>
      </div>

      <!-- Thread Count -->
      <div class="metric-card" v-if="performance.thread_count">
        <div class="metric-label">Threads</div>
        <div class="metric-value">
          {{ performance.thread_count }}
        </div>
        <div class="metric-subtitle">Parallel processing</div>
      </div>

      <!-- I/O Wait Time -->
      <div class="metric-card" v-if="performance.io_wait_time_ms">
        <div class="metric-label">I/O Wait</div>
        <div
          class="metric-value"
          :class="performance.io_wait_time_ms! > 1000 ? 'text-red-600' : 'text-green-600'"
        >
          {{ performance.io_wait_time_ms }}ms
        </div>
        <div class="metric-subtitle">Disk wait time</div>
      </div>

      <!-- System Load -->
      <div class="metric-card" v-if="performance.system_load_average">
        <div class="metric-label">System Load</div>
        <div
          class="metric-value"
          :class="performance.system_load_average! > 2.0 ? 'text-red-600' : 'text-green-600'"
        >
          {{ performance.system_load_average?.toFixed(2) }}
        </div>
        <div class="metric-subtitle">System average</div>
      </div>

      <!-- Disk Efficiency -->
      <div class="metric-card" v-if="diskEfficiency">
        <div class="metric-label">Avg File Size</div>
        <div class="metric-value">
          {{ formatBytes(diskEfficiency) }}
        </div>
        <div class="metric-subtitle">Average per file</div>
      </div>
    </div>

    <!-- Performance Insights -->
    <div v-if="performance" class="mt-6 pt-6 border-t border-gray-200">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">Performance Insights</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="insight-item">
          <div class="insight-label">Scan Efficiency</div>
          <div class="insight-value" :class="throughputColor">
            {{
              performance.files_per_second! > 1000
                ? "Excellent"
                : performance.files_per_second! > 500
                  ? "Good"
                  : "Needs Optimization"
            }}
          </div>
        </div>
        <div class="insight-item">
          <div class="insight-label">Memory Efficiency</div>
          <div class="insight-value" :class="memoryUsageColor">
            {{
              (performance.memory_peak_mb || 0) < 100
                ? "Excellent"
                : (performance.memory_peak_mb || 0) < 500
                  ? "Good"
                  : "High Usage"
            }}
          </div>
        </div>
        <div class="insight-item" v-if="performance.disk_reads">
          <div class="insight-label">Disk Operations</div>
          <div class="insight-value">
            {{ performance.disk_reads! > 10000 ? "High Volume" : "Normal" }}
          </div>
        </div>
        <div class="insight-item" v-if="performance.cpu_usage_percent">
          <div class="insight-label">CPU Utilization</div>
          <div class="insight-value" :class="cpuUsageColor">
            {{
              performance.cpu_usage_percent! < 50
                ? "Optimal"
                : performance.cpu_usage_percent! < 80
                  ? "Moderate"
                  : "High"
            }}
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<script lang="ts">
// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
</script>

<style scoped>
/* Performance Monitor - Basic Tailwind Classes */
.performance-monitor {
  transition: all 0.3s ease;
}

.performance-monitor.loading {
  opacity: 0.7;
}

/* Metric Cards - Using project's existing color scheme */
.metric-card {
  padding: 1rem;
  background-color: rgb(248 250 252);
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(107 114 128);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(17 24 39);
  margin-top: 0.25rem;
}

.metric-subtitle {
  font-size: 0.75rem;
  color: rgb(107 114 128);
  margin-top: 0.25rem;
}

/* Insight Items - Simple layout */
.insight-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: rgb(248 250 252);
  border-radius: 0.25rem;
}

.insight-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
}

.insight-value {
  font-size: 0.875rem;
  font-weight: 600;
}

/* Performance Grade Indicators - Simple color classes */
.performance-grade-a {
  color: rgb(34 197 94);
}
.performance-grade-b {
  color: rgb(59 130 246);
}
.performance-grade-c {
  color: rgb(251 146 60);
}
.performance-grade-d {
  color: rgb(239 68 68);
}

/* Metric Value Color Indicators - Simple color classes */
.metric-excellent {
  color: rgb(34 197 94);
}
.metric-good {
  color: rgb(59 130 246);
}
.metric-warning {
  color: rgb(251 146 60);
}
.metric-critical {
  color: rgb(239 68 68);
}
</style>

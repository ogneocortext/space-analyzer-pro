<script setup lang="ts">
import { computed } from "vue";
import { Card } from "@/design-system/components";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  HardDrive,
  MemoryStick,
  Cpu,
  Clock,
  BarChart3,
} from "lucide-vue-next";
import type { PerformanceMetrics } from "@/services/analysis/AnalysisBridge";

interface Props {
  performance: PerformanceMetrics | null;
  scanSize?: number; // Number of files scanned
  scanDuration?: number; // Duration in milliseconds
}

const props = withDefaults(defineProps<Props>(), {
  scanSize: 0,
  scanDuration: 0,
});

// Performance insights computed properties
const insights = computed(() => {
  if (!props.performance) return [];

  const insights = [];
  const { performance } = props;

  // Throughput analysis
  if (performance.files_per_second) {
    if (performance.files_per_second > 1000) {
      insights.push({
        type: "excellent",
        title: "Excellent Throughput",
        description: `Processing ${performance.files_per_second.toLocaleString()} files/second - very fast performance!`,
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      });
    } else if (performance.files_per_second > 500) {
      insights.push({
        type: "good",
        title: "Good Throughput",
        description: `Processing ${performance.files_per_second.toLocaleString()} files/second - decent performance.`,
        icon: TrendingUp,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
      });
    } else {
      insights.push({
        type: "warning",
        title: "Slow Throughput",
        description: `Only ${performance.files_per_second.toLocaleString()} files/second. Consider optimizing scan settings.`,
        icon: AlertTriangle,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
      });
    }
  }

  // Memory usage analysis
  if (performance.memory_peak_mb) {
    if (performance.memory_peak_mb > 1000) {
      insights.push({
        type: "critical",
        title: "High Memory Usage",
        description: `${performance.memory_peak_mb.toLocaleString()} MB peak memory. Consider reducing scan scope or enabling memory optimization.`,
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
      });
    } else if (performance.memory_peak_mb > 500) {
      insights.push({
        type: "warning",
        title: "Moderate Memory Usage",
        description: `${performance.memory_peak_mb.toLocaleString()} MB peak memory. Monitor for larger scans.`,
        icon: Info,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
      });
    } else {
      insights.push({
        type: "good",
        title: "Efficient Memory Usage",
        description: `Only ${performance.memory_peak_mb.toLocaleString()} MB peak memory - very efficient!`,
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
      });
    }
  }

  // Disk I/O analysis
  if (performance.disk_reads && performance.disk_bytes_read) {
    const avgFileSize = performance.disk_bytes_read / performance.disk_reads;
    if (avgFileSize < 1024) {
      // Less than 1KB average
      insights.push({
        type: "info",
        title: "Many Small Files",
        description: `Average file size is ${formatBytes(avgFileSize)}. Consider grouping small files or using compression.`,
        icon: HardDrive,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
      });
    } else if (avgFileSize > 100 * 1024 * 1024) {
      // More than 100MB average
      insights.push({
        type: "info",
        title: "Large Files Detected",
        description: `Average file size is ${formatBytes(avgFileSize)}. Consider parallel processing for better performance.`,
        icon: Zap,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200",
      });
    }
  }

  // CPU usage analysis
  if (performance.cpu_usage_percent) {
    if (performance.cpu_usage_percent > 80) {
      insights.push({
        type: "warning",
        title: "High CPU Usage",
        description: `${performance.cpu_usage_percent.toFixed(1)}% CPU usage. Consider reducing parallel processing or using CPU optimization.`,
        icon: Cpu,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
      });
    } else if (performance.cpu_usage_percent < 20) {
      insights.push({
        type: "info",
        title: "Low CPU Usage",
        description: `Only ${performance.cpu_usage_percent.toFixed(1)}% CPU usage. Consider increasing parallel processing for better performance.`,
        icon: Cpu,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
      });
    }
  }

  // I/O wait analysis
  if (performance.io_wait_time_ms && performance.io_wait_time_ms > 1000) {
    insights.push({
      type: "warning",
      title: "High I/O Wait Time",
      description: `${performance.io_wait_time_ms}ms I/O wait detected. Consider using faster storage or optimizing file access patterns.`,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
    });
  }

  // Cache efficiency analysis
  if (performance.cache_hits !== undefined && performance.cache_misses !== undefined) {
    const total = performance.cache_hits + performance.cache_misses;
    if (total > 0) {
      const hitRate = (performance.cache_hits / total) * 100;
      if (hitRate < 50) {
        insights.push({
          type: "warning",
          title: "Low Cache Hit Rate",
          description: `Only ${hitRate.toFixed(1)}% cache hit rate. Consider optimizing cache strategy.`,
          icon: BarChart3,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
        });
      } else if (hitRate > 90) {
        insights.push({
          type: "excellent",
          title: "Excellent Cache Performance",
          description: `${hitRate.toFixed(1)}% cache hit rate - very efficient caching!`,
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        });
      }
    }
  }

  return insights;
});

// Performance score
const performanceScore = computed(() => {
  if (!props.performance) return 0;

  let score = 100;
  const { performance } = props;

  // Throughput scoring (40% weight)
  if (performance.files_per_second) {
    if (performance.files_per_second > 1000) score += 0;
    else if (performance.files_per_second > 500) score -= 10;
    else score -= 25;
  }

  // Memory usage scoring (30% weight)
  if (performance.memory_peak_mb) {
    if (performance.memory_peak_mb < 100) score += 0;
    else if (performance.memory_peak_mb < 500) score -= 10;
    else score -= 25;
  }

  // CPU usage scoring (20% weight)
  if (performance.cpu_usage_percent) {
    if (performance.cpu_usage_percent < 50) score += 0;
    else if (performance.cpu_usage_percent < 80) score -= 10;
    else score -= 25;
  }

  // I/O efficiency scoring (10% weight)
  if (performance.io_wait_time_ms && performance.io_wait_time_ms > 1000) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
});

const performanceGrade = computed(() => {
  const score = performanceScore.value;
  if (score >= 90) return { grade: "A", color: "text-green-600", bgColor: "bg-green-100" };
  if (score >= 80) return { grade: "B", color: "text-blue-600", bgColor: "bg-blue-100" };
  if (score >= 70) return { grade: "C", color: "text-yellow-600", bgColor: "bg-yellow-100" };
  return { grade: "D", color: "text-red-600", bgColor: "bg-red-100" };
});

// Optimization recommendations
const recommendations = computed(() => {
  if (!props.performance) return [];

  const recommendations = [];
  const { performance } = props;

  if (performance.files_per_second && performance.files_per_second < 500) {
    recommendations.push({
      title: "Improve Scan Speed",
      description: "Enable parallel processing or reduce scan scope to improve throughput.",
      priority: "high",
    });
  }

  if (performance.memory_peak_mb && performance.memory_peak_mb > 500) {
    recommendations.push({
      title: "Optimize Memory Usage",
      description: "Consider excluding temporary files or enabling memory-efficient scanning.",
      priority: "medium",
    });
  }

  if (performance.cpu_usage_percent && performance.cpu_usage_percent > 80) {
    recommendations.push({
      title: "Reduce CPU Load",
      description: "Lower parallel processing threads or enable CPU throttling.",
      priority: "medium",
    });
  }

  if (performance.io_wait_time_ms && performance.io_wait_time_ms > 1000) {
    recommendations.push({
      title: "Optimize I/O Performance",
      description: "Use SSD storage or optimize file access patterns for better I/O performance.",
      priority: "low",
    });
  }

  return recommendations;
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
</script>

<template>
  <Card class="performance-insights">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Performance Insights</h3>
        <div class="flex items-center gap-2">
          <div class="text-sm font-medium" :class="performanceGrade.color">
            Score: {{ performanceScore }}/100
          </div>
          <div
            class="px-2 py-1 rounded-full text-xs font-bold"
            :class="performanceGrade.bgColor + ' ' + performanceGrade.color"
          >
            Grade {{ performanceGrade.grade }}
          </div>
        </div>
      </div>
    </template>

    <div v-if="!performance" class="text-center py-8 text-gray-500">
      <BarChart3 class="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <p>No performance data available for insights</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Performance Score Visualization -->
      <div class="score-visualization">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Overall Performance</span>
          <span class="text-sm font-bold" :class="performanceGrade.color"
            >{{ performanceScore }}/100</span
          >
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
          <div
            class="h-3 rounded-full transition-all duration-500 ease-out"
            :class="
              performanceScore >= 90
                ? 'bg-green-500'
                : performanceScore >= 80
                  ? 'bg-blue-500'
                  : performanceScore >= 70
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
            "
            :style="{ width: performanceScore + '%' }"
          ></div>
        </div>
      </div>

      <!-- Performance Insights -->
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-gray-700">Analysis Results</h4>
        <div class="space-y-2">
          <div
            v-for="(insight, index) in insights"
            :key="index"
            class="insight-item"
            :class="insight.bgColor + ' ' + insight.borderColor + ' border'"
          >
            <div class="flex items-start gap-3">
              <component
                :is="insight.icon"
                class="w-5 h-5 mt-0.5 shrink-0"
                :class="insight.color"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-900" :class="insight.color">
                  {{ insight.title }}
                </div>
                <div class="text-sm text-gray-600 mt-1">
                  {{ insight.description }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Optimization Recommendations -->
      <div v-if="recommendations.length > 0" class="space-y-3">
        <h4 class="text-sm font-semibold text-gray-700">Optimization Recommendations</h4>
        <div class="space-y-2">
          <div
            v-for="(rec, index) in recommendations"
            :key="index"
            class="recommendation-item p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-2 h-2 rounded-full mt-2"
                :class="
                  rec.priority === 'high'
                    ? 'bg-red-500'
                    : rec.priority === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                "
              ></div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">{{ rec.title }}</div>
                <div class="text-sm text-gray-600 mt-1">{{ rec.description }}</div>
                <div class="text-xs text-gray-500 mt-2">
                  Priority:
                  <span
                    class="font-medium"
                    :class="
                      rec.priority === 'high'
                        ? 'text-red-600'
                        : rec.priority === 'medium'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                    "
                  >
                    {{ rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Metrics Summary -->
      <div class="metrics-summary">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Key Metrics</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="metric-summary">
            <div class="text-xs text-gray-500">Throughput</div>
            <div class="text-lg font-bold text-gray-900">
              {{ performance.files_per_second?.toLocaleString() || "N/A" }}
            </div>
            <div class="text-xs text-gray-500">files/sec</div>
          </div>

          <div class="metric-summary">
            <div class="text-xs text-gray-500">Memory</div>
            <div class="text-lg font-bold text-gray-900">
              {{ performance.memory_peak_mb?.toLocaleString() || "N/A" }}
            </div>
            <div class="text-xs text-gray-500">MB peak</div>
          </div>

          <div class="metric-summary">
            <div class="text-xs text-gray-500">Duration</div>
            <div class="text-lg font-bold text-gray-900">
              {{ formatDuration(performance.scan_duration_ms || 0) }}
            </div>
            <div class="text-xs text-gray-500">total time</div>
          </div>

          <div class="metric-summary">
            <div class="text-xs text-gray-500">Disk I/O</div>
            <div class="text-lg font-bold text-gray-900">
              {{ performance.disk_reads?.toLocaleString() || "N/A" }}
            </div>
            <div class="text-xs text-gray-500">reads</div>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<script lang="ts">
// Helper function to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
</script>

<style scoped>
/* Performance Insights - Basic Tailwind Classes */
.performance-insights {
  transition: all 0.3s ease;
}

/* Score Visualization - Performance grading display */
.score-visualization {
  padding: 1rem;
  background-color: rgb(248 250 252);
  border-radius: 0.5rem;
}

/* Insight Items - Analysis results display */
.insight-item {
  padding: 0.75rem;
  border-radius: 0.5rem;
}

/* Recommendation Items - Actionable suggestions */
.recommendation-item {
  transition: all 0.2s ease;
}

.recommendation-item:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Metric Summary - Key metrics overview */
.metric-summary {
  padding: 0.75rem;
  background-color: rgb(248 250 252);
  border-radius: 0.5rem;
  text-align: center;
}

/* Insight Type Color Classes - Consistent with other components */
.insight-excellent {
  background-color: rgb(240 253 244);
  border-color: rgb(134 239 172);
  color: rgb(34 197 94);
}

.insight-good {
  background-color: rgb(239 246 255);
  border-color: rgb(147 197 253);
  color: rgb(59 130 246);
}

.insight-warning {
  background-color: rgb(254 252 232);
  border-color: rgb(252 211 77);
  color: rgb(245 158 11);
}

.insight-critical {
  background-color: rgb(254 242 242);
  border-color: rgb(252 165 165);
  color: rgb(239 68 68);
}

.insight-info {
  background-color: rgb(243 232 255);
  border-color: rgb(196 181 253);
  color: rgb(139 92 246);
}

/* Performance Score Visualization */
.score-bar-excellent {
  background-color: rgb(34 197 94);
}

.score-bar-good {
  background-color: rgb(59 130 246);
}

.score-bar-average {
  background-color: rgb(245 158 11);
}

.score-bar-poor {
  background-color: rgb(239 68 68);
}

/* Recommendation Priority Indicators */
.priority-high {
  background-color: rgb(239 68 68);
  color: rgb(239 68 68);
}

.priority-medium {
  background-color: rgb(245 158 11);
  color: rgb(245 158 11);
}

.priority-low {
  background-color: rgb(59 130 246);
  color: rgb(59 130 246);
}

/* Icon Sizing - Consistent across components */
.icon-small {
  width: 1rem;
  height: 1rem;
}

.icon-medium {
  width: 1.25rem;
  height: 1.25rem;
}

.icon-large {
  width: 1.5rem;
  height: 1.5rem;
}

/* Flex Utilities - AI-friendly naming */
.flex-no-shrink {
  flex-shrink: 0;
}

.flex-1-grow {
  flex: 1;
}

/* Text Utilities - Consistent sizing */
.text-label {
  font-size: 0.75rem;
  font-weight: 500;
}

.text-value {
  font-size: 1.125rem;
  font-weight: 700;
}

.text-description {
  font-size: 0.875rem;
}

/* Spacing Utilities - Consistent gaps */
.gap-tight {
  gap: 0.25rem;
}

.gap-normal {
  gap: 0.5rem;
}

.gap-loose {
  gap: 0.75rem;
}
</style>

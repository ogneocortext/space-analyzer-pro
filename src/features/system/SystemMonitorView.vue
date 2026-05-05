<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card } from "../../design-system/components";

const store = useAnalysisStore();
const refreshInterval = ref<number | null>(null);
const lastUpdate = ref(new Date());
const loading = ref(false);
const error = ref<string | null>(null);

// Real system metrics from backend API
const systemMetrics = ref({
  cpu: { usage: 0, cores: 0, model: "" },
  memory: { total: 0, used: 0, free: 0, percentage: 0 },
  disk: { used: 0, total: 0, percentage: 0, free: 0 },
  network: { interfaces: [], totalRx: 0, totalTx: 0, activeConnections: 0 },
  process: { uptime: 0, memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 }, pid: 0 },
});

// Fetch real system metrics from API
const fetchSystemMetrics = async () => {
  try {
    loading.value = true;
    error.value = null;

    const response = await fetch("/api/system/metrics");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    systemMetrics.value = data;
    lastUpdate.value = new Date();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch system metrics";
    error.value = errorMessage;
    console.error("Failed to fetch system metrics:", err);
  } finally {
    loading.value = false;
  }
};

// Run directory analysis to get category data
const runAnalysis = async () => {
  try {
    await store.handleAnalysis(store.path);
  } catch (err) {
    console.error("Failed to start analysis:", err);
  }
};

// Analysis-based metrics
const analysisMetrics = computed(() => {
  if (!store.analysisResult) return null;

  const files = store.analysisResult.files || [];
  const totalSize = store.analysisResult.totalSize || 0;

  // Calculate I/O estimate based on file count and sizes
  const avgFileSize = totalSize / (files.length || 1);
  const estimatedScanTime = files.length * 0.001; // ~1ms per file

  return {
    scannedFiles: files.length,
    scannedSize: totalSize,
    avgFileSize,
    estimatedScanTime,
    categories: store.analysisResult.categories || {},
  };
});

// Health score (0-100) based on real metrics
const healthScore = computed(() => {
  const diskUsage = systemMetrics.value.disk.percentage / 100;
  const memUsage = systemMetrics.value.memory.percentage / 100;
  const cpuUsage = systemMetrics.value.cpu.usage / 100;

  // Lower is better for these metrics
  let score = 100;
  score -= diskUsage * 30; // Disk usage penalty (max 30)
  score -= memUsage * 20; // Memory usage penalty (max 20)
  score -= cpuUsage * 10; // CPU usage penalty (max 10)

  return Math.max(0, Math.min(100, Math.round(score)));
});

onMounted(() => {
  // Fetch initial metrics
  fetchSystemMetrics();

  // Set up real-time updates
  refreshInterval.value = window.setInterval(fetchSystemMetrics, 2000);
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatSpeed(bytes: number): string {
  if (bytes === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getHealthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getProgressColor(percentage: number): string {
  if (percentage < 50) return "bg-emerald-500";
  if (percentage < 75) return "bg-yellow-500";
  if (percentage < 90) return "bg-orange-500";
  return "bg-red-500";
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">System Monitor</h1>
        <p class="text-slate-400 mt-1">Real-time system health and resource monitoring</p>
      </div>
      <div class="text-sm text-slate-500">
        <span v-if="loading" class="text-yellow-400">Loading...</span>
        <span v-else>Last updated: {{ lastUpdate.toLocaleTimeString() }}</span>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
      <div class="text-red-400 font-medium">Error loading system metrics</div>
      <div class="text-slate-400 text-sm">{{ error }}</div>
    </div>

    <!-- Health Score -->
    <Card title="System Health Score">
      <div class="flex items-center gap-8">
        <div class="relative w-32 h-32">
          <svg class="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              stroke-width="12"
              fill="none"
              class="text-slate-700"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              stroke-width="12"
              fill="none"
              :stroke-dasharray="351.86"
              :stroke-dashoffset="351.86 - (351.86 * healthScore) / 100"
              class="transition-all duration-500"
              :class="getHealthColor(healthScore)"
            />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-3xl font-bold" :class="getHealthColor(healthScore)">
              {{ healthScore }}
            </span>
          </div>
        </div>
        <div class="flex-1 space-y-2">
          <p class="text-slate-300">
            System health is
            <span class="font-semibold" :class="getHealthColor(healthScore)">
              {{
                healthScore >= 80
                  ? "Excellent"
                  : healthScore >= 60
                    ? "Good"
                    : healthScore >= 40
                      ? "Fair"
                      : "Poor"
              }}
            </span>
          </p>
          <p class="text-sm text-slate-500">
            Based on CPU load, memory usage, and available disk space
          </p>
        </div>
      </div>
    </Card>

    <!-- System Metrics -->
    <div class="grid grid-cols-4 gap-4">
      <!-- CPU -->
      <Card title="CPU Usage">
        <div class="text-3xl font-bold text-blue-400">
          {{ Math.round(systemMetrics.cpu.usage) }}%
        </div>
        <div class="text-sm text-slate-500">{{ systemMetrics.cpu.cores }} cores</div>
        <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-3">
          <div
            class="h-full bg-blue-500 rounded-full transition-all duration-500"
            :style="{ width: systemMetrics.cpu.usage + '%' }"
          />
        </div>
      </Card>

      <!-- Memory -->
      <Card title="Memory">
        <div class="text-3xl font-bold text-purple-400">
          {{ formatSize(systemMetrics.memory.used) }}
        </div>
        <div class="text-sm text-slate-500">of {{ formatSize(systemMetrics.memory.total) }}</div>
        <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-3">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="
              getProgressColor((systemMetrics.memory.used / systemMetrics.memory.total) * 100)
            "
            :style="{ width: (systemMetrics.memory.used / systemMetrics.memory.total) * 100 + '%' }"
          />
        </div>
      </Card>

      <!-- Disk -->
      <Card title="Disk Usage">
        <div class="text-3xl font-bold text-emerald-400">
          {{ formatSize(systemMetrics.disk.used) }}
        </div>
        <div class="text-sm text-slate-500">of {{ formatSize(systemMetrics.disk.total) }}</div>
        <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-3">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="getProgressColor((systemMetrics.disk.used / systemMetrics.disk.total) * 100)"
            :style="{ width: (systemMetrics.disk.used / systemMetrics.disk.total) * 100 + '%' }"
          />
        </div>
      </Card>

      <!-- Network -->
      <Card title="Network">
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="text-sm text-slate-500">Status</span>
            <span class="font-medium text-blue-400">
              {{ systemMetrics.network.interfaces.length > 0 ? "Connected" : "Disconnected" }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-slate-500">Interfaces</span>
            <span class="font-medium text-emerald-400">{{
              systemMetrics.network.interfaces.length
            }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-slate-500">Active Connections</span>
            <span class="font-medium text-purple-400">{{
              systemMetrics.network.activeConnections
            }}</span>
          </div>
          <div
            v-if="systemMetrics.network.interfaces.length > 0"
            class="mt-3 pt-3 border-t border-slate-700"
          >
            <div class="text-xs text-slate-500 mb-2">Network Interfaces:</div>
            <div class="space-y-1">
              <div
                v-for="iface in systemMetrics.network.interfaces.slice(0, 2)"
                :key="iface.name"
                class="flex justify-between text-xs"
              >
                <span class="text-slate-400">{{ iface.name }}</span>
                <span class="text-slate-300">{{ iface.address }}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Analysis Metrics -->
    <Card v-if="analysisMetrics" title="Scan Analysis Impact">
      <div class="grid grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-sm text-slate-500">Files Scanned</div>
          <div class="text-2xl font-bold text-blue-400">
            {{ analysisMetrics.scannedFiles.toLocaleString() }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-slate-500">Data Scanned</div>
          <div class="text-2xl font-bold text-purple-400">
            {{ formatSize(analysisMetrics.scannedSize) }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-slate-500">Avg File Size</div>
          <div class="text-2xl font-bold text-emerald-400">
            {{ formatSize(analysisMetrics.avgFileSize) }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-slate-500">Scan Time</div>
          <div class="text-2xl font-bold text-orange-400">
            {{ analysisMetrics.estimatedScanTime.toFixed(1) }}s
          </div>
        </div>
      </div>
    </Card>

    <!-- Storage Breakdown -->
    <div class="grid grid-cols-2 gap-6">
      <Card title="Storage by Category">
        <div
          v-if="analysisMetrics?.categories && Object.keys(analysisMetrics.categories).length > 0"
          class="space-y-2"
        >
          <div
            v-for="[category, data] in Object.entries(analysisMetrics.categories).sort(
              ([, a]: any, [, b]: any) => b.size - a.size
            )"
            :key="category"
            class="flex items-center justify-between p-2 bg-slate-800/50 rounded"
          >
            <span class="text-slate-300 capitalize">{{ category }}</span>
            <span class="font-medium text-slate-200">{{ formatSize(data.size) }}</span>
          </div>
        </div>
        <div v-else class="text-slate-500 text-center py-4">
          <div class="mb-4">
            <svg
              class="w-12 h-12 mx-auto text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
          </div>
          <div class="mb-2">No analysis data available</div>
          <div class="text-sm text-slate-600 mb-4">
            Run a directory scan to see storage breakdown by category
          </div>
          <Button @click="runAnalysis" variant="primary" size="sm"> Run Analysis </Button>
        </div>
      </Card>

      <Card title="Recommendations">
        <div class="space-y-3">
          <div
            v-if="systemMetrics.disk.used / systemMetrics.disk.total > 0.8"
            class="p-3 bg-red-500/10 border border-red-500/20 rounded"
          >
            <div class="font-medium text-red-400">Low Disk Space</div>
            <div class="text-sm text-slate-400">
              Consider cleaning up files or expanding storage
            </div>
          </div>
          <div v-else class="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
            <div class="font-medium text-blue-400">Disk Usage Monitoring</div>
            <div class="text-sm text-slate-400">
              Disk usage is at
              {{ Math.round((systemMetrics.disk.used / systemMetrics.disk.total) * 100) }}%. Monitor
              for growth.
            </div>
          </div>

          <div
            v-if="systemMetrics.memory.used / systemMetrics.memory.total > 0.7"
            class="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded"
          >
            <div class="font-medium text-yellow-400">High Memory Usage</div>
            <div class="text-sm text-slate-400">Close unused applications to free memory</div>
          </div>
          <div v-else class="p-3 bg-green-500/10 border border-green-500/20 rounded">
            <div class="font-medium text-green-400">Memory Usage OK</div>
            <div class="text-sm text-slate-400">
              Memory usage is at
              {{ Math.round((systemMetrics.memory.used / systemMetrics.memory.total) * 100) }}%
            </div>
          </div>

          <div
            v-if="systemMetrics.cpu.usage > 70"
            class="p-3 bg-orange-500/10 border border-orange-500/20 rounded"
          >
            <div class="font-medium text-orange-400">High CPU Load</div>
            <div class="text-sm text-slate-400">Check for resource-intensive processes</div>
          </div>
          <div v-else class="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
            <div class="font-medium text-purple-400">CPU Usage Normal</div>
            <div class="text-sm text-slate-400">
              CPU usage is at {{ Math.round(systemMetrics.cpu.usage) }}%
            </div>
          </div>

          <div
            v-if="healthScore >= 70"
            class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded"
          >
            <div class="font-medium text-emerald-400">System Health Good</div>
            <div class="text-sm text-slate-400">
              Health score: {{ healthScore }}/100. System is performing well.
            </div>
          </div>
          <div v-else class="p-3 bg-orange-500/10 border border-orange-500/20 rounded">
            <div class="font-medium text-orange-400">System Needs Attention</div>
            <div class="text-sm text-slate-400">
              Health score: {{ healthScore }}/100. Review system metrics.
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

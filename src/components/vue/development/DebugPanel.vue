<template>
  <div v-if="visible" class="fixed bottom-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
    <!-- Toggle Button -->
    <button
      @click="isExpanded = !isExpanded"
      class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-t-lg transition-colors"
    >
      <Bug :size="16" />
      <span class="text-sm font-medium">Debug Panel</span>
      <span :class="['transform transition-transform', isExpanded ? 'rotate-180' : '']">
        ▼
      </span>
    </button>

    <!-- Panel Content -->
    <div v-if="isExpanded" class="p-4 w-96 max-h-96 overflow-y-auto">
      <!-- Controls -->
      <div class="flex gap-2 mb-4">
        <button
          @click="isMonitoring = !isMonitoring"
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded text-xs text-white transition-colors',
            isMonitoring ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          ]"
        >
          <Pause v-if="isMonitoring" :size="12" />
          <Play v-else :size="12" />
          {{ isMonitoring ? 'Pause' : 'Monitor' }}
        </button>

        <button
          @click="handleViewLocalStorage"
          class="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors"
        >
          <Eye :size="12" />
          Storage
        </button>

        <button
          @click="handleClearMetrics"
          class="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs transition-colors"
        >
          <RotateCcw :size="12" />
          Clear Metrics
        </button>

        <button
          @click="handleClearLogs"
          class="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs transition-colors"
        >
          <Trash2 :size="12" />
          Clear Logs
        </button>

        <button
          @click="handleExportLogs"
          class="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors"
        >
          <Download :size="12" />
          Export
        </button>
      </div>

      <!-- Performance Metrics -->
      <div class="mb-4">
        <h4 class="text-sm font-semibold text-gray-300 mb-2">Performance Metrics</h4>
        <div class="bg-gray-800 rounded p-2 text-xs">
          <div v-if="Object.keys(metrics).length > 0">
            <div
              v-for="(value, key) in metrics"
              :key="key"
              class="flex justify-between py-1"
            >
              <span class="text-gray-400">{{ key }}:</span>
              <span class="text-green-400 font-mono">{{ value.toFixed(2) }}ms</span>
            </div>
          </div>
          <div v-else class="text-gray-500">
            No metrics available. Start monitoring.
          </div>
        </div>
      </div>

      <!-- Debug Logs -->
      <div>
        <h4 class="text-sm font-semibold text-gray-300 mb-2">Debug Logs</h4>
        <div class="bg-gray-800 rounded p-2 text-xs font-mono max-h-48 overflow-y-auto">
          <div v-if="logs.length > 0">
            <div
              v-for="(log, index) in logs"
              :key="index"
              class="text-gray-300 py-1 border-b border-gray-700"
            >
              {{ log }}
            </div>
          </div>
          <div v-else class="text-gray-500">
            No logs yet.
          </div>
        </div>
      </div>

      <!-- System Info -->
      <div class="mt-4 pt-4 border-t border-gray-700">
        <h4 class="text-sm font-semibold text-gray-300 mb-2">System Info</h4>
        <div class="bg-gray-800 rounded p-2 text-xs text-gray-400">
          <div>URL: {{ window.location.href }}</div>
          <div>User Agent: {{ navigator.userAgent.split(' ').slice(-2).join(' ') }}</div>
          <div>
            Viewport: {{ window.innerWidth }}x{{ window.innerHeight }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Bug, Play, Pause, RotateCcw, Trash2, Download, Eye } from 'lucide-vue-next';

interface DebugPanelProps {
  visible?: boolean;
}

const props = withDefaults(defineProps<DebugPanelProps>(), {
  visible: false,
});

const isExpanded = ref(false);
const metrics = ref<Record<string, number>>({});
const logs = ref<string[]>([]);
const isMonitoring = ref(false);
let intervalId: number | null = null;

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  logs.value = [`[${timestamp}] ${message}`, ...logs.value].slice(0, 100);
};

const handleClearLogs = () => {
  logs.value = [];
  addLog('Logs cleared');
};

const handleClearMetrics = () => {
  metrics.value = {};
  addLog('Performance metrics cleared');
};

const handleExportLogs = () => {
  const logData = {
    timestamp: new Date().toISOString(),
    metrics: metrics.value,
    logs: logs.value,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `space-analyzer-debug-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  addLog('Debug data exported');
};

const handleViewLocalStorage = () => {
  try {
    const performanceMetrics = localStorage.getItem('performance-metrics');
    if (performanceMetrics) {
      const data = JSON.parse(performanceMetrics);
      addLog(`Found ${data.length} stored performance metrics`);
      console.table(data);
    } else {
      addLog('No stored performance metrics found');
    }
  } catch (error) {
    addLog(`Error reading localStorage: ${error}`);
  }
};

watch(isMonitoring, (newValue) => {
  if (newValue) {
    intervalId = window.setInterval(() => {
      // Placeholder for actual performance monitoring
      metrics.value = {
        renderTime: Math.random() * 50,
        memoryUsage: Math.random() * 100,
        apiLatency: Math.random() * 200,
      };
    }, 1000);
  } else if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});
</script>

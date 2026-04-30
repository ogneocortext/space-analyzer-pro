<template>
  <div class="cache-monitor">
    <h3>🚀 Multi-Agent Orchestrator Cache</h3>

    <!-- Cache Metrics Display -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value">{{ formatPercent(cacheMetrics.hitRate) }}</div>
        <div class="metric-label">Hit Rate</div>
        <div class="metric-trend" :class="hitRateTrend">
          {{ hitRateTrend === 'good' ? '✅' : hitRateTrend === 'warning' ? '⚠️' : '❌' }}
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-value">{{ cacheMetrics.hits }}</div>
        <div class="metric-label">Cache Hits</div>
      </div>

      <div class="metric-card">
        <div class="metric-value">{{ cacheMetrics.misses }}</div>
        <div class="metric-label">Cache Misses</div>
      </div>

      <div class="metric-card">
        <div class="metric-value">{{ cacheMetrics.size }} / {{ cacheMetrics.maxSize }}</div>
        <div class="metric-label">Cache Entries</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: cacheUtilization + '%' }"></div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-value">{{ cacheMetrics.evictions }}</div>
        <div class="metric-label">Evictions</div>
      </div>
    </div>

    <!-- Cache Configuration -->
    <div class="config-section">
      <h4>⚙️ Cache Configuration</h4>
      <div class="config-form">
        <div class="form-group">
          <label>TTL (Time to Live):</label>
          <select v-model="selectedTTL" @change="updateConfig">
            <option :value="60000">1 minute (testing)</option>
            <option :value="300000">5 minutes</option>
            <option :value="600000">10 minutes (default)</option>
            <option :value="1800000">30 minutes</option>
            <option :value="3600000">1 hour</option>
          </select>
          <span class="help-text">How long cached data remains valid</span>
        </div>

        <div class="form-group">
          <label>Max Cache Size:</label>
          <select v-model="selectedMaxSize" @change="updateConfig">
            <option :value="10">10 entries</option>
            <option :value="50">50 entries (default)</option>
            <option :value="100">100 entries</option>
            <option :value="200">200 entries</option>
          </select>
          <span class="help-text">Maximum number of cached directory analyses</span>
        </div>

        <button @click="refreshMetrics" class="btn-refresh">
          🔄 Refresh Metrics
        </button>
      </div>
    </div>

    <!-- Performance Tips -->
    <div class="tips-section" v-if="showTips">
      <h4>💡 Performance Tips</h4>
      <ul>
        <li v-if="cacheMetrics.hitRate < 0.5">
          ⚠️ <strong>Low hit rate:</strong> Consider increasing cache TTL if you frequently re-scan the same directories
        </li>
        <li v-if="cacheMetrics.evictions > 10">
          ⚠️ <strong>High evictions:</strong> Increase max cache size to retain more directory analyses
        </li>
        <li v-if="cacheMetrics.size >= cacheMetrics.maxSize * 0.9">
          ⚠️ <strong>Cache full:</strong> Consider increasing max size or invalidating old entries
        </li>
        <li v-if="cacheMetrics.hitRate >= 0.8">
          ✅ <strong>Great hit rate!</strong> Your cache is working efficiently
        </li>
        <li>
          💡 <strong>Best practice:</strong> Set TTL based on how often your directories change
        </li>
      </ul>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { AnalysisBridge } from '@/services/AnalysisBridge';

// Props
const props = defineProps<{
  autoRefresh?: boolean;
  refreshInterval?: number;
}>();

// Emits
const emit = defineEmits<{
  (e: 'metrics-updated', metrics: CacheMetrics): void;
  (e: 'config-updated', config: CacheConfig): void;
}>;

// State
const analysisBridge = new AnalysisBridge();
const cacheMetrics = ref<CacheMetrics>({
  hits: 0,
  misses: 0,
  evictions: 0,
  size: 0,
  maxSize: 50,
  hitRate: 0
});

const selectedTTL = ref(600000); // 10 minutes default
const selectedMaxSize = ref(50); // 50 entries default
const error = ref<string | null>(null);
const showTips = ref(true);
let refreshTimer: number | null = null;

// Computed
const hitRateTrend = computed(() => {
  const rate = cacheMetrics.value.hitRate;
  if (rate >= 0.8) return 'good';
  if (rate >= 0.5) return 'warning';
  return 'bad';
});

const cacheUtilization = computed(() => {
  if (cacheMetrics.value.maxSize === 0) return 0;
  return (cacheMetrics.value.size / cacheMetrics.value.maxSize) * 100;
});

// Methods
const formatPercent = (value: number): string => {
  return (value * 100).toFixed(1) + '%';
};

const fetchMetrics = async () => {
  try {
    error.value = null;
    const metrics = await analysisBridge.getCacheMetrics();
    cacheMetrics.value = metrics;
    emit('metrics-updated', metrics);
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch cache metrics';
    console.error('Cache metrics error:', err);
  }
};

const updateConfig = async () => {
  try {
    error.value = null;
    const result = await analysisBridge.configureCache(
      selectedTTL.value,
      selectedMaxSize.value
    );
    emit('config-updated', result.config);
    // Refresh to show updated config
    await fetchMetrics();
  } catch (err: any) {
    error.value = err.message || 'Failed to update cache config';
    console.error('Cache config error:', err);
  }
};

const refreshMetrics = async () => {
  await fetchMetrics();
};

// Lifecycle
onMounted(() => {
  fetchMetrics();

  if (props.autoRefresh) {
    const interval = props.refreshInterval || 5000; // Default 5 seconds
    refreshTimer = window.setInterval(fetchMetrics, interval);
  }
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});

// Types
interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
  currentSize: number;
}
</script>

<style scoped>
.cache-monitor {
  padding: 20px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 12px;
  font-family: system-ui, -apple-system, sans-serif;
}

h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary, #333);
  font-size: 1.5rem;
}

h4 {
  margin: 20px 0 12px 0;
  color: var(--text-secondary, #666);
  font-size: 1.1rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;
}

.metric-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--primary-color, #007acc);
}

.metric-label {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
  margin-top: 4px;
}

.metric-trend {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 1.2rem;
}

.metric-trend.good { color: #28a745; }
.metric-trend.warning { color: #ffc107; }
.metric-trend.bad { color: #dc3545; }

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}

.config-section {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.config-form {
  display: grid;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-weight: 600;
  color: var(--text-primary, #333);
}

.form-group select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.help-text {
  font-size: 0.85rem;
  color: var(--text-muted, #888);
}

.btn-refresh {
  padding: 10px 20px;
  background: var(--primary-color, #007acc);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-refresh:hover {
  background: var(--primary-hover, #005fa3);
}

.tips-section {
  background: #e7f3ff;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #007acc;
}

.tips-section ul {
  margin: 0;
  padding-left: 20px;
}

.tips-section li {
  margin: 8px 0;
  line-height: 1.5;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 6px;
  margin-top: 16px;
}
</style>

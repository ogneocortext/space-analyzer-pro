<template>
  <div class="ai-insights">
    <h3>🧠 AI-Powered Insights</h3>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Analyzing directory with AI...</p>
      <span v-if="source === 'cache'" class="badge cached">Using cached data</span>
    </div>

    <!-- Results -->
    <div v-else-if="insights" class="insights-content">
      <!-- Source Badge -->
      <div class="source-badge" :class="source">
        {{ source === 'cache' ? '📋 From Cache' : '✨ Fresh Analysis' }}
      </div>

      <!-- Summary Section -->
      <div class="section">
        <h4>📊 Summary</h4>
        <div class="summary-grid">
          <div class="stat">
            <span class="stat-value">{{ formatNumber(insights.summary.totalFiles) }}</span>
            <span class="stat-label">Total Files</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ formatSize(insights.summary.totalSize) }}</span>
            <span class="stat-label">Total Size</span>
          </div>
          <div class="stat" v-if="insights.summary.duplicates.length > 0">
            <span class="stat-value">{{ insights.summary.duplicates.length }}</span>
            <span class="stat-label">Duplicate Groups</span>
          </div>
        </div>

        <!-- Top Categories -->
        <div v-if="insights.summary.topCategories.length > 0" class="categories">
          <h5>Top Categories</h5>
          <div class="category-list">
            <div
              v-for="[name, data] in insights.summary.topCategories"
              :key="name"
              class="category-item"
            >
              <span class="category-name">{{ name }}</span>
              <span class="category-count">{{ data.count }} files</span>
              <span class="category-size">{{ formatSize(data.size) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div v-if="insights.recommendations.length > 0" class="section">
        <h4>💡 AI Recommendations</h4>
        <ul class="recommendation-list">
          <li v-for="(rec, index) in insights.recommendations" :key="index">
            {{ rec }}
          </li>
        </ul>
      </div>

      <!-- Storage Optimization -->
      <div class="section">
        <h4>💾 Storage Optimization</h4>
        <div class="optimization-grid">
          <div class="opt-card" v-if="insights.storageOptimization.potentialSavings > 0">
            <div class="opt-icon">💰</div>
            <div class="opt-content">
              <div class="opt-value">{{ formatSize(insights.storageOptimization.potentialSavings) }}</div>
              <div class="opt-label">Potential Savings</div>
              <div class="opt-desc">From duplicate removal</div>
            </div>
          </div>

          <div class="opt-card" v-if="insights.storageOptimization.compressionCandidates.length > 0">
            <div class="opt-icon">🗜️</div>
            <div class="opt-content">
              <div class="opt-value">{{ insights.storageOptimization.compressionCandidates.length }}</div>
              <div class="opt-label">Compressible Files</div>
              <div class="opt-desc">Large files that could be compressed</div>
            </div>
          </div>

          <div class="opt-card" v-if="insights.storageOptimization.oldFiles.length > 0">
            <div class="opt-icon">📅</div>
            <div class="opt-content">
              <div class="opt-value">{{ insights.storageOptimization.oldFiles.length }}</div>
              <div class="opt-label">Old Files</div>
              <div class="opt-desc">Not accessed in 1+ years</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Security -->
      <div class="section" v-if="showSecurity">
        <h4>🔒 Security Overview</h4>
        <div class="security-grid">
          <div class="sec-item" :class="{ warning: insights.security.hiddenFiles.length > 0 }">
            <span class="sec-icon">👻</span>
            <span class="sec-label">Hidden Files</span>
            <span class="sec-value">{{ insights.security.hiddenFiles.length }}</span>
          </div>
          <div class="sec-item">
            <span class="sec-icon">⚙️</span>
            <span class="sec-label">Executables</span>
            <span class="sec-value">{{ insights.security.executableCount }}</span>
          </div>
          <div class="sec-item">
            <span class="sec-icon">📜</span>
            <span class="sec-label">Scripts</span>
            <span class="sec-value">{{ insights.security.scriptFiles.length }}</span>
          </div>
        </div>
      </div>

      <!-- Large Files -->
      <div class="section" v-if="insights.summary.largestFiles.length > 0">
        <h4>📁 Largest Files</h4>
        <ul class="file-list">
          <li v-for="(file, index) in insights.summary.largestFiles.slice(0, 5)" :key="index">
            {{ file }}
          </li>
        </ul>
      </div>

      <!-- Timestamp -->
      <div class="timestamp">
        Generated: {{ formatTimestamp(timestamp) }}
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">❌</div>
      <p>{{ error }}</p>
      <button @click="generateInsights" class="retry-btn">
        🔄 Retry
      </button>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">🧠</div>
      <p>Enter a directory path to generate AI insights</p>
      <div class="input-group">
        <input
          v-model="directoryPath"
          type="text"
          placeholder="C:\Users\YourName\Documents"
          @keyup.enter="generateInsights"
        />
        <button @click="generateInsights" :disabled="!directoryPath || loading">
          {{ loading ? 'Analyzing...' : 'Generate Insights' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AnalysisBridge } from '@/services/AnalysisBridge';

// Props
const props = defineProps<{
  initialPath?: string;
  showSecurity?: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'insights-generated', data: AIInsightsData): void;
  (e: 'error', error: string): void;
}>();

// State
const analysisBridge = new AnalysisBridge();
const directoryPath = ref(props.initialPath || '');
const insights = ref<AIInsights | null>(null);
const source = ref<'cache' | 'fresh'>('fresh');
const timestamp = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

// Methods
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const formatSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const formatTimestamp = (ts: string): string => {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleString();
};

const generateInsights = async () => {
  if (!directoryPath.value) return;

  loading.value = true;
  error.value = null;
  insights.value = null;

  try {
    const result = await analysisBridge.getAIInsights(directoryPath.value);
    insights.value = result.insights;
    source.value = result.source;
    timestamp.value = result.timestamp;

    emit('insights-generated', {
      insights: result.insights,
      source: result.source,
      timestamp: result.timestamp
    });
  } catch (err: any) {
    error.value = err.message || 'Failed to generate AI insights';
    emit('error', error.value);
    console.error('AI insights error:', err);
  } finally {
    loading.value = false;
  }
};

// Auto-generate if initial path provided
if (props.initialPath) {
  generateInsights();
}

// Types
interface AIInsights {
  summary: {
    totalFiles: number;
    totalSize: number;
    topCategories: Array<[string, { count: number; size: number }]>;
    largestFiles: string[];
    duplicates: string[];
  };
  recommendations: string[];
  storageOptimization: {
    potentialSavings: number;
    compressionCandidates: string[];
    oldFiles: string[];
  };
  security: {
    hiddenFiles: string[];
    executableCount: number;
    scriptFiles: string[];
  };
}

interface AIInsightsData {
  insights: AIInsights;
  source: 'cache' | 'fresh';
  timestamp: string;
}
</script>

<style scoped>
.ai-insights {
  padding: 20px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 12px;
  font-family: system-ui, -apple-system, sans-serif;
}

h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary, #333);
  font-size: 1.5rem;
}

h4 {
  margin: 0 0 12px 0;
  color: var(--text-secondary, #666);
  font-size: 1.1rem;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 8px;
}

h5 {
  margin: 16px 0 8px 0;
  color: var(--text-muted, #888);
  font-size: 1rem;
}

/* Loading State */
.loading-state {
  text-align: center;
  padding: 40px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
}

.badge.cached {
  background: #e7f3ff;
  color: #007acc;
}

/* Source Badge */
.source-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.source-badge.cache {
  background: #d4edda;
  color: #155724;
}

.source-badge.fresh {
  background: #fff3cd;
  color: #856404;
}

/* Sections */
.section {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat {
  text-align: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
  color: #007acc;
}

.stat-label {
  display: block;
  font-size: 0.85rem;
  color: #666;
  margin-top: 4px;
}

/* Categories */
.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.category-name {
  font-weight: 600;
  color: #333;
  text-transform: capitalize;
}

.category-count {
  color: #666;
  font-size: 0.9rem;
}

.category-size {
  color: #007acc;
  font-weight: 600;
  font-size: 0.9rem;
}

/* Recommendations */
.recommendation-list {
  margin: 0;
  padding-left: 20px;
}

.recommendation-list li {
  margin: 8px 0;
  line-height: 1.5;
  color: #333;
}

/* Optimization Grid */
.optimization-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.opt-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.opt-icon {
  font-size: 2rem;
}

.opt-content {
  flex: 1;
}

.opt-value {
  font-size: 1.3rem;
  font-weight: bold;
  color: #28a745;
}

.opt-label {
  font-size: 0.9rem;
  color: #333;
  font-weight: 600;
}

.opt-desc {
  font-size: 0.8rem;
  color: #888;
  margin-top: 2px;
}

/* Security */
.security-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.sec-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.sec-item.warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
}

.sec-icon {
  font-size: 1.2rem;
}

.sec-label {
  flex: 1;
  font-size: 0.9rem;
  color: #333;
}

.sec-value {
  font-weight: bold;
  color: #333;
}

/* File List */
.file-list {
  margin: 0;
  padding-left: 20px;
}

.file-list li {
  margin: 6px 0;
  font-size: 0.9rem;
  color: #555;
  word-break: break-all;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 40px;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  gap: 8px;
  max-width: 500px;
  margin: 20px auto 0;
}

.input-group input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.input-group button {
  padding: 12px 24px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.input-group button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Error State */
.error-state {
  text-align: center;
  padding: 40px;
  color: #dc3545;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.retry-btn {
  margin-top: 16px;
  padding: 10px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* Timestamp */
.timestamp {
  text-align: right;
  font-size: 0.8rem;
  color: #888;
  margin-top: 16px;
}
</style>

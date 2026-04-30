<template>
  <div class="batch-analysis">
    <h3>📦 Batch Directory Analysis</h3>

    <!-- Directory Input -->
    <div class="input-section">
      <h4>Add Directories to Analyze</h4>
      <div class="input-row">
        <input
          v-model="newDirectory"
          type="text"
          placeholder="Enter directory path..."
          @keyup.enter="addDirectory"
        />
        <button @click="addDirectory" :disabled="!newDirectory">Add</button>
      </div>

      <!-- Directory List -->
      <div v-if="directories.length > 0" class="directory-list">
        <div
          v-for="(dir, index) in directories"
          :key="index"
          class="directory-item"
        >
          <span class="dir-number">{{ index + 1 }}.</span>
          <span class="dir-path">{{ dir }}</span>
          <button @click="removeDirectory(index)" class="btn-remove">×</button>
        </div>
      </div>

      <div v-if="directories.length > 0" class="batch-options">
        <h4>Batch Options</h4>
        <div class="options-grid">
          <div class="option">
            <label>Priority:</label>
            <select v-model="options.priority">
              <option :value="0">Critical</option>
              <option :value="1">High</option>
              <option :value="2">Normal</option>
              <option :value="3">Low</option>
              <option :value="4">Background</option>
            </select>
          </div>
          <div class="option">
            <label>Concurrency:</label>
            <select v-model="options.concurrency">
              <option :value="1">1 (Sequential)</option>
              <option :value="2">2</option>
              <option :value="3">3 (Default)</option>
              <option :value="5">5</option>
            </select>
          </div>
          <div class="option checkbox">
            <label>
              <input v-model="options.useOllama" type="checkbox" />
              Enable AI Analysis
            </label>
          </div>
          <div class="option checkbox">
            <label>
              <input v-model="options.parallel" type="checkbox" />
              Parallel Processing
            </label>
          </div>
        </div>
      </div>

      <button
        @click="startBatch"
        :disabled="directories.length === 0 || loading"
        class="btn-start"
      >
        {{ loading ? `Analyzing ${progress.current}/${directories.length}...` : `Start Batch Analysis (${directories.length} directories)` }}
      </button>
    </div>

    <!-- Progress -->
    <div v-if="loading" class="progress-section">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progress.percentage + '%' }"
        ></div>
      </div>
      <div class="progress-stats">
        <span>{{ progress.current }} / {{ directories.length }} completed</span>
        <span>{{ progress.percentage.toFixed(0) }}%</span>
      </div>
    </div>

    <!-- Results -->
    <div v-if="results" class="results-section">
      <h4>Batch Results</h4>

      <!-- Summary -->
      <div class="batch-summary">
        <div class="summary-item success">
          <span class="summary-value">{{ results.batch.successful }}</span>
          <span class="summary-label">Successful</span>
        </div>
        <div v-if="results.batch.failed > 0" class="summary-item failed">
          <span class="summary-value">{{ results.batch.failed }}</span>
          <span class="summary-label">Failed</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ formatDuration(results.batch.totalDuration) }}</span>
          <span class="summary-label">Total Time</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ formatSize(results.batch.aggregateStats.totalSize) }}</span>
          <span class="summary-label">Total Size</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ formatNumber(results.batch.aggregateStats.totalFiles) }}</span>
          <span class="summary-label">Total Files</span>
        </div>
      </div>

      <!-- Individual Results -->
      <div class="individual-results">
        <h5>Individual Directory Results</h5>
        <div
          v-for="(result, index) in results.results"
          :key="index"
          class="result-item"
          :class="{ success: result.success, failed: !result.success }"
        >
          <div class="result-header">
            <span class="result-number">{{ index + 1 }}</span>
            <span class="result-status">{{ result.success ? '✅' : '❌' }}</span>
            <span class="result-path">{{ result.directory }}</span>
            <span class="result-duration">{{ result.duration }}ms</span>
          </div>
          <div v-if="result.success && result.result" class="result-details">
            <span>{{ result.result.total_files }} files</span>
            <span>{{ formatSize(result.result.total_size) }}</span>
          </div>
          <div v-if="!result.success && result.error" class="result-error">
            ⚠️ {{ result.error }}
          </div>
        </div>
      </div>

      <!-- Errors -->
      <div v-if="results.errors && results.errors.length > 0" class="errors-section">
        <h5>Failed Directories</h5>
        <div
          v-for="(error, index) in results.errors"
          :key="index"
          class="error-item"
        >
          <span class="error-path">{{ error.directory }}</span>
          <span class="error-message">{{ error.error }}</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { AnalysisBridge } from '@/services/AnalysisBridge';

interface BatchResult {
  batch: {
    totalDirectories: number;
    successful: number;
    failed: number;
    totalDuration: number;
    aggregateStats: {
      totalFiles: number;
      totalSize: number;
      avgFilesPerDirectory: number;
    };
  };
  results: Array<{
    directory: string;
    success: boolean;
    result?: { total_files: number; total_size: number };
    error?: string;
    duration: number;
  }>;
  errors?: Array<{
    directory: string;
    success: boolean;
    error: string;
    duration: number;
  }>;
}

// State
const analysisBridge = new AnalysisBridge();
const directories = ref<string[]>([]);
const newDirectory = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const results = ref<BatchResult | null>(null);

const options = reactive({
  priority: 2, // NORMAL
  concurrency: 3,
  useOllama: false,
  parallel: true
});

const progress = reactive({
  current: 0,
  percentage: 0
});

// Methods
const addDirectory = () => {
  if (!newDirectory.value) return;
  if (directories.value.length >= 20) {
    error.value = 'Maximum 20 directories allowed';
    return;
  }
  if (directories.value.includes(newDirectory.value)) {
    error.value = 'Directory already in list';
    return;
  }
  directories.value.push(newDirectory.value);
  newDirectory.value = '';
  error.value = null;
};

const removeDirectory = (index: number) => {
  directories.value.splice(index, 1);
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
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

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const startBatch = async () => {
  if (directories.value.length === 0) return;

  loading.value = true;
  error.value = null;
  results.value = null;
  progress.current = 0;
  progress.percentage = 0;

  try {
    // Simulate progress (actual progress would need WebSocket)
    const progressInterval = setInterval(() => {
      if (progress.current < directories.value.length) {
        progress.current++;
        progress.percentage = (progress.current / directories.value.length) * 100;
      }
    }, 1000);

    const result = await analysisBridge.analyzeBatch(directories.value, options);

    clearInterval(progressInterval);
    progress.current = directories.value.length;
    progress.percentage = 100;

    results.value = result;
  } catch (err: any) {
    error.value = err.message || 'Batch analysis failed';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.batch-analysis {
  padding: 20px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 12px;
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

h5 {
  margin: 16px 0 8px 0;
  color: var(--text-muted, #888);
  font-size: 1rem;
}

/* Input Section */
.input-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.input-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.input-row input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.input-row button {
  padding: 10px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.input-row button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Directory List */
.directory-list {
  margin-bottom: 20px;
}

.directory-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 8px;
}

.dir-number {
  font-weight: 600;
  color: #007acc;
  min-width: 24px;
}

.dir-path {
  flex: 1;
  font-size: 0.9rem;
  word-break: break-all;
}

.btn-remove {
  padding: 4px 8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

/* Options */
.batch-options {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.option label {
  font-weight: 600;
  font-size: 0.9rem;
}

.option select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

/* Start Button */
.btn-start {
  width: 100%;
  padding: 14px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-start:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* Progress */
.progress-section {
  margin-bottom: 20px;
}

.progress-bar {
  width: 100%;
  height: 24px;
  background: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007acc, #28a745);
  transition: width 0.3s ease;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #666;
}

/* Results */
.results-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.batch-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.summary-item {
  text-align: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.summary-item.success {
  background: #d4edda;
  color: #155724;
}

.summary-item.failed {
  background: #f8d7da;
  color: #721c24;
}

.summary-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
}

.summary-label {
  font-size: 0.85rem;
  color: #666;
}

/* Individual Results */
.individual-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  padding: 12px;
  border-radius: 6px;
  background: #f8f9fa;
  border-left: 4px solid #ddd;
}

.result-item.success {
  border-left-color: #28a745;
}

.result-item.failed {
  border-left-color: #dc3545;
  background: #fff5f5;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.result-number {
  font-weight: 600;
  color: #007acc;
}

.result-path {
  flex: 1;
  font-size: 0.9rem;
  word-break: break-all;
}

.result-duration {
  font-size: 0.8rem;
  color: #888;
}

.result-details {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: #666;
}

.result-error {
  color: #dc3545;
  font-size: 0.85rem;
}

/* Errors Section */
.errors-section {
  margin-top: 20px;
  padding: 16px;
  background: #fff5f5;
  border-radius: 6px;
  border-left: 4px solid #dc3545;
}

.error-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  margin-bottom: 8px;
}

.error-path {
  font-weight: 600;
  font-size: 0.9rem;
}

.error-message {
  color: #dc3545;
  font-size: 0.85rem;
}

/* Main Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 6px;
}
</style>

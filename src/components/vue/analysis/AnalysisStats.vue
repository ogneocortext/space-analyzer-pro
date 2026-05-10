<!--
  Analysis Stats Widget
  Displays analysis statistics and metrics
-->
<template>
  <div class="analysis-stats">
    <div class="stats-header">
      <h3 class="stats-title">Analysis Statistics</h3>
      <div class="stats-meta">
        <span class="stats-date">{{ formatDate(stats?.timestamp) }}</span>
        <span class="stats-duration">{{ formatDuration(stats?.performance?.duration) }}</span>
      </div>
    </div>

    <div class="stats-grid">
      <!-- Total Files -->
      <div class="stat-card">
        <div class="stat-icon files">
          <FileText class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.totalFiles || 0) }}</div>
          <div class="stat-label">Total Files</div>
        </div>
      </div>

      <!-- Total Size -->
      <div class="stat-card">
        <div class="stat-icon storage">
          <Database class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatFileSize(stats?.totalSize || 0) }}</div>
          <div class="stat-label">Total Size</div>
        </div>
      </div>

      <!-- Directories -->
      <div class="stat-card">
        <div class="stat-icon directories">
          <Folder class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.directories || 0) }}</div>
          <div class="stat-label">Directories</div>
        </div>
      </div>

      <!-- Code Files -->
      <div class="stat-card">
        <div class="stat-icon code">
          <Code class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.codeFiles || 0) }}</div>
          <div class="stat-label">Code Files</div>
        </div>
      </div>

      <!-- Duplicate Files -->
      <div class="stat-card">
        <div class="stat-icon duplicates">
          <Copy class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.duplicateFiles || 0) }}</div>
          <div class="stat-label">Duplicates</div>
        </div>
      </div>

      <!-- Large Files -->
      <div class="stat-card">
        <div class="stat-icon large">
          <FilePlus class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.largeFiles || 0) }}</div>
          <div class="stat-label">Large Files</div>
        </div>
      </div>

      <!-- Average File Size -->
      <div class="stat-card">
        <div class="stat-icon average">
          <BarChart3 class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatFileSize(stats?.avgFileSize || 0) }}</div>
          <div class="stat-label">Avg Size</div>
        </div>
      </div>

      <!-- Max File Size -->
      <div class="stat-card">
        <div class="stat-icon max">
          <TrendingUp class="w-5 h-5" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatFileSize(stats?.maxFileSize || 0) }}</div>
          <div class="stat-label">Max Size</div>
        </div>
      </div>
    </div>

    <!-- File Type Distribution -->
    <div v-if="fileTypes.length > 0" class="file-types">
      <h4 class="section-title">File Type Distribution</h4>
      <div class="type-grid">
        <div 
          v-for="(count, type) in fileTypes" 
          :key="type"
          class="type-item"
        >
          <div class="type-extension">{{ type || 'no-ext' }}</div>
          <div class="type-count">{{ formatNumber(count) }}</div>
          <div class="type-bar">
            <div 
              class="type-fill" 
              :style="{ 
                width: `${(count / totalFiles) * 100}%`,
                backgroundColor: getFileTypeColor(type)
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div v-if="performance" class="performance-metrics">
      <h4 class="section-title">Performance Metrics</h4>
      <div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-label">Files/Second</div>
          <div class="metric-value">{{ performance.filesPerSecond.toFixed(1) }}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Memory Usage</div>
          <div class="metric-value">{{ formatBytes(performance.memoryUsage) }}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">CPU Usage</div>
          <div class="metric-value">{{ (performance.cpuUsage * 100).toFixed(1) }}%</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Disk I/O</div>
          <div class="metric-value">{{ formatBytes(performance.diskIO) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  FileText, 
  Database, 
  Folder, 
  Code, 
  Copy, 
  FilePlus, 
  BarChart3, 
  TrendingUp 
} from 'lucide-vue-next';
import type { AnalysisStats, AnalysisPerformance } from '../../../services/AnalysisService';

interface Props {
  stats?: AnalysisStats | null;
  performance?: AnalysisPerformance | null;
}

const props = defineProps<Props>();

const fileTypes = computed(() => {
  if (!props.stats?.fileTypes) return {};
  return props.stats.fileTypes;
});

const totalFiles = computed(() => props.stats?.totalFiles || 1);

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatBytes = (bytes: number): string => {
  return formatFileSize(bytes);
};

const formatDate = (date?: Date): string => {
  if (!date) return 'N/A';
  return date.toLocaleDateString();
};

const formatDuration = (ms?: number): string => {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

const getFileTypeColor = (extension: string): string => {
  const colors: Record<string, string> = {
    'js': '#f7df1e',
    'ts': '#3b82f6',
    'jsx': '#61dafb',
    'tsx': '#61dafb',
    'vue': '#4fc08d',
    'py': '#3776ab',
    'java': '#f89820',
    'cpp': '#00599c',
    'c': '#a8b9c8',
    'cs': '#239120',
    'php': '#777bb4',
    'rb': '#cc342d',
    'go': '#00add8',
    'rs': '#dea584',
    'html': '#e34c26',
    'css': '#1572b6',
    'json': '#000000',
    'xml': '#0066cc',
    'md': '#083fa1',
    'txt': '#6b7280',
  };
  return colors[extension.toLowerCase()] || '#6b7280';
};
</script>

<style scoped>
.analysis-stats {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.stats-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.stats-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.stat-card:hover {
  background: #1f2937;
  border-color: #4b5563;
  transform: translateY(-1px);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.stat-icon.files {
  background: #3b82f6;
  color: #ffffff;
}

.stat-icon.storage {
  background: #8b5cf6;
  color: #ffffff;
}

.stat-icon.directories {
  background: #10b981;
  color: #ffffff;
}

.stat-icon.code {
  background: #f59e0b;
  color: #ffffff;
}

.stat-icon.duplicates {
  background: #ef4444;
  color: #ffffff;
}

.stat-icon.large {
  background: #06b6d4;
  color: #ffffff;
}

.stat-icon.average {
  background: #84cc16;
  color: #ffffff;
}

.stat-icon.max {
  background: #ec4899;
  color: #ffffff;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.file-types,
.performance-metrics {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #374151;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 1rem 0;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.type-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
}

.type-extension {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #d1d5db;
  text-transform: uppercase;
}

.type-count {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
}

.type-bar {
  width: 100%;
  height: 4px;
  background: #374151;
  border-radius: 2px;
  overflow: hidden;
}

.type-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  text-align: center;
}

.metric-label {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
}

.metric-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  
  .type-grid {
    grid-template-columns: 1fr;
  }
  
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-card {
    padding: 0.75rem;
  }
  
  .stat-icon {
    width: 32px;
    height: 32px;
  }
  
  .stat-value {
    font-size: 1.25rem;
  }
}
</style>
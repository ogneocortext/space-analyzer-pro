<!--
  Dashboard Stats Widget
  Displays key dashboard statistics in a grid layout
-->
<template>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-header">
        <Folder class="w-6 h-6 text-blue-400" />
        <h3 class="text-lg font-semibold text-white">Total Files</h3>
      </div>
      <div class="stat-content">
        <div class="stat-value">{{ formatNumber(stats?.totalFiles || 0) }}</div>
        <div class="stat-change" :class="{ positive: stats?.weeklyGrowth > 0, negative: stats?.weeklyGrowth < 0 }">
          <TrendingUp v-if="stats?.weeklyGrowth > 0" class="w-4 h-4" />
          <TrendingDown v-else-if="stats?.weeklyGrowth < 0" class="w-4 h-4" />
          <span>{{ formatGrowth(stats?.weeklyGrowth || 0) }} from last week</span>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <Database class="w-6 h-6 text-purple-400" />
        <h3 class="text-lg font-semibold text-white">Storage Used</h3>
      </div>
      <div class="stat-content">
        <div class="stat-value">{{ formatStorageSize(stats?.storageUsed || 0) }}</div>
        <div class="stat-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ 
                width: `${storagePercentage}%`,
                backgroundColor: storageStatusColor 
              }"
            ></div>
          </div>
          <span class="progress-text">{{ storagePercentage }}% of {{ formatStorageSize(stats?.storageTotal || 0) }}</span>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <Activity class="w-6 h-6 text-green-400" />
        <h3 class="text-lg font-semibold text-white">Analysis Speed</h3>
      </div>
      <div class="stat-content">
        <div class="stat-value">{{ formatNumber(stats?.analysisSpeed || 0) }}</div>
        <div class="stat-unit">files/second</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <BrainCircuit class="w-6 h-6 text-yellow-400" />
        <h3 class="text-lg font-semibold text-white">AI Insights</h3>
      </div>
      <div class="stat-content">
        <div class="stat-value">{{ formatNumber(stats?.aiInsights || 0) }}</div>
        <div class="stat-unit">recommendations generated</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  Folder, 
  Database, 
  Activity, 
  BrainCircuit, 
  TrendingUp, 
  TrendingDown 
} from 'lucide-vue-next';
import type { DashboardStats } from '../../../services/DashboardService';

interface Props {
  stats?: DashboardStats | null;
}

const props = defineProps<Props>();

const storagePercentage = computed(() => {
  if (!props.stats) return 0;
  return Math.round((props.stats.storageUsed / props.stats.storageTotal) * 100);
});

const storageStatusColor = computed(() => {
  const percentage = storagePercentage.value;
  if (percentage >= 90) return '#ef4444'; // red
  if (percentage >= 75) return '#f59e0b'; // yellow
  return '#22c55e'; // green
});

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const formatStorageSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatGrowth = (growth: number): string => {
  const sign = growth >= 0 ? '+' : '';
  return `${sign}${growth.toFixed(1)}%`;
};
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.stat-card:hover {
  background: #111827;
  border-color: #4b5563;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.stat-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.stat-change.positive {
  color: #10b981;
}

.stat-change.negative {
  color: #ef4444;
}

.stat-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #374151;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: #9ca3af;
}

.stat-unit {
  font-size: 0.875rem;
  color: #9ca3af;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .stat-card {
    padding: 1rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
  }
}
</style>
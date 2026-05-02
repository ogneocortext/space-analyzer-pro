<template>
  <div class="space-y-6">
    <!-- Timestamp Overview -->
    <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Timestamp Analysis</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- Created Stats -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            <span class="text-slate-400 text-sm">Created</span>
          </div>
          <div class="text-2xl font-bold text-blue-400">{{ createdStats.count.toLocaleString() }}</div>
          <div class="text-xs text-slate-500">{{ createdStats.dateRange }}</div>
        </div>

        <!-- Modified Stats -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span class="text-slate-400 text-sm">Modified</span>
          </div>
          <div class="text-2xl font-bold text-emerald-400">{{ modifiedStats.count.toLocaleString() }}</div>
          <div class="text-xs text-slate-500">{{ modifiedStats.dateRange }}</div>
        </div>

        <!-- Accessed Stats -->
        <div class="bg-slate-700/50 rounded-lg p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-amber-500"></div>
            <span class="text-slate-400 text-sm">Accessed</span>
          </div>
          <div class="text-2xl font-bold text-amber-400">{{ accessedStats.count.toLocaleString() }}</div>
          <div class="text-xs text-slate-500">{{ accessedStats.dateRange }}</div>
        </div>
      </div>

      <!-- Time Period Distribution -->
      <div class="bg-slate-700/30 rounded-lg p-4">
        <h3 class="text-white font-medium mb-4">File Distribution by Time Period</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Created by Period -->
          <div>
            <h4 class="text-slate-400 text-sm mb-3">Created by Period</h4>
            <div class="space-y-2">
              <div v-for="(count, period) in createdByPeriod" :key="period" class="flex items-center gap-2">
                <span class="text-slate-400 text-xs w-16">{{ period }}</span>
                <div class="flex-1 bg-slate-800 rounded-full h-4 relative overflow-hidden">
                  <div
                    class="h-full bg-blue-500 rounded-full transition-all duration-500"
                    :style="{ width: `${((count / createdStats.count) * 100).toFixed(1)}%` }"
                  >
                    <span class="absolute inset-0 flex items-center justify-center text-xs text-white">
                      {{ count.toLocaleString() }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modified by Period -->
          <div>
            <h4 class="text-slate-400 text-sm mb-3">Modified by Period</h4>
            <div class="space-y-2">
              <div v-for="(count, period) in modifiedByPeriod" :key="period" class="flex items-center gap-2">
                <span class="text-slate-400 text-xs w-16">{{ period }}</span>
                <div class="flex-1 bg-slate-800 rounded-full h-4 relative overflow-hidden">
                  <div
                    class="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    :style="{ width: `${((count / modifiedStats.count) * 100).toFixed(1)}%` }"
                  >
                    <span class="absolute inset-0 flex items-center justify-center text-xs text-white">
                      {{ count.toLocaleString() }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Accessed by Period -->
          <div>
            <h4 class="text-slate-400 text-sm mb-3">Accessed by Period</h4>
            <div class="space-y-2">
              <div v-for="(count, period) in accessedByPeriod" :key="period" class="flex items-center gap-2">
                <span class="text-slate-400 text-xs w-16">{{ period }}</span>
                <div class="flex-1 bg-slate-800 rounded-full h-4 relative overflow-hidden">
                  <div
                    class="h-full bg-amber-500 rounded-full transition-all duration-500"
                    :style="{ width: `${((count / accessedStats.count) * 100).toFixed(1)}%` }"
                  >
                    <span class="absolute inset-0 flex items-center justify-center text-xs text-white">
                      {{ count.toLocaleString() }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- File Age Analysis -->
    <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">File Age Analysis</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Oldest Files -->
        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Oldest Files (by creation date)</h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="file in oldestFiles"
              :key="file.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div>
              <div class="flex-1">
                <div class="text-white truncate">{{ file.name }}</div>
                <div class="text-slate-400 text-xs">{{ formatDate(file.created) }}</div>
              </div>
              <span class="text-blue-400 text-xs">{{ getAgeInDays(file.created) }} days</span>
            </div>
          </div>
        </div>

        <!-- Newest Files -->
        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Newest Files (by creation date)</h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="file in newestFiles"
              :key="file.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
              <div class="flex-1">
                <div class="text-white truncate">{{ file.name }}</div>
                <div class="text-slate-400 text-xs">{{ formatDate(file.created) }}</div>
              </div>
              <span class="text-emerald-400 text-xs">{{ getAgeInDays(file.created) }} days</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recently Modified Files -->
    <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Recently Modified Files</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Recently Modified -->
        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Last 7 Days</h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="file in recentlyModified"
              :key="file.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
              <div class="flex-1">
                <div class="text-white truncate">{{ file.name }}</div>
                <div class="text-slate-400 text-xs">{{ formatDate(file.modified) }}</div>
              </div>
              <span class="text-emerald-400 text-xs">{{ formatBytes(file.size) }}</span>
            </div>
          </div>
        </div>

        <!-- Recently Accessed -->
        <div class="bg-slate-700/30 rounded-lg p-4">
          <h3 class="text-white font-medium mb-3">Recently Accessed</h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="file in recentlyAccessed"
              :key="file.path"
              class="flex items-center gap-2 text-sm p-2 bg-slate-800/50 rounded"
            >
              <div class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></div>
              <div class="flex-1">
                <div class="text-white truncate">{{ file.name }}</div>
                <div class="text-slate-400 text-xs">{{ formatDate(file.accessed) }}</div>
              </div>
              <span class="text-amber-400 text-xs">{{ formatBytes(file.size) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Timestamp Patterns -->
    <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 class="text-xl font-semibold text-white mb-4">Timestamp Patterns</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-slate-700/30 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-blue-400">{{ patternStats.sameDayFiles.toLocaleString() }}</div>
          <div class="text-sm text-slate-400 mt-1">Created & Modified Same Day</div>
        </div>
        
        <div class="bg-slate-700/30 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-emerald-400">{{ patternStats.recentlyCreated.toLocaleString() }}</div>
          <div class="text-sm text-slate-400 mt-1">Created Last 30 Days</div>
        </div>
        
        <div class="bg-slate-700/30 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-amber-400">{{ patternStats.neverAccessed.toLocaleString() }}</div>
          <div class="text-sm text-slate-400 mt-1">Never Accessed</div>
        </div>
        
        <div class="bg-slate-700/30 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-purple-400">{{ patternStats.staleFiles.toLocaleString() }}</div>
          <div class="text-sm text-slate-400 mt-1">Not Modified > 1 Year</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface FileTimestamps {
  name: string;
  path: string;
  size: number;
  created: string | null;
  modified: string | null;
  accessed: string | null;
}

const props = defineProps<{
  files: FileTimestamps[];
}>();

// Basic timestamp statistics
const createdStats = computed(() => {
  const filesWithCreated = props.files.filter(f => f.created);
  const dates = filesWithCreated.map(f => new Date(f.created!)).sort((a, b) => a.getTime() - b.getTime());
  
  return {
    count: filesWithCreated.length,
    dateRange: dates.length > 0 
      ? `${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}`
      : 'N/A'
  };
});

const modifiedStats = computed(() => {
  const filesWithModified = props.files.filter(f => f.modified);
  const dates = filesWithModified.map(f => new Date(f.modified!)).sort((a, b) => a.getTime() - b.getTime());
  
  return {
    count: filesWithModified.length,
    dateRange: dates.length > 0 
      ? `${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}`
      : 'N/A'
  };
});

const accessedStats = computed(() => {
  const filesWithAccessed = props.files.filter(f => f.accessed);
  const dates = filesWithAccessed.map(f => new Date(f.accessed!)).sort((a, b) => a.getTime() - b.getTime());
  
  return {
    count: filesWithAccessed.length,
    dateRange: dates.length > 0 
      ? `${formatDateShort(dates[0])} - ${formatDateShort(dates[dates.length - 1])}`
      : 'N/A'
  };
});

// Time period distribution
const getPeriodDistribution = (timestampField: 'created' | 'modified' | 'accessed') => {
  const now = new Date();
  const periods = {
    'Today': 0,
    'Week': 0,
    'Month': 0,
    'Year': 0,
    'Older': 0
  };

  props.files.forEach(file => {
    const timestamp = file[timestampField];
    if (!timestamp) return;

    const date = new Date(timestamp);
    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < 1) periods.Today++;
    else if (daysDiff < 7) periods.Week++;
    else if (daysDiff < 30) periods.Month++;
    else if (daysDiff < 365) periods.Year++;
    else periods.Older++;
  });

  return periods;
};

const createdByPeriod = computed(() => getPeriodDistribution('created'));
const modifiedByPeriod = computed(() => getPeriodDistribution('modified'));
const accessedByPeriod = computed(() => getPeriodDistribution('accessed'));

// File age analysis
const oldestFiles = computed(() => {
  return props.files
    .filter(f => f.created)
    .sort((a, b) => new Date(a.created!).getTime() - new Date(b.created!).getTime())
    .slice(0, 10);
});

const newestFiles = computed(() => {
  return props.files
    .filter(f => f.created)
    .sort((a, b) => new Date(b.created!).getTime() - new Date(a.created!).getTime())
    .slice(0, 10);
});

// Recently modified and accessed
const recentlyModified = computed(() => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return props.files
    .filter(f => f.modified && new Date(f.modified) > sevenDaysAgo)
    .sort((a, b) => new Date(b.modified!).getTime() - new Date(a.modified!).getTime())
    .slice(0, 15);
});

const recentlyAccessed = computed(() => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return props.files
    .filter(f => f.accessed && new Date(f.accessed) > sevenDaysAgo)
    .sort((a, b) => new Date(b.accessed!).getTime() - new Date(a.accessed!).getTime())
    .slice(0, 15);
});

// Pattern statistics
const patternStats = computed(() => {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  let sameDayFiles = 0;
  let recentlyCreated = 0;
  let neverAccessed = 0;
  let staleFiles = 0;

  props.files.forEach(file => {
    // Created and modified same day
    if (file.created && file.modified) {
      const createdDate = new Date(file.created).toDateString();
      const modifiedDate = new Date(file.modified).toDateString();
      if (createdDate === modifiedDate) sameDayFiles++;
    }

    // Recently created (last 30 days)
    if (file.created && new Date(file.created) > thirtyDaysAgo) {
      recentlyCreated++;
    }

    // Never accessed
    if (!file.accessed) {
      neverAccessed++;
    }

    // Stale files (not modified in over a year)
    if (file.modified && new Date(file.modified) < oneYearAgo) {
      staleFiles++;
    }
  });

  return {
    sameDayFiles,
    recentlyCreated,
    neverAccessed,
    staleFiles
  };
});

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString();
}

function getAgeInDays(dateString: string | null | undefined): string {
  if (!dateString) return '0';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff.toString();
  } catch {
    return '0';
  }
}
</script>

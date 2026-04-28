<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const selectedTimeRange = ref<"7d" | "30d" | "90d" | "1y">("30d");

// Simulated historical data (would come from backend in production)
const trendData = ref([
  { date: "2024-01-01", size: 45.2 * 1024 * 1024 * 1024, files: 12000 },
  { date: "2024-02-01", size: 48.5 * 1024 * 1024 * 1024, files: 13500 },
  { date: "2024-03-01", size: 52.1 * 1024 * 1024 * 1024, files: 14200 },
  { date: "2024-04-01", size: 51.8 * 1024 * 1024 * 1024, files: 14100 },
  { date: "2024-05-01", size: 55.3 * 1024 * 1024 * 1024, files: 15800 },
  { date: "2024-06-01", size: 58.7 * 1024 * 1024 * 1024, files: 16200 },
  { date: "2024-07-01", size: 62.4 * 1024 * 1024 * 1024, files: 17500 },
  { date: "2024-08-01", size: 65.1 * 1024 * 1024 * 1024, files: 18200 },
  { date: "2024-09-01", size: 68.9 * 1024 * 1024 * 1024, files: 19500 },
  { date: "2024-10-01", size: 72.5 * 1024 * 1024 * 1024, files: 20800 },
  { date: "2024-11-01", size: 75.2 * 1024 * 1024 * 1024, files: 21500 },
  { date: "2024-12-01", size: 78.6 * 1024 * 1024 * 1024, files: 22300 },
]);

// Category breakdown (simulated)
const categoryTrends = ref([
  { category: "Documents", current: 15.2 * 1024 * 1024 * 1024, growth: 12 },
  { category: "Images", current: 25.8 * 1024 * 1024 * 1024, growth: 28 },
  { category: "Videos", current: 22.4 * 1024 * 1024 * 1024, growth: 45 },
  { category: "Code", current: 8.5 * 1024 * 1024 * 1024, growth: 8 },
  { category: "Archives", current: 6.7 * 1024 * 1024 * 1024, growth: -5 },
]);

// Current stats from analysis result
const currentStats = computed(() => {
  const result = store.analysisResult;
  if (!result) return null;

  const current = trendData.value[trendData.value.length - 1];
  const previous = trendData.value[trendData.value.length - 2];

  return {
    totalSize: result.totalSize || 0,
    totalFiles: result.totalFiles || 0,
    sizeGrowth: current ? ((result.totalSize - current.size) / current.size) * 100 : 0,
    fileGrowth: current ? ((result.totalFiles - current.files) / current.files) * 100 : 0,
  };
});

// Projections
const projections = computed(() => {
  if (!currentStats.value) return null;

  const monthlyGrowth = 2.5; // Simulated 2.5% monthly growth
  const currentSize = currentStats.value.totalSize;

  return {
    nextMonth: currentSize * (1 + monthlyGrowth / 100),
    nextQuarter: currentSize * Math.pow(1 + monthlyGrowth / 100, 3),
    nextYear: currentSize * Math.pow(1 + monthlyGrowth / 100, 12),
    fillDate: new Date(Date.now() + (100 * 1024 * 1024 * 1024 / (currentSize * monthlyGrowth / 100)) * 30 * 24 * 60 * 60 * 1000),
  };
});

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Storage Trends</h1>
        <p class="text-slate-400 mt-1">Track storage usage patterns and predict future needs</p>
      </div>
      <div class="flex gap-2">
        <Button
          v-for="range in ['7d', '30d', '90d', '1y']"
          :key="range"
          :variant="selectedTimeRange === range ? 'primary' : 'secondary'"
          size="sm"
          @click="selectedTimeRange = range as any"
        >
          {{ range }}
        </Button>
      </div>
    </div>

    <!-- No Analysis -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <!-- Stats Overview -->
      <div class="grid grid-cols-4 gap-4">
        <Card title="Current Size">
          <div class="text-3xl font-bold text-blue-400">{{ formatSize(currentStats?.totalSize || 0) }}</div>
          <div class="text-sm" :class="currentStats?.sizeGrowth && currentStats.sizeGrowth > 0 ? 'text-red-400' : 'text-emerald-400'">
            {{ currentStats?.sizeGrowth?.toFixed(1) || 0 }}% from last month
          </div>
        </Card>
        <Card title="Total Files">
          <div class="text-3xl font-bold text-purple-400">{{ currentStats?.totalFiles.toLocaleString() || 0 }}</div>
          <div class="text-sm" :class="currentStats?.fileGrowth && currentStats.fileGrowth > 0 ? 'text-red-400' : 'text-emerald-400'">
            {{ currentStats?.fileGrowth?.toFixed(1) || 0 }}% from last month
          </div>
        </Card>
        <Card title="Avg File Size">
          <div class="text-3xl font-bold text-yellow-400">
            {{ formatSize((currentStats?.totalSize || 0) / (currentStats?.totalFiles || 1)) }}
          </div>
          <div class="text-sm text-slate-500">per file average</div>
        </Card>
        <Card title="Growth Rate">
          <div class="text-3xl font-bold text-orange-400">+2.5%</div>
          <div class="text-sm text-slate-500">monthly average</div>
        </Card>
      </div>

      <!-- Projections -->
      <Card title="Storage Projections" v-if="projections">
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400">{{ formatSize(projections.nextMonth) }}</div>
            <div class="text-sm text-slate-500">Next Month</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-purple-400">{{ formatSize(projections.nextQuarter) }}</div>
            <div class="text-sm text-slate-500">Next Quarter</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-orange-400">{{ formatSize(projections.nextYear) }}</div>
            <div class="text-sm text-slate-500">Next Year</div>
          </div>
        </div>
        <div class="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
          <p class="text-sm text-yellow-300">
            <span class="font-semibold">Storage Alert:</span> At current growth rate, you'll reach 100GB by {{ formatDate(projections.fillDate) }}
          </p>
        </div>
      </Card>

      <!-- Category Breakdown -->
      <Card title="Category Growth Trends">
        <div class="space-y-4">
          <div
            v-for="cat in categoryTrends"
            :key="cat.category"
            class="flex items-center justify-between p-3 bg-slate-800/50 rounded"
          >
            <div class="flex items-center gap-4">
              <div class="w-32 font-medium text-slate-200">{{ cat.category }}</div>
              <div class="text-sm text-slate-400">{{ formatSize(cat.current) }}</div>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-sm" :class="cat.growth > 0 ? 'text-red-400' : 'text-emerald-400'">
                {{ cat.growth > 0 ? '+' : '' }}{{ cat.growth }}%
              </div>
              <div class="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :class="cat.growth > 20 ? 'bg-red-500' : cat.growth > 0 ? 'bg-yellow-500' : 'bg-emerald-500'"
                  :style="{ width: Math.min(Math.abs(cat.growth) * 2, 100) + '%' }"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- Growth Chart Placeholder -->
      <Card title="Storage Growth History">
        <div class="h-48 flex items-center justify-center">
          <div class="text-center">
            <p class="text-slate-400 mb-2">📊 Growth visualization chart</p>
            <p class="text-sm text-slate-500">Line chart showing {{ trendData.length }} months of storage history</p>
          </div>
        </div>
      </Card>
    </template>
  </div>
</template>

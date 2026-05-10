<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";
import {
  historicalDataService,
  type HistoricalDataPoint,
  type AnalysisResult,
} from "../../services/HistoricalDataService";
import GrowthChart from "../../components/charts/GrowthChart.vue";

const store = useAnalysisStore();
const selectedTimeRange = ref<"7d" | "30d" | "90d" | "1y">("30d");
const loading = ref(false);
const historicalData = ref<HistoricalDataPoint[]>([]);
const showChart = ref(true);
const chartMetric = ref<"both" | "size" | "files">("both");
const sortCategories = ref<"growth" | "size">("growth");
const selectedCategory = ref<string | null>(null);

// Load historical data from persistent storage
onMounted(async () => {
  loading.value = true;
  try {
    historicalData.value = historicalDataService.getHistoricalData();

    // If we have current analysis data, save it
    if (store.data) {
      await historicalDataService.saveAnalysisData(store.data as AnalysisResult);
      historicalData.value = historicalDataService.getHistoricalData();
    }
  } catch (error) {
    console.error("Failed to load historical data:", error);
  } finally {
    loading.value = false;
  }
});

// Current stats from analysis result
const currentStats = computed(() => {
  const result = store.data;
  if (!result) return null;

  // Get total size and files from analysis data
  const totalSize = result.totalSize || result.summary?.totalSize || 0;
  const totalFiles = result.totalFiles || result.summary?.totalFiles || 0;

  if (historicalData.value.length < 2) {
    return {
      totalSize,
      totalFiles,
      sizeGrowth: 0,
      fileGrowth: 0,
    };
  }

  const previous = historicalData.value[historicalData.value.length - 2];
  const current = historicalData.value[historicalData.value.length - 1];

  return {
    totalSize: current.size,
    totalFiles: current.files,
    sizeGrowth: previous ? ((current.size - previous.size) / previous.size) * 100 : 0,
    fileGrowth: previous ? ((current.files - previous.files) / previous.files) * 100 : 0,
  };
});

// Calculate actual growth rate from historical data using linear regression
const actualGrowthRate = computed(() => {
  if (historicalData.value.length < 2) return 0;

  const monthlyGrowth = historicalDataService.calculateGrowthRate(historicalData.value);
  return monthlyGrowth * 100; // Convert to percentage
});

// Projections with accurate calculations using real growth rate
const projections = computed(() => {
  if (!store.data || historicalData.value.length < 2) return null;

  const growthRate = historicalDataService.calculateGrowthRate(historicalData.value);
  return historicalDataService.generateProjections(store.data as AnalysisResult, growthRate);
});

// Filter historical data based on selected time range
const filteredHistoricalData = computed(() => {
  if (historicalData.value.length === 0) return [];

  const now = new Date();
  const cutoffDate = new Date();

  switch (selectedTimeRange.value) {
    case "7d":
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      cutoffDate.setDate(now.getDate() - 30);
      break;
    case "90d":
      cutoffDate.setDate(now.getDate() - 90);
      break;
    case "1y":
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return historicalData.value.filter((d) => new Date(d.date) >= cutoffDate);
});

// Calculate category breakdown from actual historical data
const categoryTrends = computed(() => {
  return historicalDataService.getCategoryTrends(historicalData.value);
});

// Sorted category trends for display
const sortedCategoryTrends = computed(() => {
  const trends = [...categoryTrends.value];
  return trends.sort((a, b) => {
    if (sortCategories.value === "growth") {
      return b.growth - a.growth;
    } else {
      return b.current - a.current;
    }
  });
});

// Get selected category data
const getSelectedCategoryData = () => {
  if (!selectedCategory.value) return null;
  return categoryTrends.value.find((cat) => cat.category === selectedCategory.value) || null;
};

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatPercent(value: number): string {
  return (value >= 0 ? "+" : "") + value.toFixed(1) + "%";
}

function getGrowthColor(value: number): string {
  if (value > 10) return "text-emerald-400"; // High growth
  if (value > 5) return "text-green-400"; // Moderate growth
  if (value > 0) return "text-lime-400"; // Positive growth
  return "text-red-400"; // Negative or no growth
}

function getGrowthBgColor(value: number): string {
  if (value > 10) return "bg-emerald-500";
  if (value > 5) return "bg-green-500";
  if (value > 0) return "bg-lime-500";
  return "bg-red-500";
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header with Context -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Storage Trends</h1>
        <p class="text-slate-400 mt-1">
          Track storage usage patterns and predict future needs based on historical data
        </p>
        <div class="mt-2 text-xs text-slate-500">
          💡 Data is automatically saved after each scan to build accurate growth trends
        </div>
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
    <div v-if="!store.data" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')"> Go to Scanner </Button>
    </div>

    <template v-else>
      <!-- Stats Overview with Enhanced Context -->
      <div class="grid grid-cols-4 gap-4">
        <Card title="Current Size">
          <div class="space-y-2">
            <div class="text-3xl font-bold text-blue-400">
              {{ formatSize(currentStats?.totalSize || 0) }}
            </div>
            <div
              class="text-sm"
              :class="
                currentStats?.sizeGrowth && currentStats.sizeGrowth > 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              "
            >
              {{ formatPercent(currentStats?.sizeGrowth || 0) }} from last month
            </div>
            <div class="text-xs text-slate-500">📊 Total storage usage across all files</div>
          </div>
        </Card>
        <Card title="Total Files">
          <div class="space-y-2">
            <div class="text-3xl font-bold text-purple-400">
              {{ currentStats?.totalFiles.toLocaleString() || 0 }}
            </div>
            <div
              class="text-sm"
              :class="
                currentStats?.fileGrowth && currentStats.fileGrowth > 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              "
            >
              {{ formatPercent(currentStats?.fileGrowth || 0) }} from last month
            </div>
            <div class="text-xs text-slate-500">📁 Total number of files tracked</div>
          </div>
        </Card>
        <Card title="Avg File Size">
          <div class="space-y-2">
            <div class="text-3xl font-bold text-yellow-400">
              {{ formatSize((currentStats?.totalSize || 0) / (currentStats?.totalFiles || 1)) }}
            </div>
            <div class="text-sm text-slate-500">per file average</div>
            <div class="text-xs text-slate-500">📏 Average size per individual file</div>
          </div>
        </Card>
        <Card title="Growth Rate">
          <div class="space-y-2">
            <div class="text-3xl font-bold" :class="getGrowthColor(actualGrowthRate)">
              {{ formatPercent(actualGrowthRate) }}
            </div>
            <div class="text-sm text-slate-500">monthly average</div>
            <div class="text-xs text-slate-500">
              📈 Compound monthly growth rate from historical data
            </div>
          </div>
        </Card>
      </div>

      <!-- Projections with Enhanced Explanations -->
      <Card v-if="projections" title="Storage Projections">
        <div class="flex flex-col gap-4">
          <div class="text-sm text-slate-400">
            📅 Projections based on {{ historicalData.length }} months of historical data
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div class="text-center p-3 bg-slate-800/30 rounded">
              <div class="text-2xl font-bold text-blue-400">
                {{ formatSize(projections.nextMonth) }}
              </div>
              <div class="text-sm text-slate-500">Next Month</div>
              <div class="text-xs text-slate-600 mt-1">
                {{ formatPercent(actualGrowthRate) }} growth expected
              </div>
            </div>
            <div class="text-center p-3 bg-slate-800/30 rounded">
              <div class="text-2xl font-bold text-purple-400">
                {{ formatSize(projections.nextQuarter) }}
              </div>
              <div class="text-sm text-slate-500">Next Quarter</div>
              <div class="text-xs text-slate-600 mt-1">3-month projection</div>
            </div>
            <div class="text-center p-3 bg-slate-800/30 rounded">
              <div class="text-2xl font-bold text-orange-400">
                {{ formatSize(projections.nextYear) }}
              </div>
              <div class="text-sm text-slate-500">Next Year</div>
              <div class="text-xs text-slate-600 mt-1">12-month projection</div>
            </div>
          </div>
          <div
            v-if="projections.fillDate"
            class="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded"
          >
            <p class="text-sm text-yellow-300">
              <span class="font-semibold">⚠️ Storage Alert:</span> At current growth rate, you'll
              reach 100GB by {{ formatDate(projections.fillDate) }}
            </p>
            <div class="text-xs text-yellow-200 mt-2">
              💡 Consider archiving old files or upgrading storage capacity
            </div>
          </div>
          <div v-else class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded">
            <p class="text-sm text-emerald-300">
              ✅ Storage usage is stable or declining - no immediate action needed
            </p>
          </div>
        </div>
      </Card>

      <!-- Category Breakdown with Filters -->
      <Card title="Category Growth Trends">
        <div class="mb-4">
          <div class="flex items-center justify-between">
            <div class="text-sm text-slate-400">Showing growth across file categories</div>
            <div class="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                :class="sortCategories === 'growth' ? 'bg-slate-700' : ''"
                @click="sortCategories = 'growth'"
              >
                Sort by Growth
              </Button>
              <Button
                variant="secondary"
                size="sm"
                :class="sortCategories === 'size' ? 'bg-slate-700' : ''"
                @click="sortCategories = 'size'"
              >
                Sort by Size
              </Button>
            </div>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="cat in sortedCategoryTrends"
            :key="cat.category"
            class="flex items-center justify-between p-3 bg-slate-800/50 rounded hover:bg-slate-800/70 transition-colors cursor-pointer"
            @click="selectedCategory = selectedCategory === cat.category ? null : cat.category"
          >
            <div class="flex items-center gap-4">
              <div class="w-32 font-medium text-slate-200">
                {{ cat.category }}
                <span v-if="selectedCategory === cat.category" class="ml-2 text-xs text-blue-400"
                  >▼</span
                >
              </div>
              <div class="text-sm text-slate-400">
                {{ formatSize(cat.current) }}
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="text-sm" :class="cat.growth > 0 ? 'text-emerald-400' : 'text-red-400'">
                {{ formatPercent(cat.growth) }}
              </div>
              <div class="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="
                    cat.growth > 20
                      ? 'bg-emerald-500'
                      : cat.growth > 0
                        ? 'bg-green-500'
                        : 'bg-red-500'
                  "
                  :style="{ width: Math.min(Math.abs(cat.growth) * 2, 100) + '%' }"
                />
              </div>
            </div>
          </div>

          <!-- Category Detail View -->
          <div
            v-if="selectedCategory"
            class="mt-3 p-4 bg-slate-900/50 rounded border border-slate-700"
          >
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-medium text-slate-200">{{ selectedCategory }} Details</h4>
              <Button variant="ghost" size="sm" @click="selectedCategory = null"> ✕ </Button>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-slate-400">Current Size:</span>
                <div class="text-slate-200 font-medium">
                  {{ formatSize(getSelectedCategoryData()?.current || 0) }}
                </div>
              </div>
              <div>
                <span class="text-slate-400">Growth Rate:</span>
                <div
                  class="font-medium"
                  :class="
                    getSelectedCategoryData()?.growth > 0 ? 'text-emerald-400' : 'text-red-400'
                  "
                >
                  {{ formatPercent(getSelectedCategoryData()?.growth || 0) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- Growth Chart -->
      <Card title="Storage Growth History">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex gap-2">
            <Button
              :variant="chartMetric === 'both' ? 'primary' : 'secondary'"
              size="sm"
              @click="chartMetric = 'both'"
            >
              Both
            </Button>
            <Button
              :variant="chartMetric === 'size' ? 'primary' : 'secondary'"
              size="sm"
              @click="chartMetric = 'size'"
            >
              Size
            </Button>
            <Button
              :variant="chartMetric === 'files' ? 'primary' : 'secondary'"
              size="sm"
              @click="chartMetric = 'files'"
            >
              Files
            </Button>
          </div>
          <Button
            :variant="showChart ? 'secondary' : 'primary'"
            size="sm"
            @click="showChart = !showChart"
          >
            {{ showChart ? "Hide" : "Show" }} Chart
          </Button>
        </div>
        <div v-if="showChart" class="h-64">
          <GrowthChart :data="filteredHistoricalData" :loading="loading" :height="256" />
        </div>
        <div v-else class="h-16 flex items-center justify-center text-slate-400">
          Chart hidden - Click "Show Chart" to display
        </div>
      </Card>
    </template>
  </div>
</template>

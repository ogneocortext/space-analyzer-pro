<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const perspectiveMode = ref(false);
const selectedTimeRange = ref<"week" | "month" | "quarter" | "year">("month");

// Generate timeline data from file modification dates
const timelineData = computed(() => {
  if (!store.analysisResult?.files) return [];
  
  const files = store.analysisResult.files;
  const now = Date.now();
  const ranges = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    quarter: 90 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };
  
  const cutoff = now - ranges[selectedTimeRange.value];
  
  // Group files by date
  const dateGroups = new Map();
  
  files.forEach((file: any) => {
    const modified = new Date(file.modified).getTime();
    if (modified < cutoff) return;
    
    const dateKey = new Date(file.modified).toISOString().split('T')[0];
    
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, {
        date: dateKey,
        files: [],
        totalSize: 0,
        count: 0,
      });
    }
    
    const group = dateGroups.get(dateKey);
    group.files.push(file);
    group.totalSize += file.size || 0;
    group.count += 1;
  });
  
  return Array.from(dateGroups.values())
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
});

// Get activity intensity (files per day)
const activityStats = computed(() => {
  if (timelineData.value.length === 0) return null;
  
  const totalFiles = timelineData.value.reduce((sum: number, day: any) => sum + day.count, 0);
  const totalSize = timelineData.value.reduce((sum: number, day: any) => sum + day.totalSize, 0);
  const avgPerDay = totalFiles / timelineData.value.length;
  
  // Find most active day
  const mostActive = timelineData.value.reduce((max: any, day: any) => 
    day.count > max.count ? day : max, timelineData.value[0]);
  
  return {
    totalFiles,
    totalSize,
    avgPerDay,
    mostActive,
    activeDays: timelineData.value.length,
  };
});

// 3D-style bar height calculation
function getBarHeight(count: number, maxCount: number): string {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return `${Math.max(5, percentage)}%`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Timeline</h1>
        <p class="text-slate-400 mt-1">File modification history and activity visualization</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex gap-2">
          <Button
            v-for="range in ['week', 'month', 'quarter', 'year']"
            :key="range"
            :variant="selectedTimeRange === range ? 'primary' : 'secondary'"
            size="sm"
            @click="selectedTimeRange = range as any"
          >
            {{ range }}
          </Button>
        </div>
        <Button
          :variant="perspectiveMode ? 'primary' : 'secondary'"
          size="sm"
          @click="perspectiveMode = !perspectiveMode"
        >
          {{ perspectiveMode ? '2D' : '3D' }} View
        </Button>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else-if="activityStats">
      <!-- Activity Stats -->
      <div class="grid grid-cols-4 gap-4">
        <Card title="Files Modified">
          <div class="text-2xl font-bold text-blue-400">{{ activityStats.totalFiles.toLocaleString() }}</div>
          <div class="text-sm text-slate-500">in selected period</div>
        </Card>
        <Card title="Data Modified">
          <div class="text-2xl font-bold text-purple-400">{{ formatSize(activityStats.totalSize) }}</div>
          <div class="text-sm text-slate-500">total size</div>
        </Card>
        <Card title="Avg Per Day">
          <div class="text-2xl font-bold text-emerald-400">{{ activityStats.avgPerDay.toFixed(1) }}</div>
          <div class="text-sm text-slate-500">files/day</div>
        </Card>
        <Card title="Most Active Day">
          <div class="text-2xl font-bold text-orange-400">{{ formatDate(activityStats.mostActive.date) }}</div>
          <div class="text-sm text-slate-500">{{ activityStats.mostActive.count }} files</div>
        </Card>
      </div>

      <!-- Timeline Visualization -->
      <Card :title="perspectiveMode ? '3D Activity Timeline' : 'Activity Timeline'">
        <div
          class="relative h-80 flex items-end gap-1 overflow-x-auto pb-8"
          :class="perspectiveMode ? 'transform perspective-1000 rotate-x-12' : ''"
        >
          <div
            v-for="day in timelineData"
            :key="day.date"
            class="flex-1 min-w-[40px] flex flex-col justify-end group cursor-pointer"
            :style="perspectiveMode ? 'transform-style: preserve-3d;' : ''"
          >
            <!-- 3D Effect bars -->
            <div
              class="relative bg-blue-500/80 hover:bg-blue-400 rounded-t transition-all duration-300"
              :class="perspectiveMode ? 'shadow-lg transform hover:translate-z-2' : ''"
              :style="{ height: getBarHeight(day.count, activityStats.mostActive.count) }"
            >
              <!-- 3D side face -->
              <div
                v-if="perspectiveMode"
                class="absolute inset-0 bg-blue-600/60 transform skew-x-12 origin-bottom-left translate-y-full"
                :style="{ height: getBarHeight(day.count, activityStats.mostActive.count) }"
              />
            </div>
            
            <!-- Tooltip -->
            <div class="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 
                        bg-slate-800 px-2 py-1 rounded text-xs text-slate-200 whitespace-nowrap z-10 transition-opacity">
              {{ formatDate(day.date) }}: {{ day.count }} files
            </div>
            
            <!-- Date label -->
            <div class="text-xs text-slate-500 mt-2 text-center transform -rotate-45 origin-top-left truncate w-full">
              {{ formatDate(day.date) }}
            </div>
          </div>
        </div>
      </Card>

      <!-- Recent Activity List -->
      <Card title="Recent Activity">
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="day in [...timelineData].reverse().slice(0, 10)"
            :key="day.date"
            class="flex items-center justify-between p-3 bg-slate-800/50 rounded hover:bg-slate-800 transition-colors"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 text-center">
                <div class="text-lg font-bold text-blue-400">{{ day.count }}</div>
                <div class="text-xs text-slate-500">files</div>
              </div>
              <div>
                <div class="font-medium text-slate-200">{{ new Date(day.date).toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' }) }}</div>
                <div class="text-sm text-slate-400">{{ formatSize(day.totalSize) }} modified</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-slate-500">Sample files:</div>
              <div class="text-xs text-slate-400 truncate max-w-xs">
                {{ day.files.slice(0, 2).map((f: any) => f.name).join(', ') }}
                {{ day.files.length > 2 ? `+${day.files.length - 2} more` : '' }}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </template>

    <!-- Empty State -->
    <div v-else class="p-8 text-center">
      <p class="text-slate-400">No file activity found in the selected time range.</p>
      <p class="text-sm text-slate-500 mt-2">Try selecting a different time period.</p>
    </div>
  </div>
</template>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}

.rotate-x-12 {
  transform: rotateX(12deg);
}

.translate-z-2 {
  transform: translateZ(8px);
}
</style>

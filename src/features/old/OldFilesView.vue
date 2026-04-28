<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const ageThreshold = ref(365); // days
const minSize = ref(0); // bytes
const selectedFiles = ref<Set<string>>(new Set());
const sortBy = ref<"size" | "date">("size");

// Find old files
const oldFiles = computed(() => {
  if (!store.analysisResult?.files) return [];
  
  const now = Date.now();
  const thresholdMs = ageThreshold.value * 24 * 60 * 60 * 1000;
  const cutoff = now - thresholdMs;
  
  return store.analysisResult.files
    .filter((f: any) => {
      const modified = new Date(f.modified).getTime();
      return modified < cutoff && (f.size || 0) >= minSize.value;
    })
    .map((f: any) => ({
      ...f,
      age: Math.floor((now - new Date(f.modified).getTime()) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a: any, b: any) => {
      if (sortBy.value === "size") {
        return (b.size || 0) - (a.size || 0);
      }
      return new Date(a.modified).getTime() - new Date(b.modified).getTime();
    });
});

// Statistics
const stats = computed(() => {
  if (!oldFiles.value.length) return null;
  
  const totalSize = oldFiles.value.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
  const avgAge = oldFiles.value.reduce((sum: number, f: any) => sum + f.age, 0) / oldFiles.value.length;
  
  // Group by year
  const byYear: Record<string, number> = {};
  oldFiles.value.forEach((f: any) => {
    const year = Math.floor(f.age / 365);
    const key = year >= 5 ? "5+ years" : year >= 2 ? "2-5 years" : "1-2 years";
    byYear[key] = (byYear[key] || 0) + 1;
  });
  
  return {
    count: oldFiles.value.length,
    totalSize,
    avgAge: Math.floor(avgAge),
    byYear,
    potentialSavings: totalSize,
  };
});

function toggleSelection(path: string) {
  if (selectedFiles.value.has(path)) {
    selectedFiles.value.delete(path);
  } else {
    selectedFiles.value.add(path);
  }
}

function selectAll() {
  oldFiles.value.forEach((f: any) => selectedFiles.value.add(f.path));
}

function clearSelection() {
  selectedFiles.value.clear();
}

function copyPath(path: string) {
  navigator.clipboard.writeText(path);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatAge(days: number): string {
  if (days >= 365) {
    const years = (days / 365).toFixed(1);
    return `${years} years`;
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} months`;
  }
  return `${days} days`;
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Old Files Finder</h1>
        <p class="text-slate-400 mt-1">Find files that haven't been modified in a long time</p>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <!-- Filters -->
      <Card title="Filters">
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <label class="text-sm text-slate-400">Not modified in:</label>
            <select
              v-model="ageThreshold"
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            >
              <option :value="30">30 days</option>
              <option :value="90">3 months</option>
              <option :value="180">6 months</option>
              <option :value="365">1 year</option>
              <option :value="730">2 years</option>
              <option :value="1825">5 years</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm text-slate-400">Min size:</label>
            <select
              v-model="minSize"
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            >
              <option :value="0">Any size</option>
              <option :value="1024 * 1024">1 MB</option>
              <option :value="10 * 1024 * 1024">10 MB</option>
              <option :value="100 * 1024 * 1024">100 MB</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm text-slate-400">Sort by:</label>
            <select
              v-model="sortBy"
              class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
            >
              <option value="size">Size</option>
              <option value="date">Age</option>
            </select>
          </div>
        </div>
      </Card>

      <!-- Stats -->
      <div v-if="stats" class="grid grid-cols-4 gap-4">
        <Card title="Old Files Found">
          <div class="text-2xl font-bold text-orange-400">{{ stats.count }}</div>
          <div class="text-sm text-slate-500">not modified in {{ ageThreshold }}+ days</div>
        </Card>
        <Card title="Average Age">
          <div class="text-2xl font-bold text-yellow-400">{{ formatAge(stats.avgAge) }}</div>
          <div class="text-sm text-slate-500">since last modified</div>
        </Card>
        <Card title="Total Size">
          <div class="text-2xl font-bold text-purple-400">{{ formatSize(stats.totalSize) }}</div>
          <div class="text-sm text-slate-500">of old files</div>
        </Card>
        <Card title="Potential Savings">
          <div class="text-2xl font-bold text-emerald-400">{{ formatSize(stats.potentialSavings) }}</div>
          <div class="text-sm text-slate-500">if archived/deleted</div>
        </Card>
      </div>

      <!-- Age Distribution -->
      <Card v-if="stats?.byYear" title="Age Distribution">
        <div class="space-y-3">
          <div
            v-for="[range, count] in Object.entries(stats.byYear).sort((a, b) => parseInt(b[0]) - parseInt(a[0]))"
            :key="range"
            class="flex items-center gap-4"
          >
            <span class="w-20 text-sm text-slate-400">{{ range }}</span>
            <div class="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-orange-500 rounded-full"
                :style="{ width: (count / stats.count * 100) + '%' }"
              />
            </div>
            <span class="w-16 text-right text-sm text-slate-300">{{ count }} files</span>
          </div>
        </div>
      </Card>

      <!-- Selection Actions -->
      <div v-if="selectedFiles.size > 0" class="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
        <span class="text-orange-400">{{ selectedFiles.size }} files selected</span>
        <Button variant="secondary" size="sm" @click="clearSelection">Clear</Button>
      </div>

      <!-- File List -->
      <Card :title="`Old Files (${oldFiles.length})`">
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center gap-4 p-2 text-sm font-medium text-slate-500 border-b border-slate-700 sticky top-0 bg-slate-900">
            <input
              type="checkbox"
              :checked="selectedFiles.size === oldFiles.length && oldFiles.length > 0"
              @change="selectedFiles.size === oldFiles.length ? clearSelection() : selectAll()"
              class="rounded border-slate-600 bg-slate-800"
            />
            <span class="flex-1">File</span>
            <span class="w-24 text-right">Size</span>
            <span class="w-28 text-right">Age</span>
            <span class="w-16 text-right">Actions</span>
          </div>

          <!-- Files -->
          <div
            v-for="file in oldFiles"
            :key="file.path"
            class="flex items-center gap-4 p-2 rounded hover:bg-slate-800/50 transition-colors"
            :class="selectedFiles.has(file.path) ? 'bg-orange-500/10' : ''"
          >
            <input
              type="checkbox"
              :checked="selectedFiles.has(file.path)"
              @change="toggleSelection(file.path)"
              class="rounded border-slate-600 bg-slate-800"
            />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-slate-200 truncate" :title="file.name">{{ file.name }}</div>
              <div class="text-sm text-slate-500 truncate" :title="file.path">{{ file.path }}</div>
            </div>
            <span class="w-24 text-right font-medium text-slate-300">
              {{ formatSize(file.size) }}
            </span>
            <span class="w-28 text-right text-sm" :class="file.age > 730 ? 'text-red-400' : 'text-orange-400'">
              {{ formatAge(file.age) }}
            </span>
            <div class="w-16 text-right">
              <button
                class="text-slate-400 hover:text-blue-400 transition-colors"
                title="Copy path"
                @click="copyPath(file.path)"
              >
                📋
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="oldFiles.length === 0" class="p-8 text-center">
          <p class="text-slate-400">🎉 No old files found!</p>
          <p class="text-sm text-slate-500 mt-2">All files have been modified within {{ ageThreshold }} days.</p>
        </div>
      </Card>

      <!-- Recommendations -->
      <div v-if="stats && stats.count > 0" class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h3 class="font-medium text-blue-400 mb-2">💡 Recommendations</h3>
        <ul class="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>Consider archiving files older than 2 years to cold storage</li>
          <li>Files not modified in 5+ years are likely safe to delete after review</li>
          <li>Large old files (100MB+) should be prioritized for cleanup</li>
          <li>Always backup before bulk deletion operations</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const activeTab = ref<"overview" | "patterns" | "code">("overview");

// Smart Insights computed from analysis data
const insights = computed(() => {
  if (!store.analysisResult) return null;
  
  const files = store.analysisResult.files || [];
  const totalSize = store.analysisResult.totalSize || 0;
  
  // Usage patterns
  const extensions = files.reduce((acc: any, f: any) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || 'no-extension';
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});
  
  const topExtensions = Object.entries(extensions)
    .sort(([,a]: any, [,b]: any) => b - a)
    .slice(0, 5);
  
  // File age distribution
  const now = Date.now();
  const ageGroups = {
    recent: files.filter((f: any) => now - new Date(f.modified).getTime() < 7 * 24 * 60 * 60 * 1000).length,
    month: files.filter((f: any) => {
      const age = now - new Date(f.modified).getTime();
      return age >= 7 * 24 * 60 * 60 * 1000 && age < 30 * 24 * 60 * 60 * 1000;
    }).length,
    quarter: files.filter((f: any) => {
      const age = now - new Date(f.modified).getTime();
      return age >= 30 * 24 * 60 * 60 * 1000 && age < 90 * 24 * 60 * 60 * 1000;
    }).length,
    old: files.filter((f: any) => now - new Date(f.modified).getTime() >= 90 * 24 * 60 * 60 * 1000).length,
  };
  
  // Code analysis (for code files)
  const codeFiles = files.filter((f: any) => 
    ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'h', 'rs', 'go'].includes(
      f.name.split('.').pop()?.toLowerCase()
    )
  );
  
  const codeStats = {
    totalLines: codeFiles.length * 150, // Estimate
    languages: codeFiles.reduce((acc: any, f: any) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {}),
    largestFile: codeFiles.sort((a: any, b: any) => b.size - a.size)[0],
  };
  
  return {
    topExtensions,
    ageGroups,
    codeStats,
    totalFiles: files.length,
    avgFileSize: totalSize / (files.length || 1),
  };
});

// Predictions based on trends
const predictions = computed(() => {
  if (!insights.value) return [];
  
  const preds = [];
  const { ageGroups, totalFiles } = insights.value;
  
  // Storage prediction
  const oldRatio = ageGroups.old / totalFiles;
  if (oldRatio > 0.3) {
    preds.push({
      type: 'warning',
      title: `${Math.round(oldRatio * 100)}% of files are 3+ months old`,
      action: 'Review old files for archival',
      impact: 'high',
    });
  }
  
  // Recent activity
  if (ageGroups.recent > totalFiles * 0.1) {
    preds.push({
      type: 'info',
      title: 'High recent activity detected',
      action: 'Recent files may need backup',
      impact: 'medium',
    });
  }
  
  return preds;
});

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Insights Dashboard</h1>
        <p class="text-slate-400 mt-1">Smart analysis of your storage patterns and usage</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 border-b border-slate-700">
      <button
        v-for="tab in ['overview', 'patterns', 'code']"
        :key="tab"
        class="px-4 py-2 font-medium capitalize transition-colors"
        :class="activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'"
        @click="activeTab = tab as any"
      >
        {{ tab }}
      </button>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else-if="insights">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <!-- Predictions -->
        <div v-if="predictions.length > 0" class="space-y-3">
          <h2 class="text-lg font-semibold text-slate-200">Smart Predictions</h2>
          <div
            v-for="pred in predictions"
            :key="pred.title"
            class="p-4 rounded-lg border"
            :class="pred.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-blue-500/10 border-blue-500/20'"
          >
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-medium" :class="pred.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'">
                  {{ pred.title }}
                </h3>
                <p class="text-sm text-slate-400 mt-1">{{ pred.action }}</p>
              </div>
              <span
                class="text-xs px-2 py-1 rounded-full"
                :class="pred.impact === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'"
              >
                {{ pred.impact }} impact
              </span>
            </div>
          </div>
        </div>

        <!-- Key Stats -->
        <div class="grid grid-cols-3 gap-4">
          <Card title="Average File Size">
            <div class="text-2xl font-bold text-blue-400">{{ formatSize(insights.avgFileSize) }}</div>
          </Card>
          <Card title="Total Files">
            <div class="text-2xl font-bold text-purple-400">{{ insights.totalFiles.toLocaleString() }}</div>
          </Card>
          <Card title="File Types">
            <div class="text-2xl font-bold text-emerald-400">{{ insights.topExtensions.length }}</div>
          </Card>
        </div>
      </div>

      <!-- Patterns Tab -->
      <div v-if="activeTab === 'patterns'" class="space-y-6">
        <div class="grid grid-cols-2 gap-6">
          <!-- Top Extensions -->
          <Card title="Most Common File Types">
            <div class="space-y-2">
              <div
                v-for="[ext, count] in insights.topExtensions"
                :key="ext"
                class="flex items-center justify-between p-2 bg-slate-800/50 rounded"
              >
                <span class="font-mono text-slate-300">.{{ ext }}</span>
                <div class="flex items-center gap-2">
                  <div class="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-blue-500 rounded-full"
                      :style="{ width: (count / insights.totalFiles * 100) + '%' }"
                    />
                  </div>
                  <span class="text-sm text-slate-400 w-12 text-right">{{ count }}</span>
                </div>
              </div>
            </div>
          </Card>

          <!-- File Age Distribution -->
          <Card title="File Age Distribution">
            <div class="space-y-3">
              <div class="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span class="text-slate-400">Last 7 days</span>
                <span class="font-medium text-emerald-400">{{ insights.ageGroups.recent }}</span>
              </div>
              <div class="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span class="text-slate-400">Last 30 days</span>
                <span class="font-medium text-blue-400">{{ insights.ageGroups.month }}</span>
              </div>
              <div class="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span class="text-slate-400">Last 90 days</span>
                <span class="font-medium text-yellow-400">{{ insights.ageGroups.quarter }}</span>
              </div>
              <div class="flex justify-between items-center p-2 bg-slate-800/50 rounded">
                <span class="text-slate-400">Older than 90 days</span>
                <span class="font-medium text-red-400">{{ insights.ageGroups.old }}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <!-- Code Analysis Tab -->
      <div v-if="activeTab === 'code'" class="space-y-6">
        <div class="grid grid-cols-2 gap-6">
          <Card title="Code Statistics">
            <div class="space-y-4">
              <div>
                <div class="text-sm text-slate-500">Estimated Lines of Code</div>
                <div class="text-2xl font-bold text-blue-400">{{ insights.codeStats.totalLines.toLocaleString() }}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">Languages Detected</div>
                <div class="text-2xl font-bold text-purple-400">{{ Object.keys(insights.codeStats.languages).length }}</div>
              </div>
              <div v-if="insights.codeStats.largestFile">
                <div class="text-sm text-slate-500">Largest Code File</div>
                <div class="text-sm font-medium text-slate-300 truncate">{{ insights.codeStats.largestFile.name }}</div>
                <div class="text-xs text-slate-500">{{ formatSize(insights.codeStats.largestFile.size) }}</div>
              </div>
            </div>
          </Card>

          <Card title="Languages Breakdown">
            <div class="space-y-2">
              <div
                v-for="[lang, count] in Object.entries(insights.codeStats.languages).sort(([,a]: any, [,b]: any) => b - a).slice(0, 8)"
                :key="lang"
                class="flex items-center justify-between p-2 bg-slate-800/50 rounded"
              >
                <span class="font-mono text-slate-300">.{{ lang }}</span>
                <span class="text-sm text-slate-400">{{ count }} files</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const isLoading = ref(false);
const recommendations = ref<any[]>([]);
const error = ref("");

// Total potential savings
const totalSavings = computed(() => {
  return recommendations.value.reduce((sum, rec) => sum + (rec.potentialSavings || 0), 0);
});

// High-impact recommendations
const highImpactRecs = computed(() => {
  return recommendations.value.filter(r => r.potentialSavings > 100 * 1024 * 1024); // > 100MB
});

async function generateRecommendations() {
  if (!store.analysisResult) {
    error.value = "Please run a scan first";
    return;
  }

  isLoading.value = true;
  error.value = "";

  try {
    // Generate recommendations based on analysis data
    const recs = [];
    const files = store.analysisResult.files || [];
    const categories = store.analysisResult.categories || {};

    // 1. Old temp files
    const tempFiles = files.filter((f: any) => 
      f.name.match(/\.(tmp|temp|cache|log)$/i) ||
      f.path.includes('temp') ||
      f.path.includes('cache')
    );
    const tempSize = tempFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
    if (tempFiles.length > 0) {
      recs.push({
        type: 'temp',
        title: `Delete ${tempFiles.length} temporary files`,
        description: 'Clear temporary and cache files that are safe to remove',
        potentialSavings: tempSize,
        priority: 'high',
        action: 'delete_temp',
        fileCount: tempFiles.length
      });
    }

    // 2. Large unused files
    const oldFiles = files.filter((f: any) => {
      const age = Date.now() - new Date(f.modified).getTime();
      return f.size > 100 * 1024 * 1024 && age > 365 * 24 * 60 * 60 * 1000; // > 100MB, > 1 year
    });
    const oldSize = oldFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
    if (oldFiles.length > 0) {
      recs.push({
        type: 'old',
        title: `Review ${oldFiles.length} large old files`,
        description: 'Files over 100MB not accessed in over a year',
        potentialSavings: oldSize,
        priority: 'medium',
        action: 'review_old',
        fileCount: oldFiles.length
      });
    }

    // 3. Duplicate check
    if (store.analysisResult.duplicateCount > 0) {
      recs.push({
        type: 'duplicates',
        title: `Clean up ${store.analysisResult.duplicateCount} duplicate files`,
        description: `Found ${store.analysisResult.duplicateGroups?.length || 0} duplicate groups wasting space`,
        potentialSavings: store.analysisResult.duplicateSize || 0,
        priority: 'high',
        action: 'view_duplicates',
        fileCount: store.analysisResult.duplicateCount
      });
    }

    // 4. Category-based suggestions
    const mediaSize = categories['media']?.size || categories['images']?.size || 0;
    if (mediaSize > 1024 * 1024 * 1024) { // > 1GB media
      recs.push({
        type: 'media',
        title: 'Optimize media files',
        description: `Compress or archive ${formatSize(mediaSize)} of media files`,
        potentialSavings: mediaSize * 0.3, // Assume 30% compression
        priority: 'low',
        action: 'optimize_media'
      });
    }

    // Sort by potential savings
    recs.sort((a, b) => b.potentialSavings - a.potentialSavings);
    recommendations.value = recs;

  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to generate recommendations";
    console.error("Recommendations error:", err);
  } finally {
    isLoading.value = false;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return 'text-red-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-blue-400';
    default: return 'text-slate-400';
  }
}

function executeAction(action: string) {
  switch (action) {
    case 'view_duplicates':
      // Navigate to duplicates view
      break;
    case 'delete_temp':
      // Show confirmation modal
      alert('This would delete temporary files after confirmation');
      break;
    default:
      console.log('Action:', action);
  }
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">AI Cleanup Recommendations</h1>
        <p class="text-slate-400 mt-1">Smart suggestions to optimize your storage</p>
      </div>
      <Button
        variant="primary"
        :loading="isLoading"
        :disabled="isLoading || !store.analysisResult"
        @click="generateRecommendations"
      >
        {{ isLoading ? "Analyzing..." : "Generate Recommendations" }}
      </Button>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
      <p class="text-red-400">{{ error }}</p>
    </div>

    <!-- No Analysis -->
    <div v-if="!store.analysisResult && !isLoading" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <!-- Summary Card -->
    <div v-if="recommendations.length > 0" class="grid grid-cols-3 gap-4">
      <Card title="Total Recommendations">
        <div class="text-3xl font-bold text-blue-400">{{ recommendations.length }}</div>
        <div class="text-sm text-slate-500">actions available</div>
      </Card>
      <Card title="Potential Savings">
        <div class="text-3xl font-bold text-emerald-400">{{ formatSize(totalSavings) }}</div>
        <div class="text-sm text-slate-500">can be freed</div>
      </Card>
      <Card title="High Impact Items">
        <div class="text-3xl font-bold text-orange-400">{{ highImpactRecs.length }}</div>
        <div class="text-sm text-slate-500">over 100MB each</div>
      </Card>
    </div>

    <!-- Recommendations List -->
    <div v-if="recommendations.length > 0" class="space-y-4">
      <h2 class="text-xl font-semibold text-slate-200">Recommended Actions</h2>
      
      <div
        v-for="(rec, index) in recommendations"
        :key="index"
        class="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-medium text-slate-200">{{ rec.title }}</h3>
              <span 
                class="text-xs px-2 py-0.5 rounded-full bg-slate-700"
                :class="getPriorityColor(rec.priority)"
              >
                {{ rec.priority }}
              </span>
            </div>
            <p class="text-sm text-slate-400">{{ rec.description }}</p>
            <div v-if="rec.fileCount" class="text-xs text-slate-500 mt-2">
              {{ rec.fileCount }} files affected
            </div>
          </div>
          
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-lg font-semibold text-emerald-400">
                {{ formatSize(rec.potentialSavings) }}
              </div>
              <div class="text-xs text-slate-500">savings</div>
            </div>
            <Button 
              variant="secondary" 
              size="sm"
              @click="executeAction(rec.action)"
            >
              Review
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="recommendations.length === 0 && !isLoading && store.analysisResult" class="p-8 text-center">
      <div class="text-5xl mb-4">🎉</div>
      <h2 class="text-xl font-semibold text-slate-200 mb-2">Storage Optimized!</h2>
      <p class="text-slate-400">No cleanup recommendations found. Your storage is well-organized.</p>
    </div>
  </div>
</template>

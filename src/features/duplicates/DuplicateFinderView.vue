<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";
import { Trash2, ExternalLink, AlertCircle } from "lucide-vue-next";

const store = useAnalysisStore();
const isAnalyzing = ref(false);
const isDeleting = ref<string | null>(null);
const duplicateData = ref<any>(null);
const error = ref("");
const successMessage = ref("");

// Stats computed from duplicate data
const stats = computed(() => {
  if (!duplicateData.value) return null;
  return {
    totalDuplicates: duplicateData.value.duplicateCount || 0,
    totalGroups: duplicateData.value.duplicateGroups?.length || 0,
    wastedSpace: duplicateData.value.wastedSpace || 0,
    totalFiles: duplicateData.value.totalFiles || 0,
  };
});

// Top duplicate groups sorted by wasted space
const topDuplicates = computed(() => {
  return duplicateData.value?.duplicateGroups?.slice(0, 10) || [];
});

// Recommendations for cleanup
const recommendations = computed(() => {
  return duplicateData.value?.recommendations || [];
});

async function analyzeDuplicates() {
  if (!store.analysisResult) {
    error.value = "Please run a scan first";
    return;
  }

  isAnalyzing.value = true;
  error.value = "";

  try {
    // Get the analysis ID from the store
    const analysisId = store.analysisResult.analysisId || "latest";

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/analysis/${analysisId}/duplicates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: store.analysisResult.path }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    duplicateData.value = await response.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to analyze duplicates";
    console.error("Duplicate analysis error:", err);
  } finally {
    isAnalyzing.value = false;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

async function revealFile(filePath: string) {
  try {
    await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/files/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
  } catch (err) {
    console.error("Failed to reveal file:", err);
  }
}

async function deleteFile(filePath: string, hash: string) {
  if (!confirm(`Are you sure you want to permanently delete this file?\n\n${filePath}`)) {
    return;
  }

  isDeleting.value = filePath;
  error.value = "";
  successMessage.value = "";

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/files/delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete file");
    }

    // Success - remove from UI locally
    if (duplicateData.value?.duplicateGroups) {
      const group = duplicateData.value.duplicateGroups.find((g: any) => g.hash === hash);
      if (group) {
        const fileIndex = group.files.findIndex((f: any) => f.path === filePath);
        if (fileIndex !== -1) {
          group.files.splice(fileIndex, 1);
          group.fileCount--;
          group.wastedSpace -= group.size;

          // Update overall stats
          duplicateData.value.duplicateCount--;
          duplicateData.value.wastedSpace -= group.size;

          // Remove group if only 1 file left (no longer a duplicate)
          if (group.files.length < 2) {
            const groupIndex = duplicateData.value.duplicateGroups.indexOf(group);
            duplicateData.value.duplicateGroups.splice(groupIndex, 1);
          }
        }
      }
    }

    successMessage.value = "File deleted successfully";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to delete file";
  } finally {
    isDeleting.value = null;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Duplicate File Finder</h1>
        <p class="text-slate-400 mt-1">
          Find and clean up duplicate files to free up storage space
        </p>
      </div>
      <Button
        variant="primary"
        :loading="isAnalyzing"
        :disabled="isAnalyzing || !store.analysisResult"
        @click="analyzeDuplicates"
      >
        {{ isAnalyzing ? "Analyzing..." : "Find Duplicates" }}
      </Button>
    </div>

    <div v-if="error" class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
      <AlertCircle class="w-5 h-5 text-red-400" />
      <p class="text-red-400 text-sm">{{ error }}</p>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <p class="text-emerald-400 text-sm">{{ successMessage }}</p>
    </div>

    <!-- No Analysis Warning -->
    <div v-if="!store.analysisResult && !isAnalyzing" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')"> Go to Scanner </Button>
    </div>

    <!-- Stats Overview -->
    <div v-if="stats" class="grid grid-cols-4 gap-4">
      <Card title="Duplicate Files">
        <div class="text-3xl font-bold text-red-400">{{ stats.totalDuplicates }}</div>
        <div class="text-sm text-slate-500">files found</div>
      </Card>
      <Card title="Duplicate Groups">
        <div class="text-3xl font-bold text-orange-400">{{ stats.totalGroups }}</div>
        <div class="text-sm text-slate-500">unique sets</div>
      </Card>
      <Card title="Wasted Space">
        <div class="text-3xl font-bold text-yellow-400">{{ formatSize(stats.wastedSpace) }}</div>
        <div class="text-sm text-slate-500">can be freed</div>
      </Card>
      <Card title="Total Scanned">
        <div class="text-3xl font-bold text-blue-400">{{ stats.totalFiles.toLocaleString() }}</div>
        <div class="text-sm text-slate-500">files analyzed</div>
      </Card>
    </div>

    <!-- Recommendations -->
    <div v-if="recommendations.length > 0" class="space-y-4">
      <h2 class="text-xl font-semibold text-slate-200">Cleanup Recommendations</h2>
      <div class="space-y-3">
        <div
          v-for="(rec, index) in recommendations"
          :key="index"
          class="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-medium text-slate-200">{{ rec.title }}</h3>
              <p class="text-sm text-slate-400 mt-1">{{ rec.description }}</p>
            </div>
            <div class="text-right">
              <div class="text-lg font-semibold text-emerald-400">
                {{ formatSize(rec.potentialSavings) }}
              </div>
              <div class="text-xs text-slate-500">potential savings</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Duplicate Groups -->
    <div v-if="topDuplicates.length > 0" class="space-y-4">
      <h2 class="text-xl font-semibold text-slate-200">Top Duplicate Groups</h2>
      <div class="space-y-3">
        <Card
          v-for="group in topDuplicates"
          :key="group.hash"
          :title="`${group.files[0]?.name || 'Unknown'} (${group.fileCount} copies)`"
        >
          <div class="space-y-3">
            <!-- Group Stats -->
            <div class="flex gap-4 text-sm">
              <span class="text-slate-400">
                Size: <span class="text-slate-200">{{ formatSize(group.size) }}</span>
              </span>
              <span class="text-slate-400">
                Wasted: <span class="text-red-400">{{ formatSize(group.wastedSpace) }}</span>
              </span>
              <span class="text-slate-400">
                Hash: <span class="text-slate-500 font-mono">{{ group.hash }}</span>
              </span>
            </div>

            <!-- File List -->
            <div class="space-y-1">
              <div
                v-for="file in group.files"
                :key="file.path"
                class="flex items-center justify-between p-2 bg-slate-800 rounded text-sm"
              >
                <div class="flex items-center gap-2">
                  <span class="text-slate-300 truncate max-w-md" :title="file.path">
                    {{ file.path }}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-slate-500">{{ formatDate(file.modified) }}</span>
                  <div class="flex items-center gap-1">
                    <button
                      @click="revealFile(file.path)"
                      class="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                      title="Reveal in Explorer"
                    >
                      <ExternalLink class="w-4 h-4" />
                    </button>
                    <button
                      @click="deleteFile(file.path, group.hash)"
                      :disabled="isDeleting === file.path"
                      class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      :class="{ 'opacity-50 cursor-not-allowed': isDeleting === file.path }"
                      title="Delete File"
                    >
                      <Trash2 v-if="isDeleting !== file.path" class="w-4 h-4" />
                      <div
                        v-else
                        class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"
                      ></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- No Duplicates Found -->
    <div v-if="duplicateData && topDuplicates.length === 0" class="p-8 text-center">
      <div class="text-5xl mb-4">🎉</div>
      <h2 class="text-xl font-semibold text-slate-200 mb-2">No Duplicates Found!</h2>
      <p class="text-slate-400">Your storage is well-organized with no duplicate files detected.</p>
    </div>
  </div>
</template>

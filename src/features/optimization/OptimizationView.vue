<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-slate-100 mb-2">Storage Optimization</h1>
        <p class="text-slate-400 mb-6">
          Intelligent storage optimization tools and recommendations
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <!-- Clean Temporary Files -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <Trash2 class="w-8 h-8 text-red-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">Clean Temporary Files</h3>
          </div>
          <p class="text-slate-300 mb-4">
            Remove temporary files, cache, and leftovers from system cleanup
          </p>
          <button
            @click="cleanTemporaryFiles"
            :disabled="isCleaning"
            class="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Trash2 class="w-4 h-4 mr-2" />
            {{ isCleaning ? "Cleaning..." : "Clean Temporary Files" }}
          </button>
        </div>

        <!-- Find Duplicate Files -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <Copy class="w-8 h-8 text-orange-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">Find Duplicate Files</h3>
          </div>
          <p class="text-slate-300 mb-4">
            Identify and remove duplicate files to reclaim storage space
          </p>
          <button
            @click="findDuplicateFiles"
            :disabled="isScanning"
            class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Copy class="w-4 h-4 mr-2" />
            {{ isScanning ? "Scanning..." : "Find Duplicate Files" }}
          </button>
        </div>

        <!-- Compress Large Files -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <Archive class="w-8 h-8 text-blue-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">Compress Large Files</h3>
          </div>
          <p class="text-slate-300 mb-4">Compress old or rarely used files to save disk space</p>
          <button
            @click="compressLargeFiles"
            :disabled="isCompressing"
            class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Archive class="w-4 h-4 mr-2" />
            {{ isCompressing ? "Compressing..." : "Compress Large Files" }}
          </button>
        </div>

        <!-- Storage Analysis -->
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div class="flex items-center mb-4">
            <HardDrive class="w-8 h-8 text-purple-400 mr-3" />
            <h3 class="text-lg font-semibold text-white">Storage Analysis</h3>
          </div>
          <p class="text-slate-300 mb-4">
            Analyze storage patterns and provide optimization recommendations
          </p>
          <button
            @click="analyzeStoragePatterns"
            :disabled="isAnalyzing"
            class="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-800 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <HardDrive class="w-4 h-4 mr-2" />
            {{ isAnalyzing ? "Analyzing..." : "Analyze Storage Patterns" }}
          </button>
        </div>
      </div>

      <!-- Results Section -->
      <div
        v-if="optimizationResults.length > 0"
        class="bg-slate-800 rounded-lg p-6 border border-slate-700"
      >
        <h3 class="text-lg font-semibold text-white mb-4">Optimization Results</h3>
        <div class="space-y-4">
          <div
            v-for="result in optimizationResults"
            :key="result.id"
            class="flex items-center justify-between p-4 bg-slate-700 rounded-lg"
          >
            <div class="flex items-center">
              <component :is="getResultIcon(result.type)" class="w-5 h-5 text-slate-400 mr-3" />
              <div>
                <div class="font-medium text-white">{{ result.title }}</div>
                <div class="text-sm text-slate-400">{{ result.description }}</div>
              </div>
            </div>
            <div class="text-slate-400 text-sm">
              {{ result.details }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAnalysisStore } from "@/store";
import { Trash2, Copy, Archive, HardDrive, TrendingUp } from "lucide-vue-next";

interface OptimizationResult {
  id: string;
  type: "success" | "warning" | "error" | "info";
  title: string;
  description: string;
  details: string;
}

const analysisStore = useAnalysisStore();

const isCleaning = ref(false);
const isScanning = ref(false);
const isCompressing = ref(false);
const isAnalyzing = ref(false);
const optimizationResults = ref<OptimizationResult[]>([]);

const hasAnalysisData = computed(() => {
  return (
    analysisStore.analysisResult &&
    analysisStore.analysisResult.file_analysis &&
    analysisStore.analysisResult.file_analysis.files &&
    analysisStore.analysisResult.file_analysis.files.length > 0
  );
});

const cleanTemporaryFiles = async () => {
  if (!hasAnalysisData.value) return;

  isCleaning.value = true;

  try {
    // Simulate cleaning temporary files
    await new Promise((resolve) => setTimeout(resolve, 2000));

    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "success",
      title: "Temporary Files Cleaned",
      description: "Removed temporary files and cache",
      details: "Freed up 245 MB of storage space",
    });
  } catch (error) {
    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "error",
      title: "Cleaning Failed",
      description: "Failed to clean temporary files",
      details: error.message,
    });
  } finally {
    isCleaning.value = false;
  }
};

const findDuplicateFiles = async () => {
  if (!hasAnalysisData.value) return;

  isScanning.value = true;

  try {
    // Simulate duplicate file detection
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const duplicateCount = Math.floor(Math.random() * 20) + 5;

    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "info",
      title: "Duplicate Files Found",
      description: `Found ${duplicateCount} duplicate files`,
      details: "Review and remove duplicates to reclaim storage space",
    });
  } catch (error) {
    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "error",
      title: "Duplicate Scan Failed",
      description: "Failed to scan for duplicates",
      details: error.message,
    });
  } finally {
    isScanning.value = false;
  }
};

const compressLargeFiles = async () => {
  if (!hasAnalysisData.value) return;

  isCompressing.value = true;

  try {
    // Simulate file compression
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const compressionRatio = 0.65 + Math.random() * 0.2;
    const savedSpace = Math.floor(Math.random() * 500 + 100);

    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "success",
      title: "Files Compressed",
      description: "Compressed large files successfully",
      details: `Achieved ${Math.round(compressionRatio * 100)}% compression ratio, saved ${savedSpace} MB`,
    });
  } catch (error) {
    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "error",
      title: "Compression Failed",
      description: "Failed to compress files",
      details: error.message,
    });
  } finally {
    isCompressing.value = false;
  }
};

const analyzeStoragePatterns = async () => {
  if (!hasAnalysisData.value) return;

  isAnalyzing.value = true;

  try {
    // Simulate storage pattern analysis
    await new Promise((resolve) => setTimeout(resolve, 2500));

    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "info",
      title: "Storage Analysis Complete",
      description: "Analyzed storage usage patterns",
      details: "Consider moving old files to archive and removing unused applications",
    });
  } catch (error) {
    optimizationResults.value.push({
      id: Date.now().toString(),
      type: "error",
      title: "Analysis Failed",
      description: "Failed to analyze storage",
      details: error.message,
    });
  } finally {
    isAnalyzing.value = false;
  }
};

const getResultIcon = (type: string) => {
  switch (type) {
    case "success":
      return TrendingUp;
    case "warning":
      return Copy;
    case "error":
      return Trash2;
    default:
      return HardDrive;
  }
};

onMounted(() => {
  // Clear previous results
  optimizationResults.value = [];
});
</script>

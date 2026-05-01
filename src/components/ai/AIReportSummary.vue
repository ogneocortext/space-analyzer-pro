<template>
  <div
    v-if="summary"
    class="ai-summary-card bg-linear-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4 mb-6"
  >
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-2">
          <h3 class="text-sm font-semibold text-blue-300">AI-Generated Summary</h3>
          <span v-if="isGenerating" class="text-xs text-blue-400/70">(generating...)</span>
        </div>
        <p class="text-sm text-slate-300 leading-relaxed">{{ summary }}</p>
        <div v-if="insights.length > 0" class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="insight in insights"
            :key="insight"
            class="text-xs px-2 py-1 bg-blue-500/10 text-blue-300 rounded-full"
          >
            {{ insight }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  data: any;
}

const props = defineProps<Props>();

const summary = ref("");
const insights = ref<string[]>([]);
const isGenerating = ref(false);

// Generate AI summary based on report data
const generateSummary = async () => {
  if (!props.data) return;

  isGenerating.value = true;

  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Generate contextual summary
  const { totalFiles, totalSize, categories, largeFiles } = props.data;
  const sizeFormatted = formatSize(totalSize);

  // Create summary based on data
  if (totalFiles === 0) {
    summary.value = "No files analyzed yet. Start a scan to generate insights.";
    insights.value = [];
  } else {
    summary.value = `Analysis of ${totalFiles.toLocaleString()} files totaling ${sizeFormatted}. ${
      largeFiles > 0
        ? `Found ${largeFiles} large files (>100MB) that may impact storage optimization.`
        : "Good distribution of file sizes."
    } ${
      categories > 3
        ? "Diverse file categories detected, suggesting varied usage patterns."
        : "Focused file type distribution."
    }`;

    insights.value = [
      `${categories} categories`,
      `${(totalSize / 1024 / 1024 / 1024 || 0).toFixed(1)} GB total`,
      largeFiles > 0 ? `${largeFiles} large files` : "Optimal file sizes",
    ];
  }

  isGenerating.value = false;
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Generate summary when data changes
watch(() => props.data, generateSummary, { immediate: true });
</script>

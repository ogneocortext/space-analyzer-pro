<template>
  <div class="relative w-full h-full bg-slate-950 rounded-lg overflow-hidden">
    <canvas ref="canvasRef" class="w-full h-full cursor-move" @click="handleCanvasClick" />

    <!-- 3D Stats Overlay -->
    <div
      v-if="showStats"
      class="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700"
    >
      <div class="text-xs text-slate-300 space-y-1">
        <div>Files: {{ displayStats.fileCount }}</div>
        <div>Mode: {{ displayStats.mode }}</div>
        <div>Rotation: {{ displayStats.isRotating ? "ON" : "OFF" }}</div>
        <div>FPS: {{ displayStats.fps }}</div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-slate-900/80">
      <div class="text-center">
        <div
          class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"
        />
        <p class="text-slate-300">Building 3D visualization...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { use3DVisualization, type FileNode } from "../../composables/use3DVisualization";

interface Props {
  files: any[];
  showStats?: boolean;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showStats: true,
  isLoading: false,
});

// Use the 3D visualization composable
const { canvasRef, config, isRotating, currentFPS, selectedFile, stats, handleCanvasClick } =
  use3DVisualization();

// Computed stats based on props
const displayStats = computed(() => ({
  ...stats.value,
  fileCount: props.files?.length || 0,
}));

// Update visualization when files change
watch(
  () => props.files,
  (newFiles) => {
    if (newFiles && newFiles.length > 0) {
      console.log("Updating 3D visualization with", newFiles.length, "files");

      // Convert files to FileNode format
      const fileNodes: FileNode[] = newFiles.map((file, index) => ({
        id: `file-${index}`,
        name: file.name || `File ${index}`,
        size: file.size || 1024,
        type: file.type || "unknown",
        path: file.path || "",
      }));

      // Update 3D visualization
      updateVisualization(fileNodes);
    }
  },
  { immediate: true }
);

onMounted(() => {
  console.log("3D Canvas component mounted");
});

onUnmounted(() => {
  console.log("3D Canvas component unmounted");
});
</script>

<style scoped>
/* Component-specific styles for 3D canvas */
canvas {
  image-rendering: optimizeSpeed;
}

/* Loading animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

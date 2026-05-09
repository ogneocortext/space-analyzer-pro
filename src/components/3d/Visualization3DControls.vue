<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <!-- View Mode -->
    <div class="bg-slate-800 rounded-lg p-4">
      <label class="block text-sm font-medium text-slate-300 mb-2">View Mode</label>
      <select
        :value="config.mode"
        class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        @change="updateConfig({ mode: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="option in modeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Color By -->
    <div class="bg-slate-800 rounded-lg p-4">
      <label class="block text-sm font-medium text-slate-300 mb-2">Color By</label>
      <select
        :value="config.colorMode"
        class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        @change="updateConfig({ colorMode: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="option in colorOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Animation Speed -->
    <div class="bg-slate-800 rounded-lg p-4">
      <label class="block text-sm font-medium text-slate-300 mb-2">Animation Speed</label>
      <input
        :value="config.animationSpeed"
        type="range"
        min="0"
        max="100"
        class="w-full"
        @input="updateConfig({ animationSpeed: Number(($event.target as HTMLInputElement).value) })"
      />
      <div class="text-xs text-slate-400 mt-1">{{ config.animationSpeed }}%</div>
    </div>

    <!-- Actions -->
    <div class="bg-slate-800 rounded-lg p-4">
      <label class="block text-sm font-medium text-slate-300 mb-2">Actions</label>
      <div class="space-y-2">
        <button
          class="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded transition-colors"
          @click="resetCamera"
        >
          <Camera class="w-4 h-4 inline mr-2" />
          Reset Camera
        </button>
        <button
          class="w-full bg-purple-500 hover:bg-purple-600 text-white text-sm py-2 px-3 rounded transition-colors"
          @click="toggleRotation"
        >
          <Eye class="w-4 h-4 inline mr-2" />
          {{ isRotating ? "Stop Rotation" : "Start Rotation" }}
        </button>
        <button
          class="w-full bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-3 rounded transition-colors"
          @click="exportVisualization"
        >
          <Eye class="w-4 h-4 inline mr-2" />
          Export View
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Camera, Eye } from "lucide-vue-next";
import { use3DControls } from "../../composables/use3DControls";

const {
  config,
  isRotating,
  modeOptions,
  colorOptions,
  resetCamera,
  toggleRotation,
  exportVisualization,
  updateConfig,
} = use3DControls();
</script>

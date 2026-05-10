<template>
  <div class="bg-slate-800 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-slate-100 mb-4">Network Controls</h3>

    <!-- View Mode Selection -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium text-slate-300">View Mode</label>
        <Tooltip
          content="Choose how to visualize your file network. Folders shows directory structure, File Types groups by extension, and Duplicates highlights repeated files."
          position="top"
        >
          <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
        </Tooltip>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <Tooltip
          v-for="mode in viewModes"
          :key="mode.value"
          :content="mode.tooltip"
          :title="mode.label"
          position="top"
        >
          <button
            :class="[
              'px-4 py-2 rounded-lg font-medium transition-all duration-200',
              viewMode === mode.value
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
            ]"
            @click="selectViewMode(mode.value)"
          >
            <component :is="mode.icon" class="w-4 h-4 inline mr-2" />
            {{ mode.label }}
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- Graph Settings -->
    <div class="flex flex-col gap-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-300">Force Strength</label>
          <Tooltip
            content="Controls how strongly nodes repel each other. Higher values create more spread out networks, lower values keep nodes closer together."
            position="top"
          >
            <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
          </Tooltip>
        </div>
        <input
          v-model="settings.forceStrength"
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        <div class="flex justify-between text-xs text-slate-400 mt-1">
          <span>Weak</span>
          <span>{{ settings.forceStrength.toFixed(1) }}</span>
          <span>Strong</span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-300">Node Size</label>
          <Tooltip
            content="Adjusts the size of nodes in the visualization. Larger nodes are easier to see but may overlap more."
            position="top"
          >
            <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
          </Tooltip>
        </div>
        <input
          v-model="settings.nodeSize"
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        <div class="flex justify-between text-xs text-slate-400 mt-1">
          <span>Small</span>
          <span>{{ settings.nodeSize.toFixed(1) }}</span>
          <span>Large</span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-300">Link Distance</label>
          <Tooltip
            content="Sets the ideal distance between connected nodes. Shorter distances create tighter clusters, longer distances show more spread."
            position="top"
          >
            <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
          </Tooltip>
        </div>
        <input
          v-model="settings.linkDistance"
          type="range"
          min="50"
          max="200"
          step="10"
          class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        <div class="flex justify-between text-xs text-slate-400 mt-1">
          <span>Short</span>
          <span>{{ settings.linkDistance }}</span>
          <span>Long</span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-300">Animation Speed</label>
          <Tooltip
            content="Controls how fast the network animation runs. Set to 0% for static view, higher values for smoother animations."
            position="top"
          >
            <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
          </Tooltip>
        </div>
        <input
          v-model="settings.animationSpeed"
          type="range"
          min="0"
          max="100"
          step="5"
          class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
        <div class="flex justify-between text-xs text-slate-400 mt-1">
          <span>Slow</span>
          <span>{{ settings.animationSpeed }}%</span>
          <span>Fast</span>
        </div>
      </div>
    </div>

    <!-- Toggle Options -->
    <div class="space-y-3 mt-6">
      <Tooltip
        content="Display text labels on nodes to identify them. Turn off for cleaner visualization in dense networks."
        position="right"
      >
        <label class="flex items-center space-x-3 cursor-pointer">
          <input
            v-model="settings.showLabels"
            type="checkbox"
            class="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span class="text-sm text-slate-300">Show Node Labels</span>
        </label>
      </Tooltip>

      <Tooltip
        content="Enable smooth animations for node movements. Creates fluid transitions but may impact performance on large networks."
        position="right"
      >
        <label class="flex items-center space-x-3 cursor-pointer">
          <input
            v-model="settings.animateNodes"
            type="checkbox"
            class="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span class="text-sm text-slate-300">Animate Nodes</span>
        </label>
      </Tooltip>

      <Tooltip
        content="Show connection lines between related nodes. Helps visualize relationships but can clutter dense networks."
        position="right"
      >
        <label class="flex items-center space-x-3 cursor-pointer">
          <input
            v-model="settings.showConnections"
            type="checkbox"
            class="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span class="text-sm text-slate-300">Show Connections</span>
        </label>
      </Tooltip>

      <Tooltip
        content="Enable physics simulation for realistic node movement. Creates organic layouts but may slow down with many nodes."
        position="right"
      >
        <label class="flex items-center space-x-3 cursor-pointer">
          <input
            v-model="settings.enablePhysics"
            type="checkbox"
            class="w-4 h-4 text-blue-500 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span class="text-sm text-slate-300">Enable Physics</span>
        </label>
      </Tooltip>
    </div>

    <!-- Action Buttons -->
    <div class="grid grid-cols-2 gap-2 mt-6">
      <Tooltip
        content="Reset all settings to their default values and reorganize the network layout."
        position="top"
      >
        <button
          class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          @click="resetGraph"
        >
          <RotateCcw class="w-4 h-4 inline mr-2" />
          Reset Graph
        </button>
      </Tooltip>

      <Tooltip
        content="Export the current network visualization as a JSON file for analysis or sharing."
        position="top"
      >
        <button
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
          @click="exportNetwork"
        >
          <Download class="w-4 h-4 inline mr-2" />
          Export
        </button>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Folder, File, Copy, RotateCcw, Download, HelpCircle } from "lucide-vue-next";
import Tooltip from "../ui/Tooltip.vue";

interface ViewMode {
  value: "folders" | "types" | "duplicates";
  label: string;
  icon: any;
  tooltip: string;
}

interface GraphSettings {
  forceStrength: number;
  nodeSize: number;
  linkDistance: number;
  animationSpeed: number;
  showLabels: boolean;
  animateNodes: boolean;
  showConnections: boolean;
  enablePhysics: boolean;
}

const emit = defineEmits<{
  viewModeChange: [mode: "folders" | "types" | "duplicates"];
  settingsChange: [settings: GraphSettings];
  resetGraph: [];
  exportNetwork: [];
}>();

const viewMode = ref<"folders" | "types" | "duplicates">("folders");

const viewModes: ViewMode[] = [
  {
    value: "folders",
    label: "Folders",
    icon: Folder,
    tooltip: "Visualize directory hierarchy and folder relationships in your file system.",
  },
  {
    value: "types",
    label: "File Types",
    icon: File,
    tooltip: "Group files by their extensions to see which file types dominate your storage.",
  },
  {
    value: "duplicates",
    label: "Duplicates",
    icon: Copy,
    tooltip: "Highlight duplicate files and their relationships to identify wasted space.",
  },
];

const settings = ref<GraphSettings>({
  forceStrength: 1.0,
  nodeSize: 1.0,
  linkDistance: 100,
  animationSpeed: 50,
  showLabels: true,
  animateNodes: false,
  showConnections: true,
  enablePhysics: true,
});

const selectViewMode = (mode: "folders" | "types" | "duplicates") => {
  viewMode.value = mode;
  emit("viewModeChange", mode);
};

const resetGraph = () => {
  settings.value = {
    forceStrength: 1.0,
    nodeSize: 1.0,
    linkDistance: 100,
    animationSpeed: 50,
    showLabels: true,
    animateNodes: false,
    showConnections: true,
    enablePhysics: true,
  };
  emit("resetGraph");
};

const exportNetwork = () => {
  emit("exportNetwork");
};

// Watch for settings changes and emit
watch(
  settings,
  (newSettings) => {
    emit("settingsChange", newSettings);
  },
  { deep: true }
);
</script>

<style scoped>
input[type="range"] {
  background: linear-gradient(to right, #3b82f6 0%, #3b82f6 100%);
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #60a5fa;
  border-radius: 50%;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #60a5fa;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

input[type="checkbox"]:checked {
  background-color: #3b82f6;
  border-color: #3b82f6;
}
</style>

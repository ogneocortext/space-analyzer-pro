<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Button } from "../../design-system/components";
import NetworkGraph from "../../components/network/NetworkGraph.vue";
import NetworkAnalytics from "../../components/network/NetworkAnalytics.vue";
import NetworkControls from "../../components/network/NetworkControls.vue";
import { HelpCircle } from "lucide-vue-next";
import Tooltip from "../../components/ui/Tooltip.vue";
import {
  useNetworkVisualization,
  type NetworkNode,
  type NetworkSettings,
} from "../../composables/useNetworkVisualization";

const store = useAnalysisStore();

// Use network visualization composable
const {
  nodes,
  links,
  selectedNode,
  hoveredNode,
  isLoading,
  viewMode,
  settings,
  generateNetworkData,
  selectNode,
  clearSelection,
  resetGraph,
  exportNetwork,
} = useNetworkVisualization();

// Generate network data from analysis store
const networkData = computed(() => {
  if (!store.analysisResult?.files) return { nodes: [], links: [] };

  return generateNetworkData(store.analysisResult.files, viewMode.value);
});

// Watch for view mode changes and regenerate network
watch(
  viewMode,
  () => {
    if (store.analysisResult?.files) {
      const { nodes: newNodes, links: newLinks } = generateNetworkData(
        store.analysisResult.files,
        viewMode.value
      );
      // Update the composable's reactive data
      nodes.value = newNodes;
      links.value = newLinks;
    }
  },
  { immediate: true }
);

// Watch for analysis result changes
watch(
  () => store.analysisResult?.files,
  (newFiles) => {
    if (newFiles) {
      const { nodes: newNodes, links: newLinks } = generateNetworkData(newFiles, viewMode.value);
      nodes.value = newNodes;
      links.value = newLinks;
    }
  },
  { immediate: true }
);

// Handle network events
const handleNodeClick = (_node: NetworkNode) => {
  selectNode(_node);
};

const handleViewModeChange = (mode: "folders" | "types" | "duplicates") => {
  viewMode.value = mode;
};

const handleSettingsChange = (newSettings: NetworkSettings) => {
  settings.value = newSettings;
};

const handleGraphReset = () => {
  resetGraph();
};

const handleNetworkExport = () => {
  exportNetwork();
};

// Lifecycle
onMounted(() => {
  // Initialize with existing data
  if (store.analysisResult?.files) {
    const { nodes: initialNodes, links: initialLinks } = generateNetworkData(
      store.analysisResult.files,
      viewMode.value
    );
    nodes.value = initialNodes;
    links.value = initialLinks;
  }
});

onUnmounted(() => {
  // Cleanup handled by composable
});
</script>

<template>
  <div class="min-h-screen bg-slate-900">
    <div class="max-w-7xl mx-auto p-6 space-y-6">
      <!-- Modern Header -->
      <header class="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">Network Analysis</h1>
            <p class="text-slate-400 text-lg">Interactive file relationship visualization</p>
          </div>

          <!-- View Mode Selector -->
          <div class="flex gap-3">
            <Tooltip
              content="Choose how to visualize your file network. Each mode shows different aspects of your file system relationships."
              position="bottom"
            >
              <div class="flex items-center space-x-2 mb-2">
                <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
                <span class="text-sm text-slate-400">View Mode</span>
              </div>
            </Tooltip>
            <Tooltip
              v-for="mode in [
                {
                  value: 'folders',
                  label: 'Folders',
                  icon: 'folder',
                  tooltip: 'Shows directory hierarchy and parent-child folder relationships',
                },
                {
                  value: 'types',
                  label: 'File Types',
                  icon: 'document',
                  tooltip: 'Groups files by extension to show storage distribution',
                },
                {
                  value: 'duplicates',
                  label: 'Duplicates',
                  icon: 'copy',
                  tooltip: 'Highlights duplicate files and wasted space',
                },
              ]"
              :key="mode.value"
              :content="mode.tooltip"
              :title="mode.label"
              position="bottom"
            >
              <button
                :key="mode.value"
                :class="[
                  'px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105',
                  viewMode === mode.value
                    ? 'bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                ]"
                :content="mode.tooltip"
                :title="mode.label"
                position="bottom"
              >
                <button
                  :class="[
                    'px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105',
                    viewMode === mode.value
                      ? 'bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                  ]"
                  @click="handleViewModeChange(mode.value)"
                >
                  <div class="flex items-center space-x-2">
                    <div
                      class="w-5 h-5 rounded"
                      :class="{
                        'bg-blue-200': mode.value === 'folders',
                        'bg-emerald-200': mode.value === 'types',
                        'bg-red-200': mode.value === 'duplicates',
                      }"
                    />
                    <span>{{ mode.label }}</span>
                  </div>
                </button>
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      <!-- No Data State -->
      <div v-if="!store.analysisResult" class="bg-slate-800 rounded-xl p-12 text-center">
        <div class="max-w-md mx-auto">
          <div
            class="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <svg
              class="w-12 h-12 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2z"
              />
            </svg>
          </div>
          <h2 class="text-2xl font-semibold text-white mb-3">No Data Available</h2>
          <p class="text-slate-400 mb-6">
            Scan a directory to visualize file relationships and network patterns
          </p>
          <Button variant="primary" size="lg" class="px-8 py-3" @click="$router.push('/scan')">
            Start Scanning
          </Button>
        </div>
      </div>

      <!-- Main Network View -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Network Graph -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Network Controls -->
          <NetworkControls
            @view-mode-change="handleViewModeChange"
            @settings-change="handleSettingsChange"
            @reset-graph="handleGraphReset"
            @export-network="handleNetworkExport"
          />

          <!-- Network Graph -->
          <div class="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
            <div class="p-4 border-b border-slate-700">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center">
                  <span class="w-3 h-3 bg-blue-500 rounded-full mr-3" />
                  Network Graph
                </h2>
                <Tooltip
                  content="Interactive visualization of your file system network. Click and drag nodes to rearrange, scroll to zoom."
                  position="top"
                >
                  <div class="flex items-center space-x-2">
                    <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
                    <span class="text-sm text-slate-400">
                      {{ networkData.nodes.length }} nodes •
                      {{ networkData.links.length }} connections
                    </span>
                  </div>
                </Tooltip>
              </div>
            </div>

            <NetworkGraph
              :nodes="nodes"
              :links="links"
              :is-loading="isLoading"
              class="h-[600px]"
              @node-click="handleNodeClick"
              @node-select="handleNodeSelect"
            />
          </div>
        </div>

        <!-- Analytics Panel -->
        <div class="space-y-6">
          <NetworkAnalytics :nodes="nodes" :links="links" />

          <!-- Selected Node Details -->
          <div
            v-if="selectedNode"
            class="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
          >
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center">
              <div
                class="w-4 h-4 rounded-full mr-3"
                :class="{
                  'bg-blue-500': selectedNode.type === 'folder',
                  'bg-emerald-500': selectedNode.type === 'filetype',
                  'bg-red-500': selectedNode.type === 'duplicate',
                  'bg-orange-500': selectedNode.type === 'file',
                }"
              />
              Selected Node
            </h3>

            <div class="space-y-4">
              <div>
                <div class="text-sm text-slate-400 mb-1">Name</div>
                <div class="text-white font-medium">
                  {{ selectedNode.name }}
                </div>
              </div>

              <div>
                <div class="text-sm text-slate-400 mb-1">Type</div>
                <div class="text-white font-medium capitalize">
                  {{ selectedNode.type }}
                </div>
              </div>

              <div>
                <div class="text-sm text-slate-400 mb-1">Size</div>
                <div class="text-white font-medium">
                  {{
                    selectedNode.size > 0
                      ? (selectedNode.size / 1024 / 1024).toFixed(2) + " GB"
                      : "0 B"
                  }}
                </div>
              </div>

              <div v-if="selectedNode.fileCount">
                <div class="text-sm text-slate-400 mb-1">Files</div>
                <div class="text-white font-medium">
                  {{ selectedNode.fileCount }}
                </div>
              </div>

              <div v-if="selectedNode.connections" class="pt-4">
                <div class="text-sm text-slate-400 mb-1">Connections</div>
                <div class="text-white font-medium">
                  {{ selectedNode.connections }}
                </div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-700">
              <Button variant="secondary" class="w-full" @click="clearSelection">
                Clear Selection
              </Button>
            </div>
          </div>

          <!-- Quick Stats -->
          <div
            v-if="!selectedNode"
            class="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
          >
            <h3 class="text-lg font-semibold text-white mb-4">Quick Stats</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-400">
                  {{ networkData.nodes.length }}
                </div>
                <div class="text-sm text-slate-400">Total Nodes</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-emerald-400">
                  {{ networkData.links.length }}
                </div>
                <div class="text-sm text-slate-400">Connections</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

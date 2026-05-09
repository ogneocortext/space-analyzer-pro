<template>
  <div class="space-y-6">
    <!-- Network Overview -->
    <div class="bg-slate-800 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-slate-100">Network Overview</h3>
        <Tooltip
          content="Key metrics about your network structure including total nodes, connections, and density measurements."
          position="top"
        >
          <HelpCircle class="w-4 h-4 text-slate-400 cursor-help" />
        </Tooltip>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-400">
            {{ totalNodes }}
          </div>
          <Tooltip
            content="Total number of nodes (files, folders, or file types) in your network visualization."
            position="top"
          >
            <div class="text-sm text-slate-400 cursor-help">Total Nodes</div>
          </Tooltip>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-emerald-400">
            {{ totalLinks }}
          </div>
          <Tooltip
            content="Number of connections between nodes showing relationships in your file system."
            position="top"
          >
            <div class="text-sm text-slate-400 cursor-help">Connections</div>
          </Tooltip>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-400">
            {{ averageConnections }}
          </div>
          <Tooltip
            content="Average number of connections per node. Higher values indicate more interconnected networks."
            position="top"
          >
            <div class="text-sm text-slate-400 cursor-help">Avg Connections</div>
          </Tooltip>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-400">
            {{ networkDensity }}
          </div>
          <Tooltip
            content="Network density as a percentage. Higher values mean more potential connections are actually used."
            position="top"
          >
            <div class="text-sm text-slate-400 cursor-help">Density</div>
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- Node Distribution -->
    <div class="bg-slate-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-slate-100 mb-4">Node Distribution</h3>
      <div class="space-y-3">
        <div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-slate-300">Folders</span>
            <span class="font-medium text-slate-100">{{ nodeCounts.folders }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-2">
            <div
              class="bg-blue-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: (nodeCounts.folders / totalNodes) * 100 + '%' }"
            />
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-slate-300">Files</span>
            <span class="font-medium text-slate-100">{{ nodeCounts.files }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-2">
            <div
              class="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: (nodeCounts.files / totalNodes) * 100 + '%' }"
            />
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-slate-300">Duplicates</span>
            <span class="font-medium text-slate-100">{{ nodeCounts.duplicates }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-2">
            <div
              class="bg-red-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: (nodeCounts.duplicates / totalNodes) * 100 + '%' }"
            />
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <span class="text-slate-300">File Types</span>
            <span class="font-medium text-slate-100">{{ nodeCounts.fileTypes }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-2">
            <div
              class="bg-purple-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: (nodeCounts.fileTypes / totalNodes) * 100 + '%' }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Top Connections -->
    <div class="bg-slate-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-slate-100 mb-4">Top Connections</h3>
      <div class="space-y-2">
        <div
          v-for="(connection, index) in topConnections"
          :key="connection.source.name + '-' + connection.target.name"
          class="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <div class="w-2 h-2 rounded-full bg-blue-500" />
            <span class="text-slate-200">{{ connection.source.name }}</span>
            <ArrowRight class="w-4 h-4 text-slate-400" />
            <span class="text-slate-200">{{ connection.target.name }}</span>
          </div>
          <div class="text-sm text-slate-400">Strength: {{ connection.strength.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <!-- Network Insights -->
    <div class="bg-slate-800 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-slate-100 mb-4">Network Insights</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-slate-700 rounded-lg p-4">
          <div class="flex items-center space-x-2 mb-2">
            <TrendingUp class="w-5 h-5 text-green-400" />
            <span class="text-slate-200 font-medium">Most Connected</span>
          </div>
          <div class="text-lg font-bold text-slate-100">
            {{ mostConnectedNode.name }}
          </div>
          <div class="text-sm text-slate-400">{{ mostConnectedNode.connections }} connections</div>
        </div>

        <div class="bg-slate-700 rounded-lg p-4">
          <div class="flex items-center space-x-2 mb-2">
            <HardDrive class="w-5 h-5 text-blue-400" />
            <span class="text-slate-200 font-medium">Largest Node</span>
          </div>
          <div class="text-lg font-bold text-slate-100">
            {{ largestNode.name }}
          </div>
          <div class="text-sm text-slate-400">
            {{ formatSize(largestNode.size) }}
          </div>
        </div>

        <div class="bg-slate-700 rounded-lg p-4">
          <div class="flex items-center space-x-2 mb-2">
            <Zap class="w-5 h-5 text-yellow-400" />
            <span class="text-slate-200 font-medium">Network Health</span>
          </div>
          <div
            class="text-lg font-bold"
            :class="
              networkHealth.score > 80
                ? 'text-green-400'
                : networkHealth.score > 60
                  ? 'text-yellow-400'
                  : 'text-red-400'
            "
          >
            {{ networkHealth.score }}%
          </div>
          <div class="text-sm text-slate-400">
            {{ networkHealth.status }}
          </div>
        </div>

        <div class="bg-slate-700 rounded-lg p-4">
          <div class="flex items-center space-x-2 mb-2">
            <Activity class="w-5 h-5 text-purple-400" />
            <span class="text-slate-200 font-medium">Clustering</span>
          </div>
          <div class="text-lg font-bold text-slate-100">
            {{ clustering.coefficient.toFixed(3) }}
          </div>
          <div class="text-sm text-slate-400">
            {{ clustering.interpretation }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, TrendingUp, HardDrive, Zap, Activity, HelpCircle } from "lucide-vue-next";
import Tooltip from "../ui/Tooltip.vue";

interface NetworkNode {
  id: string;
  name: string;
  size: number;
  fileCount?: number;
  type: "folder" | "filetype" | "duplicate" | "file";
  connections?: number;
}

interface NetworkLink {
  source: NetworkNode;
  target: NetworkNode;
  strength: number;
}

interface Props {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

const props = defineProps<Props>();

// Utility functions
const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Computed analytics
const totalNodes = computed(() => props.nodes.length);

const totalLinks = computed(() => props.links.length);

const nodeCounts = computed(() => {
  const counts = {
    folders: 0,
    files: 0,
    duplicates: 0,
    fileTypes: 0,
  };

  props.nodes.forEach((node) => {
    switch (node.type) {
      case "folder":
        counts.folders++;
        break;
      case "file":
        counts.files++;
        break;
      case "duplicate":
        counts.duplicates++;
        break;
      case "filetype":
        counts.fileTypes++;
        break;
    }
  });

  return counts;
});

const averageConnections = computed(() => {
  if (totalNodes.value === 0) return 0;
  return (totalLinks.value * 2) / totalNodes.value;
});

const networkDensity = computed(() => {
  const maxPossibleLinks = (totalNodes.value * (totalNodes.value - 1)) / 2;
  if (maxPossibleLinks === 0) return 0;
  return (totalLinks.value / maxPossibleLinks) * 100;
});

const topConnections = computed(() => {
  return [...props.links].sort((a, b) => b.strength - a.strength).slice(0, 5);
});

const mostConnectedNode = computed(() => {
  const connectionCounts = new Map<string, number>();

  props.links.forEach((link) => {
    const sourceId = link.source.id;
    const targetId = link.target.id;

    connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1);
    connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1);
  });

  let mostConnected = null;
  let maxConnections = 0;

  connectionCounts.forEach((connections, nodeId) => {
    if (connections > maxConnections) {
      maxConnections = connections;
      mostConnected = props.nodes.find((n) => n.id === nodeId) || null;
    }
  });

  return mostConnected || { name: "Unknown", connections: 0 };
});

const largestNode = computed(() => {
  return [...props.nodes].sort((a, b) => b.size - a.size)[0] || { name: "Unknown", size: 0 };
});

const networkHealth = computed(() => {
  const density = networkDensity.value;
  const avgConnections = averageConnections.value;

  let score = 0;
  let status = "Poor";

  if (density > 50 && avgConnections > 2) {
    score = 85;
    status = "Excellent";
  } else if (density > 30 && avgConnections > 1.5) {
    score = 70;
    status = "Good";
  } else if (density > 15 && avgConnections > 1) {
    score = 55;
    status = "Fair";
  } else {
    score = 30;
    status = "Poor";
  }

  return { score, status };
});

const clustering = computed(() => {
  // Simplified clustering coefficient calculation
  const nodeCount = totalNodes.value;
  if (nodeCount < 3) {
    return { coefficient: 0, interpretation: "Too few nodes for clustering analysis" };
  }

  // Calculate clustering coefficient (simplified)
  let totalClustering = 0;
  let validNodes = 0;

  props.nodes.forEach((node) => {
    const neighbors = new Set<string>();

    props.links.forEach((link) => {
      if (link.source.id === node.id) {
        neighbors.add(link.target.id);
      } else if (link.target.id === node.id) {
        neighbors.add(link.source.id);
      }
    });

    if (neighbors.size >= 2) {
      validNodes++;
      let neighborConnections = 0;

      neighbors.forEach((neighborId) => {
        let neighborNeighborCount = 0;
        props.links.forEach((link) => {
          if (
            (link.source.id === neighborId && neighbors.has(link.target.id)) ||
            (link.target.id === neighborId && neighbors.has(link.source.id))
          ) {
            neighborNeighborCount++;
          }
        });

        neighborConnections += neighborNeighborCount;
      });

      const maxPossibleNeighborConnections = neighbors.size * (neighbors.size - 1);
      if (maxPossibleNeighborConnections > 0) {
        totalClustering += neighborConnections / maxPossibleNeighborConnections;
      }
    }
  });

  const coefficient = validNodes > 0 ? totalClustering / validNodes : 0;

  let interpretation = "Low clustering";
  if (coefficient > 0.7) {
    interpretation = "Highly clustered network";
  } else if (coefficient > 0.4) {
    interpretation = "Moderately clustered network";
  } else if (coefficient > 0.2) {
    interpretation = "Loosely clustered network";
  }

  return { coefficient, interpretation };
});
</script>

<template>
  <div
    data-testid="3d-visualization"
    class="enhanced-3d-visualization"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div class="visualization-placeholder">
      <div class="placeholder-content">
        <div class="placeholder-icon">🎮</div>
        <h3>3D Visualization</h3>
        <p>Interactive 3D graph visualization</p>
        <div class="stats">
          <div>📦 Nodes: {{ data.nodes.length }}</div>
          <div>🔗 Links: {{ data.links.length }}</div>
        </div>
      </div>
    </div>

    <!-- Control Panel -->
    <div data-testid="viz-controls" class="control-panel">
      <h3>🎮 3D Controls</h3>
      <div class="stats">
        <div>📦 Nodes: {{ data.nodes.length }}</div>
        <div>🔗 Links: {{ data.links.length }}</div>
      </div>

      <div class="zoom-controls">
        <button
          data-testid="zoom-in"
          @click="handleZoomIn"
          class="zoom-btn"
        >
          ➕ Zoom In
        </button>
        <button
          data-testid="zoom-out"
          @click="handleZoomOut"
          class="zoom-btn"
        >
          ➖ Zoom Out
        </button>
        <button
          data-testid="reset-view"
          @click="handleResetView"
          class="zoom-btn"
        >
          🔄 Reset View
        </button>
      </div>

      <div v-if="selectedNode" class="selected-info">
        <h4>🎯 {{ selectedNode.name }}</h4>
        <div>📁 Path: {{ selectedNode.path }}</div>
        <div>📏 Lines: {{ selectedNode.metadata.lines }}</div>
        <div>🧠 Complexity: {{ selectedNode.metadata.complexity }}</div>
        <div>⚠️ Issues: {{ selectedNode.metadata.issues }}</div>
        <div>🔗 Dependencies: {{ selectedNode.metadata.dependencies }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface EnhancedNode3D {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'function' | 'class' | 'module' | 'component';
  size: number;
  color: string;
  metadata: {
    path: string;
    lines: number;
    complexity: number;
    issues: number;
    dependencies: number;
  };
}

interface EnhancedLink3D {
  source: string;
  target: string;
  type: 'import' | 'require' | 'extends' | 'call';
  strength: number;
  color: string;
}

interface Enhanced3DVisualizationProps {
  data: { nodes: EnhancedNode3D[]; links: EnhancedLink3D[] };
  width?: number;
  height?: number;
  onNodeClick?: (node: EnhancedNode3D) => void;
}

const props = withDefaults(defineProps<Enhanced3DVisualizationProps>(), {
  width: 1200,
  height: 800,
  onNodeClick: undefined,
});

const selectedNode = ref<EnhancedNode3D | null>(null);

const handleNodeClick = (node: any) => {
  const nodeData = props.data.nodes.find((n) => n.id === node.id);
  if (nodeData) {
    selectedNode.value = nodeData;
    props.onNodeClick?.(nodeData);
  }
};

const handleNodeHover = (node: any | null) => {
  if (node) {
    document.body.style.cursor = 'pointer';
  } else {
    document.body.style.cursor = 'default';
  }
};

const handleZoomIn = () => {
  // Placeholder for zoom functionality
  console.log('Zoom in');
};

const handleZoomOut = () => {
  // Placeholder for zoom functionality
  console.log('Zoom out');
};

const handleResetView = () => {
  // Placeholder for reset view functionality
  console.log('Reset view');
};
</script>

<style scoped>
.enhanced-3d-visualization {
  @apply relative bg-gray-900 rounded-lg overflow-hidden;
}

.visualization-placeholder {
  @apply absolute inset-0 flex items-center justify-center;
}

.placeholder-content {
  @apply text-center;
}

.placeholder-icon {
  @apply text-6xl mb-4;
}

.placeholder-content h3 {
  @apply text-xl font-semibold text-white mb-2;
}

.placeholder-content p {
  @apply text-gray-400 mb-4;
}

.stats {
  @apply space-y-1 text-sm text-gray-300;
}

.control-panel {
  @apply absolute top-4 right-4 bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-lg p-4 max-w-xs;
}

.control-panel h3 {
  @apply text-lg font-semibold text-white mb-3;
}

.zoom-controls {
  @apply flex flex-col gap-2 mt-3;
}

.zoom-btn {
  @apply px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors;
}

.selected-info {
  @apply mt-4 pt-4 border-t border-gray-700 space-y-1 text-sm;
}

.selected-info h4 {
  @apply font-semibold text-white mb-2;
}

.selected-info > div {
  @apply text-gray-300;
}
</style>

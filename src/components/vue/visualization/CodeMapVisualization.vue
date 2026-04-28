<template>
  <div class="code-map-visualization">
    <!-- Header -->
    <div class="code-map-header">
      <div class="header-left">
        <h3 class="code-map-title">
          <Network class="title-icon" :size="20" />
          Interactive Code Map
        </h3>
        <div class="code-map-stats">
          <div class="stat">
            <span class="stat-label">Files</span>
            <span class="stat-value">{{ stats.totalFiles }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Issues</span>
            <span class="stat-value">{{ stats.totalIssues }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Circular</span>
            <span class="stat-value">{{ stats.circularDependencies }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Unused</span>
            <span class="stat-value">{{ stats.unusedImports }}</span>
          </div>
        </div>
      </div>

      <div class="header-right">
        <!-- Search -->
        <div class="search-container">
          <Search class="search-icon" :size="16" />
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Search files, functions, classes..."
            class="search-input"
          />
        </div>

        <!-- Filter -->
        <select
          v-model="filterType"
          class="filter-select"
        >
          <option value="all">All Items</option>
          <option value="issues">Issues Only</option>
          <option value="connections">Connections Only</option>
        </select>

        <!-- Zoom controls -->
        <div class="zoom-controls">
          <button @click="handleZoomOut" class="zoom-btn" title="Zoom out">
            <ZoomOut :size="16" />
          </button>
          <button @click="handleResetZoom" class="zoom-btn" title="Reset zoom">
            <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
          </button>
          <button @click="handleZoomIn" class="zoom-btn" title="Zoom in">
            <ZoomIn :size="16" />
          </button>
        </div>

        <!-- Export -->
        <button @click="handleExport" class="export-btn" title="Export as SVG">
          <Download :size="16" />
        </button>
      </div>
    </div>

    <!-- Visualization -->
    <div class="code-map-container" :style="{ width: `${width}px`, height: `${height}px` }">
      <div v-if="loading" class="code-map-loading">
        <div class="loading-spinner" />
        <p>Analyzing code dependencies...</p>
      </div>
      <svg
        v-else
        ref="svgRef"
        :width="width"
        :height="height"
        :style="{ transform: `scale(${zoom})`, transformOrigin: 'center' }"
      />
    </div>

    <!-- Legend -->
    <div class="code-map-legend">
      <h4 class="legend-title">Legend</h4>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #3b82f6" />
          <span>File (No Issues)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #ef4444" />
          <span>File (Has Issues)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #10b981" />
          <span>Used Function/Class</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #f59e0b" />
          <span>Exported (Unused)</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #6b7280" />
          <span>Unused Code</span>
        </div>
      </div>
    </div>

    <!-- Selected Node Details -->
    <div v-if="selectedNode" class="node-details">
      <div class="details-header">
        <h4 class="details-title">
          <FileText v-if="selectedNode.type === 'file'" :size="16" />
          <Code v-else-if="selectedNode.type === 'function'" :size="16" />
          <Database v-else :size="16" />
          {{ selectedNode.name }}
        </h4>
        <button @click="selectedNode = null" class="close-btn">
          ×
        </button>
      </div>

      <div class="details-content">
        <div class="detail-row">
          <span class="detail-label">Type:</span>
          <span class="detail-value">{{ selectedNode.type }}</span>
        </div>

        <div v-if="selectedNode.type === 'file'" class="detail-row">
          <span class="detail-label">Path:</span>
          <span class="detail-value">{{ selectedNode.filePath }}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Issues:</span>
          <div class="issues-list">
            <div v-if="selectedNode.issues.unusedImports > 0" class="issue-item">
              <AlertTriangle :size="12" class="issue-icon" />
              <span>{{ selectedNode.issues.unusedImports }} unused imports</span>
            </div>
            <div v-if="selectedNode.issues.missingImports > 0" class="issue-item">
              <XCircle :size="12" class="issue-icon" />
              <span>{{ selectedNode.issues.missingImports }} missing imports</span>
            </div>
            <div v-if="selectedNode.issues.circularDependencies > 0" class="issue-item">
              <GitBranch :size="12" class="issue-icon" />
              <span>{{ selectedNode.issues.circularDependencies }} circular dependencies</span>
            </div>
            <div v-if="selectedNode.issues.deadCode > 0" class="issue-item">
              <Info :size="12" class="issue-icon" />
              <span>{{ selectedNode.issues.deadCode }} dead code segments</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Network,
  ZoomIn,
  ZoomOut,
  Download,
  Search,
  AlertTriangle,
  XCircle,
  Info,
  GitBranch,
  FileText,
  Code,
  Database,
} from 'lucide-vue-next';

interface CodeMapVisualizationProps {
  files: any[];
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  width?: number;
  height?: number;
}

interface CodeMapNode {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'export';
  filePath: string;
  group: string;
  size: number;
  color: string;
  issues: {
    unusedImports: number;
    missingImports: number;
    circularDependencies: number;
    deadCode: number;
  };
}

interface CodeMapLink {
  source: string;
  target: string;
  type: 'import' | 'export' | 'call' | 'reference';
  strength: 'strong' | 'medium' | 'weak';
  color: string;
}

interface CodeMapData {
  nodes: CodeMapNode[];
  links: CodeMapLink[];
}

const props = withDefaults(defineProps<CodeMapVisualizationProps>(), {
  width: 800,
  height: 600,
  selectedFile: undefined,
  onFileSelect: undefined,
});

const data = ref<CodeMapData>({ nodes: [], links: [] });
const searchTerm = ref('');
const filterType = ref<'all' | 'issues' | 'connections'>('all');
const selectedNode = ref<CodeMapNode | null>(null);
const zoom = ref(1);
const loading = ref(true);
const svgRef = ref<SVGSVGElement | null>(null);

const stats = ref({
  totalFiles: 0,
  totalIssues: 0,
  circularDependencies: 0,
  unusedImports: 0,
  deadCode: 0,
});

const filteredData = computed(() => {
  let filteredNodes = [...data.value.nodes];
  let filteredLinks = [...data.value.links];

  if (searchTerm.value) {
    filteredNodes = filteredNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
        node.filePath.toLowerCase().includes(searchTerm.value.toLowerCase())
    );

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredLinks = filteredLinks.filter(
      (link) => nodeIds.has(link.source) && nodeIds.has(link.target)
    );
  }

  if (filterType.value === 'issues') {
    filteredNodes = filteredNodes.filter((node) =>
      Object.values(node.issues).some((count) => count > 0)
    );

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredLinks = filteredLinks.filter(
      (link) => nodeIds.has(link.source) && nodeIds.has(link.target)
    );
  } else if (filterType.value === 'connections') {
    const connectedNodeIds = new Set(filteredLinks.flatMap((link) => [link.source, link.target]));
    filteredNodes = filteredNodes.filter((node) => connectedNodeIds.has(node.id));
  }

  return { nodes: filteredNodes, links: filteredLinks };
});

onMounted(() => {
  // Process files and build code map data
  const processData = async () => {
    loading.value = true;

    try {
      const codeFiles = props.files.filter(
        (f) =>
          f.path.endsWith('.js') ||
          f.path.endsWith('.jsx') ||
          f.path.endsWith('.ts') ||
          f.path.endsWith('.tsx') ||
          f.path.endsWith('.py')
      );

      // Placeholder for actual dependency analysis
      const nodes: CodeMapNode[] = [];
      const links: CodeMapLink[] = [];

      for (const file of codeFiles) {
        nodes.push({
          id: file.path,
          name: file.path.split(/[/\\]/).pop() || '',
          type: 'file',
          filePath: file.path,
          group: 'files',
          size: 20,
          color: '#3b82f6',
          issues: {
            unusedImports: 0,
            missingImports: 0,
            circularDependencies: 0,
            deadCode: 0,
          },
        });
      }

      data.value = { nodes, links };
      stats.value = {
        totalFiles: codeFiles.length,
        totalIssues: 0,
        circularDependencies: 0,
        unusedImports: 0,
        deadCode: 0,
      };
    } catch (error) {
      console.error('Failed to process code map data:', error);
    } finally {
      loading.value = false;
    }
  };

  processData();
});

const handleZoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.2, 3);
};

const handleZoomOut = () => {
  zoom.value = Math.max(zoom.value / 1.2, 0.5);
};

const handleResetZoom = () => {
  zoom.value = 1;
};

const handleExport = () => {
  const svgElement = svgRef.value;
  if (!svgElement) return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'code-map.svg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.code-map-visualization {
  @apply bg-gray-900 rounded-lg p-4;
}

.code-map-header {
  @apply flex items-center justify-between mb-4;
}

.header-left {
  @apply flex items-center gap-4;
}

.code-map-title {
  @apply flex items-center gap-2 text-lg font-semibold text-white;
}

.title-icon {
  @apply text-blue-400;
}

.code-map-stats {
  @apply flex gap-4;
}

.stat {
  @apply flex flex-col;
}

.stat-label {
  @apply text-xs text-gray-400;
}

.stat-value {
  @apply text-sm font-medium text-white;
}

.header-right {
  @apply flex items-center gap-3;
}

.search-container {
  @apply relative;
}

.search-icon {
  @apply absolute left-3 top-1/2 -translate-y-1/2 text-gray-400;
}

.search-input {
  @apply pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.filter-select {
  @apply px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.zoom-controls {
  @apply flex items-center gap-1;
}

.zoom-btn {
  @apply p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors;
}

.zoom-level {
  @apply text-sm font-medium;
}

.export-btn {
  @apply p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors;
}

.code-map-container {
  @apply relative bg-gray-800 rounded-lg overflow-hidden;
}

.code-map-loading {
  @apply absolute inset-0 flex flex-col items-center justify-center;
}

.loading-spinner {
  @apply w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4;
}

.code-map-loading p {
  @apply text-gray-400;
}

.code-map-legend {
  @apply mt-4 p-4 bg-gray-800 rounded-lg;
}

.legend-title {
  @apply text-sm font-semibold text-white mb-3;
}

.legend-items {
  @apply space-y-2;
}

.legend-item {
  @apply flex items-center gap-2 text-sm text-gray-300;
}

.legend-color {
  @apply w-3 h-3 rounded;
}

.node-details {
  @apply absolute top-4 right-4 w-80 bg-gray-800 border border-gray-700 rounded-lg p-4;
}

.details-header {
  @apply flex items-center justify-between mb-4;
}

.details-title {
  @apply flex items-center gap-2 text-sm font-semibold text-white;
}

.close-btn {
  @apply text-gray-400 hover:text-white text-xl;
}

.details-content {
  @apply space-y-3;
}

.detail-row {
  @apply flex flex-col gap-1;
}

.detail-label {
  @apply text-xs text-gray-400;
}

.detail-value {
  @apply text-sm text-white;
}

.issues-list {
  @apply space-y-2;
}

.issue-item {
  @apply flex items-center gap-2 text-sm text-gray-300;
}

.issue-icon {
  @apply text-red-400;
}
</style>

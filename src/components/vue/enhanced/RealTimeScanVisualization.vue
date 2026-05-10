<template>
  <div class="real-time-scan-visualization">
    <!-- Header with Controls -->
    <div class="visualization-header">
      <div class="header-content">
        <div class="title-section">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Real-Time Scan Visualization
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ scanStatus.status === "scanning" ? "Scanning in progress..." : "Scan complete" }}
          </p>
        </div>

        <div class="control-section">
          <button
            @click="toggleVisualization"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            :disabled="scanStatus.status === 'scanning'"
          >
            {{ isVisualizationActive ? "Pause" : "Resume" }}
          </button>

          <button
            @click="resetVisualization"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            :disabled="scanStatus.status === 'scanning'"
          >
            Reset
          </button>
        </div>
      </div>
    </div>

    <!-- Progress Overview -->
    <div class="progress-overview">
      <div class="progress-stats">
        <div class="stat-card">
          <div class="stat-value">{{ formatNumber(scanStats.totalFiles) }}</div>
          <div class="stat-label">Total Files</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ formatNumber(scanStats.processedFiles) }}</div>
          <div class="stat-label">Processed</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ formatFileSize(scanStats.totalSize) }}</div>
          <div class="stat-label">Total Size</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ scanStats.scanSpeed }} files/sec</div>
          <div class="stat-label">Speed</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-bar-container">
        <div class="progress-bar" :style="{ width: `${scanProgress}%` }"></div>
        <div class="progress-text">{{ scanProgress.toFixed(1) }}%</div>
      </div>
    </div>

    <!-- Visualization Tabs -->
    <div class="visualization-tabs">
      <div class="tab-buttons">
        <button
          v-for="tab in visualizationTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
        >
          {{ tab.name }}
        </button>
      </div>
    </div>

    <!-- Visualization Content -->
    <div class="visualization-content">
      <!-- Tree View -->
      <div v-if="activeTab === 'tree'" class="tree-visualization">
        <div class="tree-controls">
          <input
            v-model="treeFilter"
            type="text"
            placeholder="Filter directories..."
            class="tree-filter"
          />
          <button @click="expandAll" class="tree-action">Expand All</button>
          <button @click="collapseAll" class="tree-action">Collapse All</button>
        </div>

        <div class="tree-container">
          <TreeNode
            v-for="node in filteredTreeData"
            :key="node.path"
            :node="node"
            :depth="0"
            :expanded="expandedNodes.has(node.path)"
            @toggle="toggleNode"
            @select="selectNode"
          />
        </div>
      </div>

      <!-- Heat Map -->
      <div v-if="activeTab === 'heatmap'" class="heatmap-visualization">
        <div class="heatmap-controls">
          <div class="control-group">
            <label>Color By:</label>
            <select v-model="heatmapConfig.colorBy" class="control-select">
              <option value="size">File Size</option>
              <option value="type">File Type</option>
              <option value="age">File Age</option>
              <option value="access">Access Frequency</option>
            </select>
          </div>

          <div class="control-group">
            <label>Aggregation:</label>
            <select v-model="heatmapConfig.aggregation" class="control-select">
              <option value="sum">Sum</option>
              <option value="avg">Average</option>
              <option value="max">Maximum</option>
              <option value="count">Count</option>
            </select>
          </div>
        </div>

        <div class="heatmap-container">
          <HeatMap :data="heatmapData" :config="heatmapConfig" @cell-click="onHeatMapCellClick" />
        </div>
      </div>

      <!-- Timeline -->
      <div v-if="activeTab === 'timeline'" class="timeline-visualization">
        <div class="timeline-controls">
          <div class="control-group">
            <label>Time Range:</label>
            <select v-model="timelineConfig.range" class="control-select">
              <option value="hour">Last Hour</option>
              <option value="day">Last Day</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          <div class="control-group">
            <label>Granularity:</label>
            <select v-model="timelineConfig.granularity" class="control-select">
              <option value="minute">Minutes</option>
              <option value="hour">Hours</option>
              <option value="day">Days</option>
              <option value="week">Weeks</option>
            </select>
          </div>
        </div>

        <div class="timeline-container">
          <Timeline
            :data="timelineData"
            :config="timelineConfig"
            @segment-click="onTimelineSegmentClick"
          />
        </div>
      </div>

      <!-- Statistics -->
      <div v-if="activeTab === 'stats'" class="stats-visualization">
        <div class="stats-grid">
          <div class="stats-section">
            <h3>File Type Distribution</h3>
            <PieChart :data="fileTypeDistribution" />
          </div>

          <div class="stats-section">
            <h3>Size Distribution</h3>
            <BarChart :data="sizeDistribution" />
          </div>

          <div class="stats-section">
            <h3>Directory Analysis</h3>
            <TableChart :data="directoryAnalysis" />
          </div>

          <div class="stats-section">
            <h3>Performance Metrics</h3>
            <PerformanceMetrics :metrics="performanceMetrics" />
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Filter Panel -->
    <div class="smart-filter-panel">
      <div class="filter-header">
        <h3>Smart Filters</h3>
        <button @click="toggleFilterPanel" class="filter-toggle">
          {{ filterPanelExpanded ? "Collapse" : "Expand" }}
        </button>
      </div>

      <div v-if="filterPanelExpanded" class="filter-content">
        <!-- Natural Language Search -->
        <div class="filter-section">
          <label>Natural Language Search</label>
          <div class="search-container">
            <input
              v-model="naturalLanguageQuery"
              type="text"
              placeholder="e.g., 'Find all PDFs larger than 10MB modified last week'"
              class="search-input"
              @keyup.enter="executeNaturalLanguageSearch"
            />
            <button @click="executeNaturalLanguageSearch" class="search-button">Search</button>
          </div>
        </div>

        <!-- Advanced Filters -->
        <div class="filter-section">
          <label>Advanced Filters</label>
          <div class="advanced-filters">
            <div class="filter-group">
              <label>File Types</label>
              <div class="checkbox-group">
                <label v-for="type in availableFileTypes" :key="type" class="checkbox-label">
                  <input type="checkbox" :value="type" v-model="activeFilters.fileTypes" />
                  {{ type }}
                </label>
              </div>
            </div>

            <div class="filter-group">
              <label>Size Range</label>
              <div class="size-range">
                <input
                  v-model="activeFilters.minSize"
                  type="number"
                  placeholder="Min (KB)"
                  class="size-input"
                />
                <span>-</span>
                <input
                  v-model="activeFilters.maxSize"
                  type="number"
                  placeholder="Max (KB)"
                  class="size-input"
                />
              </div>
            </div>

            <div class="filter-group">
              <label>Date Range</label>
              <div class="date-range">
                <input v-model="activeFilters.startDate" type="date" class="date-input" />
                <span>-</span>
                <input v-model="activeFilters.endDate" type="date" class="date-input" />
              </div>
            </div>

            <div class="filter-group">
              <label>Content Keywords</label>
              <input
                v-model="activeFilters.keywords"
                type="text"
                placeholder="Enter keywords separated by commas"
                class="keyword-input"
              />
            </div>
          </div>
        </div>

        <!-- Saved Filters -->
        <div class="filter-section">
          <label>Saved Filters</label>
          <div class="saved-filters">
            <div v-for="filter in savedFilters" :key="filter.id" class="saved-filter">
              <span class="filter-name">{{ filter.name }}</span>
              <div class="filter-actions">
                <button @click="applySavedFilter(filter)" class="filter-action">Apply</button>
                <button @click="deleteSavedFilter(filter.id)" class="filter-action delete">
                  Delete
                </button>
              </div>
            </div>

            <button @click="showSaveFilterDialog = true" class="save-filter-btn">
              Save Current Filter
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Save Filter Dialog -->
    <div v-if="showSaveFilterDialog" class="dialog-overlay">
      <div class="dialog">
        <h3>Save Filter</h3>
        <input v-model="newFilterName" type="text" placeholder="Filter name" class="dialog-input" />
        <div class="dialog-actions">
          <button @click="saveCurrentFilter" class="dialog-btn primary">Save</button>
          <button @click="showSaveFilterDialog = false" class="dialog-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import TreeNode from "./TreeNode.vue";
import HeatMap from "./HeatMap.vue";
import Timeline from "./Timeline.vue";
import PieChart from "./PieChart.vue";
import BarChart from "./BarChart.vue";
import TableChart from "./TableChart.vue";
import PerformanceMetrics from "./PerformanceMetrics.vue";

// Reactive state
const isVisualizationActive = ref(true);
const activeTab = ref("tree");
const treeFilter = ref("");
const expandedNodes = ref(new Set());
const filterPanelExpanded = ref(false);
const naturalLanguageQuery = ref("");
const showSaveFilterDialog = ref(false);
const newFilterName = ref("");

// Scan status and statistics
const scanStatus = ref({
  status: "idle", // idle, scanning, completed, error
  currentPath: "",
  startTime: null,
  endTime: null,
  error: null,
});

const scanStats = ref({
  totalFiles: 0,
  processedFiles: 0,
  totalSize: 0,
  scanSpeed: 0,
  errors: [],
});

// Tree data
const treeData = ref([]);
const filteredTreeData = computed(() => {
  if (!treeFilter.value) return treeData.value;

  return filterTreeData(treeData.value, treeFilter.value.toLowerCase());
});

// Visualization tabs
const visualizationTabs = ref([
  { id: "tree", name: "Tree View" },
  { id: "heatmap", name: "Heat Map" },
  { id: "timeline", name: "Timeline" },
  { id: "stats", name: "Statistics" },
]);

// Heat map configuration
const heatmapConfig = ref({
  colorBy: "size",
  aggregation: "sum",
});

const heatmapData = computed(() => {
  return generateHeatMapData(treeData.value, heatmapConfig.value);
});

// Timeline configuration
const timelineConfig = ref({
  range: "day",
  granularity: "hour",
});

const timelineData = computed(() => {
  return generateTimelineData(treeData.value, timelineConfig.value);
});

// Statistics data
const fileTypeDistribution = computed(() => generateFileTypeDistribution(treeData.value));
const sizeDistribution = computed(() => generateSizeDistribution(treeData.value));
const directoryAnalysis = computed(() => generateDirectoryAnalysis(treeData.value));
const performanceMetrics = computed(() => ({
  scanDuration: scanStatus.value.endTime - scanStatus.value.startTime,
  filesPerSecond: scanStats.value.scanSpeed,
  averageFileSize: scanStats.value.totalSize / scanStats.value.processedFiles,
  errorRate: scanStats.value.errors.length / scanStats.value.totalFiles,
}));

// Filters
const availableFileTypes = ref([
  "Documents",
  "Images",
  "Videos",
  "Audio",
  "Code",
  "Archives",
  "Other",
]);
const activeFilters = ref({
  fileTypes: [],
  minSize: null,
  maxSize: null,
  startDate: null,
  endDate: null,
  keywords: "",
});

const savedFilters = ref([
  { id: 1, name: "Large Documents", config: { fileTypes: ["Documents"], minSize: 1024 } },
  {
    id: 2,
    name: "Recent Images",
    config: {
      fileTypes: ["Images"],
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
  },
]);

// Computed properties
const scanProgress = computed(() => {
  if (scanStats.value.totalFiles === 0) return 0;
  return (scanStats.value.processedFiles / scanStats.value.totalFiles) * 100;
});

// Methods
const toggleVisualization = () => {
  isVisualizationActive.value = !isVisualizationActive.value;
  if (isVisualizationActive.value) {
    startRealTimeUpdates();
  } else {
    stopRealTimeUpdates();
  }
};

const resetVisualization = () => {
  treeData.value = [];
  scanStats.value = {
    totalFiles: 0,
    processedFiles: 0,
    totalSize: 0,
    scanSpeed: 0,
    errors: [],
  };
  scanStatus.value = {
    status: "idle",
    currentPath: "",
    startTime: null,
    endTime: null,
    error: null,
  };
};

const toggleNode = (nodePath) => {
  if (expandedNodes.value.has(nodePath)) {
    expandedNodes.value.delete(nodePath);
  } else {
    expandedNodes.value.add(nodePath);
  }
};

const selectNode = (node) => {
  // Handle node selection
  console.log("Selected node:", node);
};

const expandAll = () => {
  const allPaths = [];
  const collectPaths = (nodes) => {
    nodes.forEach((node) => {
      allPaths.push(node.path);
      if (node.children) collectPaths(node.children);
    });
  };
  collectPaths(treeData.value);
  expandedNodes.value = new Set(allPaths);
};

const collapseAll = () => {
  expandedNodes.value.clear();
};

const toggleFilterPanel = () => {
  filterPanelExpanded.value = !filterPanelExpanded.value;
};

const executeNaturalLanguageSearch = () => {
  // Parse natural language query and apply filters
  const parsedQuery = parseNaturalLanguageQuery(naturalLanguageQuery.value);
  applyFilters(parsedQuery);
};

const applySavedFilter = (filter) => {
  activeFilters.value = { ...activeFilters.value, ...filter.config };
};

const deleteSavedFilter = (filterId) => {
  savedFilters.value = savedFilters.value.filter((f) => f.id !== filterId);
};

const saveCurrentFilter = () => {
  if (newFilterName.value.trim()) {
    savedFilters.value.push({
      id: Date.now(),
      name: newFilterName.value,
      config: { ...activeFilters.value },
    });
    newFilterName.value = "";
    showSaveFilterDialog.value = false;
  }
};

const onHeatMapCellClick = (cell) => {
  // Handle heat map cell click
  console.log("Heat map cell clicked:", cell);
};

const onTimelineSegmentClick = (segment) => {
  // Handle timeline segment click
  console.log("Timeline segment clicked:", segment);
};

// Utility functions
const formatNumber = (num) => {
  return new Intl.NumberFormat().format(num);
};

const formatFileSize = (bytes) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const filterTreeData = (data, filter) => {
  return data
    .filter((node) => {
      const matchesFilter = node.name.toLowerCase().includes(filter);
      const childrenMatch = node.children ? filterTreeData(node.children, filter).length > 0 : true;
      return matchesFilter || childrenMatch;
    })
    .map((node) => ({
      ...node,
      children: node.children ? filterTreeData(node.children, filter) : [],
    }));
};

const parseNaturalLanguageQuery = (query) => {
  // Simplified natural language parsing
  const filters = {};

  // File type detection
  const fileTypePatterns = {
    pdf: "Documents",
    image: "Images",
    video: "Videos",
    audio: "Audio",
    code: "Code",
  };

  for (const [pattern, type] of Object.entries(fileTypePatterns)) {
    if (query.toLowerCase().includes(pattern)) {
      filters.fileTypes = [type];
    }
  }

  // Size detection
  const sizeMatch = query.match(/(\d+)\s*(KB|MB|GB)/i);
  if (sizeMatch) {
    const size = parseInt(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    const sizeInKB = unit === "KB" ? size : unit === "MB" ? size * 1024 : size * 1024 * 1024;
    filters.minSize = sizeInKB;
  }

  // Date detection
  const datePatterns = {
    "last week": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    "last month": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    "last year": new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  };

  for (const [pattern, date] of Object.entries(datePatterns)) {
    if (query.toLowerCase().includes(pattern)) {
      filters.startDate = date.toISOString().split("T")[0];
    }
  }

  return filters;
};

const applyFilters = (filters) => {
  activeFilters.value = { ...activeFilters.value, ...filters };
};

// Data generation functions
const generateHeatMapData = (data, config) => {
  // Generate heat map data based on configuration
  return {
    cells: [],
    maxValue: 0,
    minValue: 0,
  };
};

const generateTimelineData = (data, config) => {
  // Generate timeline data based on configuration
  return {
    segments: [],
    totalDuration: 0,
  };
};

const generateFileTypeDistribution = (data) => {
  // Generate file type distribution data
  return {
    labels: [],
    values: [],
  };
};

const generateSizeDistribution = (data) => {
  // Generate size distribution data
  return {
    labels: [],
    values: [],
  };
};

const generateDirectoryAnalysis = (data) => {
  // Generate directory analysis data
  return {
    headers: ["Directory", "Files", "Total Size", "Avg Size"],
    rows: [],
  };
};

// Real-time updates
let updateInterval = null;

const startRealTimeUpdates = () => {
  updateInterval = setInterval(() => {
    if (scanStatus.value.status === "scanning") {
      // Update scan statistics
      updateScanStats();
    }
  }, 1000);
};

const stopRealTimeUpdates = () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
};

const updateScanStats = () => {
  // Calculate scan speed and other metrics
  const elapsed = Date.now() - scanStatus.value.startTime;
  if (elapsed > 0) {
    scanStats.value.scanSpeed = Math.round(scanStats.value.processedFiles / (elapsed / 1000));
  }
};

// Lifecycle hooks
onMounted(() => {
  // Initialize visualization
  if (isVisualizationActive.value) {
    startRealTimeUpdates();
  }
});

onUnmounted(() => {
  stopRealTimeUpdates();
});

// Watch for scan status changes
watch(scanStatus, (newStatus) => {
  if (newStatus.status === "scanning" && !updateInterval) {
    startRealTimeUpdates();
  } else if (newStatus.status !== "scanning" && updateInterval) {
    stopRealTimeUpdates();
  }
});
</script>

<style scoped>
.real-time-scan-visualization {
  @apply p-6 bg-gray-50 dark:bg-gray-900 min-h-screen;
}

.visualization-header {
  @apply mb-6;
}

.header-content {
  @apply flex justify-between items-center;
}

.title-section h2 {
  @apply text-xl font-semibold text-gray-800 dark:text-gray-200;
}

.title-section p {
  @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
}

.control-section {
  @apply flex gap-2;
}

.progress-overview {
  @apply mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow;
}

.progress-stats {
  @apply grid grid-cols-4 gap-4 mb-4;
}

.stat-card {
  @apply text-center p-3 bg-gray-50 dark:bg-gray-700 rounded;
}

.stat-value {
  @apply text-2xl font-bold text-blue-600 dark:text-blue-400;
}

.stat-label {
  @apply text-sm text-gray-600 dark:text-gray-400 mt-1;
}

.progress-bar-container {
  @apply relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden;
}

.progress-bar {
  @apply absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300;
}

.progress-text {
  @apply absolute inset-0 flex items-center justify-center text-sm font-medium text-white;
}

.visualization-tabs {
  @apply mb-6;
}

.tab-buttons {
  @apply flex gap-2 border-b border-gray-200 dark:border-gray-700;
}

.tab-button {
  @apply px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors;
}

.tab-button.active {
  @apply text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400;
}

.visualization-content {
  @apply mb-6;
}

.tree-controls {
  @apply flex gap-2 mb-4;
}

.tree-filter {
  @apply flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
}

.tree-action {
  @apply px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors;
}

.tree-container {
  @apply border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800;
}

.heatmap-controls {
  @apply flex gap-4 mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg;
}

.control-group {
  @apply flex flex-col;
}

.control-group label {
  @apply text-sm font-medium text-gray-700 dark:text-gray-300 mb-1;
}

.control-select {
  @apply px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
}

.timeline-controls {
  @apply flex gap-4 mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg;
}

.stats-grid {
  @apply grid grid-cols-2 gap-6;
}

.stats-section {
  @apply p-4 bg-white dark:bg-gray-800 rounded-lg;
}

.stats-section h3 {
  @apply text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200;
}

.smart-filter-panel {
  @apply p-4 bg-white dark:bg-gray-800 rounded-lg shadow;
}

.filter-header {
  @apply flex justify-between items-center mb-4;
}

.filter-header h3 {
  @apply text-lg font-semibold text-gray-800 dark:text-gray-200;
}

.filter-toggle {
  @apply px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors;
}

.filter-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-section {
  @apply space-y-2;
}

.filter-section label {
  @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
}

.search-container {
  @apply flex gap-2;
}

.search-input {
  @apply flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
}

.search-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
}

.advanced-filters {
  @apply grid grid-cols-2 gap-4;
}

.filter-group {
  @apply space-y-2;
}

.checkbox-group {
  @apply space-y-1;
}

.checkbox-label {
  @apply flex items-center text-sm text-gray-700 dark:text-gray-300;
}

.size-range {
  @apply flex items-center gap-2;
}

.size-input {
  @apply w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
}

.date-range {
  @apply flex items-center gap-2;
}

.date-input {
  @apply px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
}

.keyword-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800;
}

.saved-filters {
  @apply space-y-2;
}

.saved-filter {
  @apply flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded;
}

.filter-name {
  @apply font-medium text-gray-800 dark:text-gray-200;
}

.filter-actions {
  @apply flex gap-2;
}

.filter-action {
  @apply px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors;
}

.filter-action.delete {
  @apply bg-red-600 hover:bg-red-700;
}

.save-filter-btn {
  @apply w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors;
}

.dialog-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.dialog {
  @apply bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full;
}

.dialog h3 {
  @apply text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200;
}

.dialog-input {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 mb-4;
}

.dialog-actions {
  @apply flex gap-2 justify-end;
}

.dialog-btn {
  @apply px-4 py-2 rounded-lg transition-colors;
}

.dialog-btn.primary {
  @apply bg-blue-600 text-white hover:bg-blue-700;
}

.dialog-btn:not(.primary) {
  @apply bg-gray-600 text-white hover:bg-gray-700;
}
</style>

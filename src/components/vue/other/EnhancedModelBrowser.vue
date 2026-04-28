<template>
  <div class="enhanced-model-browser">
    <!-- Header -->
    <div class="browser-header">
      <div class="header-top">
        <div class="title-section">
          <h3>Model Browser ({{ processedModels.length }})</h3>
          <div class="performance-indicator">
            <span class="metric">
              <TrendingUp :size="14" />
              {{ performanceMetrics.renderTime }}ms render
            </span>
            <span class="metric">
              <HardDrive :size="14" />
              {{ memoryEfficiencyScore }}% efficiency
            </span>
          </div>
        </div>

        <div class="view-controls">
          <div class="view-mode-buttons">
            <button
              :class="{ active: viewMode === 'grid' }"
              title="Grid view"
              @click="viewMode = 'grid'"
            >
              <Grid3X3 :size="16" />
            </button>
            <button
              :class="{ active: viewMode === 'list' }"
              title="List view"
              @click="viewMode = 'list'"
            >
              <List :size="16" />
            </button>
            <button
              :class="{ active: viewMode === 'compact' }"
              title="Compact view"
              @click="viewMode = 'compact'"
            >
              <Layers :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="search-section">
        <div class="search-bar">
          <Search :size="16" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search models by name, description, or tags..."
            aria-label="Search models"
            title="Search models"
          />
          <button v-if="searchQuery" title="Clear search" @click="searchQuery = ''">
            <X :size="14" />
          </button>
        </div>

        <div class="filter-controls">
          <button class="filter-toggle" @click="showFilters = !showFilters">
            <Filter :size="16" />
            Filters
          </button>

          <select v-model="sortBy">
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="accuracy">Accuracy</option>
            <option value="lastUsed">Last Used</option>
          </select>

          <button @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
            <ArrowUpDown :size="16" />
          </button>
        </div>
      </div>

      <!-- Advanced Filters -->
      <div v-if="showFilters" class="advanced-filters">
        <div class="filter-group">
          <h4>Type</h4>
          <label v-for="type in ['pytorch', 'tensorflow', 'onnx', 'custom']" :key="type">
            <input v-model="filters.types" type="checkbox" :value="type" />
            {{ type }}
          </label>
        </div>

        <div class="filter-group">
          <h4>Status</h4>
          <label v-for="status in ['loaded', 'loading', 'error', 'unloaded']" :key="status">
            <input v-model="filters.status" type="checkbox" :value="status" />
            {{ status }}
          </label>
        </div>

        <div class="filter-group">
          <h4>Accuracy Range</h4>
          <input v-model.number="filters.minAccuracy" type="range" min="0" max="100" />
          <span>{{ filters.minAccuracy }}%+</span>
        </div>
      </div>
    </div>

    <!-- Selection Toolbar -->
    <div v-if="selectedModels.size > 0" class="selection-toolbar">
      <div class="selection-info">
        <Check :size="16" />
        {{ selectedModels.size }} models selected
      </div>
      <div class="selection-actions">
        <button @click="handleBatchAction('load')">
          <Eye :size="14" />
          Load Selected
        </button>
        <button @click="handleBatchAction('unload')">
          <EyeOff :size="14" />
          Unload Selected
        </button>
        <button @click="handleBatchAction('delete')">
          <Trash2 :size="14" />
          Delete Selected
        </button>
      </div>
    </div>

    <!-- Models Grid/List -->
    <div class="models-container">
      <div :class="['models-grid', `${viewMode}-view`]">
        <div v-for="model in processedModels" :key="model.path" class="model-item">
          <div
            v-if="viewMode === 'grid'"
            :class="['model-card', { selected: selectedModels.has(model.path) }]"
            @click="handleModelSelection(model.path)"
          >
            <div class="model-header">
              <div class="model-type-badge">
                {{ model.type.toUpperCase() }}
              </div>
              <div class="model-status" :style="{ color: getStatusColor(model.status) }">
                {{ model.status }}
              </div>
            </div>

            <div class="model-content">
              <h4 class="model-name">
                {{ model.name }}
              </h4>
              <p class="model-description">
                {{ model.description }}
              </p>

              <div class="model-metrics">
                <div class="metric">
                  <Cpu :size="14" />
                  <span>{{ formatSize(model.gpuMemory) }} GPU</span>
                </div>
                <div class="metric">
                  <Zap :size="14" />
                  <span>{{ model.inferenceTime }}ms</span>
                </div>
                <div class="metric">
                  <TrendingUp :size="14" />
                  <span>{{ model.accuracy }}%</span>
                </div>
              </div>

              <div class="model-footer">
                <span class="model-size">{{ formatSize(model.size) }}</span>
                <span class="model-params">{{ (model.parameters / 1e9).toFixed(1) }}B params</span>
              </div>
            </div>

            <div class="model-actions">
              <button @click.stop="onModelAction('load', model)">
                <Eye :size="14" />
              </button>
              <button @click.stop="onModelAction('download', model)">
                <Download :size="14" />
              </button>
              <button @click.stop="onModelAction('delete', model)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <div
            v-else-if="viewMode === 'list'"
            :class="['model-list-item', { selected: selectedModels.has(model.path) }]"
            @click="handleModelSelection(model.path)"
          >
            <div class="model-info">
              <div class="model-name">
                {{ model.name }}
              </div>
              <div class="model-details">
                <span class="model-type">{{ model.type }}</span>
                <span class="model-framework">{{ model.framework }}</span>
                <span class="model-version">{{ model.version }}</span>
              </div>
            </div>

            <div class="model-stats">
              <div class="stat">
                <span>Accuracy: {{ model.accuracy }}%</span>
              </div>
              <div class="stat">
                <span>GPU: {{ formatSize(model.gpuMemory) }}</span>
              </div>
              <div class="stat">
                <span>Speed: {{ model.inferenceTime }}ms</span>
              </div>
              <div class="stat">
                <span>Size: {{ formatSize(model.size) }}</span>
              </div>
            </div>

            <div class="model-status-indicator" :style="{ color: getStatusColor(model.status) }">
              {{ model.status }}
            </div>
          </div>

          <div
            v-else
            :class="['model-compact-item', { selected: selectedModels.has(model.path) }]"
            @click="handleModelSelection(model.path)"
          >
            <span class="model-name">{{ model.name }}</span>
            <span class="model-size">{{ formatSize(model.size) }}</span>
            <span class="model-accuracy">{{ model.accuracy }}%</span>
            <span class="model-status" :style="{ color: getStatusColor(model.status) }">
              {{ model.status }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- GPU Memory Summary -->
    <div class="gpu-memory-summary">
      <h4>GPU Memory Usage</h4>
      <div class="memory-stats">
        <div class="stat">
          <span>Total Used:</span>
          <span>{{ formatSize(gpuMemoryStats.totalUsed) }}</span>
        </div>
        <div class="stat">
          <span>Available:</span>
          <span>{{ formatSize(gpuMemoryStats.available) }}</span>
        </div>
        <div class="stat">
          <span>Efficiency:</span>
          <span>{{ memoryEfficiencyScore }}%</span>
        </div>
      </div>

      <div v-if="optimizationSuggestions.length > 0" class="optimization-suggestions">
        <h5><AlertTriangle :size="14" /> Optimization Suggestions</h5>
        <ul>
          <li v-for="(suggestion, index) in optimizationSuggestions.slice(0, 3)" :key="index">
            {{ String(suggestion) }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Layers,
  X,
  Check,
  HardDrive,
  ArrowUpDown,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Cpu,
  Zap,
  AlertTriangle,
  TrendingUp,
} from "lucide-vue-next";

interface ModelData {
  name: string;
  path: string;
  size: number;
  type: "pytorch" | "tensorflow" | "onnx" | "custom";
  framework: string;
  accuracy: number;
  parameters: number;
  lastUsed: Date;
  downloadDate: Date;
  tags: string[];
  gpuMemory: number;
  inferenceTime: number;
  status: "loaded" | "loading" | "error" | "unloaded";
  description: string;
  version: string;
  license: string;
}

interface Props {
  models: ModelData[];
  onModelAction: (action: string, model: ModelData) => void;
}

const props = defineProps<Props>();

const viewMode = ref<"grid" | "list" | "compact">("grid");
const searchQuery = ref("");
const selectedModels = ref<Set<string>>(new Set());
const sortBy = ref<"name" | "size" | "accuracy" | "lastUsed">("name");
const sortOrder = ref<"asc" | "desc">("asc");
const showFilters = ref(false);
const filters = ref({
  types: [] as string[],
  frameworks: [] as string[],
  status: [] as string[],
  minAccuracy: 0,
  maxGpuMemory: Infinity,
});

// Simulated performance metrics
const performanceMetrics = ref({
  renderTime: 12,
  fps: 60,
});

// Simulated GPU memory stats
const gpuMemoryStats = ref({
  totalUsed: 8 * 1024 * 1024 * 1024,
  available: 16 * 1024 * 1024 * 1024,
  total: 24 * 1024 * 1024 * 1024,
});

const memoryEfficiencyScore = computed(() => {
  return Math.round((gpuMemoryStats.value.totalUsed / gpuMemoryStats.value.total) * 100);
});

const optimizationSuggestions = computed(() => {
  const suggestions: string[] = [];
  if (memoryEfficiencyScore.value > 80) {
    suggestions.push("Consider unloading unused models to free GPU memory");
  }
  if (props.models.length > 50) {
    suggestions.push("Large model count may impact performance");
  }
  return suggestions;
});

// Apply filters and search
const processedModels = computed(() => {
  let filtered = [...props.models];

  // Apply type filter
  if (filters.value.types.length > 0) {
    filtered = filtered.filter((model) => filters.value.types.includes(model.type));
  }

  // Apply status filter
  if (filters.value.status.length > 0) {
    filtered = filtered.filter((model) => filters.value.status.includes(model.status));
  }

  // Apply accuracy filter
  filtered = filtered.filter((model) => model.accuracy >= filters.value.minAccuracy);

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (model) =>
        model.name.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query) ||
        model.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortBy.value) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "accuracy":
        comparison = a.accuracy - b.accuracy;
        break;
      case "lastUsed":
        comparison = a.lastUsed.getTime() - b.lastUsed.getTime();
        break;
    }
    return sortOrder.value === "asc" ? comparison : -comparison;
  });

  return filtered;
});

const handleModelSelection = (modelPath: string, multiSelect = false) => {
  if (multiSelect) {
    if (selectedModels.value.has(modelPath)) {
      selectedModels.value.delete(modelPath);
    } else {
      selectedModels.value.add(modelPath);
    }
  } else {
    if (selectedModels.value.has(modelPath)) {
      selectedModels.value.clear();
    } else {
      selectedModels.value.clear();
      selectedModels.value.add(modelPath);
    }
  }
};

const handleBatchAction = (action: string) => {
  selectedModels.value.forEach((modelPath) => {
    const model = props.models.find((m) => m.path === modelPath);
    if (model) {
      props.onModelAction(action, model);
    }
  });
  selectedModels.value.clear();
};

const formatSize = (bytes: number) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "loaded":
      return "#10b981";
    case "loading":
      return "#f59e0b";
    case "error":
      return "#ef4444";
    case "unloaded":
      return "#6b7280";
    default:
      return "#6b7280";
  }
};
</script>

<style scoped>
.enhanced-model-browser {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 0.75rem;
  color: #e2e8f0;
}

.browser-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.performance-indicator {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.performance-indicator .metric {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.view-mode-buttons {
  display: flex;
  gap: 0.5rem;
}

.view-mode-buttons button {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}

.view-mode-buttons button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.view-mode-buttons button.active {
  background: #3b82f6;
  border-color: #3b82f6;
}

.search-section {
  display: flex;
  gap: 1rem;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
}

.search-bar input {
  flex: 1;
  background: transparent;
  border: none;
  color: #e2e8f0;
  outline: none;
}

.search-bar button {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.25rem;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.filter-controls select {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  color: #e2e8f0;
  cursor: pointer;
}

.filter-controls button {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  color: #e2e8f0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.advanced-filters {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.375rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group h4 {
  margin: 0;
  font-size: 0.875rem;
  color: #94a3b8;
}

.filter-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.selection-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #3b82f6;
  border-radius: 0.375rem;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.selection-actions {
  display: flex;
  gap: 0.5rem;
}

.selection-actions button {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.375rem;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.models-container {
  flex: 1;
  overflow-y: auto;
}

.models-grid {
  display: grid;
  gap: 1rem;
}

.models-grid.grid-view {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.models-grid.list-view {
  grid-template-columns: 1fr;
}

.models-grid.compact-view {
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
}

.model-card {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.model-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.model-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.model-type-badge {
  padding: 0.25rem 0.5rem;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #3b82f6;
}

.model-status {
  font-size: 0.75rem;
  font-weight: 600;
}

.model-content h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.model-description {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  color: #94a3b8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.model-metrics {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.model-metrics .metric {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.model-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
  color: #94a3b8;
}

.model-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.model-actions button {
  padding: 0.375rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
}

.model-actions button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.model-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.model-list-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.model-list-item.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.model-info {
  flex: 1;
}

.model-info .model-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.model-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.model-stats {
  display: flex;
  gap: 1.5rem;
}

.model-stats .stat {
  font-size: 0.875rem;
  color: #94a3b8;
}

.model-compact-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.model-compact-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.model-compact-item.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.gpu-memory-summary {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
}

.gpu-memory-summary h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.memory-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.memory-stats .stat {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.memory-stats .stat span:first-child {
  color: #94a3b8;
}

.optimization-suggestions {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.optimization-suggestions h5 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #f59e0b;
}

.optimization-suggestions ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.optimization-suggestions li {
  margin-bottom: 0.25rem;
}
</style>

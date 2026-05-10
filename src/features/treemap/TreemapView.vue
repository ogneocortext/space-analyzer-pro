<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import * as d3 from "d3";
import { useAnalysisStore } from "../../store/analysis";
import { getCategoryColor } from "../../utils/dataTransformers";

const store = useAnalysisStore();
const selectedDepth = ref(2);
const selectedCategory = ref<string | null>(null);
const hoveredItem = ref<any>(null);
const svgRef = ref<SVGSVGElement>(null);
const renderMode = ref<"canvas" | "svg" | "hybrid">("hybrid");
const zoomLevel = ref(1);
const panOffset = ref({ x: 0, y: 0 });
const searchQuery = ref("");
const breadcrumbs = ref<{ name: string; path: string; depth: number }[]>([]);
const treemapContainer = ref<HTMLDivElement>(null);
const mouseCoords = ref({ x: 0, y: 0 });
const isLoading = ref(false);
const treemapHeight = ref(400);

// Responsive height
function updateTreemapHeight() {
  const h = window.innerHeight;
  treemapHeight.value = Math.max(300, Math.min(h * 0.55, 700));
}

onMounted(() => {
  updateTreemapHeight();
  window.addEventListener("resize", updateTreemapHeight);
  nextTick(() => renderTreemap());
});

onUnmounted(() => {
  window.removeEventListener("resize", updateTreemapHeight);
});

// Watch data changes
watch(
  () => store.analysisResult,
  () => {
    nextTick(() => renderTreemap());
  },
  { deep: true }
);

// Watch render mode changes
watch(renderMode, () => {
  nextTick(() => renderTreemap());
});

// Watch depth and search changes
watch([selectedDepth, searchQuery], () => {
  nextTick(() => renderTreemap());
});

// Build hierarchical data from flat file list
const treemapData = computed(() => {
  if (!store.analysisResult?.file_analysis?.files) return null;

  const files = store.analysisResult.file_analysis.files;
  const root: any = { name: "root", children: {}, size: 0, path: "" };

  files.forEach((file: any) => {
    const parts = file.path.split(/[\\/]/).filter(Boolean);
    let current = root;

    parts.forEach((part: string, index: number) => {
      if (index >= selectedDepth.value) return;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          children: {},
          size: 0,
          path: parts.slice(0, index + 1).join("/"),
          fileCount: 0,
          category: file.category,
          fileTypes: {} as Record<string, number>,
        };
      }

      current = current.children[part];
      current.size += file.size?.bytes || file.size || 0;
      current.fileCount += 1;
      // Track file types within this folder
      const ext = file.name?.split(".").pop()?.toLowerCase() || "unknown";
      current.fileTypes[ext] = (current.fileTypes[ext] || 0) + 1;
    });
  });

  // Apply search filter
  let filteredChildren = Object.values(root.children) as any[];
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    filteredChildren = filteredChildren.filter((c: any) => c.name.toLowerCase().includes(q));
  }

  const maxSize = Math.max(...filteredChildren.map((c: any) => c.size), 1);

  const processNode = (node: any): any => {
    const children = Object.values(node.children || {}).map(processNode);
    return {
      ...node,
      children,
      percentage:
        (node.size /
          (store.analysisResult?.summary?.total_size || store.analysisResult?.totalSize || 1)) *
        100,
      relativeSize: node.size / maxSize,
    };
  };

  return filteredChildren.map(processNode);
});

// Compute dynamic categories from actual data
const dataCategories = computed(() => {
  if (!store.analysisResult?.file_analysis?.files) return [];
  const cats = new Set<string>();
  store.analysisResult.file_analysis.files.forEach((f: any) => {
    if (f.category) cats.add(f.category);
  });
  return Array.from(cats).sort();
});

// D3.js treemap rendering
function renderD3Treemap() {
  if (!treemapData.value || !svgRef.value) return;

  const data = {
    name: "root",
    children: treemapData.value.map((item) => ({
      ...item,
      value: item.size,
    })),
  };

  const width = svgRef.value.clientWidth || 600;
  const height = treemapHeight.value;

  // Clear previous content
  d3.select(svgRef.value).selectAll("*").remove();

  const svg = d3.select(svgRef.value).attr("width", width).attr("height", height);

  // Create zoom behavior
  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 10])
    .on("zoom", (event) => {
      const { transform } = event;
      svg.select(".treemap-group").attr("transform", transform);
    });

  svg.call(zoom);

  const g = svg.append("g").attr("class", "treemap-group");

  // Create treemap layout
  const root = d3
    .hierarchy(data)
    .sum((d) => d.value)
    .sort((a, b) => b.value! - a.value!);

  const treemap = d3.treemap().size([width, height]).padding(2).round(true);

  treemap(root);

  // Create color scale - use actual data categories
  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(dataCategories.value)
    .range(dataCategories.value.map((c) => getCategoryColor(c)));

  // Render cells
  const cell = g
    .selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Add rectangles with animation
  cell
    .append("rect")
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => getCategoryColor(d.data.category))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .attr("rx", 4)
    .style("cursor", "pointer")
    .style("opacity", 0)
    .transition()
    .duration(400)
    .delay((_, i) => i * 5)
    .style("opacity", 1)
    .on("end", function () {
      d3.select(this).style("opacity", null); // reset for hover
    });

  // Apply hover effects
  cell
    .on("mouseover", function (event, d) {
      d3.select(this).select("rect").transition().duration(200).attr("opacity", 0.9);
      hoveredItem.value = d.data;
      mouseCoords.value = { x: event.offsetX || event.clientX, y: event.offsetY || event.clientY };
    })
    .on("mousemove", function (event) {
      const rect = (svgRef.value as SVGSVGElement)?.getBoundingClientRect();
      if (rect) {
        mouseCoords.value = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
      }
    })
    .on("mouseout", function () {
      d3.select(this).select("rect").transition().duration(200).attr("opacity", 0.7);
      hoveredItem.value = null;
    })
    .on("click", function (_event, d) {
      handleItemClick(d.data);
    });

  // Add text labels for larger cells
  cell
    .append("text")
    .attr("x", (d) => {
      const w = d.x1 - d.x0;
      return w > 60 ? 4 : 0;
    })
    .attr("y", 20)
    .text((d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w > 60 && h > 30) {
        return d.data.name.length > 12 ? d.data.name.substring(0, 12) + "..." : d.data.name;
      }
      return "";
    })
    .style("font-size", "12px")
    .style("fill", "#fff")
    .style("font-weight", "bold")
    .style("pointer-events", "none")
    .style("text-shadow", "0 1px 3px rgba(0,0,0,0.6)");

  // Add size labels for even larger cells
  cell
    .append("text")
    .attr("x", (d) => {
      const w = d.x1 - d.x0;
      return w > 80 ? 4 : 0;
    })
    .attr("y", 35)
    .text((d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w > 80 && h > 50) {
        return formatSize(d.data.size);
      }
      return "";
    })
    .style("font-size", "10px")
    .style("fill", "#fff")
    .style("opacity", 0.85)
    .style("pointer-events", "none")
    .style("text-shadow", "0 1px 2px rgba(0,0,0,0.5)");

  // Add percentage badge for larger cells
  cell
    .append("text")
    .attr("x", (d) => d.x1 - d.x0 - 6)
    .attr("y", 16)
    .attr("text-anchor", "end")
    .text((d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w > 90 && h > 40) {
        return d.data.percentage?.toFixed(1) + "%";
      }
      return "";
    })
    .style("font-size", "10px")
    .style("fill", "rgba(255,255,255,0.75)")
    .style("pointer-events", "none")
    .style("text-shadow", "0 1px 2px rgba(0,0,0,0.4)");
}

// Track folder navigation for self-learning
const handleItemClick = (item: any) => {
  hoveredItem.value = item;

  // Add to breadcrumbs as drill-down
  if (item.path) {
    const depth = item.path.split("/").length;
    breadcrumbs.value = breadcrumbs.value.slice(0, depth - 1);
    breadcrumbs.value.push({ name: item.name, path: item.path, depth });
  }
};

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function renderTreemap() {
  isLoading.value = true;
  nextTick(() => {
    if (renderMode.value === "canvas") {
      // Canvas rendering would go here
      renderD3Treemap();
    } else if (renderMode.value === "svg" || renderMode.value === "hybrid") {
      renderD3Treemap();
    }
    isLoading.value = false;
  });
}

function goToBreadcrumb(index: number) {
  breadcrumbs.value = breadcrumbs.value.slice(0, index + 1);
  // Could also zoom/scroll to the selected breadcrumb
}

function clearSearch() {
  searchQuery.value = "";
}

function refreshData() {
  if (store.analysisResult) {
    nextTick(() => renderTreemap());
  }
}

function getTopFileTypes(fileTypes: Record<string, number>): [string, number][] {
  if (!fileTypes) return [];
  return Object.entries(fileTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
}
</script>

<template>
  <div class="page-container">
    <header class="header">
      <div class="header-content">
        <div>
          <h1 class="text-xl font-semibold text-primary">Interactive Treemap</h1>
          <p class="text-sm text-muted mt-1">Visual representation of your storage hierarchy</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <!-- Depth control -->
          <div class="flex items-center gap-2">
            <label class="text-sm text-muted whitespace-nowrap">Depth:</label>
            <select v-model="selectedDepth" class="form-select" style="width: auto">
              <option :value="1">1 level</option>
              <option :value="2">2 levels</option>
              <option :value="3">3 levels</option>
              <option :value="4">4 levels</option>
            </select>
          </div>

          <!-- Render mode -->
          <div class="flex items-center gap-2">
            <label class="text-sm text-muted whitespace-nowrap">Render:</label>
            <select v-model="renderMode" class="form-select" style="width: auto">
              <option value="hybrid">Hybrid (D3.js)</option>
              <option value="svg">SVG (Interactive)</option>
            </select>
          </div>

          <!-- Refresh button -->
          <button class="btn btn-secondary btn-sm" title="Refresh treemap" @click="refreshData">
            ↻ Refresh
          </button>
        </div>
      </div>
    </header>

    <main class="p-4">
      <!-- No Data -->
      <div v-if="!store.analysisResult" class="text-center py-12">
        <p class="text-muted mb-4">No scan data available. Please scan a directory first.</p>
        <button class="btn btn-primary" @click="$router.push('/scan')">Go to Scanner</button>
      </div>

      <template v-else>
        <!-- Search & Filters Bar -->
        <div class="card p-3 mb-4">
          <div class="flex flex-wrap items-center gap-4">
            <!-- Search -->
            <div class="flex-1 min-w-[200px]">
              <div class="search-container">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Filter folders..."
                  class="search-input"
                />
                <button
                  v-if="searchQuery"
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-primary"
                  @click="clearSearch"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Stats summary -->
            <div class="text-sm text-muted whitespace-nowrap">
              <span v-if="treemapData">
                {{ treemapData.length }} {{ treemapData.length === 1 ? "folder" : "folders" }}
                ·
                {{
                  formatSize(
                    store.analysisResult?.summary?.total_size ||
                      store.analysisResult?.totalSize ||
                      0
                  )
                }}
                total
              </span>
            </div>
          </div>
        </div>

        <!-- Dynamic Legend -->
        <div class="flex flex-wrap gap-4 text-sm mb-4">
          <div
            v-for="cat in dataCategories"
            :key="cat"
            class="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80"
            :class="{ 'opacity-50': selectedCategory && selectedCategory !== cat }"
            @click="selectedCategory = selectedCategory === cat ? null : cat"
          >
            <div class="w-3 h-3 rounded-sm" :style="{ background: getCategoryColor(cat) }" />
            <span class="text-muted">{{ cat }}</span>
          </div>
          <button
            v-if="dataCategories.length > 0"
            class="text-xs text-muted hover:text-primary ml-2"
            @click="selectedCategory = null"
          >
            Clear
          </button>
        </div>

        <!-- Breadcrumb Navigation -->
        <div v-if="breadcrumbs.length > 0" class="flex items-center gap-1 text-sm flex-wrap mb-4">
          <button
            class="text-secondary hover:text-primary transition-colors"
            @click="
              breadcrumbs = [];
              hoveredItem = null;
            "
          >
            Root
          </button>
          <svg
            v-for="(crumb, idx) in breadcrumbs"
            :key="idx"
            class="w-3 h-3 text-muted mx-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
          <button
            class="text-secondary hover:text-primary transition-colors"
            :class="{ 'text-primary font-medium': idx === breadcrumbs.length - 1 }"
            @click="goToBreadcrumb(idx)"
          >
            {{ crumb.name }}
          </button>
        </div>

        <!-- Treemap Container -->
        <div ref="treemapContainer" class="relative">
          <!-- D3.js SVG Treemap -->
          <div
            v-if="renderMode === 'svg' || renderMode === 'hybrid'"
            class="card overflow-hidden relative"
          >
            <!-- Loading overlay -->
            <div
              v-if="isLoading"
              class="absolute inset-0 bg-surface/60 flex items-center justify-center z-10"
            >
              <div class="loading-spinner loading-spinner-lg" />
            </div>

            <!-- Empty state -->
            <div
              v-if="treemapData && treemapData.length === 0"
              class="flex items-center justify-center text-muted text-sm"
              :style="{ height: treemapHeight + 'px' }"
            >
              No folders match your search.
            </div>

            <svg
              ref="svgRef"
              class="w-full"
              :style="{
                height: treemapHeight + 'px',
                display: treemapData?.length ? 'block' : 'none',
              }"
            />
          </div>
        </div>

        <!-- Floating Tooltip Overlay -->
        <div
          v-if="hoveredItem"
          class="modal-overlay pointer-events-none"
          :style="{
            left: Math.min(mouseCoords.x + 16, (treemapContainer?.offsetWidth || 400) - 280) + 'px',
            top: Math.max(mouseCoords.y - 10, 10) + 'px',
          }"
        >
          <div class="card p-3 max-w-xs">
            <div class="font-medium text-primary truncate text-sm">
              {{ hoveredItem.name }}
            </div>
            <div class="text-xs text-muted mt-0.5 font-mono truncate">
              {{ hoveredItem.path }}
            </div>
            <div class="flex items-center gap-3 mt-2 text-xs">
              <span class="text-secondary">{{ formatSize(hoveredItem.size) }}</span>
              <span class="text-muted">|</span>
              <span class="text-muted">{{ hoveredItem.fileCount }} files</span>
              <span class="text-muted">|</span>
              <span class="text-success">{{ hoveredItem.percentage?.toFixed(1) }}%</span>
            </div>
            <!-- File type breakdown -->
            <div
              v-if="hoveredItem.fileTypes && getTopFileTypes(hoveredItem.fileTypes).length > 0"
              class="mt-2 pt-2 border-t border-primary"
            >
              <div class="text-xs text-muted mb-1">Top file types:</div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="[ext, count] in getTopFileTypes(hoveredItem.fileTypes)"
                  :key="ext"
                  class="text-xs bg-surface text-secondary px-1.5 py-0.5 rounded"
                >
                  .{{ ext }} ×{{ count }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Item Details Card -->
        <div v-if="hoveredItem" class="card mt-4">
          <div class="card-header">
            <h3 class="card-title">Selected Folder</h3>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div class="text-sm text-muted">Name</div>
                <div class="font-medium text-primary truncate">
                  {{ hoveredItem.name }}
                </div>
              </div>
              <div>
                <div class="text-sm text-muted">Size</div>
                <div class="font-medium text-primary">
                  {{ formatSize(hoveredItem.size) }}
                </div>
              </div>
              <div>
                <div class="text-sm text-muted">Files</div>
                <div class="font-medium text-primary">
                  {{ hoveredItem.fileCount }}
                </div>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-sm text-muted">Path</div>
              <div class="font-mono text-sm text-secondary truncate">
                {{ hoveredItem.path }}
              </div>
            </div>
            <div class="mt-3">
              <div class="text-sm text-muted">Percentage of Total</div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :style="{
                    width: Math.max(0.5, hoveredItem.percentage) + '%',
                    background: getCategoryColor(hoveredItem.category),
                  }"
                />
              </div>
              <div class="text-sm text-muted mt-1">{{ hoveredItem.percentage?.toFixed(2) }}%</div>
            </div>
            <!-- File type breakdown in card -->
            <div
              v-if="hoveredItem.fileTypes && getTopFileTypes(hoveredItem.fileTypes).length > 0"
              class="mt-3 pt-3 border-t border-primary"
            >
              <div class="text-sm text-muted mb-2">File Type Breakdown</div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="[ext, count] in getTopFileTypes(hoveredItem.fileTypes)"
                  :key="ext"
                  class="text-xs bg-surface text-secondary px-2 py-1 rounded flex items-center gap-1"
                >
                  <span class="font-mono">.{{ ext }}</span>
                  <span class="text-muted">×</span>
                  <span>{{ count }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page-container {
  min-height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.text-primary {
  color: #ffffff;
}

.text-muted {
  color: #888888;
}

.text-secondary {
  color: #cccccc;
}

.text-success {
  color: #4ade80;
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
}

.card-body {
  padding: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-primary {
  background: #3b82f6;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.form-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 0.875rem;
}

.search-container {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 0.875rem;
}

.search-input::placeholder {
  color: #888888;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner-lg {
  width: 3rem;
  height: 3rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.modal-overlay {
  position: fixed;
  background: rgba(10, 10, 10, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  z-index: 1000;
  pointer-events: auto;
}

.bg-surface {
  background: rgba(255, 255, 255, 0.05);
}

.border-primary {
  border-color: rgba(255, 255, 255, 0.2);
}
</style>

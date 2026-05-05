<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import * as d3 from "d3";
import { useAnalysisStore } from "../../store/analysis";
import { useSelfLearningStore } from "../../store/selfLearning";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const selfLearningStore = useSelfLearningStore();
const selectedDepth = ref(2);
const selectedCategory = ref<string | null>(null);
const hoveredItem = ref<any>(null);
const canvasRef = ref<HTMLCanvasElement>(null);
const svgRef = ref<SVGSVGElement>(null);
const renderMode = ref<"canvas" | "svg" | "hybrid">("hybrid");
const zoomLevel = ref(1);
const panOffset = ref({ x: 0, y: 0 });

// Build hierarchical data from flat file list
const treemapData = computed(() => {
  if (!store.analysisResult?.files) return null;

  const files = store.analysisResult.files;
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
        };
      }

      current = current.children[part];
      current.size += file.size || 0;
      current.fileCount += 1;
    });
  });

  // Convert to array and calculate percentages
  const maxSize = Math.max(...Object.values(root.children).map((c: any) => c.size));

  const processNode = (node: any): any => {
    const children = Object.values(node.children || {}).map(processNode);
    return {
      ...node,
      children,
      percentage: (node.size / (store.analysisResult?.totalSize || 1)) * 100,
      relativeSize: node.size / maxSize,
    };
  };

  return Object.values(root.children).map(processNode);
});

// Get color based on category
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    media: "#f59e0b",
    images: "#f59e0b",
    videos: "#ef4444",
    documents: "#3b82f6",
    code: "#10b981",
    archives: "#8b5cf6",
    other: "#64748b",
  };
  return colors[category] || colors.other;
}

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

  const width = svgRef.value.clientWidth;
  const height = 400;

  // Clear previous content
  d3.select(svgRef.value).selectAll("*").remove();

  const svg = d3.select(svgRef.value).attr("width", width).attr("height", height);

  // Create zoom behavior
  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 8])
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

  // Create color scale
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Render cells
  const cell = g
    .selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Add rectangles
  cell
    .append("rect")
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => getCategoryColor(d.data.category))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .attr("rx", 4)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      d3.select(this).transition().duration(200).attr("opacity", 1);

      hoveredItem.value = d.data;
    })
    .on("mouseout", function (event, d) {
      d3.select(this).transition().duration(200).attr("opacity", 0.8);

      hoveredItem.value = null;
    })
    .on("click", function (event, d) {
      handleItemClick(d.data);
    });

  // Add text labels for larger cells
  cell
    .append("text")
    .attr("x", 4)
    .attr("y", 20)
    .text((d) => {
      const width = d.x1 - d.x0;
      const height = d.y1 - d.y0;
      // Only show text if cell is large enough
      if (width > 60 && height > 30) {
        return d.data.name.length > 10 ? d.data.name.substring(0, 10) + "..." : d.data.name;
      }
      return "";
    })
    .style("font-size", "12px")
    .style("fill", "#fff")
    .style("font-weight", "bold")
    .style("pointer-events", "none");

  // Add size labels for even larger cells
  cell
    .append("text")
    .attr("x", 4)
    .attr("y", 35)
    .text((d) => {
      const width = d.x1 - d.x0;
      const height = d.y1 - d.y0;
      if (width > 80 && height > 50) {
        return formatSize(d.data.size);
      }
      return "";
    })
    .style("font-size", "10px")
    .style("fill", "#fff")
    .style("opacity", 0.8)
    .style("pointer-events", "none");
}

// Canvas rendering for better performance with large datasets
function renderCanvasTreemap() {
  if (!canvasRef.value || !treemapData.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.clientWidth;
  const height = 400;

  canvas.width = width;
  canvas.height = height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Simple squarified treemap algorithm
  const layout = squarifyLayout(treemapData.value, width, height);

  // Render rectangles
  layout.forEach((item) => {
    ctx.fillStyle = getCategoryColor(item.category);
    ctx.globalAlpha = hoveredItem.value?.path === item.path ? 1 : 0.8;

    // Draw rounded rectangle
    roundRect(ctx, item.x, item.y, item.width, item.height, 4);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw text if space permits
    if (item.width > 60 && item.height > 30) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const text = item.name.length > 10 ? item.name.substring(0, 10) + "..." : item.name;
      ctx.fillText(text, item.x + 4, item.y + 20);

      if (item.width > 80 && item.height > 50) {
        ctx.font = "10px sans-serif";
        ctx.globalAlpha = 0.8;
        ctx.fillText(formatSize(item.size), item.x + 4, item.y + 35);
      }
    }
  });
}

// Simple squarified treemap layout algorithm
function squarifyLayout(data: any[], width: number, height: number): any[] {
  const layout: any[] = [];
  let x = 0,
    y = 0;
  let currentRow: any[] = [];
  let rowHeight = 0;
  let remainingWidth = width;

  data.sort((a, b) => b.size - a.size);

  for (const item of data) {
    if (currentRow.length === 0) {
      // Start new row
      currentRow.push(item);
      rowHeight = (item.size / width) * height;
      remainingWidth = width;
    } else {
      // Try to add to current row
      const newRowHeight =
        ((currentRow.reduce((sum, i) => sum + i.size, 0) + item.size) / width) * height;

      if (newRowHeight > height * 1.5 && currentRow.length > 0) {
        // Finish current row and start new one
        placeRow(currentRow, x, y, remainingWidth, rowHeight, layout);
        y += rowHeight;
        x = 0;
        remainingWidth = width;
        currentRow = [item];
        rowHeight = (item.size / width) * height;
      } else {
        // Add to current row
        currentRow.push(item);
        rowHeight = newRowHeight;
      }
    }
  }

  // Place last row
  if (currentRow.length > 0) {
    placeRow(currentRow, x, y, remainingWidth, rowHeight, layout);
  }

  return layout;
}

function placeRow(row: any[], x: number, y: number, width: number, height: number, layout: any[]) {
  const totalSize = row.reduce((sum, item) => sum + item.size, 0);
  let currentX = x;

  for (const item of row) {
    const itemWidth = (item.size / totalSize) * width;
    layout.push({
      ...item,
      x: currentX,
      y,
      width: itemWidth,
      height,
    });
    currentX += itemWidth;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Calculate rectangle style based on treemap algorithm (fallback)
function getBlockStyle(item: any, index: number, total: number): any {
  const width = Math.max(10, Math.sqrt(item.relativeSize) * 100);
  const height = Math.max(10, item.relativeSize * 100);

  return {
    width: `${width}%`,
    height: `${height}px`,
    backgroundColor: getCategoryColor(item.category),
    opacity: hoveredItem.value?.path === item.path ? 1 : 0.8,
  };
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Lifecycle hooks
onMounted(() => {
  nextTick(() => {
    renderTreemap();
  });

  // Watch for data changes
  watch(
    () => treemapData.value,
    () => {
      nextTick(() => {
        renderTreemap();
      });
    }
  );

  // Watch for render mode changes
  watch(
    () => renderMode.value,
    () => {
      nextTick(() => {
        renderTreemap();
      });
    }
  );
});

function renderTreemap() {
  if (renderMode.value === "canvas") {
    renderCanvasTreemap();
  } else if (renderMode.value === "svg" || renderMode.value === "hybrid") {
    renderD3Treemap();
  }
}

// Track folder navigation for self-learning
const handleItemClick = (item: any) => {
  if (selfLearningStore.isLearning) {
    selfLearningStore.recordUsageEvent({
      type: "directory-navigation",
      timestamp: new Date(),
      data: {
        path: item.path,
        name: item.name,
        size: item.size,
        fileCount: item.fileCount,
        category: item.category,
      },
      context: {
        view: "treemap",
        depth: selectedDepth.value,
      },
    });
  }
  hoveredItem.value = item;
};
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Interactive Treemap</h1>
        <p class="text-slate-400 mt-1">Visual representation of your storage hierarchy</p>
      </div>
      <div class="flex items-center gap-4">
        <label class="text-sm text-slate-400">Depth:</label>
        <select
          v-model="selectedDepth"
          class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 depth-control"
        >
          <option :value="1">1 level</option>
          <option :value="2">2 levels</option>
          <option :value="3">3 levels</option>
          <option :value="4">4 levels</option>
        </select>

        <label class="text-sm text-slate-400">Render Mode:</label>
        <select
          v-model="renderMode"
          class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        >
          <option value="hybrid">Hybrid (D3.js)</option>
          <option value="canvas">Canvas (Fast)</option>
          <option value="svg">SVG (Interactive)</option>
        </select>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <!-- Legend -->
      <div class="flex flex-wrap gap-4 text-sm legend">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded" style="background: #f59e0b"></div>
          <span class="text-slate-400">Media</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded" style="background: #ef4444"></div>
          <span class="text-slate-400">Videos</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded" style="background: #3b82f6"></div>
          <span class="text-slate-400">Documents</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded" style="background: #10b981"></div>
          <span class="text-slate-400">Code</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded" style="background: #8b5cf6"></div>
          <span class="text-slate-400">Archives</span>
        </div>
      </div>

      <!-- Treemap Container -->
      <div class="mt-6">
        <!-- D3.js SVG Treemap -->
        <div
          v-if="renderMode === 'svg' || renderMode === 'hybrid'"
          class="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden"
        >
          <svg ref="svgRef" class="w-full cursor-move"></svg>
        </div>

        <!-- Canvas Treemap -->
        <div
          v-else-if="renderMode === 'canvas'"
          class="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden"
        >
          <canvas ref="canvasRef" class="w-full cursor-pointer"></canvas>
        </div>

        <!-- Fallback Grid View -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <div
            v-for="(item, index) in treemapData"
            :key="item.path"
            :style="getBlockStyle(item, index, treemapData.length)"
            class="p-3 rounded-lg border border-slate-700 cursor-pointer transition-all hover:border-slate-600"
            @click="handleItemClick(item)"
            @mouseover="hoveredItem = item"
            @mouseleave="hoveredItem = null"
          >
            <div class="text-white font-medium truncate">{{ item.name }}</div>
            <div class="text-white/80 text-sm">{{ formatSize(item.size) }}</div>
            <div class="text-white/60 text-xs">{{ item.percentage.toFixed(1) }}%</div>
          </div>
        </div>
      </div>

      <!-- Selected Item Details -->
      <Card v-if="hoveredItem" title="Selected Folder">
        <div class="grid grid-cols-3 gap-4">
          <div>
            <div class="text-sm text-slate-500">Name</div>
            <div class="font-medium text-slate-200">{{ hoveredItem.name }}</div>
          </div>
          <div>
            <div class="text-sm text-slate-500">Size</div>
            <div class="font-medium text-slate-200">{{ formatSize(hoveredItem.size) }}</div>
          </div>
          <div>
            <div class="text-sm text-slate-500">Files</div>
            <div class="font-medium text-slate-200">{{ hoveredItem.fileCount }}</div>
          </div>
        </div>
        <div class="mt-4">
          <div class="text-sm text-slate-500">Path</div>
          <div class="font-mono text-sm text-slate-300">{{ hoveredItem.path }}</div>
        </div>
        <div class="mt-4">
          <div class="text-sm text-slate-500">Percentage of Total</div>
          <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full"
              :style="{
                width: hoveredItem.percentage + '%',
                background: getCategoryColor(hoveredItem.category),
              }"
            />
          </div>
          <div class="text-sm text-slate-400 mt-1">{{ hoveredItem.percentage.toFixed(2) }}%</div>
        </div>
      </Card>
    </template>
  </div>
</template>

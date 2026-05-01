<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { useSelfLearningStore } from "../../store/selfLearning";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const selfLearningStore = useSelfLearningStore();
const selectedDepth = ref(2);
const selectedCategory = ref<string | null>(null);
const hoveredItem = ref<any>(null);

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

// Calculate rectangle style based on treemap algorithm
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
          class="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
        >
          <option :value="1">1 level</option>
          <option :value="2">2 levels</option>
          <option :value="3">3 levels</option>
          <option :value="4">4 levels</option>
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
      <div class="flex flex-wrap gap-4 text-sm">
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
      <Card title="Storage Treemap">
        <div class="flex flex-wrap gap-1 min-h-[400px]">
          <div
            v-for="item in treemapData"
            :key="item.path"
            class="relative p-3 rounded cursor-pointer transition-all hover:scale-[1.02] hover:z-10"
            :style="getBlockStyle(item, 0, treemapData?.length || 1)"
            @mouseenter="hoveredItem = item"
            @mouseleave="hoveredItem = null"
            @click="handleItemClick(item)"
          >
            <div class="text-xs font-medium text-white truncate">{{ item.name }}</div>
            <div class="text-xs text-white/80">{{ formatSize(item.size) }}</div>
            <div class="text-xs text-white/60">{{ item.fileCount }} files</div>
          </div>
        </div>
      </Card>

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

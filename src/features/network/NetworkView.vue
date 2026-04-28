<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const animationFrame = ref<number | null>(null);
const selectedNode = ref<any>(null);
const viewMode = ref<"folders" | "types" | "duplicates">("folders");

// Generate network nodes and links from file data
const networkData = computed(() => {
  if (!store.analysisResult?.files) return { nodes: [], links: [] };
  
  const files = store.analysisResult.files;
  const nodes: any[] = [];
  const links: any[] = [];
  const nodeMap = new Map();
  
  if (viewMode.value === "folders") {
    // Group by parent folder
    const folderMap = new Map();
    
    files.forEach((file: any) => {
      const parts = file.path.split(/[\\/]/);
      const parentPath = parts.slice(0, -1).join("/") || "root";
      
      if (!folderMap.has(parentPath)) {
        folderMap.set(parentPath, {
          id: parentPath,
          name: parts[parts.length - 2] || "root",
          size: 0,
          fileCount: 0,
          type: "folder",
        });
      }
      
      const folder = folderMap.get(parentPath);
      folder.size += file.size || 0;
      folder.fileCount += 1;
    });
    
    // Create folder nodes
    folderMap.forEach((folder, path) => {
      nodes.push({
        id: path,
        name: folder.name,
        size: folder.size,
        fileCount: folder.fileCount,
        type: "folder",
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: 0,
        vy: 0,
      });
      nodeMap.set(path, nodes[nodes.length - 1]);
    });
    
    // Create parent-child links
    folderMap.forEach((folder, path) => {
      const parts = path.split("/");
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join("/") || "root";
        if (nodeMap.has(parentPath)) {
          links.push({
            source: nodeMap.get(parentPath),
            target: nodeMap.get(path),
            strength: 0.5,
          });
        }
      }
    });
  } else if (viewMode.value === "types") {
    // Group by file type
    const typeMap = new Map();
    
    files.forEach((file: any) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || "no-ext";
      
      if (!typeMap.has(ext)) {
        typeMap.set(ext, {
          id: ext,
          name: `.${ext}`,
          size: 0,
          fileCount: 0,
          type: "filetype",
        });
      }
      
      const type = typeMap.get(ext);
      type.size += file.size || 0;
      type.fileCount += 1;
    });
    
    typeMap.forEach((type, ext) => {
      nodes.push({
        id: ext,
        name: type.name,
        size: type.size,
        fileCount: type.fileCount,
        type: "filetype",
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: 0,
        vy: 0,
      });
    });
  } else {
    // Show duplicate relationships
    const dupGroups = store.analysisResult.duplicateGroups || [];
    
    dupGroups.forEach((group: any, idx: number) => {
      const groupId = `group-${idx}`;
      nodes.push({
        id: groupId,
        name: `Duplicate ${idx + 1}`,
        size: group.size,
        fileCount: group.fileCount,
        type: "duplicate",
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: 0,
        vy: 0,
      });
      
      group.files.forEach((file: any) => {
        const fileId = `file-${file.path}`;
        nodes.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: "file",
          x: Math.random() * 800,
          y: Math.random() * 600,
          vx: 0,
          vy: 0,
        });
        
        links.push({
          source: nodes[nodes.length - 1],
          target: nodes.find((n: any) => n.id === groupId),
          strength: 1,
        });
      });
    });
  }
  
  return { nodes, links };
});

// Force-directed graph simulation
function updateGraph() {
  const { nodes, links } = networkData.value;
  if (nodes.length === 0) return;
  
  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 5000 / (dist * dist);
      
      nodes[i].vx -= (dx / dist) * force;
      nodes[i].vy -= (dy / dist) * force;
      nodes[j].vx += (dx / dist) * force;
      nodes[j].vy += (dy / dist) * force;
    }
  }
  
  // Attraction (links)
  links.forEach((link: any) => {
    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 100) * 0.01 * link.strength;
    
    link.source.vx += (dx / dist) * force;
    link.source.vy += (dy / dist) * force;
    link.target.vx -= (dx / dist) * force;
    link.target.vy -= (dy / dist) * force;
  });
  
  // Center gravity
  nodes.forEach((node: any) => {
    node.vx += (400 - node.x) * 0.001;
    node.vy += (300 - node.y) * 0.001;
    
    // Damping
    node.vx *= 0.9;
    node.vy *= 0.9;
    
    // Update position
    node.x += node.vx;
    node.y += node.vy;
  });
}

// Render graph
function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const { nodes, links } = networkData.value;
  
  // Draw links
  ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
  ctx.lineWidth = 1;
  links.forEach((link: any) => {
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  });
  
  // Draw nodes
  nodes.forEach((node: any) => {
    const radius = Math.max(10, Math.min(50, Math.sqrt(node.size) / 1000));
    
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = getNodeColor(node.type);
    ctx.fill();
    
    // Selected highlight
    if (selectedNode.value?.id === node.id) {
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(node.name.substring(0, 15), node.x, node.y + radius + 15);
  });
}

function getNodeColor(type: string): string {
  switch (type) {
    case "folder": return "#3b82f6";
    case "filetype": return "#10b981";
    case "duplicate": return "#ef4444";
    case "file": return "#f59e0b";
    default: return "#64748b";
  }
}

function animate() {
  updateGraph();
  render();
  animationFrame.value = requestAnimationFrame(animate);
}

function handleCanvasClick(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const { nodes } = networkData.value;
  for (const node of nodes) {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = Math.max(10, Math.min(50, Math.sqrt(node.size) / 1000));
    
    if (dx * dx + dy * dy < radius * radius) {
      selectedNode.value = node;
      return;
    }
  }
  
  selectedNode.value = null;
}

onMounted(() => {
  animate();
});

onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
  }
});

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Network Graph</h1>
        <p class="text-slate-400 mt-1">Visualize file relationships and dependencies</p>
      </div>
      <div class="flex gap-2">
        <Button
          v-for="mode in ['folders', 'types', 'duplicates']"
          :key="mode"
          :variant="viewMode === mode ? 'primary' : 'secondary'"
          size="sm"
          @click="viewMode = mode as any"
        >
          {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
        </Button>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <div class="grid grid-cols-3 gap-6">
        <!-- Graph Canvas -->
        <Card title="Force-Directed Graph" class="col-span-2">
          <canvas
            ref="canvasRef"
            width="800"
            height="500"
            class="w-full h-[500px] bg-slate-800/50 rounded cursor-pointer"
            @click="handleCanvasClick"
          />
          <div class="flex gap-4 mt-4 text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span class="text-slate-400">Folders</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span class="text-slate-400">File Types</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <span class="text-slate-400">Duplicates</span>
            </div>
          </div>
        </Card>

        <!-- Selected Node Info -->
        <Card :title="selectedNode ? 'Selected Node' : 'Node Information'">
          <div v-if="selectedNode" class="space-y-4">
            <div>
              <div class="text-sm text-slate-500">Name</div>
              <div class="font-medium text-slate-200">{{ selectedNode.name }}</div>
            </div>
            <div>
              <div class="text-sm text-slate-500">Type</div>
              <div class="font-medium text-slate-200 capitalize">{{ selectedNode.type }}</div>
            </div>
            <div>
              <div class="text-sm text-slate-500">Size</div>
              <div class="font-medium text-slate-200">{{ formatSize(selectedNode.size) }}</div>
            </div>
            <div>
              <div class="text-sm text-slate-500">Files</div>
              <div class="font-medium text-slate-200">{{ selectedNode.fileCount || 1 }}</div>
            </div>
          </div>
          <div v-else class="text-slate-500 text-center py-8">
            Click a node in the graph to see details
          </div>
        </Card>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4">
        <Card title="Total Nodes">
          <div class="text-2xl font-bold text-blue-400">{{ networkData.nodes.length }}</div>
        </Card>
        <Card title="Connections">
          <div class="text-2xl font-bold text-emerald-400">{{ networkData.links.length }}</div>
        </Card>
        <Card title="View Mode">
          <div class="text-2xl font-bold text-purple-400 capitalize">{{ viewMode }}</div>
        </Card>
      </div>
    </template>
  </div>
</template>

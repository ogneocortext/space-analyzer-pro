<template>
  <div class="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden">
    <!-- Graph Canvas -->
    <canvas 
      ref="canvasRef" 
      class="w-full h-full cursor-move"
      @click="handleCanvasClick"
      @mousemove="handleCanvasMouseMove"
      @wheel="handleCanvasWheel"
    />

    <!-- Zoom Controls -->
    <div class="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
      <div class="flex flex-col gap-2">
        <button
          @click="zoomIn"
          class="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center transition-colors"
          title="Zoom In"
        >
          <Plus class="w-4 h-4" />
        </button>
        <button
          @click="zoomOut"
          class="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center transition-colors"
          title="Zoom Out"
        >
          <Minus class="w-4 h-4" />
        </button>
        <button
          @click="resetZoom"
          class="w-8 h-8 bg-slate-600 hover:bg-slate-700 text-white rounded flex items-center justify-center transition-colors"
          title="Reset Zoom"
        >
          <Maximize2 class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Node Details Tooltip -->
    <div
      v-if="hoveredNode"
      class="absolute bg-slate-800/95 backdrop-blur-sm rounded-lg p-3 border border-slate-600 shadow-lg pointer-events-none"
      :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
    >
      <div class="text-sm space-y-1">
        <div class="font-semibold text-slate-100">{{ hoveredNode.name }}</div>
        <div class="text-slate-300">Type: {{ hoveredNode.type }}</div>
        <div class="text-slate-300">Size: {{ formatSize(hoveredNode.size) }}</div>
        <div v-if="hoveredNode.fileCount" class="text-slate-300">Files: {{ hoveredNode.fileCount }}</div>
      </div>
    </div>

    <!-- Loading State -->
    <div 
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-slate-900/80"
    >
      <div class="text-center">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p class="text-slate-300">Building network graph...</p>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-if="!isLoading && nodes.length === 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center">
        <Network class="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <p class="text-slate-400 text-lg">No network data available</p>
        <p class="text-slate-500 text-sm">Scan a directory to visualize file relationships</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Plus, Minus, Maximize2, Network } from 'lucide-vue-next';

interface NetworkNode {
  id: string;
  name: string;
  size: number;
  fileCount?: number;
  type: 'folder' | 'filetype' | 'duplicate' | 'file';
  x: number;
  y: number;
  vx: number;
  vy: number;
  level?: number;
  children?: string[];
}

interface NetworkLink {
  source: NetworkNode;
  target: NetworkNode;
  strength: number;
}

interface Props {
  nodes: NetworkNode[];
  links: NetworkLink[];
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false
});

const emit = defineEmits<{
  nodeClick: [node: NetworkNode];
  nodeSelect: [node: NetworkNode | null];
}>();

// Canvas and rendering state
const canvasRef = ref<HTMLCanvasElement | null>(null);
const hoveredNode = ref<NetworkNode | null>(null);
const tooltipPosition = ref({ x: 0, y: 0 });
const animationFrame = ref<number | null>(null);

// Graph state
const zoom = ref(1);
const panOffset = ref({ x: 0, y: 0 });
const selectedNode = ref<NetworkNode | null>(null);

// Computed properties
const canvasSize = computed(() => ({
  width: canvasRef.value?.width || 800,
  height: canvasRef.value?.height || 600
}));

// Node color mapping
const getNodeColor = (type: string): string => {
  const colors = {
    folder: '#3b82f6',
    filetype: '#10b981',
    duplicate: '#ef4444',
    file: '#f59e0b'
  };
  return colors[type as keyof typeof colors] || '#64748b';
};

// Utility functions
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Zoom controls
const zoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.2, 3);
};

const zoomOut = () => {
  zoom.value = Math.max(zoom.value / 1.2, 0.3);
};

const resetZoom = () => {
  zoom.value = 1;
  panOffset.value = { x: 0, y: 0 };
};

// Canvas interaction handlers
const handleCanvasClick = (event: MouseEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - panOffset.value.x) / zoom.value;
  const y = (event.clientY - rect.top - panOffset.value.y) / zoom.value;

  // Find clicked node
  for (const node of props.nodes) {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = Math.max(10, Math.min(50, Math.sqrt(node.size) / 1000));

    if (dx * dx + dy * dy < radius * radius) {
      emit('nodeClick', node);
      emit('nodeSelect', node);
      return;
    }
  }

  emit('nodeSelect', null);
};

const handleCanvasMouseMove = (event: MouseEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left - panOffset.value.x) / zoom.value;
  const y = (event.clientY - rect.top - panOffset.value.y) / zoom.value;

  // Find hovered node
  let foundNode = null;
  for (const node of props.nodes) {
    const dx = x - node.x;
    const dy = y - node.y;
    const radius = Math.max(10, Math.min(50, Math.sqrt(node.size) / 1000));

    if (dx * dx + dy * dy < radius * radius) {
      foundNode = node;
      break;
    }
  }

  hoveredNode.value = foundNode;
  if (foundNode) {
    tooltipPosition.value = {
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top - 30
    };
  }
};

const handleCanvasWheel = (event: WheelEvent) => {
  event.preventDefault();
  if (event.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
};

// Force simulation
const updateForces = () => {
  if (props.nodes.length === 0) return;

  // Repulsion between nodes
  for (let i = 0; i < props.nodes.length; i++) {
    for (let j = i + 1; j < props.nodes.length; j++) {
      const dx = props.nodes[j].x - props.nodes[i].x;
      const dy = props.nodes[j].y - props.nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = 3000 / (dist * dist);

      props.nodes[i].vx -= (dx / dist) * force;
      props.nodes[i].vy -= (dy / dist) * force;
      props.nodes[j].vx += (dx / dist) * force;
      props.nodes[j].vy += (dy / dist) * force;
    }
  }

  // Attraction along links
  props.links.forEach(link => {
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
  props.nodes.forEach(node => {
    node.vx += (canvasSize.value.width / 2 - node.x) * 0.001;
    node.vy += (canvasSize.value.height / 2 - node.y) * 0.001;

    // Damping
    node.vx *= 0.85;
    node.vy *= 0.85;

    // Update position
    node.x += node.vx;
    node.y += node.vy;
  });
};

// Rendering
const render = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply transformations
  ctx.save();
  ctx.translate(panOffset.value.x, panOffset.value.y);
  ctx.scale(zoom.value, zoom.value);

  // Draw links
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
  ctx.lineWidth = 2;
  props.links.forEach(link => {
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.stroke();
  });

  // Draw nodes
  props.nodes.forEach(node => {
    const radius = Math.max(8, Math.min(40, Math.sqrt(node.size) / 1000));

    // Node shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = getNodeColor(node.type);
    ctx.fill();

    // Selected highlight
    if (selectedNode.value?.id === node.id) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Hover highlight
    if (hoveredNode.value?.id === node.id) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Node label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${Math.max(10, Math.min(14, radius / 2))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const maxWidth = radius * 1.8;
    const text = node.name.length > 15 ? node.name.substring(0, 12) + '...' : node.name;
    ctx.fillText(text, node.x, node.y);
  });

  ctx.restore();
};

// Animation loop
const animate = () => {
  updateForces();
  render();
  animationFrame.value = requestAnimationFrame(animate);
};

// Lifecycle
onMounted(async () => {
  await nextTick();
  const canvas = canvasRef.value;
  if (canvas) {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    animate();
  }
});

onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
  }
});
</script>

<style scoped>
canvas {
  image-rendering: optimizeSpeed;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

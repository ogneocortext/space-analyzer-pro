<template>
  <div data-testid="visualization-view" class="p-6 lg:p-8 bg-slate-900 min-h-screen">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">3D Visualization</h1>
          <p class="text-slate-400">Interactive 3D graph of your file structure</p>
        </div>
        <div class="flex gap-2">
          <button
            @click="navigateToDashboard"
            class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            aria-label="Back to dashboard"
          >
            <ArrowLeft :size="16" aria-hidden="true" />
            Back
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!analysisStore.data" class="flex flex-col items-center justify-center py-16 text-center">
      <Box class="text-slate-600 mb-4" :size="64" aria-hidden="true" />
      <h2 class="text-2xl font-semibold text-white mb-2">No Data Available</h2>
      <p class="text-slate-400 mb-6">Run an analysis to see 3D visualization</p>
      <button
        @click="navigateToLanding"
        class="bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        aria-label="Start analysis"
      >
        Start Analysis
      </button>
    </div>

    <!-- Visualization Content -->
    <div v-else class="space-y-6">
      <!-- Controls -->
      <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-slate-400 text-sm">Layout:</label>
            <select
              v-model="layoutMode"
              class="bg-slate-700 text-white text-sm py-2 px-3 rounded-lg border border-slate-600 focus:outline-none focus:border-cyan-500"
            >
              <option value="force">Force Graph</option>
              <option value="tree">Tree</option>
              <option value="circular">Circular</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-slate-400 text-sm">Color by:</label>
            <select
              v-model="colorMode"
              class="bg-slate-700 text-white text-sm py-2 px-3 rounded-lg border border-slate-600 focus:outline-none focus:border-cyan-500"
            >
              <option value="category">Category</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-slate-400 text-sm">Filter:</label>
            <select
              v-model="filterCategory"
              class="bg-slate-700 text-white text-sm py-2 px-3 rounded-lg border border-slate-600 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Files</option>
              <option value="Code">Code</option>
              <option value="Images">Images</option>
              <option value="Audio">Audio/Music</option>
              <option value="Video">Video</option>
              <option value="Documents">Documents</option>
              <option value="Archives">Archives</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <button
            @click="resetView"
            class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw :size="16" aria-hidden="true" />
            Reset View
          </button>
          <button
            @click="toggleFullscreen"
            class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <Maximize :size="16" aria-hidden="true" />
            Fullscreen
          </button>
        </div>
      </div>

      <!-- 3D Canvas -->
      <div
        ref="canvasContainer"
        class="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
        :class="{ 'fixed inset-0 z-50': isFullscreen }"
        :style="{ height: isFullscreen ? '100vh' : '600px' }"
      >
        <canvas ref="canvas" class="w-full h-full"></canvas>
        
        <!-- Legend -->
        <div class="absolute bottom-4 left-4 bg-slate-900/90 rounded-lg p-4 border border-slate-700">
          <h3 class="text-white font-medium mb-2 text-sm">Legend</h3>
          <div class="space-y-1">
            <div
              v-for="(color, category) in legendColors"
              :key="category"
              class="flex items-center gap-2 text-xs"
            >
              <div
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: color }"
              />
              <span class="text-slate-300">{{ category }}</span>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="absolute top-4 right-4 bg-slate-900/90 rounded-lg p-4 border border-slate-700">
          <div class="text-xs text-slate-400 mb-1">Nodes</div>
          <div class="text-lg font-bold text-white">{{ nodeCount }}</div>
          <div class="text-xs text-slate-400 mb-1 mt-2">Edges</div>
          <div class="text-lg font-bold text-white">{{ edgeCount }}</div>
        </div>
      </div>

      <!-- Selected Node Info -->
      <Transition name="slide">
        <div v-if="selectedNode" class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold text-white">Selected: {{ selectedNode.name }}</h3>
            <button
              @click="selectedNode = null"
              class="text-slate-400 hover:text-white"
            >
              <X :size="20" />
            </button>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div class="text-slate-400 text-xs">Size</div>
              <div class="text-white font-medium">{{ formatBytes(selectedNode.size) }}</div>
            </div>
            <div>
              <div class="text-slate-400 text-xs">Type</div>
              <div class="text-white font-medium">{{ selectedNode.type }}</div>
            </div>
            <div>
              <div class="text-slate-400 text-xs">Category</div>
              <div class="text-white font-medium">{{ selectedNode.category }}</div>
            </div>
            <div>
              <div class="text-slate-400 text-xs">Path</div>
              <div class="text-white font-medium text-xs truncate">{{ selectedNode.path }}</div>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-slate-700">
            <div class="text-slate-400 text-xs mb-2">Connections ({{ getNodeConnections(selectedNode.id).length }})</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(conn, index) in getNodeConnections(selectedNode.id).slice(0, 5)"
                :key="index"
                class="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded"
              >
                {{ conn.type }}: {{ conn.targetName }}
              </span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Hovered Link Info -->
      <Transition name="slide">
        <div v-if="hoveredLink" class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-white">Connection</h3>
            <button
              @click="hoveredLink = null"
              class="text-slate-400 hover:text-white"
            >
              <X :size="16" />
            </button>
          </div>
          <div class="text-xs text-slate-300">
            <span class="text-cyan-400">{{ hoveredLink.sourceName }}</span>
            <span class="mx-2">→</span>
            <span class="text-cyan-400">{{ hoveredLink.targetName }}</span>
          </div>
          <div class="mt-2 text-xs text-slate-400">
            Type: <span class="text-white">{{ hoveredLink.type || 'dependency' }}</span>
            <span class="mx-2">|</span>
            Strength: <span class="text-white">{{ (hoveredLink.strength * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, Maximize, X, Box } from 'lucide-vue-next'
import { analysisStoreKey, getCategoryColorKey } from '../../../types/injection'

const router = useRouter()
const analysisStore = inject(analysisStoreKey)!
const getCategoryColor = inject(getCategoryColorKey)!

const canvas = ref<HTMLCanvasElement | null>(null)
const canvasContainer = ref<HTMLDivElement | null>(null)
const layoutMode = ref('force')
const colorMode = ref('category')
const filterCategory = ref('all')
const selectedNode = ref<any>(null)
const hoveredNode = ref<any>(null)
const hoveredLink = ref<any>(null)
const isFullscreen = ref(false)
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const draggedNode = ref<any>(null)
const isPanning = ref(false)
const lastMousePos = ref({ x: 0, y: 0 })

let animationFrame: number | null = null
let nodes: any[] = []
let links: any[] = []

const nodeCount = computed(() => {
  if (filterCategory.value === 'all') return nodes.length
  return nodes.filter(n => n.category === filterCategory.value).length
})

const edgeCount = computed(() => {
  if (filterCategory.value === 'all') return links.length
  const visibleNodeIds = new Set(nodes.filter(n => n.category === filterCategory.value).map(n => n.id))
  return links.filter(l => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)).length
})

const legendColors = computed(() => {
  if (!analysisStore.data?.categories) return {}
  const colors: Record<string, string> = {}
  Object.keys(analysisStore.data.categories).forEach(category => {
    colors[category] = getCategoryColor(category)
  })
  return colors
})

const navigateToDashboard = () => {
  router.push('/dashboard')
}

const navigateToLanding = () => {
  router.push('/')
}

const resetView = () => {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
  if (canvas.value) {
    const ctx = canvas.value.getContext('2d')
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    }
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const getNodeConnections = (nodeId: string) => {
  const connections = []
  links.forEach(link => {
    if (link.source === nodeId) {
      const target = nodes.find(n => n.id === link.target)
      if (target) {
        connections.push({
          targetName: target.name,
          type: link.type || 'dependency',
          strength: link.strength
        })
      }
    } else if (link.target === nodeId) {
      const source = nodes.find(n => n.id === link.source)
      if (source) {
        connections.push({
          targetName: source.name,
          type: link.type || 'dependency',
          strength: link.strength,
          inbound: true
        })
      }
    }
  })
  return connections
}

const formatBytes = (bytes: number) => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const generateGraphData = () => {
  if (!analysisStore.data) {
    nodes = []
    links = []
    return
  }

  console.log('Analysis data:', analysisStore.data)
  console.log('Files:', analysisStore.data.files)
  console.log('Dependency graph:', analysisStore.data.dependencyGraph)

  // Create nodes from files
  const files = analysisStore.data.files || []
  
  if (files.length === 0 && analysisStore.data.dependencyGraph?.nodes) {
    // Use dependency graph nodes if no files array
    nodes = analysisStore.data.dependencyGraph.nodes.map((node: any, index: number) => ({
      id: node.id || `node-${index}`,
      name: node.name || node.id,
      size: node.size || 1000,
      path: node.path || '',
      type: node.type || 'file',
      category: node.category || getCategoryFromFile(node.name || ''),
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      z: Math.random() * 400 - 200,
      vx: 0,
      vy: 0,
      vz: 0
    }))

    // Use dependency graph edges
    links = (analysisStore.data.dependencyGraph.edges || []).map((edge: any, index: number) => ({
      source: edge.source,
      target: edge.target,
      strength: edge.weight || 0.5
    }))
  } else {
    // Create nodes from files array
    nodes = files.map((file: any, index: number) => ({
      id: file.id || `node-${index}`,
      name: file.name,
      size: file.size || 1000,
      path: file.path || '',
      type: file.extension || 'file',
      category: getCategoryFromFile(file.name),
      x: Math.random() * 800 - 400,
      y: Math.random() * 600 - 300,
      z: Math.random() * 400 - 200,
      vx: 0,
      vy: 0,
      vz: 0
    }))

    // Create links based on directory structure
    links = []
    for (let i = 1; i < nodes.length; i++) {
      // Connect to a random previous node to create a graph structure
      const targetIndex = Math.floor(Math.random() * i)
      links.push({
        source: nodes[targetIndex].id,
        target: nodes[i].id,
        strength: Math.random()
      })
    }
  }

  console.log('Generated nodes:', nodes.length)
  console.log('Generated links:', links.length)
}

const getCategoryFromFile = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const categories: Record<string, string> = {
    'js': 'Code',
    'ts': 'Code',
    'tsx': 'Code',
    'jsx': 'Code',
    'vue': 'Code',
    'py': 'Code',
    'rs': 'Code',
    'cpp': 'Code',
    'c': 'Code',
    'h': 'Code',
    'java': 'Code',
    'go': 'Code',
    'php': 'Code',
    'jpg': 'Images',
    'jpeg': 'Images',
    'png': 'Images',
    'gif': 'Images',
    'svg': 'Images',
    'webp': 'Images',
    'md': 'Documents',
    'txt': 'Documents',
    'pdf': 'Documents',
    'doc': 'Documents',
    'docx': 'Documents',
    'mp3': 'Audio',
    'wav': 'Audio',
    'mp4': 'Video',
    'avi': 'Video',
    'mkv': 'Video',
    'zip': 'Archives',
    'rar': 'Archives',
    '7z': 'Archives'
  }
  return categories[ext] || 'Other'
}

const drawVisualization = () => {
  if (!canvas.value || !canvasContainer.value) return

  const ctx = canvas.value.getContext('2d')
  if (!ctx) return

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight

  canvas.value.width = width
  canvas.value.height = height

  // Clear canvas
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, width, height)

  // Apply transformations
  ctx.save()
  ctx.translate(width / 2 + offsetX.value, height / 2 + offsetY.value)
  ctx.scale(scale.value, scale.value)

  // Filter nodes and links based on category
  const visibleNodes = filterCategory.value === 'all' 
    ? nodes 
    : nodes.filter(n => n.category === filterCategory.value)
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id))
  const visibleLinks = filterCategory.value === 'all'
    ? links
    : links.filter(l => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target))

  // Draw links
  visibleLinks.forEach(link => {
    const source = visibleNodes.find(n => n.id === link.source)
    const target = visibleNodes.find(n => n.id === link.target)
    if (source && target) {
      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)
      
      // Highlight hovered link
      if (hoveredLink.value && 
          ((hoveredLink.value.source === link.source && hoveredLink.value.target === link.target) ||
           (hoveredLink.value.source === link.target && hoveredLink.value.target === link.source))) {
        ctx.strokeStyle = '#00B4D8'
        ctx.lineWidth = 3
      } else {
        ctx.strokeStyle = `rgba(100, 116, 139, ${link.strength * 0.5})`
        ctx.lineWidth = 1
      }
      ctx.stroke()
    }
  })

  // Draw nodes
  visibleNodes.forEach(node => {
    const x = node.x
    const y = node.y
    const size = Math.max(5, Math.min(20, Math.log(node.size + 1) * 2))

    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    
    let color = '#6b7280'
    if (colorMode.value === 'category') {
      color = getCategoryColor(node.category)
    } else if (colorMode.value === 'size') {
      const hue = Math.max(0, 240 - Math.log(node.size + 1) * 20)
      color = `hsl(${hue}, 70%, 50%)`
    } else if (colorMode.value === 'type') {
      const typeColors: Record<string, string> = {
        'js': '#f7df1e',
        'ts': '#3178c6',
        'vue': '#42b883',
        'py': '#3776ab',
        'rs': '#dea584',
        'cpp': '#00599c'
      }
      color = typeColors[node.type] || '#6b7280'
    }

    ctx.fillStyle = color
    ctx.fill()

    // Highlight hovered node
    if (hoveredNode.value && hoveredNode.value.id === node.id) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Highlight selected node
    if (selectedNode.value && selectedNode.value.id === node.id) {
      ctx.strokeStyle = '#00B4D8'
      ctx.lineWidth = 3
      ctx.stroke()
    }
  })

  ctx.restore()
}

const animate = () => {
  // Simple force-directed layout simulation
  const repulsion = 1000
  const attraction = 0.01

  // Repulsion between nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = repulsion / (dist * dist)
      
      nodes[i].vx -= (dx / dist) * force
      nodes[i].vy -= (dy / dist) * force
      nodes[j].vx += (dx / dist) * force
      nodes[j].vy += (dy / dist) * force
    }
  }

  // Attraction along links
  links.forEach(link => {
    const source = nodes.find(n => n.id === link.source)
    const target = nodes.find(n => n.id === link.target)
    if (source && target) {
      const dx = target.x - source.x
      const dy = target.y - source.y
      source.vx += dx * attraction
      source.vy += dy * attraction
      target.vx -= dx * attraction
      target.vy -= dy * attraction
    }
  })

  // Update positions
  nodes.forEach(node => {
    node.x += node.vx
    node.y += node.vy
    node.vx *= 0.9 // Damping
    node.vy *= 0.9
  })

  drawVisualization()
  animationFrame = requestAnimationFrame(animate)
}

const handleCanvasClick = (event: MouseEvent) => {
  if (!canvas.value || !canvasContainer.value) return

  const rect = canvas.value.getBoundingClientRect()
  const x = (event.clientX - rect.left - canvasContainer.value.clientWidth / 2 - offsetX.value) / scale.value
  const y = (event.clientY - rect.top - canvasContainer.value.clientHeight / 2 - offsetY.value) / scale.value

  // Find clicked node
  const visibleNodes = filterCategory.value === 'all' 
    ? nodes 
    : nodes.filter(n => n.category === filterCategory.value)
  
  for (const node of visibleNodes) {
    const dx = node.x - x
    const dy = node.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 20) {
      selectedNode.value = node
      return
    }
  }
  selectedNode.value = null
}

const handleCanvasMouseMove = (event: MouseEvent) => {
  if (!canvas.value || !canvasContainer.value) return

  const rect = canvas.value.getBoundingClientRect()
  const x = (event.clientX - rect.left - canvasContainer.value.clientWidth / 2 - offsetX.value) / scale.value
  const y = (event.clientY - rect.top - canvasContainer.value.clientHeight / 2 - offsetY.value) / scale.value

  // Handle dragging node
  if (isDragging.value && draggedNode.value) {
    draggedNode.value.x = x
    draggedNode.value.y = y
    draggedNode.value.vx = 0
    draggedNode.value.vy = 0
    return
  }

  // Handle panning
  if (isPanning.value) {
    offsetX.value = event.clientX - lastMousePos.value.x
    offsetY.value = event.clientY - lastMousePos.value.y
    lastMousePos.value = { x: event.clientX, y: event.clientY }
    return
  }

  // Handle hover
  const visibleNodes = filterCategory.value === 'all' 
    ? nodes 
    : nodes.filter(n => n.category === filterCategory.value)
  const visibleLinks = filterCategory.value === 'all'
    ? links
    : links.filter(l => {
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id))
        return visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)
      })
  
  let found = null
  for (const node of visibleNodes) {
    const dx = node.x - x
    const dy = node.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 20) {
      found = node
      break
    }
  }
  hoveredNode.value = found

  // Check for link hover
  let foundLink = null
  if (!found) {
    for (const link of visibleLinks) {
      const source = visibleNodes.find(n => n.id === link.source)
      const target = visibleNodes.find(n => n.id === link.target)
      if (source && target) {
        const dist = pointToLineDistance(x, y, source.x, source.y, target.x, target.y)
        if (dist < 5) {
          foundLink = {
            ...link,
            sourceName: source.name,
            targetName: target.name
          }
          break
        }
      }
    }
  }
  hoveredLink.value = foundLink
  
  canvas.value.style.cursor = found ? 'pointer' : foundLink ? 'pointer' : 'grab'
}

const handleCanvasMouseDown = (event: MouseEvent) => {
  if (!canvas.value || !canvasContainer.value) return

  const rect = canvas.value.getBoundingClientRect()
  const x = (event.clientX - rect.left - canvasContainer.value.clientWidth / 2 - offsetX.value) / scale.value
  const y = (event.clientY - rect.top - canvasContainer.value.clientHeight / 2 - offsetY.value) / scale.value

  // Check if clicking on a node
  const visibleNodes = filterCategory.value === 'all' 
    ? nodes 
    : nodes.filter(n => n.category === filterCategory.value)
  
  for (const node of visibleNodes) {
    const dx = node.x - x
    const dy = node.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 20) {
      isDragging.value = true
      draggedNode.value = node
      return
    }
  }

  // Otherwise, start panning
  isPanning.value = true
  lastMousePos.value = { x: event.clientX - offsetX.value, y: event.clientY - offsetY.value }
  canvas.value.style.cursor = 'grabbing'
}

const handleCanvasMouseUp = () => {
  isDragging.value = false
  draggedNode.value = null
  isPanning.value = false
  if (canvas.value) {
    canvas.value.style.cursor = 'grab'
  }
}

const handleCanvasWheel = (event: WheelEvent) => {
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  scale.value = Math.max(0.1, Math.min(5, scale.value * delta))
}

const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq

  let xx, yy

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

onMounted(() => {
  generateGraphData()
  if (canvas.value) {
    canvas.value.addEventListener('click', handleCanvasClick)
    canvas.value.addEventListener('mousemove', handleCanvasMouseMove)
    canvas.value.addEventListener('mousedown', handleCanvasMouseDown)
    canvas.value.addEventListener('mouseup', handleCanvasMouseUp)
    canvas.value.addEventListener('wheel', handleCanvasWheel)
  }
  animate()
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
  if (canvas.value) {
    canvas.value.removeEventListener('click', handleCanvasClick)
    canvas.value.removeEventListener('mousemove', handleCanvasMouseMove)
    canvas.value.removeEventListener('mousedown', handleCanvasMouseDown)
    canvas.value.removeEventListener('mouseup', handleCanvasMouseUp)
    canvas.value.removeEventListener('wheel', handleCanvasWheel)
  }
})

watch(() => analysisStore.data, () => {
  generateGraphData()
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

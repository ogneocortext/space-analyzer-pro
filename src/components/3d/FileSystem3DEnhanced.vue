<template>
  <div class="filesystem-3d-enhanced">
    <!-- Enhanced Controls Panel -->
    <div class="controls-panel">
      <!-- Navigation Controls -->
      <div class="control-group">
        <h4>🎮 Navigation</h4>
        <div class="control-buttons">
          <button @click="resetCamera" class="btn btn-primary">🏠 Reset</button>
          <button @click="flyToSelected" class="btn btn-secondary" :disabled="!selectedNode">🎯 Focus</button>
          <button @click="toggleAutoRotate" class="btn btn-outline">
            🔄 {{ autoRotate ? "Stop" : "Start" }}
          </button>
        </div>
      </div>

      <!-- View Options -->
      <div class="control-group">
        <h4>🔍 View Options</h4>
        <div class="view-options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showFileLabels" @change="updateLabels" />
            File Labels
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="showDirectoryLabels" @change="updateLabels" />
            Directory Labels
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="colorBySize" @change="updateColors" />
            Color by Size
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="colorByType" @change="updateColors" />
            Color by Type
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="showHeatMap" @change="updateHeatMap" />
            Activity Heat Map
          </label>
        </div>
      </div>

      <!-- Scale & Layout -->
      <div class="control-group">
        <h4>📏 Scale & Layout</h4>
        <div class="scale-controls">
          <label>
            Zoom: <input type="range" min="0.1" max="3" step="0.1" v-model="zoomLevel" @input="updateZoom" />
            {{ zoomLevel.toFixed(1) }}x
          </label>
          <label>
            Node Size: <input type="range" min="0.5" max="2" step="0.1" v-model="nodeSize" @input="updateNodeSize" />
            {{ nodeSize.toFixed(1) }}x
          </label>
          <label>
            Layout:
            <select v-model="layoutType" @change="updateLayout">
              <option value="tree">Tree</option>
              <option value="sphere">Sphere</option>
              <option value="cylinder">Cylinder</option>
              <option value="spiral">Spiral</option>
            </select>
          </label>
        </div>
      </div>

      <!-- Search & Filter -->
      <div class="control-group">
        <h4>🔍 Search & Filter</h4>
        <div class="search-controls">
          <input 
            type="text" 
            v-model="searchQuery" 
            @input="handleSearch"
            placeholder="Search files..."
            class="search-input"
          />
          <select v-model="filterType" @change="applyFilters">
            <option value="all">All Files</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
          </select>
        </div>
      </div>

      <!-- Performance Settings -->
      <div class="control-group">
        <h4>⚡ Performance</h4>
        <div class="performance-controls">
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableLOD" @change="updateLOD" />
            Level of Detail
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="enableFrustumCulling" />
            Frustum Culling
          </label>
          <label>
            Max Nodes: <input type="number" v-model="maxNodes" @change="updateMaxNodes" min="100" max="10000" />
          </label>
        </div>
      </div>

      <!-- Statistics -->
      <div class="control-group">
        <h4>📊 Statistics</h4>
        <div class="stats-display">
          <div class="stat-item">
            <span class="stat-label">Files:</span>
            <span class="stat-value">{{ totalFiles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Directories:</span>
            <span class="stat-value">{{ totalDirectories }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Size:</span>
            <span class="stat-value">{{ formatBytes(totalSize) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rendered:</span>
            <span class="stat-value">{{ renderedNodes }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">FPS:</span>
            <span class="stat-value">{{ fps }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Breadcrumb Navigation -->
    <div class="breadcrumb-nav">
      <div class="breadcrumb-trail">
        <span 
          v-for="(crumb, index) in breadcrumbs" 
          :key="index"
          @click="navigateToBreadcrumb(crumb.path)"
          class="breadcrumb-item"
        >
          {{ crumb.name }}
          <span v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator">/</span>
        </span>
      </div>
    </div>

    <!-- Main 3D Viewport -->
    <div class="viewport-container">
      <div ref="viewport" class="viewport"></div>
      
      <!-- Loading Overlay -->
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>Loading 3D File System...</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
        </div>
      </div>

      <!-- Context Menu -->
      <div 
        v-if="showContextMenu" 
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <div class="context-menu-item" @click="openFile">📂 Open</div>
        <div class="context-menu-item" @click="renameFile">✏️ Rename</div>
        <div class="context-menu-item" @click="deleteFile">🗑️ Delete</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" @click="copyPath">📋 Copy Path</div>
        <div class="context-menu-item" @click="showProperties">ℹ️ Properties</div>
      </div>

      <!-- Search Results Overlay -->
      <div v-if="searchResults.length > 0" class="search-results">
        <h4>Search Results ({{ searchResults.length }})</h4>
        <div class="results-list">
          <div 
            v-for="result in searchResults.slice(0, 10)" 
            :key="result.id"
            @click="focusNode(result)"
            class="result-item"
          >
            📄 {{ result.name }}
          </div>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts Help -->
    <div v-if="showHelp" class="help-overlay">
      <div class="help-content">
        <h3>Keyboard Shortcuts</h3>
        <div class="shortcuts-list">
          <div class="shortcut-item"><kbd>Space</kbd> Toggle Auto-Rotate</div>
          <div class="shortcut-item"><kbd>R</kbd> Reset Camera</div>
          <div class="shortcut-item"><kbd>F</kbd> Search Files</div>
          <div class="shortcut-item"><kbd>Ctrl+A</kbd> Select All</div>
          <div class="shortcut-item"><kbd>Delete</kbd> Delete Selected</div>
          <div class="shortcut-item"><kbd>Escape</kbd> Clear Selection</div>
        </div>
        <button @click="showHelp = false" class="btn btn-primary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

// Types
interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: Date
  children?: FileNode[]
  position?: THREE.Vector3
  mesh?: THREE.Mesh
  label?: THREE.Mesh
  visible?: boolean
  lodLevel?: number
}

interface Breadcrumb {
  name: string
  path: string
}

interface SearchResults {
  id: string
  name: string
  path: string
  node: FileNode
}

// Props
const props = defineProps<{
  rootPath?: string
  maxDepth?: number
  maxNodes?: number
}>()

// Emits
const emit = defineEmits<{
  nodeSelected: [node: FileNode]
  nodeOpened: [node: FileNode]
}>()

// Reactive State
const viewport = ref<HTMLElement>()
const loading = ref(true)
const loadingProgress = ref(0)
const searchQuery = ref('')
const filterType = ref('all')
const searchResults = ref<SearchResults[]>([])
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const showHelp = ref(false)
const selectedNode = ref<FileNode>()
const selectedNodes = ref<Set<FileNode>>(new Set())

// 3D Scene Objects
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let font: THREE.Font
let animationId: number

// Performance & LOD
const enableLOD = ref(true)
const enableFrustumCulling = ref(true)
const fps = ref(60)
let lastTime = performance.now()
let frameCount = 0

// Visual Settings
const autoRotate = ref(false)
const wireframe = ref(false)
const showFileLabels = ref(true)
const showDirectoryLabels = ref(true)
const colorBySize = ref(false)
const colorByType = ref(true)
const showHeatMap = ref(false)
const zoomLevel = ref(1)
const nodeSize = ref(1)
const layoutType = ref('tree')

// Data
const fileSystemData = ref<FileNode>()
const nodeMap = new Map<string, FileNode>()
const totalFiles = ref(0)
const totalDirectories = ref(0)
const totalSize = ref(0)
const renderedNodes = ref(0)
const breadcrumbs = ref<Breadcrumb[]>([])

// Object Pooling
const geometryPool = new Map<string, THREE.BufferGeometry>()
const materialPool = new Map<string, THREE.Material>()
const lodCache = new Map<string, THREE.Mesh[]>()

// Initialize Three.js Scene
const initThreeJS = async () => {
  if (!viewport.value) return

  // Scene Setup
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0a)
  scene.fog = new THREE.Fog(0x0a0a0a, 50, 500)

  // Camera Setup
  camera = new THREE.PerspectiveCamera(
    75,
    viewport.value.clientWidth / viewport.value.clientHeight,
    0.1,
    1000
  )
  camera.position.set(50, 30, 50)

  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  viewport.value.appendChild(renderer.domElement)

  // Controls Setup
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 5
  controls.maxDistance = 200
  controls.autoRotate = autoRotate.value
  controls.autoRotateSpeed = 0.5

  // Enhanced Lighting
  setupEnhancedLighting()

  // Load Font
  await loadFont()

  // Load Data
  await loadFileSystemData()

  // Create Visualization
  await create3DVisualization()

  // Start Animation Loop
  startAnimationLoop()

  loading.value = false
}

// Enhanced Lighting Setup
const setupEnhancedLighting = () => {
  // Ambient Light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)

  // Main Directional Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(50, 100, 50)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 500
  directionalLight.shadow.camera.left = -50
  directionalLight.shadow.camera.right = 50
  directionalLight.shadow.camera.top = 50
  directionalLight.shadow.camera.bottom = -50
  scene.add(directionalLight)

  // Fill Lights
  const fillLight1 = new THREE.DirectionalLight(0x87ceeb, 0.3)
  fillLight1.position.set(-30, 20, -30)
  scene.add(fillLight1)

  const fillLight2 = new THREE.DirectionalLight(0xffa500, 0.2)
  fillLight2.position.set(30, -20, 30)
  scene.add(fillLight2)

  // Point Lights for accent
  const pointLight1 = new THREE.PointLight(0xff69b4, 0.5, 50)
  pointLight1.position.set(0, 50, 0)
  scene.add(pointLight1)
}

// Load Font with Fallback
const loadFont = async () => {
  return new Promise<void>((resolve) => {
    const loader = new FontLoader()
    loader.load(
      'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
      (loadedFont) => {
        font = loadedFont
        resolve()
      },
      undefined,
      () => {
        console.warn('Font loading failed, using fallback')
        // Create fallback font
        font = null
        resolve()
      }
    )
  })
}

// Enhanced Node Size Calculation
const calculateNodeSize = (node: FileNode, baseSize: number): number => {
  const sizeMultiplier = Math.log(node.size + 1) / Math.log(1024)
  const depthMultiplier = node.path.split('/').length / 10
  return baseSize * (0.5 + sizeMultiplier * 0.5) * (1 + depthMultiplier * 0.2)
}

// Enhanced Color Calculation
const getNodeColor = (node: FileNode): THREE.Color => {
  if (showHeatMap.value) {
    // Heat map coloring based on activity
    const activity = getNodeActivity(node)
    return new THREE.Color().setHSL(0.3 - activity * 0.3, 0.8, 0.5)
  }

  if (colorBySize.value) {
    // Color by size (blue to red gradient)
    const sizeRatio = Math.log(node.size + 1) / Math.log(1024 * 1024)
    return new THREE.Color().setHSL(0.6 - sizeRatio * 0.6, 0.8, 0.5)
  }

  if (colorByType.value) {
    // Color by file type
    const extension = node.name.split('.').pop()?.toLowerCase()
    return getFileTypeColor(extension || node.type)
  }

  // Default coloring
  return node.type === 'directory' ? new THREE.Color(0x4a90e2) : new THREE.Color(0x7f8c8d)
}

// Get File Type Color
const getFileTypeColor = (extension: string): THREE.Color => {
  const colorMap: Record<string, string> = {
    'jpg': '#e74c3c', 'jpeg': '#e74c3c', 'png': '#e74c3c', 'gif': '#e74c3c',
    'mp4': '#9b59b6', 'avi': '#9b59b6', 'mov': '#9b59b6',
    'mp3': '#f39c12', 'wav': '#f39c12', 'flac': '#f39c12',
    'pdf': '#e67e22', 'doc': '#3498db', 'docx': '#3498db',
    'txt': '#2ecc71', 'js': '#f1c40f', 'ts': '#f1c40f',
    'py': '#3498db', 'java': '#e74c3c', 'cpp': '#9b59b6'
  }
  
  const color = colorMap[extension] || '#95a5a6'
  return new THREE.Color(color)
}

// Get Node Activity (for heat map)
const getNodeActivity = (node: FileNode): number => {
  // Simulated activity based on file age and size
  const age = Date.now() - node.modified.getTime()
  const ageFactor = Math.max(0, 1 - age / (1000 * 60 * 60 * 24 * 30)) // 30 days
  const sizeFactor = Math.log(node.size + 1) / Math.log(1024 * 1024)
  return (ageFactor * 0.7 + sizeFactor * 0.3)
}

// Create PBR Material
const createPBRMaterial = (node: FileNode): THREE.MeshStandardMaterial => {
  const color = getNodeColor(node)
  return new THREE.MeshStandardMaterial({
    color,
    metalness: node.type === 'directory' ? 0.1 : 0.0,
    roughness: node.type === 'directory' ? 0.8 : 0.9,
    emissive: selectedNodes.value.has(node) ? 0x222222 : 0x000000,
    emissiveIntensity: selectedNodes.value.has(node) ? 0.5 : 0,
    wireframe: wireframe.value
  })
}

// Level of Detail System
const updateLOD = () => {
  if (!enableLOD.value) return

  nodeMap.forEach((node) => {
    if (!node.mesh) return

    const distance = camera.position.distanceTo(node.mesh.position)
    let lodLevel = 0

    if (distance > 100) lodLevel = 2
    else if (distance > 50) lodLevel = 1
    else lodLevel = 0

    if (node.lodLevel !== lodLevel) {
      updateNodeLOD(node, lodLevel)
      node.lodLevel = lodLevel
    }
  })
}

// Update Node LOD
const updateNodeLOD = (node: FileNode, lodLevel: number) => {
  if (!node.mesh) return

  // Update geometry complexity based on LOD
  const geometries = lodCache.get(node.id)
  if (geometries && geometries[lodLevel]) {
    node.mesh.geometry = geometries[lodLevel]
  }
}

// Frustum Culling
const performFrustumCulling = () => {
  if (!enableFrustumCulling.value) return

  const frustum = new THREE.Frustum()
  frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))

  nodeMap.forEach((node) => {
    if (!node.mesh) return

    const wasVisible = node.visible !== false
    node.visible = frustum.intersectsObject(node.mesh)

    if (wasVisible !== node.visible) {
      node.mesh.visible = node.visible
      if (node.label) node.label.visible = node.visible && (showFileLabels.value || showDirectoryLabels.value)
    }
  })
}

// Progressive Loading
const loadFileSystemData = async () => {
  loadingProgress.value = 0
  
  // Simulate progressive loading
  const mockData = generateMockFileSystem()
  fileSystemData.value = mockData
  
  // Update statistics
  updateStatistics(mockData)
  
  // Update breadcrumbs
  updateBreadcrumbs(mockData.path)
  
  loadingProgress.value = 100
}

// Generate Mock File System
const generateMockFileSystem = (): FileNode => {
  const root: FileNode = {
    id: 'root',
    name: 'C:\\',
    path: 'C:\\',
    type: 'directory',
    size: 0,
    modified: new Date(),
    children: []
  }

  // Generate mock structure
  const dirs = ['Documents', 'Downloads', 'Pictures', 'Videos', 'Music', 'Projects']
  const files = ['report.pdf', 'presentation.pptx', 'data.xlsx', 'photo.jpg', 'video.mp4', 'music.mp3']

  dirs.forEach((dirName, dirIndex) => {
    const dir: FileNode = {
      id: `dir-${dirIndex}`,
      name: dirName,
      path: `C:\\${dirName}`,
      type: 'directory',
      size: Math.random() * 1000000,
      modified: new Date(Date.now() - Math.random() * 10000000000),
      children: []
    }

    files.forEach((fileName, fileIndex) => {
      const file: FileNode = {
        id: `file-${dirIndex}-${fileIndex}`,
        name: fileName,
        path: `C:\\${dirName}\\${fileName}`,
        type: 'file',
        size: Math.random() * 10000000,
        modified: new Date(Date.now() - Math.random() * 10000000000)
      }
      dir.children!.push(file)
    })

    root.children!.push(dir)
  })

  return root
}

// Update Statistics
const updateStatistics = (root: FileNode) => {
  let files = 0
  let dirs = 0
  let size = 0

  const traverse = (node: FileNode) => {
    if (node.type === 'file') {
      files++
      size += node.size
    } else {
      dirs++
    }
    if (node.children) {
      node.children.forEach(traverse)
    }
  }

  traverse(root)

  totalFiles.value = files
  totalDirectories.value = dirs
  totalSize.value = size
}

// Update Breadcrumbs
const updateBreadcrumbs = (path: string) => {
  const parts = path.split('\\').filter(p => p)
  const crumbs: Breadcrumb[] = []
  let currentPath = ''

  parts.forEach((part) => {
    currentPath += part + '\\'
    crumbs.push({
      name: part,
      path: currentPath.slice(0, -1)
    })
  })

  breadcrumbs.value = crumbs
}

// Create 3D Visualization
const create3DVisualization = async () => {
  if (!fileSystemData.value) return

  // Clear existing scene objects
  clearScene()

  // Create layout based on selected type
  switch (layoutType.value) {
    case 'tree':
      await createTreeLayout(fileSystemData.value)
      break
    case 'sphere':
      await createSphereLayout(fileSystemData.value)
      break
    case 'cylinder':
      await createCylinderLayout(fileSystemData.value)
      break
    case 'spiral':
      await createSpiralLayout(fileSystemData.value)
      break
  }

  renderedNodes.value = nodeMap.size
}

// Enhanced Tree Layout
const createTreeLayout = async (root: FileNode) => {
  const createNode = (node: FileNode, depth: number = 0, angle: number = 0, radius: number = 0): void => {
    const size = calculateNodeSize(node, nodeSize.value)
    const geometry = node.type === 'directory' 
      ? new THREE.SphereGeometry(size * 1.5, 16, 16)
      : new THREE.BoxGeometry(size, size, size)

    const material = createPBRMaterial(node)
    const mesh = new THREE.Mesh(geometry, material)

    mesh.castShadow = true
    mesh.receiveShadow = true

    // Position with enhanced spacing
    const y = -depth * 4
    const x = radius * Math.cos(angle)
    const z = radius * Math.sin(angle)
    mesh.position.set(x, y, z)

    node.position = mesh.position
    node.mesh = mesh
    node.visible = true
    mesh.userData = { node }

    scene.add(mesh)
    nodeMap.set(node.id, node)

    // Create LOD cache
    if (!lodCache.has(node.id)) {
      const lodGeometries = [
        new THREE.SphereGeometry(size * 1.5, 16, 16), // High detail
        new THREE.SphereGeometry(size * 1.5, 8, 8),   // Medium detail
        new THREE.SphereGeometry(size * 1.5, 4, 4)    // Low detail
      ]
      lodCache.set(node.id, lodGeometries)
    }

    // Create label
    createLabel(node)

    // Process children
    if (node.children && depth < (props.maxDepth || 5)) {
      const childAngleStep = (Math.PI * 2) / node.children.length
      const childRadius = depth === 0 ? 0 : radius + 4

      node.children.forEach((child, index) => {
        const childAngle = angle + (index - node.children!.length / 2) * childAngleStep
        createNode(child, depth + 1, childAngle, childRadius)
      })
    }
  }

  createNode(root)
}

// Create Label with Enhanced Fallback
const createLabel = (node: FileNode) => {
  if (!font) return

  const shouldShow = (node.type === 'directory' && showDirectoryLabels.value) ||
                     (node.type === 'file' && showFileLabels.value)

  if (!shouldShow) return

  try {
    const textGeometry = new TextGeometry(node.name, {
      font,
      size: 0.8,
      height: 0.1,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelOffset: 0,
      bevelSegments: 5
    })

    const textMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      emissive: 0x444444,
      emissiveIntensity: 0.5
    })
    const textMesh = new THREE.Mesh(textGeometry, textMaterial)

    if (node.position) {
      textMesh.position.copy(node.position)
      textMesh.position.y += 2
    }

    node.label = textMesh
    scene.add(textMesh)
  } catch (error) {
    console.warn('Failed to create label for node:', node.name)
  }
}

// Animation Loop with Performance Monitoring
const startAnimationLoop = () => {
  const animate = () => {
    animationId = requestAnimationFrame(animate)

    // Update FPS
    frameCount++
    const currentTime = performance.now()
    if (currentTime >= lastTime + 1000) {
      fps.value = Math.round((frameCount * 1000) / (currentTime - lastTime))
      frameCount = 0
      lastTime = currentTime
    }

    // Update LOD and culling
    updateLOD()
    performFrustumCulling()

    // Update controls
    controls.update()

    // Render scene
    renderer.render(scene, camera)
  }

  animate()
}

// Search Handler
const handleSearch = () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  const query = searchQuery.value.toLowerCase()
  const results: SearchResults[] = []

  nodeMap.forEach((node) => {
    if (node.name.toLowerCase().includes(query)) {
      results.push({
        id: node.id,
        name: node.name,
        path: node.path,
        node
      })
    }
  })

  searchResults.value = results
}

// Apply Filters
const applyFilters = () => {
  nodeMap.forEach((node) => {
    if (!node.mesh) return

    let visible = true

    if (filterType.value !== 'all') {
      const extension = node.name.split('.').pop()?.toLowerCase()
      visible = isFileType(extension, filterType.value)
    }

    node.visible = visible
    node.mesh.visible = visible
  })
}

// Check File Type
const isFileType = (extension: string | undefined, type: string): boolean => {
  if (!extension) return false

  const typeMap: Record<string, string[]> = {
    'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'],
    'document': ['pdf', 'doc', 'docx', 'txt', 'rtf'],
    'video': ['mp4', 'avi', 'mov', 'wmv', 'flv'],
    'audio': ['mp3', 'wav', 'flac', 'aac', 'ogg']
  }

  return typeMap[type]?.includes(extension) || false
}

// Focus on Node
const focusNode = (node: FileNode) => {
  if (!node.position) return

  selectedNode.value = node
  flyToPosition(node.position)
}

// Fly to Position
const flyToPosition = (targetPosition: THREE.Vector3) => {
  const startPosition = camera.position.clone()
  const targetPositionClone = targetPosition.clone()
  targetPositionClone.z += 20 // Offset camera

  const duration = 1000
  const startTime = performance.now()

  const animateCamera = () => {
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeProgress = 1 - Math.pow(1 - progress, 3) // Ease out cubic

    camera.position.lerpVectors(startPosition, targetPositionClone, easeProgress)
    controls.target.lerp(targetPosition, easeProgress)

    if (progress < 1) {
      requestAnimationFrame(animateCamera)
    }
  }

  animateCamera()
}

// Fly to Selected Node
const flyToSelected = () => {
  if (selectedNode.value && selectedNode.value.position) {
    flyToPosition(selectedNode.value.position)
  }
}

// Reset Camera
const resetCamera = () => {
  camera.position.set(50, 30, 50)
  controls.target.set(0, 0, 0)
  controls.update()
}

// Toggle Auto Rotate
const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value
  controls.autoRotate = autoRotate.value
}

// Update Functions
const updateLabels = () => {
  // Recreate all labels
  nodeMap.forEach((node) => {
    if (node.label) {
      scene.remove(node.label)
      node.label = undefined
    }
    createLabel(node)
  })
}

const updateColors = () => {
  nodeMap.forEach((node) => {
    if (node.mesh) {
      const material = createPBRMaterial(node)
      node.mesh.material = material
    }
  })
}

const updateHeatMap = () => {
  updateColors()
}

const updateZoom = () => {
  camera.zoom = zoomLevel.value
  camera.updateProjectionMatrix()
}

const updateNodeSize = () => {
  // Recreate visualization with new node size
  create3DVisualization()
}

const updateLayout = () => {
  create3DVisualization()
}

const updateLOD = () => {
  // LOD is handled in animation loop
}

const updateMaxNodes = () => {
  // Limit nodes if necessary
  if (nodeMap.size > props.maxNodes) {
    // Keep only the most important nodes
    const nodes = Array.from(nodeMap.values())
    const importantNodes = nodes
      .sort((a, b) => b.size - a.size)
      .slice(0, props.maxNodes)

    clearScene()
    importantNodes.forEach(node => {
      if (node.mesh) scene.add(node.mesh)
      if (node.label) scene.add(node.label)
    })
  }
}

// Clear Scene
const clearScene = () => {
  nodeMap.forEach((node) => {
    if (node.mesh) scene.remove(node.mesh)
    if (node.label) scene.remove(node.label)
  })
  nodeMap.clear()
}

// Format Bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Navigate to Breadcrumb
const navigateToBreadcrumb = (path: string) => {
  // Implementation for breadcrumb navigation
  console.log('Navigate to:', path)
}

// Context Menu Handlers
const openFile = () => {
  if (selectedNode.value) {
    emit('nodeOpened', selectedNode.value)
  }
  showContextMenu.value = false
}

const renameFile = () => {
  // Implementation for rename
  showContextMenu.value = false
}

const deleteFile = () => {
  // Implementation for delete
  showContextMenu.value = false
}

const copyPath = () => {
  if (selectedNode.value) {
    navigator.clipboard.writeText(selectedNode.value.path)
  }
  showContextMenu.value = false
}

const showProperties = () => {
  // Implementation for properties dialog
  showContextMenu.value = false
}

// Keyboard Shortcuts
const handleKeyboard = (event: KeyboardEvent) => {
  switch (event.key) {
    case ' ':
      event.preventDefault()
      toggleAutoRotate()
      break
    case 'r':
    case 'R':
      resetCamera()
      break
    case 'f':
    case 'F':
      // Focus search input
      break
    case 'Delete':
      if (selectedNode.value) {
        deleteFile()
      }
      break
    case 'Escape':
      selectedNodes.value.clear()
      break
  }
}

// Resize Handler
const handleResize = () => {
  if (!viewport.value) return

  camera.aspect = viewport.value.clientWidth / viewport.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight)
}

// Mouse Handlers
const handleMouseClick = (event: MouseEvent) => {
  if (!viewport.value) return

  const rect = viewport.value.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  const meshes = Array.from(nodeMap.values())
    .map(node => node.mesh)
    .filter(mesh => mesh && mesh.visible) as THREE.Mesh[]

  const intersects = raycaster.intersectObjects(meshes)

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object
    const clickedNode = clickedMesh.userData.node as FileNode

    selectedNode.value = clickedNode
    emit('nodeSelected', clickedNode)
  }
}

const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()
  
  const rect = viewport.value?.getBoundingClientRect()
  if (!rect) return

  contextMenuPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  showContextMenu.value = true
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  await initThreeJS()

  // Event Listeners
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyboard)
  viewport.value?.addEventListener('click', handleMouseClick)
  viewport.value?.addEventListener('contextmenu', handleRightClick)
})

onUnmounted(() => {
  // Cleanup
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyboard)
  viewport.value?.removeEventListener('click', handleMouseClick)
  viewport.value?.removeEventListener('contextmenu', handleRightClick)

  // Dispose Three.js objects
  if (renderer) {
    renderer.dispose()
  }

  // Clear object pools
  geometryPool.forEach(geometry => geometry.dispose())
  materialPool.forEach(material => material.dispose())
})
</script>

<style scoped>
.filesystem-3d-enhanced {
  display: flex;
  height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.controls-panel {
  width: 320px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-right: 1px solid #333;
  overflow-y: auto;
  padding: 1rem;
}

.control-group {
  margin-bottom: 2rem;
}

.control-group h4 {
  color: #4a90e2;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.control-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #4a90e2, #357abd);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #357abd, #2968a3);
  transform: translateY(-1px);
}

.btn-secondary {
  background: linear-gradient(135deg, #6c757d, #5a6268);
  color: white;
}

.btn-outline {
  background: transparent;
  color: #4a90e2;
  border: 1px solid #4a90e2;
}

.btn-outline:hover {
  background: #4a90e2;
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-options, .performance-controls, .search-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4a90e2;
}

.scale-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.scale-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.scale-controls input[type="range"] {
  width: 100%;
  accent-color: #4a90e2;
}

.scale-controls select {
  padding: 0.5rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: white;
  font-size: 0.85rem;
}

.search-input {
  padding: 0.5rem;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: white;
  font-size: 0.85rem;
}

.search-input::placeholder {
  color: #666;
}

.stats-display {
  display: grid;
  gap: 0.5rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.85rem;
}

.stat-label {
  color: #666;
}

.stat-value {
  color: #4a90e2;
  font-weight: 600;
}

.breadcrumb-nav {
  position: absolute;
  top: 1rem;
  left: 340px;
  right: 1rem;
  background: rgba(26, 26, 46, 0.9);
  backdrop-filter: blur(10px);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #333;
  z-index: 10;
}

.breadcrumb-trail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.breadcrumb-item {
  color: #666;
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover {
  color: #4a90e2;
}

.breadcrumb-separator {
  color: #444;
}

.viewport-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.viewport {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 10, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid #333;
  border-top: 3px solid #4a90e2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progress-bar {
  width: 200px;
  height: 6px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #357abd);
  transition: width 0.3s ease;
}

.context-menu {
  position: absolute;
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 0.5rem 0;
  min-width: 150px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.context-menu-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s ease;
}

.context-menu-item:hover {
  background: rgba(74, 144, 226, 0.2);
}

.context-menu-separator {
  height: 1px;
  background: #333;
  margin: 0.5rem 0;
}

.search-results {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(26, 26, 46, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 10;
}

.search-results h4 {
  margin-bottom: 0.5rem;
  color: #4a90e2;
  font-size: 0.9rem;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s ease;
}

.result-item:hover {
  background: rgba(74, 144, 226, 0.2);
}

.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 10, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.help-content {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  text-align: center;
}

.help-content h3 {
  margin-bottom: 1.5rem;
  color: #4a90e2;
}

.shortcuts-list {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 2rem;
  text-align: left;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

kbd {
  background: #333;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
}

@media (max-width: 1024px) {
  .controls-panel {
    width: 280px;
  }
  
  .breadcrumb-nav {
    left: 300px;
  }
}

@media (max-width: 768px) {
  .filesystem-3d-enhanced {
    flex-direction: column;
  }
  
  .controls-panel {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid #333;
  }
  
  .breadcrumb-nav {
    position: static;
    margin: 1rem;
  }
  
  .control-buttons {
    grid-template-columns: 1fr;
  }
}
</style>

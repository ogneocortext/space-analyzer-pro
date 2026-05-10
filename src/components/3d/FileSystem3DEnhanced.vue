<template>
  <div class="filesystem-3d-enhanced">
    <!-- Enhanced Controls Panel -->
    <div class="controls-panel">
      <!-- Navigation Controls -->
      <div class="control-group">
        <h4>🎮 Navigation</h4>
        <div class="control-buttons">
          <button class="btn btn-primary" @click="resetCamera">🏠 Reset</button>
          <button class="btn btn-secondary" :disabled="!selectedNode" @click="flyToSelected">
            🎯 Focus
          </button>
          <button class="btn btn-outline" @click="toggleAutoRotate">
            🔄 {{ autoRotate ? "Stop" : "Start" }}
          </button>
        </div>
      </div>

      <!-- View Options -->
      <div class="control-group">
        <h4>🔍 View Options</h4>
        <div class="view-options">
          <label class="checkbox-label">
            <input v-model="showFileLabels" type="checkbox" @change="updateLabels" />
            File Labels
          </label>
          <label class="checkbox-label">
            <input v-model="showDirectoryLabels" type="checkbox" @change="updateLabels" />
            Directory Labels
          </label>
          <label class="checkbox-label">
            <input v-model="colorBySize" type="checkbox" @change="updateColors" />
            Color by Size
          </label>
          <label class="checkbox-label">
            <input v-model="colorByType" type="checkbox" @change="updateColors" />
            Color by Type
          </label>
          <label class="checkbox-label">
            <input v-model="showHeatMap" type="checkbox" @change="updateHeatMap" />
            Activity Heat Map
          </label>
        </div>
      </div>

      <!-- Scale & Layout -->
      <div class="control-group">
        <h4>📏 Scale & Layout</h4>
        <div class="scale-controls">
          <label>
            Zoom:
            <input
              v-model="zoomLevel"
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              @input="updateZoom"
            />
            {{ zoomLevel.toFixed(1) }}x
          </label>
          <label>
            Node Size:
            <input
              v-model="nodeSize"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              @input="updateNodeSize"
            />
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
            v-model="searchQuery"
            type="text"
            placeholder="Search files..."
            class="search-input"
            @input="handleSearch"
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
            <input v-model="enableLOD" type="checkbox" @change="updateLOD" />
            Level of Detail
          </label>
          <label class="checkbox-label">
            <input v-model="enableFrustumCulling" type="checkbox" @change="updateFrustumCulling" />
            Frustum Culling
          </label>
          <label>
            Max Nodes:
            <input
              v-model="localMaxNodes"
              type="number"
              min="100"
              max="10000"
              @change="updateMaxNodes"
            />
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
            <span class="stat-label"> Directories: </span>
            <span class="stat-value">
              {{ totalDirectories }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label"> Size: </span>
            <span class="stat-value">
              {{ formatBytes(totalSize) }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label"> Rendered: </span>
            <span class="stat-value">
              {{ renderedNodes }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label"> FPS: </span>
            <span class="stat-value">
              {{ fps }}
            </span>
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
          class="breadcrumb-item"
          @click="navigateToBreadcrumb(crumb.path)"
        >
          {{ crumb.name }}
          <span v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator"> / </span>
        </span>
      </div>
    </div>

    <!-- Main 3D Viewport -->
    <div class="viewport-container">
      <div ref="viewport" class="viewport" />

      <!-- Loading Overlay -->
      <div v-if="loading" class="loading-overlay">
        <div class="loading-spinner" />
        <p>Loading 3D File System...</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: loadingProgress + '%' }" />
        </div>
      </div>
    </div>
  </div>

  <!-- Context Menu -->
  <div
    v-if="showContextMenu"
    class="context-menu"
    :style="{
      left: (contextMenuPosition?.x || 0) + 'px',
      top: (contextMenuPosition?.y || 0) + 'px',
    }"
  >
    <div class="context-menu-item" @click="openFile">📂 Open</div>
    <div class="context-menu-item" @click="renameFile">✏️ Rename</div>
    <div class="context-menu-item" @click="deleteFile">🗑️ Delete</div>
    <div class="context-menu-separator" />
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
        class="result-item"
        @click="focusNode(result)"
      >
        📄 {{ result.name }}
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
      <button class="btn btn-primary" @click="showHelp = false">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";

// Types
interface SearchResult {
  id: string;
  name: string;
  path: string;
  node: ExtendedFileNode;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface ExtendedFileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: Date;
  children?: ExtendedFileNode[];
  position?: THREE.Vector3;
  mesh?: THREE.Mesh;
  label?: THREE.Mesh;
  visible?: boolean;
  lodLevel?: number;
}

interface ThreeSceneObjects {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  font: Font | null;
}

interface PerformanceMetrics {
  fps: number;
  lastTime: number;
  frameCount: number;
}

// Props
const props = withDefaults(
  defineProps<{
    rootPath?: string;
    maxDepth?: number;
    maxNodes?: number;
  }>(),
  {
    rootPath: "/",
    maxDepth: 5,
    maxNodes: 1000,
  }
);

// Emits
const emit = defineEmits<{
  (event: "nodeSelected", node: ExtendedFileNode): void;
  (event: "nodeOpened", node: ExtendedFileNode): void;
}>();

// Reactive State
const viewport = ref<HTMLElement>();
const loading = ref(true);
const loadingProgress = ref(0);
const searchQuery = ref("");
const filterType = ref("all");
const searchResults = ref<SearchResult[]>([]);
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const showHelp = ref(false);
const selectedNode = ref<ExtendedFileNode>();

// 3D Scene Objects
const sceneObjects = ref<ThreeSceneObjects | null>(null);
let animationId: number | null = null;

// Performance & LOD
const enableLOD = ref(true);
const enableFrustumCulling = ref(true);
const fps = ref(60);
const performanceMetrics = ref<PerformanceMetrics>({
  fps: 60,
  lastTime: performance.now(),
  frameCount: 0,
});
const localMaxNodes = ref(props.maxNodes || 1000);

// Visual Settings
const autoRotate = ref(false);
const wireframe = ref(false);
const showFileLabels = ref(true);
const showDirectoryLabels = ref(true);
const colorBySize = ref(false);
const colorByType = ref(true);
const showHeatMap = ref(false);
const zoomLevel = ref(1);
const nodeSize = ref(1);
const layoutType = ref("tree");

// Data
const fileSystemData = ref<ExtendedFileNode>();
const nodeMap = new Map<string, ExtendedFileNode>();
const totalFiles = ref(0);
const totalDirectories = ref(0);
const totalSize = ref(0);
const renderedNodes = ref(0);
const breadcrumbs = ref<Breadcrumb[]>([]);

// Object Pooling
const geometryPool = new Map<string, THREE.BufferGeometry>();
const materialPool = new Map<string, THREE.Material>();
const lodCache = new Map<string, THREE.Mesh[]>();

// Computed Properties
const scene = computed(() => sceneObjects.value?.scene ?? null);
const camera = computed(() => sceneObjects.value?.camera ?? null);
const renderer = computed(() => sceneObjects.value?.renderer ?? null);
const controls = computed(() => sceneObjects.value?.controls ?? null);
const font = computed(() => sceneObjects.value?.font ?? null);

// Initialize Three.js Scene
const initThreeJS = async (): Promise<void> => {
  if (!viewport.value) return;

  try {
    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 50, 500);

    // Camera Setup
    const camera = new THREE.PerspectiveCamera(
      75,
      viewport.value.clientWidth / viewport.value.clientHeight,
      0.1,
      1000
    );
    camera.position.set(50, 30, 50);

    // Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.value.appendChild(renderer.domElement);

    // Controls Setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 200;
    controls.autoRotate = autoRotate.value;
    controls.autoRotateSpeed = 0.5;

    // Store scene objects
    sceneObjects.value = { scene, camera, renderer, controls, font: null };

    // Enhanced Lighting
    setupEnhancedLighting();

    // Load Font
    await loadFont();

    // Load Data
    await loadFileSystemData();

    // Create Visualization
    await create3DVisualization();

    // Start Animation Loop
    startAnimationLoop();

    loading.value = false;
  } catch (error) {
    console.error("Failed to initialize Three.js scene:", error);
    loading.value = false;
  }
};

// Enhanced Lighting Setup
const setupEnhancedLighting = (): void => {
  if (!scene.value) return;

  // Ambient Light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.value.add(ambientLight);

  // Main Directional Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;
  scene.value.add(directionalLight);

  // Fill Lights
  const fillLight1 = new THREE.DirectionalLight(0x87ceeb, 0.3);
  fillLight1.position.set(-30, 20, -30);
  scene.value.add(fillLight1);

  const fillLight2 = new THREE.DirectionalLight(0xffa500, 0.2);
  fillLight2.position.set(30, -20, 30);
  scene.value.add(fillLight2);

  // Point Lights for accent
  const pointLight1 = new THREE.PointLight(0xff69b4, 0.5, 50);
  pointLight1.position.set(0, 50, 0);
  scene.value.add(pointLight1);
};

// Load Font
const loadFont = async (): Promise<void> => {
  return new Promise((resolve) => {
    const loader = new FontLoader();
    loader.load(
      "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
      (loadedFont) => {
        if (sceneObjects.value) {
          sceneObjects.value.font = loadedFont;
        }
        resolve();
      },
      (progress) => {
        console.log("Font loading progress:", progress);
      },
      (error) => {
        console.warn("Failed to load font, using fallback:", error);
        // Continue without font - labels will be disabled
        resolve();
      }
    );
  });
};

// Load File System Data
const loadFileSystemData = async (): Promise<void> => {
  try {
    // Simulate loading file system data
    loadingProgress.value = 30;

    // Mock data - replace with actual file system API call
    const mockData: ExtendedFileNode = {
      id: "root",
      name: "Root",
      path: "/",
      type: "directory",
      size: 0,
      modified: new Date(),
      children: generateMockFileSystem(0, 3), // Limit depth to prevent infinite recursion
    };

    fileSystemData.value = mockData;
    calculateStatistics(mockData);

    loadingProgress.value = 60;
  } catch (error) {
    console.error("Failed to load file system data:", error);
    // Create fallback empty data structure
    fileSystemData.value = {
      id: "root",
      name: "Root",
      path: "/",
      type: "directory",
      size: 0,
      modified: new Date(),
      children: [],
    };
    calculateStatistics(fileSystemData.value);
  }
};

// Generate Mock File System
const generateMockFileSystem = (depth: number = 0, maxDepth: number = 3): ExtendedFileNode[] => {
  if (depth >= maxDepth) return [];

  const mockFiles: ExtendedFileNode[] = [];

  for (let i = 0; i < Math.max(5, 50 - depth * 10); i++) {
    mockFiles.push({
      id: `file-${depth}-${i}`,
      name: `File${depth}-${i}.txt`,
      path: `/File${depth}-${i}.txt`,
      type: "file",
      size: Math.random() * 10000,
      modified: new Date(),
    });
  }

  for (let i = 0; i < Math.max(2, 10 - depth * 2); i++) {
    mockFiles.push({
      id: `dir-${depth}-${i}`,
      name: `Directory${depth}-${i}`,
      path: `/Directory${depth}-${i}`,
      type: "directory",
      size: 0,
      modified: new Date(),
      children: generateMockFileSystem(depth + 1, maxDepth),
    });
  }

  return mockFiles;
};

// Calculate Statistics
const calculateStatistics = (node: ExtendedFileNode): void => {
  let files = 0;
  let directories = 0;
  let size = 0;

  const traverse = (n: ExtendedFileNode) => {
    if (n.type === "file") {
      files++;
      size += n.size;
    } else {
      directories++;
    }

    if (n.children) {
      n.children.forEach(traverse);
    }
  };

  traverse(node);

  totalFiles.value = files;
  totalDirectories.value = directories;
  totalSize.value = size;
};

// Create 3D Visualization
const create3DVisualization = async (): Promise<void> => {
  if (!fileSystemData.value || !scene.value) return;

  clearScene();
  nodeMap.clear();

  switch (layoutType.value) {
    case "tree":
      createTreeLayout(fileSystemData.value);
      break;
    case "sphere":
      createSphereLayout(fileSystemData.value);
      break;
    case "cylinder":
      createCylinderLayout(fileSystemData.value);
      break;
    case "spiral":
      createSpiralLayout(fileSystemData.value);
      break;
  }

  loadingProgress.value = 90;
};

// Create Tree Layout
const createTreeLayout = (root: ExtendedFileNode): void => {
  if (!scene.value) return;

  const createNode = (
    node: ExtendedFileNode,
    depth: number,
    angle: number,
    radius: number
  ): void => {
    if (nodeMap.size >= localMaxNodes.value) return;

    const size = node.type === "directory" ? 2 : 1;
    const geometry = new THREE.SphereGeometry(size * nodeSize.value, 16, 16);
    const material = createPBRMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = -depth * 5;

    mesh.position.set(x, y, z);

    node.position = mesh.position;
    node.mesh = mesh;
    node.visible = true;
    mesh.userData = { node };

    if (scene.value) {
      scene.value.add(mesh);
    }
    nodeMap.set(node.id, node);

    // Create LOD cache
    if (!lodCache.has(node.id)) {
      const lodMaterial = new THREE.MeshBasicMaterial({ color: 0x4444ff });
      const lodMeshes = [
        new THREE.Mesh(new THREE.SphereGeometry(size * 1.5, 16, 16), lodMaterial),
        new THREE.Mesh(new THREE.SphereGeometry(size * 1.5, 8, 8), lodMaterial),
        new THREE.Mesh(new THREE.SphereGeometry(size * 1.5, 4, 4), lodMaterial),
      ];
      lodCache.set(node.id, lodMeshes);
    }

    // Create label
    createLabel(node);

    // Process children
    if (node.children && node.children.length > 0 && depth < (props.maxDepth || 5)) {
      const childAngleStep = (Math.PI * 2) / node.children.length;
      const childRadius = depth === 0 ? 0 : radius + 4;

      if (node.children && node.children.length > 0) {
        node.children.forEach((child, index) => {
          const childAngle = angle + (index - (node.children?.length || 0) / 2) * childAngleStep;
          createNode(child, depth + 1, childAngle, childRadius);
        });
      }
    }
  };

  const flattenNodes = (node: ExtendedFileNode, index: number = 0): void => {
    createNode(node, 0, index, 1);
    if (node.children) {
      (node.children || []).forEach((child) => flattenNodes(child, index + 1));
    }
  };

  flattenNodes(root);
};

// Create Sphere Layout
const createSphereLayout = (root: ExtendedFileNode): void => {
  if (!scene.value) return;

  const createNode = (
    node: ExtendedFileNode,
    depth: number,
    index: number,
    total: number
  ): void => {
    if (nodeMap.size >= localMaxNodes.value) return;

    const size = node.type === "directory" ? 2 : 1;
    const geometry = new THREE.SphereGeometry(size * nodeSize.value, 16, 16);
    const material = createPBRMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    const phi = Math.acos(-1 + (2 * index) / total);
    const theta = Math.sqrt(total * Math.PI) * phi;

    const radius = 20 + depth * 5;
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(theta);

    mesh.position.set(x, y, z);

    node.position = mesh.position;
    node.mesh = mesh;
    node.visible = true;
    mesh.userData = { node };

    if (scene.value) {
      scene.value.add(mesh);
    }
    nodeMap.set(node.id, node);

    // Create label
    createLabel(node);

    // Process children
    if (node.children && node.children.length > 0 && depth < (props.maxDepth || 5)) {
      node.children.forEach((child, childIndex) => {
        createNode(
          child,
          depth + 1,
          index + total + childIndex,
          total + (node.children?.length || 0)
        );
      });
    }
  };

  const flattenNodes = (node: ExtendedFileNode, index: number = 0): void => {
    createNode(node, 0, index, 1);
    if (node.children) {
      (node.children || []).forEach((child) => flattenNodes(child, index + 1));
    }
  };

  flattenNodes(root);
};

// Create Cylinder Layout
const createCylinderLayout = (root: ExtendedFileNode): void => {
  if (!scene.value) return;

  const createNode = (
    node: ExtendedFileNode,
    depth: number,
    angle: number,
    height: number
  ): void => {
    if (nodeMap.size >= localMaxNodes.value) return;

    const size = node.type === "directory" ? 2 : 1;
    const geometry = new THREE.SphereGeometry(size * nodeSize.value, 16, 16);
    const material = createPBRMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    const radius = 10 + depth * 3;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    mesh.position.set(x, height, z);

    node.position = mesh.position;
    node.mesh = mesh;
    node.visible = true;
    mesh.userData = { node };

    if (scene.value) {
      scene.value.add(mesh);
    }
    nodeMap.set(node.id, node);

    // Create label
    createLabel(node);

    // Process children
    if (node.children && depth < (props.maxDepth || 5)) {
      const childAngleStep = (Math.PI * 2) / (node.children.length || 1);
      const childHeight = height - 3;

      (node.children || []).forEach((child, index) => {
        const childAngle = angle + (index - (node.children?.length || 0) / 2) * childAngleStep;
        createNode(child, depth + 1, childAngle, childHeight);
      });
    }
  };

  const processLevel = (nodes: ExtendedFileNode[], height: number): void => {
    const angleStep = (Math.PI * 2) / (nodes.length || 1);
    (nodes || []).forEach((node, index) => {
      createNode(node, 0, index * angleStep, height);
    });
  };

  const processNodes = (node: ExtendedFileNode, height: number = 0): void => {
    if (node.children && node.children.length > 0) {
      processLevel(node.children, height);
      if (node.children) {
        node.children.forEach((child) => processNodes(child, height - 3));
      }
    }
  };

  processNodes(root);
};

// Create Spiral Layout
const createSpiralLayout = (root: ExtendedFileNode): void => {
  if (!scene.value) return;

  const createNode = (node: ExtendedFileNode, depth: number, index: number): void => {
    if (nodeMap.size >= localMaxNodes.value) return;

    const size = node.type === "directory" ? 2 : 1;
    const geometry = new THREE.SphereGeometry(size * nodeSize.value, 16, 16);
    const material = createPBRMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    const spiralRadius = 5 + index * 0.5;
    const spiralHeight = index * 0.3;
    const angle = index * 0.5;

    const x = Math.cos(angle) * spiralRadius;
    const y = spiralHeight;
    const z = Math.sin(angle) * spiralRadius;

    mesh.position.set(x, y, z);

    node.position = mesh.position;
    node.mesh = mesh;
    node.visible = true;
    mesh.userData = { node };

    if (scene.value) {
      scene.value.add(mesh);
    }
    nodeMap.set(node.id, node);

    // Create label
    createLabel(node);

    // Process children
    if (node.children && node.children.length > 0 && depth < (props.maxDepth || 5)) {
      node.children.forEach((child, childIndex) => {
        createNode(child, depth + 1, index + childIndex + 1);
      });
    }
  };

  const flattenNodes = (node: ExtendedFileNode, index: number = 0): void => {
    createNode(node, 0, index);
    if (node.children) {
      (node.children || []).forEach((child) => flattenNodes(child, index + 1));
    }
  };

  flattenNodes(root);
};

// Create PBR Material
const createPBRMaterial = (node: ExtendedFileNode): THREE.Material => {
  let color = 0x4444ff;

  if (colorByType.value) {
    if (node.type === "directory") {
      color = 0xff6b6b;
    } else {
      color = 0x4ecdc4;
    }
  }

  if (colorBySize.value) {
    const hue = (node.size / 10000) * 0.3; // 0 to 0.3 (red to green)
    color = new THREE.Color().setHSL(hue, 0.7, 0.5).getHex();
  }

  if (showHeatMap.value) {
    const time = Date.now() / 1000;
    const intensity = Math.sin(time + node.id.charCodeAt(0)) * 0.5 + 0.5;
    color = new THREE.Color().setHSL(intensity * 0.1, 0.8, 0.5).getHex();
  }

  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.4,
    wireframe: wireframe.value,
  });
};

// Create Label with Enhanced Fallback
const createLabel = (node: ExtendedFileNode): void => {
  if (!scene.value) return;

  // Only create labels if font is loaded
  if (!font.value) {
    console.warn("Font not loaded, skipping label creation for:", node.name);
    return;
  }

  try {
    const textGeometry = new TextGeometry(node.name, {
      font: font.value,
      size: 0.5,
    });

    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    // Position label above the node
    if (node.position) {
      textMesh.position.copy(node.position);
      textMesh.position.y += 2;
    }

    textMesh.visible = node.type === "directory" ? showDirectoryLabels.value : showFileLabels.value;

    node.label = textMesh;
    scene.value.add(textMesh);
  } catch (error) {
    console.warn("Failed to create label for node:", node.name, error);
  }
};

// Animation Loop
const startAnimationLoop = (): void => {
  const animate = (): void => {
    animationId = requestAnimationFrame(animate);

    // Update FPS
    updateFPS();

    // Update controls
    if (controls.value) {
      controls.value.update();
      controls.value.autoRotate = autoRotate.value;
    }

    // Update LOD
    if (enableLOD.value) {
      updateLOD();
    }

    // Frustum Culling
    if (enableFrustumCulling.value) {
      performFrustumCulling();
    }

    // Render
    if (renderer.value && scene.value && camera.value) {
      renderer.value.render(scene.value, camera.value);
    }

    // Update rendered nodes count
    renderedNodes.value = nodeMap.size;
  };

  animate();
};

// Update FPS
const updateFPS = (): void => {
  const currentTime = performance.now();
  const deltaTime = currentTime - performanceMetrics.value.lastTime;

  performanceMetrics.value.frameCount++;

  if (deltaTime >= 1000) {
    fps.value = Math.round((performanceMetrics.value.frameCount * 1000) / deltaTime);
    performanceMetrics.value.frameCount = 0;
    performanceMetrics.value.lastTime = currentTime;
  }
};

// Update LOD
const updateLOD = (): void => {
  if (!camera.value || !enableLOD.value) return;

  nodeMap.forEach((node) => {
    if (!node.mesh || !camera.value) return;

    const distance = camera.value.position.distanceTo(node.mesh.position);
    let lodLevel: number;

    if (distance > 100) lodLevel = 2;
    else if (distance > 50) lodLevel = 1;
    else lodLevel = 0;

    if (node.lodLevel !== lodLevel) {
      updateNodeLOD(node, lodLevel);
      node.lodLevel = lodLevel;
    }
  });
};

// Update Node LOD
const updateNodeLOD = (node: ExtendedFileNode, lodLevel: number): void => {
  if (!node.mesh) return;

  // Update geometry complexity based on LOD
  const lodMeshes = lodCache.get(node.id);
  if (lodMeshes && lodMeshes[lodLevel] && lodMeshes[lodLevel].geometry) {
    node.mesh.geometry = lodMeshes[lodLevel].geometry;
  }
};

// Frustum Culling
const performFrustumCulling = (): void => {
  if (!enableFrustumCulling.value || !camera.value) return;

  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.value.projectionMatrix,
      camera.value.matrixWorldInverse
    )
  );

  nodeMap.forEach((node) => {
    if (!node.mesh) return;

    const wasVisible = node.visible !== false;
    node.visible = frustum.intersectsObject(node.mesh);

    if (wasVisible !== node.visible) {
      node.mesh.visible = node.visible;
      if (node.label) {
        node.label.visible = node.visible && (showFileLabels.value || showDirectoryLabels.value);
      }
    }
  });
};

// Update Functions
const updateLabels = (): void => {
  if (!scene.value) return;

  // Recreate all labels
  nodeMap.forEach((node) => {
    if (node.label) {
      if (scene.value && node.label) {
        scene.value.remove(node.label);
      }
      delete node.label;
    }
    createLabel(node);
  });
};

const updateColors = (): void => {
  nodeMap.forEach((node) => {
    if (node.mesh) {
      const material = createPBRMaterial(node);
      node.mesh.material = material;
    }
  });
};

const updateHeatMap = (): void => {
  updateColors();
};

const updateZoom = (): void => {
  if (camera.value && controls.value) {
    // Store original position if not already stored
    if (!camera.value.userData.originalPosition) {
      camera.value.userData.originalPosition = camera.value.position.clone();
    }

    // Reset to original position then apply zoom
    camera.value.position.copy(camera.value.userData.originalPosition);
    camera.value.position.multiplyScalar(zoomLevel.value);
    controls.value.update();
  }
};

const updateNodeSize = (): void => {
  // Recreate all nodes with new size
  create3DVisualization();
};

const updateLayout = (): void => {
  create3DVisualization();
};

const updateMaxNodes = (): void => {
  create3DVisualization();
};

const updateFrustumCulling = (): void => {
  // Force update all nodes visibility when frustum culling setting changes
  if (!enableFrustumCulling.value) {
    // Make all nodes visible when frustum culling is disabled
    nodeMap.forEach((node) => {
      if (node.mesh) {
        node.mesh.visible = true;
        if (node.label) {
          node.label.visible =
            node.type === "directory" ? showDirectoryLabels.value : showFileLabels.value;
        }
      }
    });
  }
};

// Clear Scene
const clearScene = (): void => {
  if (!scene.value) return;

  nodeMap.forEach((node) => {
    if (node.mesh && scene.value) {
      scene.value.remove(node.mesh);
    }
    if (node.label && scene.value) {
      scene.value.remove(node.label);
    }
  });
  nodeMap.clear();
};

// Format Bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Navigate to Breadcrumb
const navigateToBreadcrumb = (path: string): void => {
  // Implementation for breadcrumb navigation
  console.warn("Navigate to:", path);
};

// Camera Controls
const resetCamera = (): void => {
  if (camera.value && controls.value) {
    camera.value.position.set(50, 30, 50);
    controls.value.target.set(0, 0, 0);
    controls.value.update();
  }
};

const flyToPosition = (targetPosition: THREE.Vector3): void => {
  if (!camera.value || !controls.value || !targetPosition) return;

  const startPosition = camera.value.position.clone();
  const targetPositionClone = targetPosition.clone();
  const duration = 1000;
  const startTime = performance.now();

  const animateCamera = (): void => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

    if (camera.value && camera.value.position) {
      camera.value.position.lerpVectors(startPosition, targetPositionClone, easeProgress);
    }
    if (controls.value && targetPosition) {
      controls.value.target.lerp(targetPosition, easeProgress);
      controls.value.update();
    }

    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    }
  };

  animateCamera();
};

// Fly to Selected Node
const flyToSelected = (): void => {
  if (selectedNode.value && selectedNode.value.position) {
    flyToPosition(selectedNode.value.position);
  }
};

// Toggle Auto Rotate
const toggleAutoRotate = (): void => {
  autoRotate.value = !autoRotate.value;
};

// Search and Filter
const handleSearch = (): void => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  const results: SearchResult[] = [];
  const query = searchQuery.value.toLowerCase();

  nodeMap.forEach((node) => {
    if (node.name.toLowerCase().includes(query)) {
      results.push({
        id: node.id,
        name: node.name,
        path: node.path,
        node,
      });
    }
  });

  searchResults.value = results;
};

const applyFilters = (): void => {
  // Implementation for filtering
  console.warn("Apply filter:", filterType.value);
};

const focusNode = (result: SearchResult): void => {
  if (result.node.position) {
    flyToPosition(result.node.position);
    selectedNode.value = result.node;
    emit("nodeSelected", result.node);
  }
};

// Context Menu Actions
const openFile = (): void => {
  if (selectedNode.value) {
    emit("nodeOpened", selectedNode.value);
  }
  showContextMenu.value = false;
};

const renameFile = (): void => {
  // Implementation for renaming
  console.warn("Rename file:", selectedNode.value?.name);
  showContextMenu.value = false;
};

const deleteFile = (): void => {
  // Implementation for deleting
  console.warn("Delete file:", selectedNode.value?.name);
  showContextMenu.value = false;
};

const copyPath = (): void => {
  if (selectedNode.value) {
    navigator.clipboard.writeText(selectedNode.value.path);
  }
  showContextMenu.value = false;
};

const showProperties = (): void => {
  // Implementation for showing properties
  console.warn("Show properties:", selectedNode.value?.name);
  showContextMenu.value = false;
};

// Event Handlers
const handleClick = (event: MouseEvent): void => {
  if (!camera.value || !renderer.value || !scene.value) return;

  try {
    const rect = renderer.value.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera.value);

    const meshes = Array.from(nodeMap.values())
      .map((node) => node.mesh)
      .filter((mesh): mesh is THREE.Mesh => mesh !== undefined && mesh.visible);

    const intersects = raycaster.intersectObjects(meshes);

    if (intersects && intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const clickedNode = clickedMesh.userData?.node as ExtendedFileNode;

      if (clickedNode) {
        selectedNode.value = clickedNode;
        emit("nodeSelected", clickedNode);
      }
    }
  } catch (error) {
    console.warn("Error handling click:", error);
  }
};

const handleRightClick = (event: MouseEvent): void => {
  event.preventDefault();

  const rect = viewport.value?.getBoundingClientRect();
  if (!rect) return;

  contextMenuPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  showContextMenu.value = true;
};

const handleKeyDown = (event: KeyboardEvent): void => {
  switch (event.key) {
    case " ":
      event.preventDefault();
      toggleAutoRotate();
      break;
    case "r":
    case "R":
      resetCamera();
      break;
    case "f":
    case "F":
      // Focus search input
      {
        const searchInput = document.querySelector(".search-input") as HTMLInputElement | null;
        searchInput?.focus();
      }
      break;
    case "Escape":
      showContextMenu.value = false;
      showHelp.value = false;
      break;
  }
};

const handleResize = (): void => {
  if (!camera.value || !renderer.value || !viewport.value) return;

  camera.value.aspect = viewport.value.clientWidth / viewport.value.clientHeight;
  camera.value.updateProjectionMatrix();
  renderer.value.setSize(viewport.value.clientWidth, viewport.value.clientHeight);
};

// Lifecycle
onMounted(async () => {
  await nextTick();
  await initThreeJS();

  // Event listeners
  window.addEventListener("resize", handleResize);
  window.addEventListener("keydown", handleKeyDown);

  if (renderer.value) {
    renderer.value.domElement.addEventListener("click", handleClick);
    renderer.value.domElement.addEventListener("contextmenu", handleRightClick);
  }
});

onUnmounted(() => {
  // Clean up animation
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  // Clean up Three.js resources
  if (scene.value) {
    scene.value.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });
  }

  if (renderer.value) {
    renderer.value.dispose();
  }

  // Clean up event listeners
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("keydown", handleKeyDown);

  if (renderer.value) {
    renderer.value.domElement.removeEventListener("click", handleClick);
    renderer.value.domElement.removeEventListener("contextmenu", handleRightClick);
  }

  // Clean up object pools
  geometryPool.forEach((geometry) => geometry.dispose());
  materialPool.forEach((material) => material.dispose());
  lodCache.clear();
});
</script>

<style scoped>
.filesystem-3d-enhanced {
  display: flex;
  height: 100vh;
  background: #0a0a0a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.controls-panel {
  width: 320px;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  padding: 20px;
}

.control-group {
  margin-bottom: 30px;
}

.control-group h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  font-weight: 600;
  color: #87ceeb;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: #4ecdc4;
  color: #0a0a0a;
}

.btn-primary:hover {
  background: #45b7b8;
}

.btn-secondary {
  background: #ff6b6b;
  color: #ffffff;
}

.btn-secondary:hover {
  background: #ff5252;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.1);
}

.view-options,
.scale-controls,
.search-controls,
.performance-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4ecdc4;
}

label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cccccc;
}

input[type="range"] {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4ecdc4;
  border-radius: 50%;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4ecdc4;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

input[type="text"],
input[type="number"],
select {
  width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #ffffff;
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
}

input[type="text"]:focus,
input[type="number"]:focus,
select:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: #4ecdc4;
}

select {
  cursor: pointer;
}

.stats-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #888888;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #4ecdc4;
}

.viewport-container {
  flex: 1;
  position: relative;
  background: #0a0a0a;
}

.viewport {
  width: 100%;
  height: 100%;
}

.breadcrumb-nav {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(20, 20, 20, 0.9);
  backdrop-filter: blur(10px);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
}

.breadcrumb-trail {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.breadcrumb-item {
  color: #87ceeb;
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover {
  color: #4ecdc4;
}

.breadcrumb-separator {
  color: #666666;
  user-select: none;
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
  gap: 20px;
  z-index: 100;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid #4ecdc4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4, #45b7b8);
  transition: width 0.3s ease;
}

.context-menu {
  position: absolute;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 0;
  min-width: 150px;
  z-index: 1000;
}

.context-menu-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #ffffff;
  transition: background-color 0.2s ease;
}

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 0;
}

.search-results {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  min-width: 200px;
  max-width: 300px;
  z-index: 10;
}

.search-results h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #87ceeb;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #cccccc;
  transition: all 0.2s ease;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.help-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 10, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-content {
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.help-content h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #87ceeb;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #cccccc;
}

kbd {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  color: #4ecdc4;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Responsive Design */
@media (max-width: 768px) {
  .filesystem-3d-enhanced {
    flex-direction: column;
  }

  .controls-panel {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow-x: hidden;
  }

  .breadcrumb-nav {
    top: 220px;
    left: 10px;
    right: 10px;
  }

  .viewport-container {
    height: calc(100vh - 220px);
  }

  .control-buttons {
    flex-direction: column;
    gap: 4px;
  }

  .btn {
    font-size: 11px;
    padding: 6px 12px;
  }
}

@media (max-width: 480px) {
  .controls-panel {
    height: 250px;
    padding: 10px;
  }

  .breadcrumb-nav {
    top: 270px;
  }

  .viewport-container {
    height: calc(100vh - 270px);
  }

  .control-group h4 {
    font-size: 12px;
  }

  .checkbox-label {
    font-size: 11px;
  }

  label {
    font-size: 11px;
  }
}
</style>

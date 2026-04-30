<template>
  <div class="filesystem-3d">
    <div class="controls-panel">
      <div class="control-group">
        <h4>🎮 Navigation Controls</h4>
        <div class="control-buttons">
          <button @click="resetCamera" class="btn btn-primary">🏠 Reset View</button>
          <button @click="toggleAutoRotate" class="btn btn-secondary">
            🔄 {{ autoRotate ? "Stop" : "Start" }} Auto-Rotate
          </button>
          <button @click="toggleWireframe" class="btn btn-outline">
            📐 {{ wireframe ? "Solid" : "Wireframe" }}
          </button>
        </div>
      </div>

      <div class="control-group">
        <h4>🔍 View Options</h4>
        <div class="view-options">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showFileLabels" @change="updateLabels" />
            Show File Labels
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="showDirectoryLabels" @change="updateLabels" />
            Show Directory Labels
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="colorBySize" @change="updateColors" />
            Color by Size
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="colorByType" @change="updateColors" />
            Color by Type
          </label>
        </div>
      </div>

      <div class="control-group">
        <h4>📏 Scale & Layout</h4>
        <div class="scale-controls">
          <label>
            Zoom Level:
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              v-model="zoomLevel"
              @input="updateZoom"
            />
            {{ zoomLevel.toFixed(1) }}x
          </label>
          <label>
            Node Size:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              v-model="nodeSize"
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

      <div class="control-group">
        <h4>📊 Statistics</h4>
        <div class="stats-display">
          <div class="stat-item">
            <span class="stat-label">Total Files:</span>
            <span class="stat-value">{{ totalFiles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Directories:</span>
            <span class="stat-value">{{ totalDirectories }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Size:</span>
            <span class="stat-value">{{ formatBytes(totalSize) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rendered Nodes:</span>
            <span class="stat-value">{{ renderedNodes }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="viewport-container">
      <div ref="viewport" class="viewport" @contextmenu.prevent>
        <canvas ref="canvas"></canvas>
        <div class="viewport-overlay">
          <div class="info-panel" v-if="selectedNode">
            <h5>{{ selectedNode.name }}</h5>
            <p>Type: {{ selectedNode.type }}</p>
            <p>Size: {{ formatBytes(selectedNode.size) }}</p>
            <p>Path: {{ selectedNode.path }}</p>
            <div class="node-actions">
              <button @click="openNode" class="btn btn-sm btn-primary">Open</button>
              <button @click="focusNode" class="btn btn-sm btn-secondary">Focus</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading 3D File System...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

interface FileNode {
  id: string;
  name: string;
  type: "file" | "directory";
  size: number;
  path: string;
  children?: FileNode[];
  parent?: FileNode;
  position?: THREE.Vector3;
  mesh?: THREE.Mesh;
  label?: THREE.Mesh;
}

const props = defineProps<{
  rootPath: string;
  maxDepth?: number;
  maxNodes?: number;
}>();

const emit = defineEmits<{
  nodeSelected: [node: FileNode];
  nodeOpened: [node: FileNode];
}>();

// Reactive state
const loading = ref(true);
const autoRotate = ref(false);
const wireframe = ref(false);
const showFileLabels = ref(true);
const showDirectoryLabels = ref(true);
const colorBySize = ref(true);
const colorByType = ref(false);
const zoomLevel = ref(1);
const nodeSize = ref(1);
const layoutType = ref("tree");
const selectedNode = ref<FileNode | null>(null);

// Three.js objects
const viewport = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let font: THREE.Font;

// Statistics
const totalFiles = ref(0);
const totalDirectories = ref(0);
const totalSize = ref(0);
const renderedNodes = ref(0);

// File system data
const fileSystemData = ref<FileNode | null>(null);
const nodeMap = new Map<string, FileNode>();

// Animation
let animationId: number;

onMounted(async () => {
  await initThreeJS();
  await loadFileSystemData();
  await create3DVisualization();
  startAnimationLoop();
  loading.value = false;
});

onUnmounted(() => {
  cleanup();
});

const initThreeJS = async () => {
  if (!canvas.value || !viewport.value) return;

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 10, 100);

  // Camera setup
  const aspect = viewport.value.clientWidth / viewport.value.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(0, 10, 20);

  // Renderer setup
  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(viewport.value.clientWidth, viewport.value.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Controls setup
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);

  // Load font for labels with fallback
  const fontLoader = new FontLoader();
  try {
    font = await new Promise((resolve, reject) => {
      fontLoader.load(
        "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json",
        resolve,
        undefined,
        reject
      );
    });
  } catch (error) {
    console.warn("Failed to load font, using fallback:", error);
    // Create a simple fallback font
    font = null; // We'll handle null font in createLabel
  }

  // Handle window resize
  window.addEventListener("resize", handleResize);

  // Handle mouse events
  canvas.value.addEventListener("click", handleMouseClick);
  canvas.value.addEventListener("mousemove", handleMouseMove);
};

const loadFileSystemData = async () => {
  try {
    // This would typically call an API to get file system data
    // For now, we'll create mock data
    fileSystemData.value = await generateMockFileSystem();
    calculateStatistics(fileSystemData.value);
  } catch (error) {
    console.error("Failed to load file system data:", error);
  }
};

const generateMockFileSystem = async (): Promise<FileNode> => {
  // Generate a realistic mock file system structure
  const generateNode = (name: string, type: "file" | "directory", depth: number): FileNode => {
    const node: FileNode = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      size: type === "file" ? Math.random() * 1000000 : 0,
      path: name,
      children: type === "directory" ? [] : undefined,
    };

    if (type === "directory" && depth < 3) {
      const childCount = Math.floor(Math.random() * 10) + 1;
      for (let i = 0; i < childCount; i++) {
        const childType = Math.random() > 0.3 ? "file" : "directory";
        const childName =
          childType === "file"
            ? `file${i}.${["txt", "js", "json", "md", "jpg", "png"][Math.floor(Math.random() * 6)]}`
            : `dir${i}`;
        const child = generateNode(childName, childType, depth + 1);
        child.path = `${node.path}/${childName}`;
        child.parent = node;
        node.children!.push(child);
        if (childType === "directory") {
          node.size += child.size;
        } else {
          node.size += child.size;
        }
      }
    }

    return node;
  };

  return generateNode("root", "directory", 0);
};

const calculateStatistics = (node: FileNode) => {
  let files = 0;
  let dirs = 0;
  let size = 0;

  const traverse = (n: FileNode) => {
    if (n.type === "file") {
      files++;
      size += n.size;
    } else {
      dirs++;
    }
    if (n.children) {
      n.children.forEach(traverse);
    }
  };

  traverse(node);
  totalFiles.value = files;
  totalDirectories.value = dirs;
  totalSize.value = size;
};

const create3DVisualization = async () => {
  if (!fileSystemData.value) return;

  // Clear existing meshes
  while (scene.children.length > 0) {
    const child = scene.children[0];
    if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
      scene.remove(child);
    } else {
      break;
    }
  }

  nodeMap.clear();

  // Create 3D representation based on layout type
  switch (layoutType.value) {
    case "tree":
      await createTreeLayout(fileSystemData.value);
      break;
    case "sphere":
      await createSphereLayout(fileSystemData.value);
      break;
    case "cylinder":
      await createCylinderLayout(fileSystemData.value);
      break;
    case "spiral":
      await createSpiralLayout(fileSystemData.value);
      break;
  }

  renderedNodes.value = nodeMap.size;
};

const createTreeLayout = async (
  root: FileNode,
  depth: number = 0,
  angle: number = 0,
  radius: number = 0
) => {
  if (depth > (props.maxDepth || 3)) return;

  // Create node mesh
  const geometry =
    root.type === "directory"
      ? new THREE.SphereGeometry(nodeSize.value * (root.type === "directory" ? 1.5 : 1), 16, 16)
      : new THREE.BoxGeometry(nodeSize.value, nodeSize.value, nodeSize.value);

  const material = new THREE.MeshPhongMaterial({
    color: getNodeColor(root),
    wireframe: wireframe.value,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Position node
  const y = -depth * 3;
  const x = radius * Math.cos(angle);
  const z = radius * Math.sin(angle);
  mesh.position.set(x, y, z);

  root.position = mesh.position;
  root.mesh = mesh;
  mesh.userData = { node: root };

  scene.add(mesh);
  nodeMap.set(root.id, root);

  // Create label
  if (
    (root.type === "directory" && showDirectoryLabels.value) ||
    (root.type === "file" && showFileLabels.value)
  ) {
    const label = createLabel(root.name);
    label.position.copy(mesh.position);
    label.position.y += 1.5;
    root.label = label;
    scene.add(label);
  }

  // Process children
  if (root.children) {
    const childAngleStep = (Math.PI * 2) / root.children.length;
    const childRadius = depth === 0 ? 0 : radius + 3;

    root.children.forEach((child, index) => {
      const childAngle = angle + (index - root.children!.length / 2) * childAngleStep;
      createTreeLayout(child, depth + 1, childAngle, childRadius);
    });
  }
};

const createSphereLayout = async (root: FileNode) => {
  // Implement sphere layout algorithm
  const nodes = flattenFileSystem(root);
  const sphereRadius = Math.max(10, nodes.length * 0.5);

  nodes.forEach((node, index) => {
    const geometry =
      node.type === "directory"
        ? new THREE.SphereGeometry(nodeSize.value * (node.type === "directory" ? 1.5 : 1), 16, 16)
        : new THREE.BoxGeometry(nodeSize.value, nodeSize.value, nodeSize.value);

    const material = new THREE.MeshPhongMaterial({
      color: getNodeColor(node),
      wireframe: wireframe.value,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position on sphere surface
    const phi = Math.acos(1 - (2 * index) / nodes.length);
    const theta = Math.sqrt(nodes.length * Math.PI) * phi;

    mesh.position.set(
      sphereRadius * Math.cos(theta) * Math.sin(phi),
      sphereRadius * Math.cos(phi),
      sphereRadius * Math.sin(theta) * Math.sin(phi)
    );

    node.position = mesh.position;
    node.mesh = mesh;
    mesh.userData = { node: node };

    scene.add(mesh);
    nodeMap.set(node.id, node);

    // Create label
    if (
      (node.type === "directory" && showDirectoryLabels.value) ||
      (node.type === "file" && showFileLabels.value)
    ) {
      const label = createLabel(node.name);
      label.position.copy(mesh.position);
      label.position.y += 1.5;
      node.label = label;
      scene.add(label);
    }
  });
};

const createCylinderLayout = async (root: FileNode) => {
  // Implement cylinder layout algorithm
  const nodes = flattenFileSystem(root);
  const levels = groupByDepth(root);
  const cylinderHeight = levels.length * 3;
  const cylinderRadius = Math.max(5, nodes.length * 0.1);

  levels.forEach((levelNodes, depth) => {
    const angleStep = (Math.PI * 2) / levelNodes.length;
    const y = -depth * 3;

    levelNodes.forEach((node, index) => {
      const geometry =
        node.type === "directory"
          ? new THREE.SphereGeometry(nodeSize.value * (node.type === "directory" ? 1.5 : 1), 16, 16)
          : new THREE.BoxGeometry(nodeSize.value, nodeSize.value, nodeSize.value);

      const material = new THREE.MeshPhongMaterial({
        color: getNodeColor(node),
        wireframe: wireframe.value,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const angle = index * angleStep;
      mesh.position.set(cylinderRadius * Math.cos(angle), y, cylinderRadius * Math.sin(angle));

      node.position = mesh.position;
      node.mesh = mesh;
      mesh.userData = { node: node };

      scene.add(mesh);
      nodeMap.set(node.id, node);

      // Create label
      if (
        (node.type === "directory" && showDirectoryLabels.value) ||
        (node.type === "file" && showFileLabels.value)
      ) {
        const label = createLabel(node.name);
        label.position.copy(mesh.position);
        label.position.y += 1.5;
        node.label = label;
        scene.add(label);
      }
    });
  });
};

const createSpiralLayout = async (root: FileNode) => {
  // Implement spiral layout algorithm
  const nodes = flattenFileSystem(root);

  nodes.forEach((node, index) => {
    const geometry =
      node.type === "directory"
        ? new THREE.SphereGeometry(nodeSize.value * (node.type === "directory" ? 1.5 : 1), 16, 16)
        : new THREE.BoxGeometry(nodeSize.value, nodeSize.value, nodeSize.value);

    const material = new THREE.MeshPhongMaterial({
      color: getNodeColor(node),
      wireframe: wireframe.value,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Spiral positioning
    const t = index / nodes.length;
    const angle = t * Math.PI * 8;
    const radius = t * 15;
    const height = t * 20 - 10;

    mesh.position.set(radius * Math.cos(angle), height, radius * Math.sin(angle));

    node.position = mesh.position;
    node.mesh = mesh;
    mesh.userData = { node: node };

    scene.add(mesh);
    nodeMap.set(node.id, node);

    // Create label
    if (
      (node.type === "directory" && showDirectoryLabels.value) ||
      (node.type === "file" && showFileLabels.value)
    ) {
      const label = createLabel(node.name);
      label.position.copy(mesh.position);
      label.position.y += 1.5;
      node.label = label;
      scene.add(label);
    }
  });
};

const flattenFileSystem = (node: FileNode): FileNode[] => {
  const nodes: FileNode[] = [];

  const traverse = (n: FileNode) => {
    nodes.push(n);
    if (n.children) {
      n.children.forEach(traverse);
    }
  };

  traverse(node);
  return nodes;
};

const groupByDepth = (root: FileNode): FileNode[][] => {
  const levels: FileNode[][] = [];

  const traverse = (node: FileNode, depth: number) => {
    if (!levels[depth]) {
      levels[depth] = [];
    }
    levels[depth].push(node);

    if (node.children) {
      node.children.forEach((child) => traverse(child, depth + 1));
    }
  };

  traverse(root, 0);
  return levels;
};

const getNodeColor = (node: FileNode): number => {
  if (colorBySize.value) {
    // Color based on size (blue to red gradient)
    const maxSize = Math.max(...Array.from(nodeMap.values()).map((n) => n.size));
    const ratio = node.size / maxSize;
    return new THREE.Color().setHSL(0.7 - ratio * 0.7, 1, 0.5).getHex();
  }

  if (colorByType.value) {
    // Color based on file type
    if (node.type === "directory") {
      return 0x4a90e2;
    }

    const extension = node.name.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "js":
      case "ts":
        return 0xf7df1e;
      case "json":
        return 0x000000;
      case "md":
        return 0x083fa1;
      case "jpg":
      case "png":
      case "gif":
        return 0xe91e63;
      case "txt":
        return 0x9e9e9e;
      default:
        return 0x757575;
    }
  }

  // Default colors
  return node.type === "directory" ? 0x4a90e2 : 0x757575;
};

const createLabel = (text: string): THREE.Mesh => {
  let textGeometry: THREE.BufferGeometry;

  if (font) {
    textGeometry = new TextGeometry(text, {
      font: font,
      size: 0.5,
      height: 0.1,
    });
  } else {
    // Fallback: create a simple plane geometry for labels when font fails to load
    textGeometry = new THREE.PlaneGeometry(text.length * 0.3, 0.5);
  }

  const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);

  // Center the text
  if (font) {
    textGeometry.computeBoundingBox();
    if (textGeometry.boundingBox) {
      const centerOffsetX =
        -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x);
      textMesh.position.x = centerOffsetX;
    }
  }

  return textMesh;
};

const handleMouseClick = (event: MouseEvent) => {
  if (!canvas.value || !camera) return;

  const rect = canvas.value.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const meshes = Array.from(nodeMap.values())
    .map((n) => n.mesh)
    .filter(Boolean) as THREE.Mesh[];
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object as THREE.Mesh;
    const node = clickedMesh.userData.node as FileNode;
    selectNode(node);
  } else {
    selectNode(null);
  }
};

const handleMouseMove = (event: MouseEvent) => {
  if (!canvas.value || !camera) return;

  const rect = canvas.value.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const meshes = Array.from(nodeMap.values())
    .map((n) => n.mesh)
    .filter(Boolean) as THREE.Mesh[];
  const intersects = raycaster.intersectObjects(meshes);

  // Update cursor style
  canvas.value.style.cursor = intersects.length > 0 ? "pointer" : "default";
};

const selectNode = (node: FileNode | null) => {
  selectedNode.value = node;
  emit("nodeSelected", node);

  // Highlight selected node
  Array.from(nodeMap.values()).forEach((n) => {
    if (n.mesh) {
      const material = n.mesh.material as THREE.MeshPhongMaterial;
      material.emissive = n === node ? new THREE.Color(0x444444) : new THREE.Color(0x000000);
    }
  });
};

const openNode = () => {
  if (selectedNode.value) {
    emit("nodeOpened", selectedNode.value);
  }
};

const focusNode = () => {
  if (selectedNode.value && selectedNode.value.position) {
    // Animate camera to focus on node
    const targetPosition = selectedNode.value.position.clone();
    targetPosition.z += 5;

    // Smooth camera transition
    const startPosition = camera.position.clone();
    const startTime = Date.now();
    const duration = 1000;

    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      controls.target.copy(selectedNode.value!.position);
      controls.update();

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };

    animateCamera();
  }
};

const resetCamera = () => {
  camera.position.set(0, 10, 20);
  controls.target.set(0, 0, 0);
  controls.update();
};

const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value;
  controls.autoRotate = autoRotate.value;
};

const toggleWireframe = () => {
  wireframe.value = !wireframe.value;
  updateMaterials();
};

const updateLabels = () => {
  Array.from(nodeMap.values()).forEach((node) => {
    if (node.label) {
      node.label.visible =
        (node.type === "directory" && showDirectoryLabels.value) ||
        (node.type === "file" && showFileLabels.value);
    }
  });
};

const updateColors = () => {
  updateMaterials();
};

const updateMaterials = () => {
  Array.from(nodeMap.values()).forEach((node) => {
    if (node.mesh) {
      const material = node.mesh.material as THREE.MeshPhongMaterial;
      material.color.setHex(getNodeColor(node));
      material.wireframe = wireframe.value;
    }
  });
};

const updateZoom = () => {
  camera.zoom = zoomLevel.value;
  camera.updateProjectionMatrix();
};

const updateNodeSize = () => {
  // Recreate visualization with new node size
  create3DVisualization();
};

const updateLayout = () => {
  // Recreate visualization with new layout
  create3DVisualization();
};

const handleResize = () => {
  if (!viewport.value || !camera || !renderer) return;

  const width = viewport.value.clientWidth;
  const height = viewport.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};

const startAnimationLoop = () => {
  const animate = () => {
    animationId = requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
  };

  animate();
};

const cleanup = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  window.removeEventListener("resize", handleResize);

  if (renderer) {
    renderer.dispose();
  }

  if (controls) {
    controls.dispose();
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Watch for prop changes
watch(
  () => props.rootPath,
  () => {
    loadFileSystemData();
    create3DVisualization();
  }
);
</script>

<style scoped>
.filesystem-3d {
  display: flex;
  height: 100vh;
  background: #0a0a0a;
  color: white;
}

.controls-panel {
  width: 320px;
  background: #1a1a1a;
  padding: 1rem;
  overflow-y: auto;
  border-right: 1px solid #333;
}

.control-group {
  margin-bottom: 2rem;
}

.control-group h4 {
  margin: 0 0 1rem 0;
  color: #4a90e2;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.view-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-label input[type="checkbox"] {
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
  gap: 0.25rem;
  font-size: 0.875rem;
}

.scale-controls input[type="range"] {
  accent-color: #4a90e2;
}

.scale-controls select {
  background: #2a2a2a;
  color: white;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.25rem;
}

.stats-display {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.stat-label {
  color: #888;
}

.stat-value {
  color: #4a90e2;
  font-weight: 600;
}

.viewport-container {
  flex: 1;
  position: relative;
}

.viewport {
  width: 100%;
  height: 100%;
  position: relative;
}

.viewport canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.viewport-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.info-panel {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(26, 26, 26, 0.95);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 1rem;
  min-width: 200px;
  pointer-events: auto;
  backdrop-filter: blur(10px);
}

.info-panel h5 {
  margin: 0 0 0.5rem 0;
  color: #4a90e2;
  font-size: 1rem;
}

.info-panel p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #ccc;
}

.node-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  text-align: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid #333;
  border-top: 3px solid #4a90e2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  background: #4a90e2;
  color: white;
}

.btn:hover {
  background: #357abd;
}

.btn-secondary {
  background: #666;
}

.btn-secondary:hover {
  background: #555;
}

.btn-outline {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
}

.btn-outline:hover {
  background: #333;
  border-color: #4a90e2;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}
</style>

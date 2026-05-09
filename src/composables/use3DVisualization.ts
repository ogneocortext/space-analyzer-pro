import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import * as THREE from "three";

export interface Visualization3DConfig {
  mode: "tree" | "sphere" | "grid" | "force";
  colorMode: "size" | "type" | "date" | "category";
  animationSpeed: number;
}

export interface Visualization3DStats {
  fileCount: number;
  mode: string;
  isRotating: boolean;
  fps: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
}

export interface FileNode {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  children?: FileNode[];
  color?: string;
  position?: THREE.Vector3;
  mesh?: THREE.Mesh;
}

export function use3DVisualization() {
  // State
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const config = ref<Visualization3DConfig>({
    mode: "tree",
    colorMode: "size",
    animationSpeed: 50,
  });
  const isRotating = ref(false);
  const currentFPS = ref(0);
  const isLoading = ref(false);
  const selectedFile = ref<FileNode | null>(null);

  // Three.js objects
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let controls: any = null; // OrbitControls
  let raycaster: THREE.Raycaster | null = null;
  let mouse: THREE.Vector2 = new THREE.Vector2();

  // Animation
  let animationId: number | null = null;
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsUpdateTime = 0;

  // Performance monitoring
  const drawCalls = ref(0);
  const triangles = ref(0);
  const memoryUsage = ref(0);

  // Computed
  const stats = computed<Visualization3DStats>(() => ({
    fileCount: 0, // Will be updated by parent
    mode: config.value.mode,
    isRotating: isRotating.value,
    fps: currentFPS.value,
    drawCalls: drawCalls.value,
    triangles: triangles.value,
    memoryUsage: memoryUsage.value,
  }));

  // Initialize Three.js scene
  const initializeScene = () => {
    if (!canvasRef.value) return;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.Fog(0x0a0a0a, 10, 100);

    // Camera setup
    const aspect = canvasRef.value.clientWidth / canvasRef.value.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // Raycaster for mouse interaction
    raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.1;

    console.log("Three.js scene initialized");
  };

  // Create file visualization mesh
  const createFileMesh = (file: FileNode): THREE.Mesh => {
    const size = Math.max(0.5, Math.min(2, Math.log(file.size + 1) * 0.3));
    const geometry = new THREE.BoxGeometry(size, size, size);

    // Color based on configuration
    let color = 0x4a90e2; // Default blue
    if (config.value.colorMode === "size") {
      const hue = Math.max(0, Math.min(120, 120 - size * 30));
      color = new THREE.Color(`hsl(${hue}, 70%, 50%)`).getHex();
    } else if (config.value.colorMode === "type") {
      const typeColors: Record<string, number> = {
        js: 0xf7df1e,
        ts: 0x3178c6,
        vue: 0x4fc08d,
        css: 0x1572b6,
        html: 0xe34c26,
        json: 0x000000,
        md: 0x083fa1,
        txt: 0x6c757d,
        img: 0x10b981,
      };
      const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
      color = typeColors[ext] || 0x888888;
    }

    const material = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.1,
      shininess: 100,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = file;

    return mesh;
  };

  // Build tree visualization
  const buildTreeVisualization = (files: FileNode[]) => {
    if (!scene) return;

    const group = new THREE.Group();
    const levelHeight = 2;

    const buildLevel = (
      nodes: FileNode[],
      level: number = 0,
      parent: THREE.Object3D | null = null
    ) => {
      const angleStep = (Math.PI * 2) / nodes.length;

      nodes.forEach((node, index) => {
        const mesh = createFileMesh(node);

        // Position in circle
        const radius = level * 3;
        const angle = angleStep * index;
        mesh.position.set(Math.cos(angle) * radius, -level * levelHeight, Math.sin(angle) * radius);

        // Create connection to parent
        if (parent && level > 0) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            parent.position,
            mesh.position,
          ]);
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,
            opacity: 0.3,
            transparent: true,
          });
          const line = new THREE.Line(lineGeometry, lineMaterial);
          group.add(line);
        }

        node.mesh = mesh;
        node.position = mesh.position.clone();
        group.add(mesh);

        // Recursively build children
        if (node.children && node.children.length > 0) {
          buildLevel(node.children, level + 1, mesh);
        }
      });
    };

    buildLevel(files);
    scene.add(group);
  };

  // Build sphere visualization
  const buildSphereVisualization = (files: FileNode[]) => {
    if (!scene) return;

    const group = new THREE.Group();
    const radius = 5;

    files.forEach((file, index) => {
      const mesh = createFileMesh(file);

      // Position on sphere surface
      const phi = Math.acos(-1 + (2 * index) / files.length);
      const theta = Math.sqrt(files.length * Math.PI) * phi;

      mesh.position.set(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(theta)
      );

      file.mesh = mesh;
      file.position = mesh.position.clone();
      group.add(mesh);
    });

    scene.add(group);
  };

  // Update visualization based on mode
  const updateVisualization = (files: FileNode[]) => {
    if (!scene) return;

    // Clear existing objects
    while (scene.children.length > 2) {
      // Keep lights
      const child = scene.children[scene.children.length - 1];
      scene.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    // Build new visualization
    switch (config.value.mode) {
      case "tree":
        buildTreeVisualization(files.slice(0, 50)); // Limit for performance
        break;
      case "sphere":
        buildSphereVisualization(files.slice(0, 100));
        break;
      case "grid":
        buildGridVisualization(files.slice(0, 64)); // 8x8 grid
        break;
      case "force":
        buildForceVisualization(files.slice(0, 200));
        break;
    }

    // Update performance stats
    updatePerformanceStats();
  };

  // Build grid visualization
  const buildGridVisualization = (files: FileNode[]) => {
    if (!scene) return;

    const group = new THREE.Group();
    const gridSize = Math.ceil(Math.sqrt(files.length));
    const spacing = 2;

    files.forEach((file, index) => {
      const mesh = createFileMesh(file);

      const row = Math.floor(index / gridSize);
      const col = index % gridSize;

      mesh.position.set((col - gridSize / 2) * spacing, 0, (row - gridSize / 2) * spacing);

      file.mesh = mesh;
      file.position = mesh.position.clone();
      group.add(mesh);
    });

    scene.add(group);
  };

  // Build force-directed graph
  const buildForceVisualization = (files: FileNode[]) => {
    if (!scene) return;

    const group = new THREE.Group();

    // Create nodes
    const nodes = files.map((file) => {
      const mesh = createFileMesh(file);
      // Random initial position
      mesh.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 20
      );
      file.mesh = mesh;
      file.position = mesh.position.clone();
      group.add(mesh);
      return { mesh, file };
    });

    // Create simple connections (could be enhanced with actual dependency analysis)
    nodes.forEach((node, i) => {
      if (i < nodes.length - 1) {
        const nextNode = nodes[i + 1];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          node.mesh.position,
          nextNode.mesh.position,
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x666666,
          opacity: 0.2,
          transparent: true,
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);
      }
    });

    scene.add(group);
  };

  // Update performance statistics
  const updatePerformanceStats = () => {
    if (!renderer) return;

    const info = renderer.info;
    drawCalls.value = info.render.calls;
    triangles.value = info.render.triangles;

    // Estimate memory usage (simplified)
    if (performance.memory) {
      memoryUsage.value = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
  };

  // Animation loop
  const animate = () => {
    if (!scene || !camera || !renderer) return;

    animationId = requestAnimationFrame(animate);

    // Calculate FPS
    const currentTime = performance.now();
    frameCount++;

    if (currentTime >= fpsUpdateTime + 1000) {
      currentFPS.value = Math.round((frameCount * 1000) / (currentTime - fpsUpdateTime));
      frameCount = 0;
      fpsUpdateTime = currentTime;
    }

    // Auto-rotation
    if (isRotating.value && scene.children.length > 0) {
      const group = scene.children.find((child) => child instanceof THREE.Group);
      if (group) {
        group.rotation.y += 0.005 * (config.value.animationSpeed / 50);
      }
    }

    renderer.render(scene, camera);
  };

  // Handle window resize
  const handleResize = () => {
    if (!camera || !renderer || !canvasRef.value) return;

    const aspect = canvasRef.value.clientWidth / canvasRef.value.clientHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasRef.value.clientWidth, canvasRef.value.clientHeight);
  };

  // Mouse interaction
  const handleCanvasClick = (event: MouseEvent) => {
    if (!canvasRef.value || !camera || !scene || !raycaster) return;

    const rect = canvasRef.value.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Find all meshes in scene
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      selectedFile.value = mesh.userData as FileNode;
      console.log("Selected file:", selectedFile.value);
    } else {
      selectedFile.value = null;
    }
  };

  // Methods
  const startAnimation = () => {
    if (animationId) return;
    animate();
  };

  const stopAnimation = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  const resetCamera = () => {
    if (!camera) return;
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
  };

  const exportVisualization = () => {
    if (!renderer || !scene) return;

    const dataURL = renderer.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "space-analyzer-3d-visualization.png";
    link.href = dataURL;
    link.click();
  };

  // Lifecycle
  onMounted(() => {
    initializeScene();
    startAnimation();
    window.addEventListener("resize", handleResize);
  });

  onUnmounted(() => {
    stopAnimation();
    window.removeEventListener("resize", handleResize);

    // Cleanup Three.js resources
    if (renderer) {
      renderer.dispose();
    }
    if (scene) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
  });

  // Watch for configuration changes
  watch(
    () => config.value.mode,
    () => {
      // Rebuild visualization when mode changes
      // This will be triggered by parent component
    }
  );

  return {
    // State
    canvasRef,
    config,
    isRotating,
    currentFPS,
    isLoading,
    selectedFile,
    stats,

    // Methods
    startAnimation,
    stopAnimation,
    resetCamera,
    exportVisualization,
    handleCanvasClick,
    updateVisualization,
  };
}

<template>
  <div class="filesystem-3d-view">
    <div class="view-header">
      <h1>🌐 3D File System Browser</h1>
      <p>Immersive 3D file system navigation with multiple layout algorithms</p>
    </div>

    <div class="three-d-content">
      <ErrorBoundary title="3D visualization failed" :show-details="true">
        <FileSystem3D
          :root-path="rootPath"
          :max-depth="maxDepth"
          :max-nodes="maxNodes"
          @node-selected="handleNodeSelected"
          @node-opened="handleNodeOpened"
        />
      </ErrorBoundary>

      <div class="controls-panel">
        <div class="control-group">
          <h3>Layout Options</h3>
          <div class="layout-buttons">
            <button :class="{ active: currentLayout === 'tree' }" @click="setLayout('tree')">
              Tree
            </button>
            <button :class="{ active: currentLayout === 'sphere' }" @click="setLayout('sphere')">
              Sphere
            </button>
            <button
              :class="{ active: currentLayout === 'cylinder' }"
              @click="setLayout('cylinder')"
            >
              Cylinder
            </button>
            <button :class="{ active: currentLayout === 'spiral' }" @click="setLayout('spiral')">
              Spiral
            </button>
          </div>
        </div>

        <div class="control-group">
          <h3>View Options</h3>
          <div class="view-options">
            <label>
              <input v-model="showFileLabels" type="checkbox" />
              Show File Labels
            </label>
            <label>
              <input v-model="showDirectoryLabels" type="checkbox" />
              Show Directory Labels
            </label>
            <label>
              <input v-model="autoRotate" type="checkbox" />
              Auto Rotate
            </label>
            <label>
              <input v-model="wireframe" type="checkbox" />
              Wireframe Mode
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import FileSystem3D from "@/components/3d/FileSystem3D.vue";

// Define emits
const emit = defineEmits<{
  "node-selected": [node: any];
  "node-opened": [node: any];
}>();

const rootPath = ref("C:\\");
const maxDepth = ref(3);
const maxNodes = ref(1000);
const currentLayout = ref("tree");
const showFileLabels = ref(true);
const showDirectoryLabels = ref(true);
const autoRotate = ref(false);
const wireframe = ref(false);
const selectedNode = ref<any>(null);

const handleNodeOpened = (node: any) => {
  // Implement open handling with directory expansion
  if (!node) return;

  console.warn(`[FileSystem3DView] Node opened:`, node);

  // Emit open event for parent components
  emit("node-opened", node);

  // If it's a directory, expand it
  if (node.type === "directory") {
    expandDirectory(node);
  }

  // If it's a file, try to open it with system default
  if (node.type === "file") {
    openFileWithSystem(node);
  }
};

// Helper function to show file details
const showFileDetails = (node: any) => {
  console.warn(`[FileSystem3DView] Showing file details for:`, node);

  // Create a simple file details modal/popup
  const details = {
    name: node.name || "Unknown",
    path: node.path || "",
    type: node.type || "unknown",
    size: node.size ? formatFileSize(node.size) : "Unknown",
    modified: node.modified ? new Date(node.modified).toLocaleString() : "Unknown",
    created: node.created ? new Date(node.created).toLocaleString() : "Unknown",
  };

  // For now, show details in console - in a real implementation,
  // this would open a modal or update a details panel
  console.table(details);
  alert(
    `File Details:\nName: ${details.name}\nPath: ${details.path}\nSize: ${details.size}\nModified: ${details.modified}`
  );
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper function to prepare directory expansion
const prepareDirectoryExpansion = (node: any) => {
  console.warn(`[FileSystem3DView] Preparing directory expansion for:`, node);

  // Set loading state and prepare for expansion
  if (node.path) {
    console.log(`[FileSystem3DView] Loading directory contents for: ${node.path}`);
    // In a real implementation, this would:
    // 1. Show loading indicator
    // 2. Preload directory metadata
    // 3. Prepare 3D scene for new nodes
    // 4. Cache directory structure for faster access
  }
};

// Helper function to expand directory
const expandDirectory = async (node: any) => {
  console.warn(`[FileSystem3DView] Expanding directory:`, node);

  try {
    // Import Tauri desktop functions dynamically
    const { invoke } = await import("@tauri-apps/api/core");

    // Get directory contents
    const contents = await invoke("analyze_directory", { path: node.path });

    console.log(`[FileSystem3DView] Directory expanded:`, contents);

    // In a real implementation, this would:
    // 1. Update 3D visualization with new nodes
    // 2. Animate the expansion
    // 3. Update navigation tree
    // 4. Emit event to parent components

    return contents;
  } catch (error) {
    console.error(`[FileSystem3DView] Failed to expand directory:`, error);
    throw error;
  }
};

// Helper function to open file with system default
const openFileWithSystem = async (node: any) => {
  console.warn(`[FileSystem3DView] Opening file with system:`, node);
  try {
    // Import Tauri desktop functions dynamically
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_file", { path: node.path });
  } catch (error) {
    console.error(`[FileSystem3DView] Failed to open file:`, error);
  }
};
</script>

<style scoped>
.filesystem-3d-view {
  padding: 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 2rem;
  text-align: center;
}

.view-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary, #fafaf9);
}

.view-header p {
  font-size: 1.1rem;
  color: var(--text-secondary, #6b6b70);
  max-width: 600px;
  margin: 0 auto;
}

.three-d-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  height: calc(100vh - 200px);
}

.controls-panel {
  background: var(--bg-card, #16161a);
  border-radius: 12px;
  border: 1px solid var(--border-subtle, #2a2a2e);
  padding: 1.5rem;
  overflow-y: auto;
}

.control-group {
  margin-bottom: 2rem;
}

.control-group h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: var(--text-primary, #fafaf9);
}

.layout-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.layout-buttons button {
  padding: 0.5rem;
  border: 1px solid var(--border-subtle, #2a2a2e);
  border-radius: 6px;
  background: var(--bg-elevated, #1a1a1e);
  color: var(--text-primary, #fafaf9);
  cursor: pointer;
  transition: all 0.2s;
}

.layout-buttons button:hover {
  background: var(--bg-elevated-hover, #222226);
}

.layout-buttons button.active {
  background: var(--accent-indigo, #6366f1);
  color: white;
  border-color: var(--accent-indigo, #6366f1);
}

.view-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.view-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--text-secondary, #6b6b70);
}

.view-options input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

@media (max-width: 1200px) {
  .three-d-content {
    grid-template-columns: 1fr;
    height: auto;
  }

  .controls-panel {
    order: -1;
    max-height: 300px;
  }
}

@media (max-width: 768px) {
  .filesystem-3d-view {
    padding: 1rem;
  }

  .view-header h1 {
    font-size: 2rem;
  }

  .layout-buttons {
    grid-template-columns: 1fr;
  }
}
</style>

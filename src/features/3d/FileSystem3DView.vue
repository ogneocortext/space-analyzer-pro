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
            <button @click="setLayout('tree')" :class="{ active: currentLayout === 'tree' }">
              Tree
            </button>
            <button @click="setLayout('sphere')" :class="{ active: currentLayout === 'sphere' }">
              Sphere
            </button>
            <button
              @click="setLayout('cylinder')"
              :class="{ active: currentLayout === 'cylinder' }"
            >
              Cylinder
            </button>
            <button @click="setLayout('spiral')" :class="{ active: currentLayout === 'spiral' }">
              Spiral
            </button>
          </div>
        </div>

        <div class="control-group">
          <h3>View Options</h3>
          <div class="view-options">
            <label>
              <input type="checkbox" v-model="showFileLabels" />
              Show File Labels
            </label>
            <label>
              <input type="checkbox" v-model="showDirectoryLabels" />
              Show Directory Labels
            </label>
            <label>
              <input type="checkbox" v-model="autoRotate" />
              Auto Rotate
            </label>
            <label>
              <input type="checkbox" v-model="wireframe" />
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
import { defineAsyncComponent } from "vue";
import ErrorBoundary from "@/components/shared/ErrorBoundary.vue";
import SkeletonLoader from "@/components/shared/SkeletonLoader.vue";

// Lazy load the 3D component
const FileSystem3D = defineAsyncComponent({
  loader: () => import("@/components/3d/FileSystem3D.vue"),
  loadingComponent: SkeletonLoader,
  delay: 200,
  timeout: 30000,
});

// Props and state
const rootPath = ref("C:\\");
const maxDepth = ref(5);
const maxNodes = ref(1000);
const currentLayout = ref("tree");
const showFileLabels = ref(true);
const showDirectoryLabels = ref(true);
const autoRotate = ref(false);
const wireframe = ref(false);

// Methods
const setLayout = (layout: string) => {
  currentLayout.value = layout;
  // Emit layout change to FileSystem3D component
};

const handleNodeSelected = (node: any) => {
  console.log("Node selected:", node);
};

const handleNodeOpened = (node: any) => {
  console.log("Node opened:", node);
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

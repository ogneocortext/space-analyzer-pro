<template>
  <div class="filesystem-3d-view">
    <div class="view-header">
      <h1>🌐 3D File System Browser</h1>
      <p>Immersive 3D file system navigation with multiple layout algorithms</p>
    </div>
    
    <div class="3d-content">
      <FileSystem3D 
        :root-path="rootPath"
        :max-depth="maxDepth"
        :max-nodes="maxNodes"
        @node-selected="handleNodeSelected"
        @node-opened="handleNodeOpened"
      />
      
      <div class="controls-panel">
        <div class="control-group">
          <h3>Layout Options</h3>
          <div class="layout-buttons">
            <button @click="setLayout('tree')" :class="{ active: currentLayout === 'tree' }">Tree</button>
            <button @click="setLayout('sphere')" :class="{ active: currentLayout === 'sphere' }">Sphere</button>
            <button @click="setLayout('cylinder')" :class="{ active: currentLayout === 'cylinder' }">Cylinder</button>
            <button @click="setLayout('spiral')" :class="{ active: currentLayout === 'spiral' }">Spiral</button>
          </div>
        </div>
        
        <div class="control-group">
          <h3>View Options</h3>
          <div class="view-options">
            <label>
              <input type="checkbox" v-model="showFileLabels">
              Show File Labels
            </label>
            <label>
              <input type="checkbox" v-model="showDirectoryLabels">
              Show Directory Labels
            </label>
            <label>
              <input type="checkbox" v-model="autoRotate">
              Auto Rotate
            </label>
            <label>
              <input type="checkbox" v-model="wireframe">
              Wireframe Mode
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FileSystem3D from '@/components/3d/FileSystem3D.vue'

// Props and state
const rootPath = ref('C:\\')
const maxDepth = ref(5)
const maxNodes = ref(1000)
const currentLayout = ref('tree')
const showFileLabels = ref(true)
const showDirectoryLabels = ref(true)
const autoRotate = ref(false)
const wireframe = ref(false)

// Methods
const setLayout = (layout: string) => {
  currentLayout.value = layout
  // Emit layout change to FileSystem3D component
}

const handleNodeSelected = (node: any) => {
  console.log('Node selected:', node)
}

const handleNodeOpened = (node: any) => {
  console.log('Node opened:', node)
}
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
  color: #2c3e50;
}

.view-header p {
  font-size: 1.1rem;
  color: #7f8c8d;
  max-width: 600px;
  margin: 0 auto;
}

.3d-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  height: calc(100vh - 200px);
}

.controls-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  overflow-y: auto;
}

.control-group {
  margin-bottom: 2rem;
}

.control-group h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.layout-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.layout-buttons button {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-buttons button:hover {
  background: #f8f9fa;
}

.layout-buttons button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
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
}

.view-options input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

@media (max-width: 1200px) {
  .3d-content {
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

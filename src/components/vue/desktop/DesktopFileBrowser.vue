<template>
  <div class="desktop-file-browser">
    <div class="browser-header">
      <div class="navigation-bar">
        <button @click="goBack" :disabled="!canGoBack" class="nav-btn" title="Go back">
          <ChevronLeft class="icon" />
        </button>
        <button @click="goForward" :disabled="!canGoForward" class="nav-btn" title="Go forward">
          <ChevronRight class="icon" />
        </button>
        <button @click="goUp" :disabled="!canGoUp" class="nav-btn" title="Go up">
          <ArrowUp class="icon" />
        </button>
        <button @click="goHome" class="nav-btn" title="Go home">
          <Home class="icon" />
        </button>
      </div>
      
      <div class="path-bar">
        <div class="path-input-wrapper">
          <FolderIcon class="path-icon" />
          <input 
            ref="pathInput"
            v-model="currentPath"
            @keydown.enter="navigateToPath"
            class="path-input"
            placeholder="Enter path..."
          />
        </div>
        <button @click="refreshCurrent" class="refresh-btn" title="Refresh">
          <RefreshCw class="icon" />
        </button>
      </div>
      
      <div class="view-controls">
        <button 
          @click="setViewMode('grid')" 
          :class="{ active: viewMode === 'grid' }"
          class="view-btn"
          title="Grid view"
        >
          <Grid3X3 class="icon" />
        </button>
        <button 
          @click="setViewMode('list')" 
          :class="{ active: viewMode === 'list' }"
          class="view-btn"
          title="List view"
        </button>
        <button 
          @click="setViewMode('tree')" 
          :class="{ active: viewMode === 'tree' }"
          class="view-btn"
          title="Tree view"
        >
          <FileTree class="icon" />
        </button>
      </div>
    </div>
    
    <div class="browser-content">
      <!-- Grid View -->
      <div v-if="viewMode === 'grid'" class="grid-view">
        <div 
          v-for="item in filteredItems"
          :key="item.path"
          class="grid-item"
          :class="{ selected: selectedItems.has(item.path) }"
          @click="selectItem(item, $event)"
          @dblclick="openItem(item)"
        >
          <div class="item-icon">
            <component :is="getFileIcon(item)" />
          </div>
          <div class="item-name" :title="item.name">{{ item.name }}</div>
          <div class="item-size">{{ formatSize(item.size) }}</div>
        </div>
      </div>
      
      <!-- List View -->
      <div v-else-if="viewMode === 'list'" class="list-view">
        <table class="file-table">
          <thead>
            <tr>
              <th @click="sortBy('name')" class="sortable">
                Name
                <ArrowUpDown v-if="sortField === 'name'" class="sort-icon" />
              </th>
              <th @click="sortBy('size')" class="sortable">
                Size
                <ArrowUpDown v-if="sortField === 'size'" class="sort-icon" />
              </th>
              <th @click="sortBy('modified')" class="sortable">
                Modified
                <ArrowUpDown v-if="sortField === 'modified'" class="sort-icon" />
              </th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="item in filteredItems"
              :key="item.path"
              class="file-row"
              :class="{ selected: selectedItems.has(item.path) }"
              @click="selectItem(item, $event)"
              @dblclick="openItem(item)"
            >
              <td class="name-cell">
                <component :is="getFileIcon(item)" class="row-icon" />
                <span>{{ item.name }}</span>
              </td>
              <td class="size-cell">{{ formatSize(item.size) }}</td>
              <td class="date-cell">{{ formatDate(item.modified) }}</td>
              <td class="type-cell">{{ item.extension || 'Directory' }}</td>
              <td class="actions-cell">
                <button @click="openInExplorer(item)" class="action-btn" title="Open in Explorer">
                  <ExternalLink class="icon-sm" />
                </button>
                <button @click="deleteItem(item)" class="action-btn danger" title="Delete">
                  <Trash2 class="icon-sm" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Tree View -->
      <div v-else-if="viewMode === 'tree'" class="tree-view">
        <div class="tree-container">
          <TreeNode 
            v-for="item in treeItems"
            :key="item.path"
            :item="item"
            :level="0"
            @select="selectItem"
            @open="openItem"
            @toggle="toggleTreeNode"
          />
        </div>
      </div>
    </div>
    
    <!-- Status Bar -->
    <div class="browser-status">
      <div class="status-left">
        <span>{{ filteredItems.length }} items</span>
        <span v-if="selectedItems.size > 0">• {{ selectedItems.size }} selected</span>
      </div>
      <div class="status-right">
        <span v-if="selectedSize > 0">Selected: {{ formatSize(selectedSize) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Home,
  FolderIcon,
  RefreshCw,
  Grid3X3,
  List,
  FileTree,
  ArrowUpDown,
  ExternalLink,
  Trash2,
  Folder,
  File,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Code
} from 'lucide-vue-next'
import { useTauriDesktop } from '@/composables/useTauriDesktop'

interface FileItem {
  name: string
  path: string
  size: number
  modified?: string
  extension?: string
  isDirectory: boolean
  children?: FileItem[]
  expanded?: boolean
}

const { isTauri, openFileLocation, getFileDetails, deleteFiles } = useTauriDesktop()

// Reactive state
const currentPath = ref('C:\\')
const viewMode = ref<'grid' | 'list' | 'tree'>('list')
const items = ref<FileItem[]>([])
const selectedItems = ref(new Set<string>())
const history = ref<string[]>(['C:\\'])
const historyIndex = ref(0)
const sortField = ref<'name' | 'size' | 'modified'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')
const searchTerm = ref('')
const pathInput = ref<HTMLInputElement>()

// Computed properties
const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < history.value.length - 1)
const canGoUp = computed(() => {
  const path = currentPath.value
  return path !== 'C:\\' && path.includes('\\')
})

const filteredItems = computed(() => {
  let result = [...items.value]
  
  // Apply search filter
  if (searchTerm.value) {
    result = result.filter(item => 
      item.name.toLowerCase().includes(searchTerm.value.toLowerCase())
    )
  }
  
  // Apply sorting
  result.sort((a, b) => {
    let aValue: any = a[sortField.value]
    let bValue: any = b[sortField.value]
    
    if (sortField.value === 'name') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue < bValue) return sortDirection.value === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
  
  return result
})

const selectedSize = computed(() => {
  let total = 0
  selectedItems.value.forEach(path => {
    const item = items.value.find(i => i.path === path)
    if (item) total += item.size
  })
  return total
})

const treeItems = computed(() => {
  // Convert flat items to tree structure for tree view
  return buildTree(items.value)
})

// Methods
function getFileIcon(item: FileItem) {
  if (item.isDirectory) return Folder
  
  const ext = item.extension?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext || '')) return Image
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext || '')) return Film
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext || '')) return Music
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return Archive
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs'].includes(ext || '')) return Code
  if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext || '')) return FileText
  
  return File
}

function buildTree(items: FileItem[]): FileItem[] {
  const tree: FileItem[] = []
  const map = new Map<string, FileItem>()
  
  // Create map of all items
  items.forEach(item => {
    map.set(item.path, { ...item, children: [] })
  })
  
  // Build tree structure
  items.forEach(item => {
    const treeNode = map.get(item.path)
    if (treeNode) {
      if (item.isDirectory) {
        tree.push(treeNode)
      } else {
        // Find parent directory
        const parentPath = item.path.substring(0, item.path.lastIndexOf('\\'))
        const parent = map.get(parentPath)
        if (parent && parent.children) {
          parent.children.push(treeNode)
        }
      }
    }
  })
  
  return tree
}

function sortBy(field: 'name' | 'size' | 'modified') {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
}

function setViewMode(mode: 'grid' | 'list' | 'tree') {
  viewMode.value = mode
}

function selectItem(item: FileItem, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    // Multi-select
    if (selectedItems.value.has(item.path)) {
      selectedItems.value.delete(item.path)
    } else {
      selectedItems.value.add(item.path)
    }
  } else if (event.shiftKey && selectedItems.value.size > 0) {
    // Range select (simplified)
    selectedItems.value.clear()
    selectedItems.value.add(item.path)
  } else {
    // Single select
    selectedItems.value.clear()
    selectedItems.value.add(item.path)
  }
}

function openItem(item: FileItem) {
  if (item.isDirectory) {
    navigateToPath(item.path)
  } else {
    // Open file with default application
    if (isTauri.value) {
      openFileLocation(item.path)
    }
  }
}

function navigateToPath(path: string) {
  path = path.trim()
  if (!path) return
  
  currentPath.value = path
  
  // Update history
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  history.value.push(path)
  historyIndex.value = history.value.length - 1
  
  loadDirectory(path)
}

function goBack() {
  if (canGoBack.value) {
    historyIndex.value--
    currentPath.value = history.value[historyIndex.value]
    loadDirectory(currentPath.value)
  }
}

function goForward() {
  if (canGoForward.value) {
    historyIndex.value++
    currentPath.value = history.value[historyIndex.value]
    loadDirectory(currentPath.value)
  }
}

function goUp() {
  if (canGoUp.value) {
    const parentPath = currentPath.value.substring(0, currentPath.value.lastIndexOf('\\'))
    navigateToPath(parentPath || 'C:\\')
  }
}

function goHome() {
  navigateToPath('C:\\')
}

function refreshCurrent() {
  loadDirectory(currentPath.value)
}

async function loadDirectory(path: string) {
  try {
    // In a real implementation, this would call the backend to get directory contents
    // For now, we'll simulate with mock data
    items.value = await getDirectoryContents(path)
  } catch (error) {
    console.error('Failed to load directory:', error)
    items.value = []
  }
}

async function getDirectoryContents(path: string): Promise<FileItem[]> {
  // Mock implementation - replace with actual backend call
  const mockItems: FileItem[] = [
    {
      name: 'Documents',
      path: `${path}\\Documents`,
      size: 0,
      modified: '2024-01-15T10:30:00Z',
      isDirectory: true
    },
    {
      name: 'Downloads',
      path: `${path}\\Downloads`,
      size: 0,
      modified: '2024-01-14T15:45:00Z',
      isDirectory: true
    },
    {
      name: 'example.txt',
      path: `${path}\\example.txt`,
      size: 1024,
      modified: '2024-01-13T09:20:00Z',
      extension: 'txt',
      isDirectory: false
    }
  ]
  
  return mockItems
}

function openInExplorer(item: FileItem) {
  if (isTauri.value) {
    openFileLocation(item.path)
  }
}

async function deleteItem(item: FileItem) {
  if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
    try {
      if (isTauri.value) {
        await deleteFiles([item.path])
        refreshCurrent()
      }
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }
}

function toggleTreeNode(item: FileItem) {
  if (item.children) {
    item.expanded = !item.expanded
  }
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString()
}

// Tree node component
const TreeNode = {
  name: 'TreeNode',
  props: ['item', 'level'],
  emits: ['select', 'open', 'toggle'],
  setup(props: any, { emit }: any) {
    const indent = computed(() => props.level * 20)
    
    return { indent, emit }
  },
  template: `
    <div class="tree-node" :style="{ paddingLeft: indent + 'px' }">
      <div 
        class="tree-node-content"
        @click="$emit('select', item, $event)"
        @dblclick="$emit('open', item)"
      >
        <button 
          v-if="item.isDirectory"
          @click.stop="$emit('toggle', item)"
          class="tree-toggle"
        >
          {{ item.expanded ? '−' : '+' }}
        </button>
        <span v-else class="tree-spacer"></span>
        <component :is="getFileIcon(item)" class="tree-icon" />
        <span class="tree-name">{{ item.name }}</span>
      </div>
      <div v-if="item.expanded && item.children" class="tree-children">
        <TreeNode 
          v-for="child in item.children"
          :key="child.path"
          :item="child"
          :level="level + 1"
          @select="$emit('select', $event, arguments[1])"
          @open="$emit('open', $event)"
          @toggle="$emit('toggle', $event)"
        />
      </div>
    </div>
  `
}

onMounted(() => {
  loadDirectory(currentPath.value)
})

watch(currentPath, (newPath) => {
  if (pathInput.value) {
    pathInput.value.value = newPath
  }
})
</script>

<style scoped>
.desktop-file-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
  border-radius: 8px;
  overflow: hidden;
}

.browser-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.navigation-bar {
  display: flex;
  gap: 4px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.path-bar {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 500px;
}

.path-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 6px 12px;
  transition: all 0.2s ease;
}

.path-input-wrapper:focus-within {
  border-color: #6366f1;
  background: rgba(15, 23, 42, 0.8);
}

.path-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
  margin-right: 8px;
}

.path-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f1f5f9;
  font-family: inherit;
  font-size: 14px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.view-controls {
  display: flex;
  gap: 4px;
}

.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover,
.view-btn.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.browser-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

/* Grid View */
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.grid-item:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
}

.grid-item.selected {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
}

.item-icon {
  width: 48px;
  height: 48px;
  color: #64748b;
  margin-bottom: 8px;
}

.item-name {
  font-size: 12px;
  color: #f1f5f9;
  text-align: center;
  word-break: break-word;
  margin-bottom: 4px;
}

.item-size {
  font-size: 10px;
  color: #64748b;
}

/* List View */
.list-view {
  width: 100%;
}

.file-table {
  width: 100%;
  border-collapse: collapse;
}

.file-table th {
  background: rgba(30, 41, 59, 0.5);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: #cbd5e1;
  border-bottom: 1px solid #334155;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.file-table th.sortable:hover {
  background: rgba(99, 102, 241, 0.1);
}

.sort-icon {
  width: 12px;
  height: 12px;
  margin-left: 4px;
  display: inline-block;
}

.file-row {
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  transition: all 0.2s ease;
}

.file-row:hover {
  background: rgba(30, 41, 59, 0.5);
}

.file-row.selected {
  background: rgba(99, 102, 241, 0.2);
}

.file-row td {
  padding: 8px 12px;
  font-size: 14px;
  color: #e2e8f0;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.size-cell {
  font-variant-numeric: tabular-nums;
  color: #94a3b8;
}

.date-cell {
  color: #94a3b8;
  font-size: 12px;
}

.type-cell {
  color: #64748b;
  font-size: 12px;
}

.actions-cell {
  display: flex;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  color: #f1f5f9;
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* Tree View */
.tree-view {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.tree-node {
  user-select: none;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.2s ease;
}

.tree-node-content:hover {
  background: rgba(99, 102, 241, 0.1);
}

.tree-toggle {
  width: 16px;
  height: 16px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 2px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-spacer {
  width: 16px;
}

.tree-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
}

.tree-name {
  color: #e2e8f0;
}

.tree-children {
  margin-left: 8px;
}

/* Status Bar */
.browser-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #1e293b;
  border-top: 1px solid #334155;
  font-size: 12px;
  color: #94a3b8;
}

.status-left,
.status-right {
  display: flex;
  gap: 16px;
}

.icon {
  width: 16px;
  height: 16px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

/* Scrollbar styling */
.browser-content::-webkit-scrollbar {
  width: 8px;
}

.browser-content::-webkit-scrollbar-track {
  background: transparent;
}

.browser-content::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.browser-content::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>

<template>
  <div class="desktop-titlebar" data-tauri-drag-region>
    <div class="titlebar-left">
      <div class="app-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="3" fill="#6366f1"/>
          <path d="M4 8L7 5L10 8L7 11L4 8Z" fill="white"/>
        </svg>
      </div>
      <span class="app-title">{{ title }}</span>
    </div>
    
    <div class="titlebar-center">
      <div class="search-box" v-if="showSearch">
        <Search class="search-icon" />
        <input 
          ref="searchInput"
          type="text" 
          placeholder="Search files, folders, or commands..."
          v-model="searchQuery"
          @keydown.enter="handleSearch"
          @keydown.escape="clearSearch"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
        />
        <kbd v-if="!searchQuery && !searchFocused" class="search-shortcut">Ctrl+K</kbd>
      </div>
    </div>
    
    <div class="titlebar-right">
      <!-- Window Controls -->
      <button 
        class="window-control minimize"
        @click="minimizeWindow"
        title="Minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="1" y="4" width="8" height="2" fill="currentColor"/>
        </svg>
      </button>
      
      <button 
        class="window-control maximize"
        @click="toggleMaximize"
        :title="isMaximized ? 'Restore' : 'Maximize'"
      >
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="1" y="1" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="1" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/>
          <rect x="1" y="2" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
      </button>
      
      <button 
        class="window-control close"
        @click="closeWindow"
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Search } from 'lucide-vue-next'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface Props {
  title?: string
  showSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Space Analyzer Pro',
  showSearch: true
})

const emit = defineEmits<{
  search: [query: string]
}>()

const searchQuery = ref('')
const searchFocused = ref(false)
const isMaximized = ref(false)
const searchInput = ref<HTMLInputElement>()

let mainWindow: any = null

onMounted(async () => {
  try {
    mainWindow = getCurrentWindow()
    isMaximized.value = await mainWindow.isMaximized()
  } catch (error) {
    console.warn('Failed to get window handle:', error)
  }
  
  // Global keyboard shortcuts
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

function handleGlobalKeydown(event: KeyboardEvent) {
  // Ctrl+K for search
  if (event.ctrlKey && event.key === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
  }
  
  // Escape to clear search
  if (event.key === 'Escape' && searchFocused.value) {
    clearSearch()
  }
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    emit('search', searchQuery.value.trim())
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchInput.value?.blur()
}

function onSearchFocus() {
  searchFocused.value = true
}

function onSearchBlur() {
  searchFocused.value = false
}

async function minimizeWindow() {
  try {
    await mainWindow?.minimize()
  } catch (error) {
    console.error('Failed to minimize window:', error)
  }
}

async function toggleMaximize() {
  try {
    if (isMaximized.value) {
      await mainWindow?.unmaximize()
    } else {
      await mainWindow?.maximize()
    }
    isMaximized.value = !isMaximized.value
  } catch (error) {
    console.error('Failed to toggle maximize:', error)
  }
}

async function closeWindow() {
  try {
    await mainWindow?.close()
  } catch (error) {
    console.error('Failed to close window:', error)
  }
}
</script>

<style scoped>
.desktop-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  background: linear-gradient(to bottom, #1e293b, #0f172a);
  border-bottom: 1px solid #334155;
  user-select: none;
  -webkit-app-region: drag;
  position: relative;
  z-index: 1000;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  flex-shrink: 0;
}

.app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.app-title {
  font-size: 13px;
  font-weight: 500;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.titlebar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 400px;
  margin: 0 auto;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 4px 8px;
  width: 100%;
  max-width: 300px;
  -webkit-app-region: no-drag;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  background: rgba(30, 41, 59, 0.9);
  border-color: #6366f1;
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3);
}

.search-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f1f5f9;
  font-size: 12px;
  font-family: inherit;
}

.search-box input::placeholder {
  color: #64748b;
}

.search-shortcut {
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
  font-size: 10px;
  font-family: monospace;
  padding: 2px 4px;
  border-radius: 3px;
  margin-left: auto;
  flex-shrink: 0;
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.window-control {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 32px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-app-region: no-drag;
  font-size: 10px;
}

.window-control:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}

.window-control.minimize:hover {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.window-control.maximize:hover {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.window-control.close:hover {
  background: #ef4444;
  color: white;
}

.window-control svg {
  width: 10px;
  height: 10px;
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
  .desktop-titlebar {
    background: linear-gradient(to bottom, #0f172a, #020617);
    border-bottom-color: #1e293b;
  }
}

/* Windows-specific styling */
.windows .desktop-titlebar {
  height: 30px;
}

.windows .window-control {
  width: 45px;
  height: 30px;
}

.windows .window-control.close:hover {
  background: #e81123;
}
</style>

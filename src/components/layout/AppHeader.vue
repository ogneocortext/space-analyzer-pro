<template>
  <header class="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800">
    <div class="flex items-center gap-3">
      <button
        @click="onToggleSidebar"
        class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Menu :size="20" class="text-slate-300" />
      </button>
      <h1 class="text-lg text-white font-semibold">
        {{ formattedView }}
      </h1>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Menu } from 'lucide-react'

interface Props {
  currentView?: string
  onToggleSidebar?: () => void
  onCommandPaletteOpen?: () => void
  onFocusModeToggle?: () => void
  onFullscreenToggle?: () => void
  onThemeChange?: (newTheme: string) => void
  theme?: any
  isOffline?: boolean
  performanceMetrics?: any
}

const props = withDefaults(defineProps<Props>(), {
  currentView: 'dashboard',
  onToggleSidebar: () => {},
  onCommandPaletteOpen: () => {},
  onFocusModeToggle: () => {},
  onFullscreenToggle: () => {},
  onThemeChange: () => {},
  isOffline: false
})

const formattedView = computed(() => {
  return props.currentView.charAt(0).toUpperCase() + props.currentView.slice(1)
})
</script>

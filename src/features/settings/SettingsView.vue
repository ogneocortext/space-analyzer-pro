<script setup lang="ts">
import { ref } from 'vue'
import { Card, Button } from '../../design-system/components'

const scanDepth = ref(10)
const includeHidden = ref(false)
const useAI = ref(true)
const theme = ref('dark')

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify({
    scanDepth: scanDepth.value,
    includeHidden: includeHidden.value,
    useAI: useAI.value,
    theme: theme.value,
  }))
  alert('Settings saved!')
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">Settings</h1>

    <!-- Scan Settings -->
    <Card title="Scan Options">
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-slate-400 mb-2">Scan Depth (directory levels)</label>
          <input
            v-model="scanDepth"
            type="range"
            min="1"
            max="20"
            class="w-full"
          >
          <p class="text-sm text-slate-500 mt-1">{{ scanDepth }} levels</p>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-slate-300">Include hidden files</span>
          <button
            :class="['w-12 h-6 rounded-full transition-colors relative', includeHidden ? 'bg-blue-600' : 'bg-slate-700']"
            @click="includeHidden = !includeHidden"
          >
            <span
              :class="['absolute top-1 w-4 h-4 bg-white rounded-full transition-transform', includeHidden ? 'translate-x-7' : 'translate-x-1']"
            />
          </button>
        </div>
      </div>
    </Card>

    <!-- AI Settings -->
    <Card title="AI Features">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-slate-300">Enable AI Analysis</p>
          <p class="text-sm text-slate-500">Get insights and recommendations</p>
        </div>
        <button
          :class="['w-12 h-6 rounded-full transition-colors relative', useAI ? 'bg-blue-600' : 'bg-slate-700']"
          @click="useAI = !useAI"
        >
          <span
            :class="['absolute top-1 w-4 h-4 bg-white rounded-full transition-transform', useAI ? 'translate-x-7' : 'translate-x-1']"
          />
        </button>
      </div>
    </Card>

    <!-- Appearance -->
    <Card title="Appearance">
      <div class="flex gap-2">
        <button
          :class="['px-4 py-2 rounded-lg transition-colors', theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300']"
          @click="theme = 'dark'"
        >
          Dark
        </button>
        <button
          :class="['px-4 py-2 rounded-lg transition-colors', theme === 'light' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300']"
          @click="theme = 'light'"
        >
          Light
        </button>
      </div>
    </Card>

    <!-- Save -->
    <div class="flex justify-end">
      <Button variant="primary" @click="saveSettings">
        Save Settings
      </Button>
    </div>
  </div>
</template>

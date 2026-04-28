<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAnalysisStore } from '../../store/analysis'
import { Card, Button } from '../../design-system/components'

const store = useAnalysisStore()
const activeTab = ref<'overview' | 'files' | 'insights'>('overview')

const hasData = computed(() => store.analysisResult !== null)
const totalFiles = computed(() => store.analysisResult?.totalFiles || 0)
const totalSize = computed(() => store.analysisResult?.totalSize || 0)
const files = computed(() => store.analysisResult?.files || [])

const fileCategories = computed(() => {
  const cats: Record<string, number> = {}
  files.value.forEach(file => {
    cats[file.category] = (cats[file.category] || 0) + 1
  })
  return cats
})

const largestFiles = computed(() => {
  return [...files.value]
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
})

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-100">Dashboard</h1>
      <div class="flex gap-2">
        <Button 
          v-for="tab in ['overview', 'files', 'insights']" 
          :key="tab"
          :variant="activeTab === tab ? 'primary' : 'secondary'"
          size="sm"
          @click="activeTab = tab"
        >
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </Button>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="!hasData" class="text-center py-12">
      <p class="text-slate-400 mb-4">No analysis data available</p>
      <Button variant="primary" @click="$router.push('/scan')">
        Start Scan
      </Button>
    </div>

    <!-- Overview Tab -->
    <div v-else-if="activeTab === 'overview'" class="space-y-6">
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div class="text-3xl font-bold text-blue-400">{{ totalFiles.toLocaleString() }}</div>
          <div class="text-sm text-slate-400">Total Files</div>
        </Card>
        
        <Card>
          <div class="text-3xl font-bold text-emerald-400">{{ formatSize(totalSize) }}</div>
          <div class="text-sm text-slate-400">Total Size</div>
        </Card>
        
        <Card>
          <div class="text-3xl font-bold text-purple-400">{{ Object.keys(fileCategories).length }}</div>
          <div class="text-sm text-slate-400">Categories</div>
        </Card>
        
        <Card>
          <div class="text-3xl font-bold text-amber-400">{{ files.filter(f => f.size > 1024 * 1024 * 100).length }}</div>
          <div class="text-sm text-slate-400">Large Files (100MB+)</div>
        </Card>
      </div>

      <!-- Category Distribution -->
      <Card title="File Categories" v-if="Object.keys(fileCategories).length > 0">
        <div class="space-y-2">
          <div 
            v-for="(count, category) in fileCategories" 
            :key="category"
            class="flex items-center justify-between"
          >
            <span class="text-slate-300">{{ category }}</span>
            <span class="text-slate-400">{{ count }} files</span>
          </div>
        </div>
      </Card>
    </div>

    <!-- Files Tab -->
    <div v-else-if="activeTab === 'files'" class="space-y-4">
      <Card title="All Files">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-slate-700">
                <th class="pb-2 text-slate-400 font-medium">Name</th>
                <th class="pb-2 text-slate-400 font-medium">Category</th>
                <th class="pb-2 text-slate-400 font-medium text-right">Size</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              <tr v-for="file in files.slice(0, 50)" :key="file.path" class="text-slate-300">
                <td class="py-2">{{ file.name }}</td>
                <td class="py-2">
                  <span class="px-2 py-1 rounded text-xs bg-slate-800">{{ file.category }}</span>
                </td>
                <td class="py-2 text-right text-slate-400">{{ formatSize(file.size) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="files.length > 50" class="text-center text-slate-500 mt-4">
            Showing 50 of {{ files.length }} files
          </p>
        </div>
      </Card>
    </div>

    <!-- Insights Tab -->
    <div v-else-if="activeTab === 'insights'" class="space-y-4">
      <Card title="Largest Files">
        <div class="space-y-2">
          <div 
            v-for="file in largestFiles" 
            :key="file.path"
            class="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
          >
            <span class="text-slate-300 truncate max-w-md">{{ file.name }}</span>
            <span class="text-amber-400 font-medium">{{ formatSize(file.size) }}</span>
          </div>
        </div>
      </Card>

      <Card title="Storage Analysis">
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span class="text-slate-400">Storage Used</span>
              <span class="text-slate-300">{{ formatSize(totalSize) }}</span>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full" style="width: 60%"></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

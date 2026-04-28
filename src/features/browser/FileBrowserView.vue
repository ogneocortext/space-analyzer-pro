<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAnalysisStore } from '../../store/analysis'
import { Card, Button } from '../../design-system/components'

const store = useAnalysisStore()
const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const sortBy = ref<'name' | 'size' | 'category'>('name')
const viewMode = ref<'list' | 'grid'>('list')

const categories = computed(() => {
  const cats = new Set<string>()
  store.analysisResult?.files?.forEach(f => cats.add(f.category))
  return ['all', ...Array.from(cats)]
})

const filteredFiles = computed(() => {
  let files = store.analysisResult?.files || []
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    files = files.filter(f => 
      f.name.toLowerCase().includes(query) ||
      f.category.toLowerCase().includes(query)
    )
  }
  
  // Category filter
  if (selectedCategory.value !== 'all') {
    files = files.filter(f => f.category === selectedCategory.value)
  }
  
  // Sort
  files = [...files].sort((a, b) => {
    switch (sortBy.value) {
      case 'size': return b.size - a.size
      case 'category': return a.category.localeCompare(b.category)
      default: return a.name.localeCompare(b.name)
    }
  })
  
  return files
})

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-slate-100">File Browser</h1>

    <!-- Filters -->
    <Card padding="sm">
      <div class="flex flex-wrap gap-4 items-center">
        <!-- Search -->
        <div class="flex-1 min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search files..."
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          >
        </div>

        <!-- Category Filter -->
        <select
          v-model="selectedCategory"
          class="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
          </option>
        </select>

        <!-- Sort -->
        <select
          v-model="sortBy"
          class="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="category">Category</option>
        </select>

        <!-- View Toggle -->
        <div class="flex gap-1 bg-slate-800 rounded-lg p-1">
          <button
            :class="['px-3 py-1 rounded text-sm', viewMode === 'list' ? 'bg-slate-700 text-slate-100' : 'text-slate-400']"
            @click="viewMode = 'list'"
          >
            List
          </button>
          <button
            :class="['px-3 py-1 rounded text-sm', viewMode === 'grid' ? 'bg-slate-700 text-slate-100' : 'text-slate-400']"
            @click="viewMode = 'grid'"
          >
            Grid
          </button>
        </div>
      </div>
    </Card>

    <!-- Results Count -->
    <p class="text-slate-400">
      Showing {{ filteredFiles.length }} of {{ store.analysisResult?.files?.length || 0 }} files
    </p>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="space-y-2">
      <div
        v-for="file in filteredFiles.slice(0, 100)"
        :key="file.path"
        class="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <span class="text-lg">{{ file.category[0] }}</span>
          </div>
          <div>
            <p class="font-medium text-slate-200">{{ file.name }}</p>
            <p class="text-sm text-slate-500">{{ file.path }}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400">{{ file.category }}</span>
          <p class="text-sm text-slate-300 mt-1">{{ formatSize(file.size) }}</p>
        </div>
      </div>
    </div>

    <!-- Grid View -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="file in filteredFiles.slice(0, 100)"
        :key="file.path"
        class="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
      >
        <div class="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-3">
          <span class="text-2xl">{{ file.category[0] }}</span>
        </div>
        <p class="font-medium text-slate-200 truncate">{{ file.name }}</p>
        <p class="text-sm text-slate-400">{{ formatSize(file.size) }}</p>
        <span class="inline-block mt-2 px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500">{{ file.category }}</span>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="filteredFiles.length === 0" class="text-center py-12">
      <p class="text-slate-400 mb-4">No files found</p>
      <Button variant="primary" @click="$router.push('/scan')">
        Scan Directory
      </Button>
    </div>
  </div>
</template>

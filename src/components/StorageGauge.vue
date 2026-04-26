<template>
  <div class="storage-gauge-container">
    <div class="gauge-wrapper">
      <svg class="gauge-svg" viewBox="0 0 100 100">
        <!-- Background circle -->
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1e293b"
          stroke-width="8"
        />
        <!-- Progress circle with CSS animation -->
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          :stroke="gaugeColor"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="animatedOffset"
          class="gauge-progress"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div class="gauge-content">
        <HardDrive class="gauge-icon" :size="24" />
        <div class="gauge-percentage">{{ Math.round(percentage) }}%</div>
        <div class="gauge-label">Used</div>
      </div>
    </div>
    
    <div class="gauge-details">
      <div class="gauge-metric">
        <span class="metric-label">Used</span>
        <span class="metric-value">{{ formatBytes(used) }}</span>
      </div>
      <div class="gauge-metric">
        <span class="metric-label">Free</span>
        <span class="metric-value">{{ formatBytes(remaining) }}</span>
      </div>
      <div class="gauge-metric">
        <span class="metric-label">Total</span>
        <span class="metric-value">{{ formatBytes(total) }}</span>
      </div>
    </div>

    <div v-if="categories.length > 0" class="category-breakdown">
      <div v-for="(category, index) in categories" :key="index" class="category-item">
        <div
          class="category-color"
          :style="{ backgroundColor: category.color }"
        />
        <span class="category-name">{{ category.name }}</span>
        <span class="category-size">{{ formatBytes(category.size) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { HardDrive } from 'lucide-react'
import './StorageGauge.css'

interface Props {
  used: number
  total: number
  categories?: { name: string; size: number; color: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  categories: () => []
})

const percentage = computed(() => {
  return props.total > 0 ? (props.used / props.total) * 100 : 0
})

const remaining = computed(() => {
  return props.total - props.used
})

const gaugeColor = computed(() => {
  if (percentage.value < 50) return '#10b981' // emerald
  if (percentage.value < 75) return '#f59e0b' // amber
  if (percentage.value < 90) return '#f97316' // orange
  return '#ef4444' // red
})

const circumference = 2 * Math.PI * 45 // radius = 45
const offset = computed(() => {
  return circumference - (percentage.value / 100) * circumference
})

const animatedOffset = ref(circumference)

onMounted(() => {
  // Animate from full circumference to target offset
  setTimeout(() => {
    animatedOffset.value = offset.value
  }, 100)
})

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
</script>

<style scoped>
.gauge-progress {
  transition: stroke-dashoffset 1s ease-out;
}
</style>

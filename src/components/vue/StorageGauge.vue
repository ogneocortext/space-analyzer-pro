<template>
  <div class="storage-gauge-container">
    <div class="gauge-wrapper">
      <svg
        class="gauge-svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Storage usage gauge showing {{ Math.round(percentage) }}% used"
      >
        <!-- Background circle -->
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1e293b"
          stroke-width="8"
          aria-hidden="true"
        />
        <!-- Progress circle -->
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          :stroke="gaugeColor"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="offset"
          transform="rotate(-90 50 50)"
          class="gauge-progress"
          aria-hidden="true"
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
      <div v-for="category in categories" :key="category.name" class="category-item">
        <div class="category-color" :style="{ backgroundColor: category.color }" />
        <span class="category-name">{{ category.name }}</span>
        <span class="category-size">{{ formatBytes(category.size) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HardDrive } from "lucide-vue-next";

interface Props {
  used: number;
  total: number;
  categories?: { name: string; size: number; color: string }[];
}

const props = withDefaults(defineProps<Props>(), {
  categories: () => [],
});

const percentage = computed(() => {
  return props.total > 0 ? (props.used / props.total) * 100 : 0;
});

const remaining = computed(() => {
  return props.total - props.used;
});

const gaugeColor = computed(() => {
  if (percentage.value < 50) return "#10b981"; // emerald
  if (percentage.value < 75) return "#f59e0b"; // amber
  if (percentage.value < 90) return "#f97316"; // orange
  return "#ef4444"; // red
});

const circumference = 2 * Math.PI * 45; // radius = 45
const offset = computed(() => {
  return circumference - (percentage.value / 100) * circumference;
});

const formatBytes = (bytes: number) => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};
</script>

<style scoped>
.storage-gauge-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: rgba(30, 41, 59, 0.5);
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.gauge-wrapper {
  position: relative;
  width: 150px;
  height: 150px;
  margin: 0 auto;
}

.gauge-svg {
  width: 100%;
  height: 100%;
}

.gauge-progress {
  transition: stroke-dashoffset 1s ease-out;
}

.gauge-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.gauge-icon {
  color: #64748b;
}

.gauge-percentage {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.gauge-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.gauge-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.gauge-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
}

.category-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(51, 65, 85, 0.5);
  border-radius: 0.375rem;
}

.category-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.category-name {
  flex: 1;
  font-size: 0.875rem;
  color: #e2e8f0;
}

.category-size {
  font-size: 0.875rem;
  font-weight: 600;
  color: #94a3b8;
}
</style>

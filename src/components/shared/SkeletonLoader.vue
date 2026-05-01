<template>
  <div class="skeleton-wrapper">
    <!-- Header Skeleton -->
    <div v-if="type === 'header'" class="flex items-center justify-between mb-6">
      <div class="skeleton skeleton-text w-32 h-8"></div>
      <div class="flex gap-2">
        <div class="skeleton skeleton-button w-20 h-8"></div>
        <div class="skeleton skeleton-button w-20 h-8"></div>
      </div>
    </div>

    <!-- Card Grid Skeleton -->
    <div v-if="type === 'card-grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div v-for="i in count" :key="i" class="skeleton skeleton-card h-24 rounded-lg"></div>
    </div>

    <!-- Card Skeleton -->
    <div v-if="type === 'card'" class="skeleton skeleton-card h-48 rounded-lg mb-4"></div>

    <!-- List Skeleton -->
    <div v-if="type === 'list'" class="space-y-3">
      <div v-for="i in count" :key="i" class="flex items-center justify-between p-3 rounded-lg skeleton skeleton-list-item">
        <div class="flex items-center gap-3 w-full">
          <div class="skeleton w-4 h-4 rounded-full"></div>
          <div class="skeleton skeleton-text flex-1 h-4"></div>
        </div>
        <div class="skeleton w-16 h-4"></div>
      </div>
    </div>

    <!-- Text Skeleton -->
    <div v-if="type === 'text'" class="space-y-2">
      <div v-for="i in count" :key="i" class="skeleton skeleton-text" :class="lineClass"></div>
    </div>

    <!-- Full Page Skeleton -->
    <div v-if="type === 'page'" class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="skeleton skeleton-text w-48 h-8"></div>
        <div class="flex gap-2">
          <div class="skeleton skeleton-button w-24 h-10"></div>
          <div class="skeleton skeleton-button w-24 h-10"></div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="skeleton skeleton-card h-32 rounded-lg"></div>
      </div>
      <div class="skeleton skeleton-card h-64 rounded-lg"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  type?: 'header' | 'card-grid' | 'card' | 'list' | 'text' | 'page';
  count?: number;
  lineClass?: string;
}

withDefaults(defineProps<Props>(), {
  type: 'card',
  count: 4,
  lineClass: 'h-4 w-full',
});
</script>

<style scoped>
.skeleton-wrapper {
  width: 100%;
}

.skeleton {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.1) 25%,
    rgba(148, 163, 184, 0.2) 50%,
    rgba(148, 163, 184, 0.1) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-card {
  border-radius: 8px;
}

.skeleton-button {
  border-radius: 6px;
}

.skeleton-list-item {
  background: rgba(148, 163, 184, 0.05);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: rgba(148, 163, 184, 0.15);
  }
}
</style>

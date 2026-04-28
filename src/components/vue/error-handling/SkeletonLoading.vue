<template>
  <div>
    <!-- Base Skeleton Component -->
    <div v-if="variant === 'text'" :class="[baseClasses, variantClasses, animationClasses, className]">
      <div
        v-for="index in lines"
        :key="index"
        class="skeleton-text-line"
        :style="{
          width: typeof width === 'number' ? `${width}%` : width,
          height: '1rem',
          marginBottom: index < lines ? '0.5rem' : '0',
        }"
      />
    </div>

    <div
      v-else-if="variant === 'circular'"
      :class="[baseClasses, variantClasses, animationClasses, className]"
    >
      <Loader2 :size="typeof height === 'number' ? height : 24" class="animate-spin" />
    </div>

    <div
      v-else
      :class="[baseClasses, variantClasses, animationClasses, className]"
      :style="{
        width: typeof width === 'number' ? `${width}%` : width,
        height,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';

interface Props {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
  variant: 'rectangular',
  width: '100%',
  height: '1rem',
  lines: 1,
  animate: true,
});

const baseClasses = 'skeleton';
const variantClasses = computed(() => `skeleton-${props.variant}`);
const animationClasses = computed(() => (props.animate ? 'skeleton-animate' : ''));
</script>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
  background-size: 200% 100%;
  border-radius: 4px;
}

.skeleton-animate {
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-text {
  display: flex;
  flex-direction: column;
}

.skeleton-text-line {
  border-radius: 4px;
}

.skeleton-circular {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.skeleton-rectangular {
  border-radius: 4px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

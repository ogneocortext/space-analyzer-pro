<template>
  <div class="relative inline-block">
    <div class="inline-flex items-center" @mouseenter="showTooltip" @mouseleave="hideTooltip">
      <slot />
    </div>

    <!-- Tooltip Content -->
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="isVisible"
        :class="positionClasses"
        class="absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg border border-gray-700 max-w-xs"
      >
        <div v-if="title" class="font-medium mb-1">
          {{ title }}
        </div>
        <div class="text-gray-300">
          {{ content }}
        </div>
        <!-- Arrow -->
        <div
          :class="arrowClasses"
          class="absolute w-2 h-2 bg-gray-900 border border-gray-700 transform rotate-45"
        />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

interface Props {
  content: string;
  title?: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  position: "top",
  delay: 300,
});

const isVisible = ref(false);
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const showTooltip = () => {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    isVisible.value = true;
  }, props.delay);
};

const hideTooltip = () => {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    isVisible.value = false;
  }, 100);
};

const positionClasses = computed(() => {
  const pos = props.position || "top";
  switch (pos) {
    case "top":
      return "bottom-full left-1/2 transform -translate-x-1/2 mb-2";
    case "bottom":
      return "top-full left-1/2 transform -translate-x-1/2 mt-2";
    case "left":
      return "right-full top-1/2 transform -translate-y-1/2 mr-2";
    case "right":
      return "left-full top-1/2 transform -translate-y-1/2 ml-2";
    default:
      return "bottom-full left-1/2 transform -translate-x-1/2 mb-2";
  }
});

const arrowClasses = computed(() => {
  const pos = props.position || "top";
  switch (pos) {
    case "top":
      return "bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 border-t-0 border-l-0";
    case "bottom":
      return "top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-b-0 border-r-0";
    case "left":
      return "right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 border-l-0 border-t-0";
    case "right":
      return "left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 border-r-0 border-b-0";
    default:
      return "bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 border-t-0 border-l-0";
  }
});
</script>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  title?: string;
  subtitle?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  padding: "md",
  hover: false,
});

const classes = computed(() => {
  const base = "bg-slate-900 border border-slate-800 rounded-lg";
  const padding = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };
  const hoverClass = props.hover ? "hover:border-slate-700 transition-colors" : "";

  return `${base} ${padding[props.padding]} ${hoverClass}`;
});
</script>

<template>
  <div :class="classes">
    <div v-if="title || subtitle" class="mb-4">
      <h3 v-if="title" class="text-lg font-semibold text-slate-100">{{ title }}</h3>
      <p v-if="subtitle" class="text-sm text-slate-400 mt-1">{{ subtitle }}</p>
    </div>
    <slot />
  </div>
</template>

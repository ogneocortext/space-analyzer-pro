<template>
  <div class="flex items-center justify-center p-8">
    <div class="relative">
      <div class="w-12 h-12 rounded-full border-4 border-slate-800"></div>
      <div class="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin absolute top-0 left-0"></div>
    </div>
    <span v-if="text" class="ml-4 text-slate-400">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

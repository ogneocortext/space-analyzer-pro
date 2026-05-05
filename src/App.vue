<template>
  <component :is="shellComponent">
    <router-view />
  </component>
</template>

<script setup lang="ts">
import { onMounted, computed } from "vue";
import AppShell from "./layout/AppShell.vue";
import DesktopAppShell from "./layout/DesktopAppShell.vue";
import { useAnalysisStore } from "./store/analysis";
import { useTauriDesktop } from "./composables/useTauriDesktop";
import { useKeyboardShortcuts } from "./composables/useKeyboardShortcuts";

const store = useAnalysisStore();
const { isTauri } = useTauriDesktop();

// Use desktop shell when running in Tauri mode
const shellComponent = computed(() => {
  return isTauri.value ? DesktopAppShell : AppShell;
});

onMounted(async () => {
  // Initialize store - load previous analysis from database
  await store.initialize();

  // Initialize keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts();
});
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

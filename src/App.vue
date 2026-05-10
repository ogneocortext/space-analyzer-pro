<template>
  <component :is="shellComponent">
    <router-view />
  </component>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { defineAsyncComponent } from "vue";

// Lazy load shell components - optimized for fast startup
const AppShell = defineAsyncComponent(() => import("./layout/AppShell.vue"));
const DesktopAppShell = defineAsyncComponent(() => import("./layout/DesktopAppShell.vue"));

// Defer Tauri check to not block initial render
let isTauri = ref(false);
let shellComponent = computed(() => (isTauri.value ? DesktopAppShell : AppShell));

onMounted(async () => {
  // Load Tauri detection after mount
  try {
    const { useTauriDesktop } = await import("./composables/useTauriDesktop");
    isTauri.value = useTauriDesktop().isTauri.value;
  } catch (error) {
    // Fallback to web version
    isTauri.value = false;
  }

  // Defer store initialization to prioritize UI
  setTimeout(async () => {
    try {
      const { useAnalysisStore } = await import("./store/analysis");
      const store = useAnalysisStore();
      store.initialize();
    } catch (error) {
      console.warn("Store initialization deferred:", error);
    }
  }, 300);
});
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

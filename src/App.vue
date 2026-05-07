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

const store = useAnalysisStore();
const { isTauri } = useTauriDesktop();

const shellComponent = computed(() => {
  return isTauri.value ? DesktopAppShell : AppShell;
});

onMounted(async () => {
  await store.initialize();
});
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

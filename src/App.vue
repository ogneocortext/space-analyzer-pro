<template>
  <AppShell>
    <router-view />
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import AppShell from "./layout/AppShell.vue";
import { useAnalysisStore } from "./store/analysis";

const store = useAnalysisStore();

onMounted(async () => {
  // Initialize store - load previous analysis from database
  await store.initialize();
});
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>

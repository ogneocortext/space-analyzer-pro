<template>
  <div class="self-learning-view">
    <div class="view-header">
      <h1>🧠 Self-Learning System</h1>
      <p>AI-powered usage pattern adaptation for personalized recommendations</p>
    </div>

    <div class="self-learning-content">
      <SelfLearningEngine />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import SelfLearningEngine from "@/components/ai/SelfLearningEngine.vue";

onMounted(() => {
  document.title = "🧠 Self-Learning System - Space Analyzer Pro";
});
</script>

<style scoped>
.self-learning-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.view-header {
  margin-bottom: 2rem;
  text-align: center;
}

.view-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary, #fafaf9);
}

.view-header p {
  font-size: 1.1rem;
  color: var(--text-secondary, #6b6b70);
  max-width: 600px;
  margin: 0 auto;
}

.self-learning-content {
  background: var(--bg-card, #16161a);
  border-radius: 12px;
  border: 1px solid var(--border-subtle, #2a2a2e);
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .self-learning-view {
    padding: 1rem;
  }

  .view-header h1 {
    font-size: 2rem;
  }

  .self-learning-content {
    padding: 1rem;
  }
}
</style>

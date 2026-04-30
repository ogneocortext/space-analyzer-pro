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
import SelfLearningEngine from '@/components/ai/SelfLearningEngine.vue'
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
  color: #2c3e50;
}

.view-header p {
  font-size: 1.1rem;
  color: #7f8c8d;
  max-width: 600px;
  margin: 0 auto;
}

.self-learning-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

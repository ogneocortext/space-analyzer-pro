<template>
  <div class="learning-analytics-view">
    <div class="view-header">
      <h1>📊 Learning Analytics Dashboard</h1>
      <p>Real-time analytics and insights for the Self-Learning system</p>
    </div>
    
    <div class="analytics-content">
      <LearningAnalyticsDashboard />
      <div class="additional-features">
        <AnalyticsDataVisualization />
        <UserFeedbackCollection />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LearningAnalyticsDashboard from '@/components/ai/LearningAnalyticsDashboard.vue'
import AnalyticsDataVisualization from '@/components/ai/AnalyticsDataVisualization.vue'
import UserFeedbackCollection from '@/components/ai/UserFeedbackCollection.vue'
</script>

<style scoped>
.learning-analytics-view {
  padding: 2rem;
  max-width: 1400px;
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

.analytics-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.additional-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

@media (max-width: 1024px) {
  .additional-features {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .learning-analytics-view {
    padding: 1rem;
  }
  
  .view-header h1 {
    font-size: 2rem;
  }
  
  .analytics-content {
    gap: 1rem;
  }
}
</style>

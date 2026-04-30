<template>
  <div class="ab-testing-view">
    <div class="view-header">
      <h1>🧪 A/B Testing Framework</h1>
      <p>Enterprise-grade A/B testing for recommendation effectiveness optimization</p>
    </div>
    
    <div class="ab-testing-content">
      <ABTestAnalysisReport />
      <div class="testing-controls">
        <div class="control-section">
          <h3>Active Tests</h3>
          <p>Manage and monitor running A/B tests</p>
        </div>
        <div class="control-section">
          <h3>Test History</h3>
          <p>View completed tests and historical results</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ABTestAnalysisReport from '@/components/ai/ABTestAnalysisReport.vue'
</script>

<style scoped>
.ab-testing-view {
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

.ab-testing-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.testing-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 2rem;
}

.control-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  text-align: center;
}

.control-section h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.control-section p {
  color: #7f8c8d;
  margin-bottom: 1.5rem;
}

@media (max-width: 1024px) {
  .testing-controls {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ab-testing-view {
    padding: 1rem;
  }
  
  .view-header h1 {
    font-size: 2rem;
  }
  
  .testing-controls {
    gap: 1rem;
  }
  
  .control-section {
    padding: 1.5rem;
  }
}
</style>

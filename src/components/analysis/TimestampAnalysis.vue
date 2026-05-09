<template>
  <div class="timestamp-analysis">
    <h3>Timestamp Analysis</h3>
    <div class="timestamp-grid">
      <div class="timestamp-item">
        <span class="timestamp-label">Created:</span>
        <span class="timestamp-value">{{ formatDate(createdAt) }}</span>
      </div>
      <div class="timestamp-item">
        <span class="timestamp-label">Modified:</span>
        <span class="timestamp-value">{{ formatDate(modifiedAt) }}</span>
      </div>
      <div class="timestamp-item">
        <span class="timestamp-label">Accessed:</span>
        <span class="timestamp-value">{{ formatDate(accessedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const createdAt = ref(new Date("2024-01-15T10:30:00"));
const modifiedAt = ref(new Date("2024-05-02T14:20:00"));
const accessedAt = ref(new Date("2024-05-06T09:15:00"));

const formatDate = (date: Date): string => {
  return date.toLocaleString();
};
</script>

<style scoped>
.timestamp-analysis {
  padding: 1rem;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
}

.timestamp-analysis h3 {
  color: #f1f5f9;
  margin: 0 0 1rem 0;
}

.timestamp-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.timestamp-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: #334155;
  border-radius: 6px;
  border-left: 4px solid #60a5fa;
  transition: background-color 0.2s ease;
}

.timestamp-item:hover {
  background: #475569;
}

.timestamp-label {
  font-weight: 600;
  color: #e2e8f0;
}

.timestamp-value {
  color: #cbd5e1;
  font-family: monospace;
  font-size: 0.875rem;
}
</style>

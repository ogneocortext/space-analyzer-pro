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
  background: #f9f9f9;
  border-radius: 8px;
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
  background: white;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.timestamp-label {
  font-weight: 600;
  color: #333;
}

.timestamp-value {
  color: #666;
  font-family: monospace;
}
</style>

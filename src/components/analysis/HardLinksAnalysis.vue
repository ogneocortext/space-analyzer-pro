<template>
  <div class="hard-links-analysis">
    <h3>Hard Links Analysis</h3>
    <div class="hard-links-info">
      <div class="info-item">
        <span class="info-label">Total Hard Links:</span>
        <span class="info-value">{{ totalLinks }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Link Count:</span>
        <span class="info-value">{{ linkCount }}</span>
      </div>
    </div>
    <div class="linked-files" v-if="linkedFiles.length > 0">
      <h4>Linked Files:</h4>
      <div class="file-list">
        <div v-for="file in linkedFiles" :key="file.path" class="file-item">
          <span class="file-path">{{ file.path }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface LinkedFile {
  path: string;
  size: number;
}

const totalLinks = ref(3);
const linkCount = ref(2);
const linkedFiles = ref<LinkedFile[]>([
  { path: "C:\\Users\\Example\\Documents\\file1.txt", size: 1024 },
  { path: "C:\\Users\\Example\\Desktop\\file1.txt", size: 1024 },
]);

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
</script>

<style scoped>
.hard-links-analysis {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.hard-links-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.info-label {
  font-weight: 600;
  color: #495057;
}

.info-value {
  color: #007bff;
  font-weight: 500;
}

.linked-files {
  margin-top: 1.5rem;
}

.file-list {
  margin-top: 0.75rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border-left: 3px solid #28a745;
}

.file-path {
  font-family: monospace;
  font-size: 0.9rem;
  color: #495057;
}

.file-size {
  color: #6c757d;
  font-weight: 500;
}
</style>

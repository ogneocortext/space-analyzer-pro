<template>
  <div class="file-attributes-visualization">
    <h3>File Attributes Analysis</h3>
    <div class="attributes-grid">
      <div class="attribute-item" v-for="attr in attributes" :key="attr.name">
        <span class="attr-name">{{ attr.name }}</span>
        <span class="attr-value">{{ attr.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface FileAttribute {
  name: string;
  value: string | number;
}

const attributes = ref<FileAttribute[]>([
  { name: "Read-only", value: "No" },
  { name: "Hidden", value: "No" },
  { name: "System", value: "No" },
  { name: "Archive", value: "Yes" },
]);
</script>

<style scoped>
.file-attributes-visualization {
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.attribute-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
}

.attr-name {
  font-weight: 600;
}

.attr-value {
  color: #666;
}
</style>

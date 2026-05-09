<template>
  <div class="file-attributes-visualization">
    <div class="header-section">
      <h3>File Attributes Analysis</h3>
      <div class="header-controls">
        <button class="btn btn-primary" @click="addAttribute">➕ Add Attribute</button>
        <button class="btn btn-outline" @click="saveAttributes">💾 Save Changes</button>
        <button class="btn btn-secondary" @click="resetAttributes">🔄 Reset</button>
      </div>
    </div>

    <div class="attributes-grid">
      <div
        v-for="(attr, index) in attributes"
        :key="attr.name"
        class="attribute-item editable"
        @click="editAttribute(index)"
      >
        <span class="attr-name">{{ attr.name }}</span>
        <span v-if="!attr.editing" class="attr-value" :class="{ editing: attr.editing }">
          {{ attr.value }}
        </span>
        <input
          v-else
          v-model="attr.editValue"
          class="attr-input"
          type="text"
          @blur="finishEdit(index)"
          @keyup.enter="finishEdit(index)"
        />
      </div>
    </div>

    <div v-if="hasChanges" class="status-message">
      <p>⚠️ You have unsaved changes. Click "Save Changes" to apply them.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

interface FileAttribute {
  name: string;
  value: string | number | boolean;
  editing?: boolean;
  editValue?: string;
}

const attributes = ref<FileAttribute[]>([
  { name: "Read-only", value: "No", editing: false, editValue: "" },
  { name: "Hidden", value: "No", editing: false, editValue: "" },
  { name: "System", value: "No", editing: false, editValue: "" },
  { name: "Archive", value: "Yes", editing: false, editValue: "" },
  { name: "Created", value: "2024-01-15", editing: false, editValue: "" },
  { name: "Modified", value: "2024-01-20", editing: false, editValue: "" },
  { name: "Size", value: "2.5 MB", editing: false, editValue: "" },
  { name: "Permissions", value: "rw-r--r--", editing: false, editValue: "" },
  { name: "Owner", value: "user", editing: false, editValue: "" },
]);

const hasChanges = computed(() => {
  return attributes.value.some((attr) => attr.editing);
});

const editAttribute = (index: number) => {
  attributes.value[index].editing = true;
  attributes.value[index].editValue = String(attributes.value[index].value);
};

const finishEdit = (index: number) => {
  const attr = attributes.value[index];
  attr.editing = false;
  attr.value = attr.editValue || attr.value;
  delete attr.editValue;
};

const addAttribute = () => {
  const name = prompt("Enter attribute name:");
  if (name) {
    attributes.value.push({
      name,
      value: "New Value",
      editing: false,
      editValue: "",
    });
  }
};

const saveAttributes = () => {
  // Apply changes and save to backend/localStorage
  console.log(
    "Saving attributes:",
    attributes.value.map((attr) => ({
      name: attr.name,
      value: attr.value,
    }))
  );

  // Reset editing state
  attributes.value.forEach((attr) => {
    attr.editing = false;
    delete attr.editValue;
  });

  alert("File attributes saved successfully!");
};

const resetAttributes = () => {
  attributes.value = [
    { name: "Read-only", value: "No", editing: false, editValue: "" },
    { name: "Hidden", value: "No", editing: false, editValue: "" },
    { name: "System", value: "No", editing: false, editValue: "" },
    { name: "Archive", value: "Yes", editing: false, editValue: "" },
    { name: "Created", value: "2024-01-15", editing: false, editValue: "" },
    { name: "Modified", value: "2024-01-20", editing: false, editValue: "" },
    { name: "Size", value: "2.5 MB", editing: false, editValue: "" },
    { name: "Permissions", value: "rw-r--r--", editing: false, editValue: "" },
    { name: "Owner", value: "user", editing: false, editValue: "" },
  ];
};
</script>

<style scoped>
.file-attributes-visualization {
  padding: 1rem;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
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
  background: #334155;
  border-radius: 4px;
  border: 1px solid #475569;
  color: #f1f5f9;
  transition: background-color 0.2s ease;
}

.attribute-item:hover {
  background: #475569;
}

.attr-name {
  font-weight: 600;
  color: #e2e8f0;
}

.attr-value {
  color: #cbd5e1;
}

.attr-value.editing {
  color: #60a5fa;
}

.attr-input {
  background: #1e293b;
  border: 1px solid #475569;
  color: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  outline: none;
}

.attr-input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-section h3 {
  color: #f1f5f9;
  margin: 0;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #60a5fa;
  border-color: #60a5fa;
  color: white;
}

.btn-primary:hover {
  background: #3b82f6;
  border-color: #3b82f6;
}

.btn-outline {
  background: transparent;
  border-color: #60a5fa;
  color: #60a5fa;
}

.btn-outline:hover {
  background: #60a5fa;
  color: white;
}

.btn-secondary {
  background: #64748b;
  border-color: #64748b;
  color: white;
}

.btn-secondary:hover {
  background: #475569;
  border-color: #475569;
}

.status-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 4px;
  color: #92400e;
}
</style>

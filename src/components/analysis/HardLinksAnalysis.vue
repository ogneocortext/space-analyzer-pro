<template>
  <div class="hard-links-analysis">
    <div class="header-section">
      <h3>Hard Links Analysis</h3>
      <div class="header-controls">
        <button class="btn btn-primary" @click="scanHardLinks">🔍 Scan Hard Links</button>
        <button class="btn btn-outline" @click="createHardLink">🔗 Create Hard Link</button>
        <button class="btn btn-secondary" @click="removeBrokenLinks">🗑️ Remove Broken Links</button>
        <button class="btn btn-outline" @click="exportLinkList">📥 Export Link List</button>
      </div>
    </div>

    <div class="hard-links-info">
      <div class="info-item">
        <span class="info-label">Total Hard Links:</span>
        <span class="info-value">{{ totalLinks }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Link Count:</span>
        <span class="info-value">{{ linkCount }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Broken Links:</span>
        <span class="info-value">{{ brokenLinks }}</span>
      </div>
    </div>

    <div v-if="linkedFiles.length > 0" class="linked-files">
      <div class="section-header">
        <h4>Linked Files:</h4>
        <div class="file-controls">
          <input
            v-model="searchQuery"
            placeholder="Search linked files..."
            class="search-input"
            @input="filterFiles"
          />
          <select v-model="sortBy" class="sort-select" @change="sortFiles">
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>
      </div>

      <div class="file-list">
        <div
          v-for="(file, index) in filteredFiles"
          :key="file.path"
          class="file-item"
          :class="{ broken: file.broken }"
        >
          <div class="file-info">
            <span class="file-path" @click="selectFile(index)">{{ file.path }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
            <span class="file-status" :class="{ broken: file.broken, valid: !file.broken }">
              {{ file.broken ? "❌ Broken" : "✅ Valid" }}
            </span>
          </div>
          <div class="file-actions">
            <button v-if="file.broken" class="btn-small" @click="resolveLink(index)">
              🔧 Resolve
            </button>
            <button class="btn-small btn-danger" @click="deleteLink(index)">🗑️ Delete</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedFile" class="link-details">
      <h4>Link Details</h4>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Source Path:</span>
          <span class="detail-value">{{ selectedFile.sourcePath }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Target Path:</span>
          <span class="detail-value">{{ selectedFile.targetPath }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status:</span>
          <span
            class="detail-value"
            :class="{ broken: selectedFile.broken, valid: !selectedFile.broken }"
          >
            {{ selectedFile.broken ? "❌ Broken" : "✅ Valid" }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Created:</span>
          <span class="detail-value">{{ formatDate(selectedFile.created) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Size:</span>
          <span class="detail-value">{{ formatSize(selectedFile.size) }}</span>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary" @click="closeDetails">Close Details</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

interface LinkedFile {
  path: string;
  sourcePath: string;
  targetPath: string;
  size: number;
  created: Date;
  broken: boolean;
}

const totalLinks = ref(0);
const linkCount = ref(0);
const brokenLinks = ref(0);
const linkedFiles = ref<LinkedFile[]>([]);
const searchQuery = ref("");
const sortBy = ref("name");
const selectedFile = ref<LinkedFile | null>(null);

const filteredFiles = computed(() => {
  let filtered = linkedFiles.value;

  if (searchQuery.value) {
    filtered = filtered.filter((file) =>
      file.path.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  if (sortBy.value === "name") {
    filtered.sort((a, b) => a.path.localeCompare(b.path));
  } else if (sortBy.value === "size") {
    filtered.sort((a, b) => b.size - a.size);
  } else if (sortBy.value === "date") {
    filtered.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }

  return filtered;
});

const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString();
};

const scanHardLinks = async () => {
  try {
    // Simulate scanning for hard links
    const mockLinks: LinkedFile[] = [
      {
        path: "C:\\Users\\Example\\Documents\\report.pdf",
        sourcePath: "C:\\Users\\Example\\Desktop\\report.pdf",
        targetPath: "C:\\Users\\Example\\Documents\\report.pdf",
        size: 2048,
        created: new Date("2024-01-15"),
        broken: false,
      },
      {
        path: "C:\\Users\\Example\\Downloads\\image.jpg",
        sourcePath: "C:\\Users\\Example\\Pictures\\vacation.jpg",
        targetPath: "C:\\Users\\Example\\Downloads\\image.jpg",
        size: 1024,
        created: new Date("2024-01-10"),
        broken: true,
      },
      {
        path: "C:\\Users\\Example\\Projects\\project.zip",
        sourcePath: "C:\\Users\\Example\\Backup\\project.zip",
        targetPath: "C:\\Users\\Example\\Projects\\project.zip",
        size: 5120,
        created: new Date("2024-01-05"),
        broken: false,
      },
    ];

    linkedFiles.value = mockLinks;
    totalLinks.value = mockLinks.length;
    linkCount.value = mockLinks.filter((link) => !link.broken).length;
    brokenLinks.value = mockLinks.filter((link) => link.broken).length;

    console.log(`Found ${mockLinks.length} hard links, ${brokenLinks.value} broken`);
  } catch (error) {
    console.error("Failed to scan hard links:", error);
    alert("Failed to scan hard links. Please try again.");
  }
};

const createHardLink = () => {
  const sourcePath = prompt("Enter source file path:");
  const targetPath = prompt("Enter target path:");

  if (sourcePath && targetPath) {
    const newLink: LinkedFile = {
      path: targetPath,
      sourcePath,
      targetPath,
      size: 1024,
      created: new Date(),
      broken: false,
    };

    linkedFiles.value.push(newLink);
    totalLinks.value = linkedFiles.value.length;
    linkCount.value = linkedFiles.value.filter((link) => !link.broken).length;
  }
};

const removeBrokenLinks = () => {
  const brokenCount = linkedFiles.value.filter((link) => link.broken).length;
  if (brokenCount > 0) {
    if (confirm(`Remove ${brokenCount} broken hard links?`)) {
      linkedFiles.value = linkedFiles.value.filter((link) => !link.broken);
      totalLinks.value = linkedFiles.value.length;
      linkCount.value = linkedFiles.value.length;
      brokenLinks.value = 0;

      alert(`Removed ${brokenCount} broken hard links.`);
    }
  }
};

const resolveLink = (index: number) => {
  const file = linkedFiles.value[index];
  if (file.broken) {
    // Simulate resolving broken link
    file.broken = false;
    alert(`Resolved broken link: ${file.path}`);
  }
};

const deleteLink = (index: number) => {
  const file = linkedFiles.value[index];
  if (confirm(`Delete hard link: ${file.path}?`)) {
    linkedFiles.value.splice(index, 1);
    totalLinks.value = linkedFiles.value.length;
    linkCount.value = linkedFiles.value.filter((link) => !link.broken).length;

    alert(`Deleted hard link: ${file.path}`);
  }
};

const selectFile = (index: number) => {
  selectedFile.value = linkedFiles.value[index];
};

const closeDetails = () => {
  selectedFile.value = null;
};

const filterFiles = () => {
  // Filtering is handled by computed property
};

const sortFiles = () => {
  // Sorting is handled by computed property
};

const exportLinkList = () => {
  const linkData = linkedFiles.value.map((link) => ({
    sourcePath: link.sourcePath,
    targetPath: link.targetPath,
    size: link.size,
    status: link.broken ? "broken" : "valid",
    created: link.created,
  }));

  const blob = new Blob([JSON.stringify(linkData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hard-links-${Date.now()}.json`;
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.hard-links-analysis {
  padding: 1rem;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
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
  background: #334155;
  border-radius: 6px;
  border: 1px solid #475569;
  transition: background-color 0.2s ease;
}

.info-item:hover {
  background: #475569;
}

.info-label {
  font-weight: 600;
  color: #e2e8f0;
}

.info-value {
  color: #60a5fa;
  font-weight: 500;
}

.linked-files {
  margin-top: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  color: #f1f5f9;
  margin: 0;
}

.file-controls {
  display: flex;
  gap: 0.5rem;
}

.search-input,
.sort-select {
  background: #334155;
  border: 1px solid #475569;
  color: #f1f5f9;
  padding: 0.5rem;
  border-radius: 4px;
  outline: none;
}

.search-input:focus,
.sort-select:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
}

.file-list {
  margin-top: 0.75rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: #334155;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border-left: 3px solid #10b981;
  transition: background-color 0.2s ease;
}

.file-item:hover {
  background: #475569;
}

.file-path {
  font-family: monospace;
  font-size: 0.9rem;
  color: #e2e8f0;
}

.file-size {
  color: #cbd5e1;
  font-weight: 500;
}
</style>

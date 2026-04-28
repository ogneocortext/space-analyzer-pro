<template>
  <div class="duplicates-tab">
    <div v-if="!files || files.length === 0" class="empty-state">
      <HardDrive :size="64" class="empty-icon" />
      <h2>No Files to Analyze</h2>
      <p>Run an analysis first to find duplicate files</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="duplicates-header">
        <div class="header-content">
          <h2>
            <Copy class="header-icon" />
            Duplicate File Finder
          </h2>
          <p>Identify and manage duplicate files to reclaim storage space</p>
        </div>

        <div v-if="isScanning" class="scanning-indicator">
          <RefreshCw class="spinner" />
          Scanning for duplicates...
        </div>
      </div>

      <!-- Statistics -->
      <div class="duplicates-stats">
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.totalDuplicates.toLocaleString() }}
          </div>
          <div class="stat-label">Duplicate Files</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ formatFileSize(stats.totalWastedSpace) }}
          </div>
          <div class="stat-label">Wasted Space</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.totalGroups }}
          </div>
          <div class="stat-label">Duplicate Groups</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ formatFileSize(stats.largestWaste) }}
          </div>
          <div class="stat-label">Largest Waste</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="duplicates-filters">
        <div class="filter-group">
          <label class="filter-label">Search Duplicates:</label>
          <div class="search-input">
            <Search :size="16" />
            <input v-model="searchQuery" type="text" placeholder="Search by file name or path..." />
            <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">×</button>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Minimum Size:</label>
          <select v-model="minSize" class="size-filter">
            <option :value="0">Any Size</option>
            <option :value="1024">&gt; 1KB</option>
            <option :value="1024 * 1024">&gt; 1MB</option>
            <option :value="1024 * 1024 * 100">&gt; 100MB</option>
            <option :value="1024 * 1024 * 1024">&gt; 1GB</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Sort By:</label>
          <select v-model="sortBy" class="sort-filter">
            <option value="size">Wasted Space</option>
            <option value="count">File Count</option>
            <option value="name">File Name</option>
          </select>
        </div>
      </div>

      <!-- Actions -->
      <div class="duplicates-actions">
        <button class="action-btn" @click="toggleAllGroups">
          {{ selectedGroups.size === filteredDuplicates.length ? "Deselect All" : "Select All" }}
        </button>

        <template v-if="selectedGroups.size > 0">
          <button class="action-btn danger" @click="handleDeleteSelected">
            <Trash2 :size="16" />
            Delete Selected Duplicates
          </button>

          <button class="action-btn" @click="exportDuplicatesReport">
            <Download :size="16" />
            Export Report
          </button>
        </template>
      </div>

      <!-- Duplicate Groups -->
      <div class="duplicates-list">
        <div v-if="filteredDuplicates.length === 0" class="no-duplicates">
          <CheckCircle :size="48" class="no-duplicates-icon" />
          <h3>No Duplicates Found</h3>
          <p>No duplicate files match your current filters.</p>
        </div>

        <div
          v-for="group in filteredDuplicates"
          :key="group.hash"
          :class="['duplicate-group', selectedGroups.has(group.hash) ? 'selected' : '']"
        >
          <div class="group-header" @click="toggleGroupExpansion(group.hash)">
            <input
              type="checkbox"
              :checked="selectedGroups.has(group.hash)"
              class="group-checkbox"
              @change="toggleGroupSelection(group.hash)"
              @click.stop
            />
            <div class="group-info">
              <div class="group-main">
                <File :size="16" class="group-icon" />
                <div class="group-details">
                  <div class="group-name">
                    {{ group.files[0].name }}
                  </div>
                  <div class="group-meta">
                    <span class="group-size">{{ formatFileSize(group.files[0].size) }}</span>
                    <span class="group-count">+{{ group.files.length - 1 }} duplicates</span>
                  </div>
                </div>
              </div>
              <div class="group-waste">
                <AlertTriangle :size="14" class="waste-icon" />
                <span class="waste-amount">{{ formatFileSize(group.totalWastedSpace) }}</span>
                <span class="waste-label">wasted</span>
              </div>
            </div>
            <div class="group-toggle">
              <EyeOff v-if="expandedGroups.has(group.hash)" :size="16" />
              <Eye v-else :size="16" />
            </div>
          </div>

          <div v-if="expandedGroups.has(group.hash)" class="group-content">
            <div class="file-section">
              <div class="file-header">
                <h4>Original File (Keep)</h4>
              </div>
              <div class="file-item original">
                <File :size="14" />
                <div class="file-info">
                  <div class="file-name">
                    {{ group.files[0].name }}
                  </div>
                  <div class="file-meta">
                    <span>{{ formatFileSize(group.files[0].size) }}</span>
                    <span>{{ group.files[0].path }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="group.files.length > 1" class="file-section">
              <div class="file-header">
                <h4>Duplicate Files (Can Delete)</h4>
                <div class="duplicate-actions">
                  <button
                    class="duplicate-action-btn danger"
                    title="Delete all duplicate files"
                    @click="handleDuplicateAction('delete', group)"
                  >
                    <Trash2 :size="14" />
                    Delete All
                  </button>
                  <button
                    class="duplicate-action-btn"
                    title="Move duplicate files to another location"
                    @click="handleDuplicateAction('move', group)"
                  >
                    <Folder :size="14" />
                    Move All
                  </button>
                </div>
              </div>
              <div
                v-for="(file, index) in group.files.slice(1)"
                :key="index"
                class="file-item duplicate"
              >
                <File :size="14" />
                <div class="file-info">
                  <div class="file-name">
                    {{ file.name }}
                  </div>
                  <div class="file-meta">
                    <span>{{ formatFileSize(file.size) }}</span>
                    <span>{{ file.path }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  Search,
  File,
  Folder,
  Trash2,
  Download,
  CheckCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  RefreshCw,
} from "lucide-vue-next";

interface DuplicateFile {
  name: string;
  size: number;
  path: string;
  extension: string;
  category: string;
  modified?: Date;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  files: DuplicateFile[];
  totalWastedSpace: number;
  potentialSavings: string;
}

interface DuplicatesTabProps {
  files: DuplicateFile[];
}

const props = defineProps<DuplicatesTabProps>();

const emit = defineEmits<{
  fileAction: [action: string, files: DuplicateFile[]];
}>();

const searchQuery = ref("");
const minSize = ref(0);
const selectedGroups = ref<Set<string>>(new Set());
const expandedGroups = ref<Set<string>>(new Set());
const isScanning = ref(false);
const sortBy = ref<"size" | "count" | "name">("size");

// Simple hash function for duplicate detection
const generateFileHash = (file: DuplicateFile): string => {
  const baseString = `${file.name}-${file.size}-${file.extension}`;
  let hash = 0;
  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Find duplicates
const duplicateGroups = computed(() => {
  if (!props.files || props.files.length === 0) return [];

  isScanning.value = true;
  const fileMap = new Map<string, DuplicateFile[]>();

  // Group files by hash
  props.files.forEach((file) => {
    const hash = generateFileHash(file);
    if (!fileMap.has(hash)) {
      fileMap.set(hash, []);
    }
    fileMap.get(hash)!.push(file);
  });

  // Filter for actual duplicates (groups with 2+ files)
  const duplicates: DuplicateGroup[] = [];

  fileMap.forEach((fileList, hash) => {
    if (fileList.length > 1) {
      const totalSize = fileList.reduce((sum, file) => sum + file.size, 0);
      const largestFile = Math.max(...fileList.map((f) => f.size));
      const wastedSpace = totalSize - largestFile;

      duplicates.push({
        hash,
        files: fileList,
        size: totalSize,
        totalWastedSpace: wastedSpace,
        potentialSavings: formatFileSize(wastedSpace),
      });
    }
  });

  isScanning.value = false;

  return duplicates.sort((a, b) => {
    switch (sortBy.value) {
      case "size":
        return b.totalWastedSpace - a.totalWastedSpace;
      case "count":
        return b.files.length - a.files.length;
      case "name":
        return a.files[0].name.localeCompare(b.files[0].name);
      default:
        return 0;
    }
  });
});

// Watch for changes to trigger scanning state
watch(
  () => props.files,
  () => {
    if (props.files && props.files.length > 0) {
      isScanning.value = true;
      setTimeout(() => {
        isScanning.value = false;
      }, 100);
    }
  },
  { immediate: true }
);

// Filter duplicates
const filteredDuplicates = computed(() => {
  return duplicateGroups.value.filter((group) => {
    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const matchesSearch = group.files.some(
        (file) => file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }

    // Size filter
    if (minSize.value > 0) {
      const hasLargeEnoughFile = group.files.some((file) => file.size >= minSize.value);
      if (!hasLargeEnoughFile) return false;
    }

    return true;
  });
});

// Calculate statistics
const stats = computed(() => {
  const totalDuplicates = filteredDuplicates.value.reduce(
    (sum, group) => sum + group.files.length - 1,
    0
  );
  const totalWastedSpace = filteredDuplicates.value.reduce(
    (sum, group) => sum + group.totalWastedSpace,
    0
  );
  const totalGroups = filteredDuplicates.value.length;
  const largestWaste = Math.max(...filteredDuplicates.value.map((g) => g.totalWastedSpace), 0);

  return {
    totalDuplicates,
    totalWastedSpace,
    totalGroups,
    largestWaste,
    averageWastePerGroup: totalGroups > 0 ? totalWastedSpace / totalGroups : 0,
  };
});

// Toggle group expansion
const toggleGroupExpansion = (hash: string) => {
  const newSet = new Set(expandedGroups.value);
  if (newSet.has(hash)) {
    newSet.delete(hash);
  } else {
    newSet.add(hash);
  }
  expandedGroups.value = newSet;
};

// Toggle group selection
const toggleGroupSelection = (hash: string) => {
  const newSet = new Set(selectedGroups.value);
  if (newSet.has(hash)) {
    newSet.delete(hash);
  } else {
    newSet.add(hash);
  }
  selectedGroups.value = newSet;
};

// Select/deselect all groups
const toggleAllGroups = () => {
  if (selectedGroups.value.size === filteredDuplicates.value.length) {
    selectedGroups.value = new Set();
  } else {
    selectedGroups.value = new Set(filteredDuplicates.value.map((g) => g.hash));
  }
};

// Handle duplicate actions
const handleDuplicateAction = (action: string, group: DuplicateGroup) => {
  const filesToKeep = [group.files[0]];
  const filesToDelete = group.files.slice(1);

  switch (action) {
    case "delete":
      emit("fileAction", "delete", filesToDelete);
      break;
    case "keep":
      emit("fileAction", "keep", filesToKeep);
      break;
    case "move":
      emit("fileAction", "move", filesToDelete);
      break;
  }
};

// Handle delete selected
const handleDeleteSelected = () => {
  const filesToDelete = Array.from(selectedGroups.value).flatMap(
    (hash) => filteredDuplicates.value.find((g) => g.hash === hash)?.files.slice(1) || []
  );
  emit("fileAction", "delete", filesToDelete);
};

// Export duplicates report
const exportDuplicatesReport = () => {
  const report = {
    generated: new Date().toISOString(),
    stats: stats.value,
    duplicates: filteredDuplicates.value.map((group) => ({
      hash: group.hash,
      fileCount: group.files.length,
      wastedSpace: group.totalWastedSpace,
      files: group.files.map((f) => ({
        name: f.name,
        path: f.path,
        size: f.size,
        modified: f.modified,
      })),
    })),
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `duplicates-report-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.duplicates-tab {
  @apply p-6;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.empty-icon {
  @apply text-gray-400 mb-4;
}

.empty-state h2 {
  @apply text-xl font-semibold text-white mb-2;
}

.empty-state p {
  @apply text-gray-400;
}

.duplicates-header {
  @apply mb-6;
}

.header-content h2 {
  @apply flex items-center gap-2 text-2xl font-bold text-white mb-2;
}

.header-icon {
  @apply text-blue-400;
}

.header-content > p {
  @apply text-gray-400;
}

.scanning-indicator {
  @apply flex items-center gap-2 text-blue-400 text-sm mt-2;
}

.spinner {
  @apply animate-spin;
}

.duplicates-stats {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6;
}

.stat-card {
  @apply bg-gray-800 border border-gray-700 rounded-lg p-4 text-center;
}

.stat-value {
  @apply text-2xl font-bold text-white mb-1;
}

.stat-label {
  @apply text-sm text-gray-400;
}

.duplicates-filters {
  @apply flex flex-wrap gap-4 mb-6 p-4 bg-gray-800 border border-gray-700 rounded-lg;
}

.filter-group {
  @apply flex flex-col gap-2;
}

.filter-label {
  @apply text-sm text-gray-300 font-medium;
}

.search-input {
  @apply flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2;
}

.search-input input {
  @apply flex-1 bg-transparent text-white text-sm outline-none;
}

.clear-search {
  @apply text-gray-400 hover:text-white transition-colors;
}

.size-filter,
.sort-filter {
  @apply bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none;
}

.duplicates-actions {
  @apply flex flex-wrap gap-3 mb-6;
}

.action-btn {
  @apply flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors;
}

.action-btn.danger {
  @apply bg-red-600 hover:bg-red-700;
}

.duplicates-list {
  @apply space-y-3;
}

.no-duplicates {
  @apply flex flex-col items-center justify-center py-12 text-center;
}

.no-duplicates-icon {
  @apply text-green-400 mb-4;
}

.no-duplicates h3 {
  @apply text-lg font-semibold text-white mb-2;
}

.no-duplicates p {
  @apply text-gray-400;
}

.duplicate-group {
  @apply bg-gray-800 border border-gray-700 rounded-lg overflow-hidden;
}

.duplicate-group.selected {
  @apply border-blue-500 bg-blue-500/10;
}

.group-header {
  @apply flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-700/50 transition-colors;
}

.group-checkbox {
  @apply w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500;
}

.group-info {
  @apply flex-1 flex items-center justify-between;
}

.group-main {
  @apply flex items-center gap-3;
}

.group-icon {
  @apply text-gray-400;
}

.group-details {
  @apply flex flex-col;
}

.group-name {
  @apply text-white font-medium;
}

.group-meta {
  @apply flex items-center gap-3 text-sm text-gray-400;
}

.group-waste {
  @apply flex items-center gap-2 text-orange-400;
}

.waste-icon {
  @apply shrink-0;
}

.waste-amount {
  @apply font-semibold;
}

.waste-label {
  @apply text-sm;
}

.group-toggle {
  @apply text-gray-400;
}

.group-content {
  @apply p-4 border-t border-gray-700 space-y-4;
}

.file-section {
  @apply space-y-2;
}

.file-header {
  @apply flex items-center justify-between mb-2;
}

.file-header h4 {
  @apply text-sm font-medium text-white;
}

.duplicate-actions {
  @apply flex gap-2;
}

.duplicate-action-btn {
  @apply flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors;
}

.duplicate-action-btn.danger {
  @apply bg-red-600 hover:bg-red-700;
}

.file-item {
  @apply flex items-center gap-3 p-2 bg-gray-700/50 rounded;
}

.file-item.original {
  @apply border-l-2 border-green-500;
}

.file-item.duplicate {
  @apply border-l-2 border-orange-500;
}

.file-info {
  @apply flex-1 flex flex-col;
}

.file-name {
  @apply text-white text-sm font-medium;
}

.file-meta {
  @apply flex items-center gap-3 text-xs text-gray-400;
}
</style>

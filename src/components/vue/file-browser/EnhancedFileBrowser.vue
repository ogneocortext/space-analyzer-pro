<template>
  <div class="enhanced-file-browser">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <FolderOpen class="w-6 h-6 text-blue-400" />
        <div>
          <h2 class="text-xl font-semibold">File Browser</h2>
          <p class="text-sm text-gray-400">{{ filteredFiles.length }} files</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          @click="viewState.viewMode = 'list'"
          :class="[
            'p-2 rounded-lg transition-colors',
            viewState.viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
          ]"
        >
          <List class="w-4 h-4" />
        </button>
        <button
          @click="viewState.viewMode = 'grid'"
          :class="[
            'p-2 rounded-lg transition-colors',
            viewState.viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
          ]"
        >
          <Grid3X3 class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex gap-2 mb-4">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          v-model="viewState.searchQuery"
          type="text"
          placeholder="Search files..."
          class="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
        />
      </div>
      <button
        @click="showAdvancedFilters = !showAdvancedFilters"
        class="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        <Filter class="w-4 h-4" />
        <span>Filters</span>
      </button>
    </div>

    <!-- Advanced Filters -->
    <div v-if="showAdvancedFilters" class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-2">Sort By</label>
          <select
            v-model="viewState.sortBy"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="modified">Modified</option>
            <option value="category">Category</option>
            <option value="extension">Extension</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-2">Sort Order</label>
          <button
            @click="viewState.sortOrder = viewState.sortOrder === 'asc' ? 'desc' : 'asc'"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white hover:bg-gray-600 transition-colors"
          >
            <ArrowUpDown class="w-4 h-4" />
            <span>{{ viewState.sortOrder === 'asc' ? 'Ascending' : 'Descending' }}</span>
          </button>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-2">Group By</label>
          <select
            v-model="viewState.groupBy"
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="none">None</option>
            <option value="category">Category</option>
            <option value="extension">Extension</option>
            <option value="size">Size</option>
            <option value="folder">Folder</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-2">View</label>
          <button
            @click="viewState.showHidden = !viewState.showHidden"
            :class="[
              'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors',
              viewState.showHidden ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            ]"
          >
            <Eye v-if="viewState.showHidden" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
            <span>{{ viewState.showHidden ? 'Show Hidden' : 'Hide Hidden' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- File List -->
    <div class="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <!-- List View -->
      <div v-if="viewState.viewMode === 'list'" class="divide-y divide-gray-700">
        <div
          v-for="file in sortedFiles"
          :key="file.path"
          @click="selectFile(file.path)"
          :class="[
            'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-700 transition-colors',
            viewState.selectedFiles.has(file.path) ? 'bg-blue-600/20' : ''
          ]"
        >
          <File class="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">{{ file.name }}</p>
            <p class="text-xs text-gray-400 truncate">{{ file.path }}</p>
          </div>
          <div class="flex items-center gap-4 flex-shrink-0">
            <span class="text-sm text-gray-400">{{ formatSize(file.size) }}</span>
            <span class="text-xs px-2 py-1 bg-gray-700 rounded text-gray-300">{{ file.category }}</span>
          </div>
        </div>
      </div>

      <!-- Grid View -->
      <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
        <div
          v-for="file in sortedFiles"
          :key="file.path"
          @click="selectFile(file.path)"
          :class="[
            'bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-colors',
            viewState.selectedFiles.has(file.path) ? 'ring-2 ring-blue-500' : ''
          ]"
        >
          <File class="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p class="text-sm font-medium text-white truncate text-center">{{ file.name }}</p>
          <p class="text-xs text-gray-400 text-center mt-1">{{ formatSize(file.size) }}</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="sortedFiles.length === 0" class="text-center py-12 text-gray-400">
        <File class="w-12 h-12 mx-auto mb-4" />
        <p>No files found</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  FolderOpen,
  File,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Clock,
  HardDrive,
  Tag,
  Layers,
  ArrowUpDown,
  MoreVertical,
  Eye,
  EyeOff,
  Download,
  Trash2,
} from 'lucide-vue-next';

interface FileData {
  name: string;
  size: number;
  path: string;
  extension: string;
  category: string;
  subcategory?: string;
  semantic_tags?: string[];
  modified?: Date;
  created?: Date;
}

interface EnhancedFileBrowserProps {
  files: FileData[];
  categories?: Record<string, { count: number; size: number }>;
  onFileAction?: (action: string, file: FileData) => void;
}

const props = withDefaults(defineProps<EnhancedFileBrowserProps>(), {
  files: () => [],
  categories: () => ({}),
  onFileAction: () => {},
});

const showAdvancedFilters = ref(false);

const viewState = ref({
  searchQuery: '',
  sortBy: 'name' as 'name' | 'size' | 'modified' | 'category' | 'extension',
  sortOrder: 'asc' as 'asc' | 'desc',
  filters: {
    categories: [] as string[],
    extensions: [] as string[],
    sizeRange: [0, Number.MAX_SAFE_INTEGER] as [number, number],
    dateRange: [null, null] as [Date | null, Date | null],
  },
  viewMode: 'list' as 'list' | 'grid' | 'tree' | 'compact',
  groupBy: 'none' as 'none' | 'category' | 'extension' | 'size' | 'folder',
  showHidden: false,
  selectedFiles: new Set<string>(),
  expandedGroups: new Set<string>(),
});

const filteredFiles = computed(() => {
  let result = [...props.files];

  // Apply search filter
  if (viewState.value.searchQuery) {
    const query = viewState.value.searchQuery.toLowerCase();
    result = result.filter(
      (file) =>
        file.name.toLowerCase().includes(query) ||
        file.path.toLowerCase().includes(query) ||
        file.category.toLowerCase().includes(query)
    );
  }

  // Apply category filter
  if (viewState.value.filters.categories.length > 0) {
    result = result.filter((file) => viewState.value.filters.categories.includes(file.category));
  }

  // Apply extension filter
  if (viewState.value.filters.extensions.length > 0) {
    result = result.filter((file) => viewState.value.filters.extensions.includes(file.extension));
  }

  // Apply size filter
  result = result.filter(
    (file) =>
      file.size >= viewState.value.filters.sizeRange[0] &&
      file.size <= viewState.value.filters.sizeRange[1]
  );

  return result;
});

const sortedFiles = computed(() => {
  const result = [...filteredFiles.value];

  result.sort((a, b) => {
    let comparison = 0;

    switch (viewState.value.sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'modified':
        comparison = (a.modified?.getTime() || 0) - (b.modified?.getTime() || 0);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'extension':
        comparison = a.extension.localeCompare(b.extension);
        break;
    }

    return viewState.value.sortOrder === 'asc' ? comparison : -comparison;
  });

  return result;
});

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const selectFile = (path: string) => {
  if (viewState.value.selectedFiles.has(path)) {
    viewState.value.selectedFiles.delete(path);
  } else {
    viewState.value.selectedFiles.add(path);
  }
};
</script>

<style scoped>
.enhanced-file-browser {
  @apply space-y-4;
}
</style>

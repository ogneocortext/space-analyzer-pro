<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";

const store = useAnalysisStore();
const selectedFolders = ref<Set<string>>(new Set());

// Find empty folders from analysis data
const emptyFolders = computed(() => {
  if (!store.analysisResult?.files) return [];
  
  const files = store.analysisResult.files;
  const folderPaths = new Set<string>();
  const fileParentFolders = new Set<string>();
  
  // Collect all folder paths and file parent paths
  files.forEach((file: any) => {
    const parts = file.path.split(/[\\/]/);
    const fullPath = parts.slice(0, -1).join("/");
    
    // Add all parent folders of this file
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      fileParentFolders.add(currentPath);
    }
    
    // Also track the full folder path
    if (fullPath) {
      folderPaths.add(fullPath);
    }
  });
  
  // Folders that exist in folderPaths but have no files directly in them
  // are considered "empty" (they may contain subfolders with files)
  const potentiallyEmpty = Array.from(folderPaths).filter(folder => {
    // Check if any file is DIRECTLY in this folder (not in subfolders)
    const hasDirectFiles = files.some((f: any) => {
      const parent = f.path.split(/[\\/]/).slice(0, -1).join("/");
      return parent === folder;
    });
    return !hasDirectFiles;
  });
  
  // Sort by depth (deepest first for safer deletion)
  return potentiallyEmpty
    .map(path => ({
      path,
      depth: path.split("/").length,
      name: path.split("/").pop() || path,
    }))
    .sort((a, b) => b.depth - a.depth);
});

// Stats
const stats = computed(() => {
  if (!emptyFolders.value.length) return null;
  
  return {
    total: emptyFolders.value.length,
    selected: selectedFolders.value.size,
  };
});

function toggleSelection(path: string) {
  if (selectedFolders.value.has(path)) {
    selectedFolders.value.delete(path);
  } else {
    selectedFolders.value.add(path);
  }
}

function selectAll() {
  emptyFolders.value.forEach(f => selectedFolders.value.add(f.path));
}

function clearSelection() {
  selectedFolders.value.clear();
}

function copyPath(path: string) {
  navigator.clipboard.writeText(path);
}

// Simulate deletion (in real app, this would call backend API)
async function deleteSelected() {
  if (selectedFolders.value.size === 0) return;
  
  const confirmed = confirm(`Delete ${selectedFolders.value.size} empty folders?\n\nThis action cannot be undone.`);
  if (!confirmed) return;
  
  // In a real implementation, this would call the backend
  alert(`Would delete ${selectedFolders.value.size} folders.\n(Backend deletion not implemented in demo)`);
  selectedFolders.value.clear();
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-100">Empty Folder Finder</h1>
        <p class="text-slate-400 mt-1">Find and clean up empty directories</p>
      </div>
    </div>

    <!-- No Data -->
    <div v-if="!store.analysisResult" class="p-8 text-center">
      <p class="text-slate-400 mb-4">No scan data available. Please scan a directory first.</p>
      <Button variant="secondary" @click="$router.push('/scan')">Go to Scanner</Button>
    </div>

    <template v-else>
      <!-- Stats -->
      <div v-if="stats" class="grid grid-cols-3 gap-4">
        <Card title="Empty Folders Found">
          <div class="text-2xl font-bold text-orange-400">{{ stats.total }}</div>
          <div class="text-sm text-slate-500">directories without files</div>
        </Card>
        <Card title="Selected">
          <div class="text-2xl font-bold text-blue-400">{{ stats.selected }}</div>
          <div class="text-sm text-slate-500">marked for deletion</div>
        </Card>
        <Card title="Action">
          <Button
            variant="danger"
            :disabled="stats.selected === 0"
            @click="deleteSelected"
          >
            Delete Selected
          </Button>
        </Card>
      </div>

      <!-- Selection Actions -->
      <div v-if="selectedFolders.size > 0" class="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
        <span class="text-orange-400">{{ selectedFolders.size }} folders selected</span>
        <Button variant="secondary" size="sm" @click="clearSelection">Clear</Button>
      </div>

      <!-- Folder List -->
      <Card title="Potentially Empty Folders">
        <div class="space-y-2">
          <!-- Header -->
          <div class="flex items-center gap-4 p-2 text-sm font-medium text-slate-500 border-b border-slate-700">
            <input
              type="checkbox"
              :checked="selectedFolders.size === emptyFolders.length && emptyFolders.length > 0"
              @change="selectedFolders.size === emptyFolders.length ? clearSelection() : selectAll()"
              class="rounded border-slate-600 bg-slate-800"
            />
            <span class="flex-1">Folder Path</span>
            <span class="w-20 text-center">Depth</span>
            <span class="w-20 text-right">Actions</span>
          </div>

          <!-- Folders -->
          <div
            v-for="folder in emptyFolders"
            :key="folder.path"
            class="flex items-center gap-4 p-2 rounded hover:bg-slate-800/50 transition-colors"
            :class="selectedFolders.has(folder.path) ? 'bg-orange-500/10' : ''"
          >
            <input
              type="checkbox"
              :checked="selectedFolders.has(folder.path)"
              @change="toggleSelection(folder.path)"
              class="rounded border-slate-600 bg-slate-800"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-lg">📁</span>
                <span class="font-medium text-slate-200 truncate" :title="folder.path">{{ folder.name }}</span>
              </div>
              <div class="text-sm text-slate-500 truncate" :title="folder.path">{{ folder.path }}</div>
            </div>
            <span class="w-20 text-center text-sm text-slate-400">{{ folder.depth }}</span>
            <div class="w-20 text-right">
              <button
                class="text-slate-400 hover:text-blue-400 transition-colors"
                title="Copy path"
                @click="copyPath(folder.path)"
              >
                📋
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="emptyFolders.length === 0" class="p-8 text-center">
          <p class="text-slate-400">🎉 No empty folders found!</p>
          <p class="text-sm text-slate-500 mt-2">All directories contain files.</p>
        </div>
      </Card>

      <!-- Info -->
      <div class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h3 class="font-medium text-blue-400 mb-2">About Empty Folders</h3>
        <ul class="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>Empty folders take up minimal space but clutter your file system</li>
          <li>Folders are sorted by depth (deepest first) for safer deletion</li>
          <li>Always review before deleting - some empty folders may be needed by applications</li>
          <li>Consider backing up before bulk deletion operations</li>
        </ul>
      </div>
    </template>
  </div>
</template>

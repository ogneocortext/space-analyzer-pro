<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="$emit('close')"
    >
      <div
        class="bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
      >
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-white">Enhanced File Details</h2>
          <button class="text-slate-400 hover:text-white transition-colors" @click="$emit('close')">
            <X :size="20" />
          </button>
        </div>

        <!-- File Overview -->
        <div v-if="selectedFile" class="space-y-6">
          <div class="bg-slate-700/30 rounded-lg p-4">
            <div class="flex items-start gap-4">
              <div class="p-2 bg-blue-500/20 rounded-lg">
                <File :size="24" class="text-blue-400" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-medium text-white mb-1">{{ selectedFile.name }}</h3>
                <p class="text-slate-400 text-sm mb-2">{{ selectedFile.path }}</p>
                <div class="flex items-center gap-4 text-sm">
                  <span class="text-emerald-400">{{ formatBytes(selectedFile.size) }}</span>
                  <span class="text-blue-400">{{ selectedFile.extension || 'No extension' }}</span>
                  <span class="text-purple-400">{{ selectedFile.category || 'Unknown' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- File Attributes Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Basic Attributes -->
            <div class="bg-slate-700/30 rounded-lg p-4">
              <h4 class="text-white font-medium mb-3">Basic Attributes</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-slate-400">Size:</span>
                  <span class="text-white">{{ formatBytes(selectedFile.size) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">Extension:</span>
                  <span class="text-white">{{ selectedFile.extension || 'N/A' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">Category:</span>
                  <span class="text-white">{{ selectedFile.category || 'Unknown' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">Owner:</span>
                  <span class="text-white">{{ selectedFile.owner || 'N/A' }}</span>
                </div>
              </div>
            </div>

            <!-- File System Attributes -->
            <div class="bg-slate-700/30 rounded-lg p-4">
              <h4 class="text-white font-medium mb-3">File System</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Compressed:</span>
                  <span :class="selectedFile.is_compressed ? 'text-emerald-400' : 'text-slate-500'">
                    {{ selectedFile.is_compressed ? 'Yes' : 'No' }}
                  </span>
                </div>
                <div v-if="selectedFile.is_compressed && selectedFile.compressed_size" class="flex justify-between">
                  <span class="text-slate-400">Compressed Size:</span>
                  <span class="text-emerald-400">{{ formatBytes(selectedFile.compressed_size) }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Sparse File:</span>
                  <span :class="selectedFile.is_sparse ? 'text-amber-400' : 'text-slate-500'">
                    {{ selectedFile.is_sparse ? 'Yes' : 'No' }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Hard Link:</span>
                  <span :class="selectedFile.is_hard_link ? 'text-blue-400' : 'text-slate-500'">
                    {{ selectedFile.is_hard_link ? 'Yes' : 'No' }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Reparse Point:</span>
                  <span :class="selectedFile.is_reparse_point ? 'text-purple-400' : 'text-slate-500'">
                    {{ selectedFile.is_reparse_point ? 'Yes' : 'No' }}
                  </span>
                </div>
                <div v-if="selectedFile.reparse_tag" class="flex justify-between">
                  <span class="text-slate-400">Reparse Tag:</span>
                  <span class="text-purple-400 text-xs">0x{{ selectedFile.reparse_tag?.toString(16) }}</span>
                </div>
              </div>
            </div>

            <!-- Timestamps -->
            <div class="bg-slate-700/30 rounded-lg p-4">
              <h4 class="text-white font-medium mb-3">Timestamps</h4>
              <div class="space-y-2 text-sm">
                <div>
                  <span class="text-slate-400">Created:</span>
                  <div class="text-white text-xs mt-1">{{ formatDate(selectedFile.created) }}</div>
                </div>
                <div>
                  <span class="text-slate-400">Modified:</span>
                  <div class="text-white text-xs mt-1">{{ formatDate(selectedFile.modified) }}</div>
                </div>
                <div>
                  <span class="text-slate-400">Accessed:</span>
                  <div class="text-white text-xs mt-1">{{ formatDate(selectedFile.accessed) }}</div>
                </div>
              </div>
            </div>

            <!-- Alternate Data Streams -->
            <div v-if="selectedFile.has_ads" class="bg-slate-700/30 rounded-lg p-4">
              <h4 class="text-white font-medium mb-3">Alternate Data Streams</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center">
                  <span class="text-slate-400">Has ADS:</span>
                  <span class="text-amber-400">Yes</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">Stream Count:</span>
                  <span class="text-amber-400">{{ selectedFile.ads_count || 0 }}</span>
                </div>
              </div>
            </div>

            <!-- File Hash -->
            <div v-if="selectedFile.file_hash" class="bg-slate-700/30 rounded-lg p-4">
              <h4 class="text-white font-medium mb-3">File Hash</h4>
              <div class="text-sm">
                <div class="text-slate-400 mb-1">SHA-256:</div>
                <div class="text-white font-mono text-xs break-all">{{ selectedFile.file_hash }}</div>
              </div>
            </div>
          </div>

          <!-- File Actions -->
          <div class="flex gap-3 pt-4 border-t border-slate-700">
            <button
              class="bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              @click="openFileLocation"
            >
              <FolderOpen :size="16" class="inline mr-2" />
              Open Location
            </button>
            <button
              class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              @click="copyFilePath"
            >
              Copy Path
            </button>
            <button
              class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors"
              @click="exportFileDetails"
            >
              Export Details
            </button>
          </div>
        </div>

        <!-- File List (when no specific file selected) -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-white">Files ({{ files.length }} total)</h3>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search files..."
              class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="file in filteredFiles"
              :key="file.path"
              class="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
              @click="selectFile(file)"
            >
              <div class="p-1 bg-blue-500/20 rounded">
                <File :size="16" class="text-blue-400" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-white font-medium truncate">{{ file.name }}</div>
                <div class="text-slate-400 text-sm truncate">{{ file.path }}</div>
              </div>
              <div class="text-right">
                <div class="text-emerald-400 text-sm">{{ formatBytes(file.size) }}</div>
                <div class="text-slate-500 text-xs">{{ file.extension || 'no ext' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, File, FolderOpen } from 'lucide-vue-next';

interface FileAttributes {
  name: string;
  path: string;
  size: number;
  extension: string;
  category: string;
  modified: string;
  created: string;
  accessed: string;
  file_hash: string | null;
  is_hard_link: boolean;
  has_ads: boolean;
  ads_count: number;
  is_compressed: boolean;
  compressed_size: number | null;
  is_sparse: boolean;
  is_reparse_point: boolean;
  reparse_tag: number | null;
  owner: string;
}

const props = defineProps<{
  show: boolean;
  files: FileAttributes[];
  selectedFile?: FileAttributes | null;
}>();

const emit = defineEmits<{
  close: [];
  fileSelected: [file: FileAttributes];
}>();

const searchQuery = ref('');
const selectedFile = ref<FileAttributes | null>(props.selectedFile || null);

const filteredFiles = computed(() => {
  if (!searchQuery.value) return props.files;
  const query = searchQuery.value.toLowerCase();
  return props.files.filter(file => 
    file.name.toLowerCase().includes(query) ||
    file.path.toLowerCase().includes(query) ||
    file.extension?.toLowerCase().includes(query) ||
    file.category?.toLowerCase().includes(query)
  );
});

function selectFile(file: FileAttributes) {
  selectedFile.value = file;
  emit('fileSelected', file);
}

function formatBytes(bytes: number): string {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

function openFileLocation() {
  if (selectedFile.value) {
    // Extract directory path from file path
    const path = selectedFile.value.path;
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const directory = lastSlash > 0 ? path.substring(0, lastSlash) : path;
    
    // In a real implementation, this would open the file explorer
    console.log('Opening location:', directory);
    alert(`Would open: ${directory}`);
  }
}

function copyFilePath() {
  if (selectedFile.value) {
    navigator.clipboard.writeText(selectedFile.value.path).then(() => {
      console.log('Path copied to clipboard');
    });
  }
}

function exportFileDetails() {
  if (selectedFile.value) {
    const dataStr = JSON.stringify(selectedFile.value, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `file-details-${selectedFile.value.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

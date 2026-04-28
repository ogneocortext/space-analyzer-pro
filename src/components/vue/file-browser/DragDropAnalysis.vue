<template>
  <div
    :class="[
      'drag-drop-container',
      className,
      isDragOver ? 'drag-over' : '',
      disabled ? 'disabled' : ''
    ]"
  >
    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      :multiple="multiple"
      :accept="acceptedTypes.join(',')"
      @change="handleFileSelect"
      :disabled="disabled || isAnalyzing"
      style="display: none"
    />

    <!-- Drag and drop area -->
    <div
      class="drag-drop-area"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="fileInputRef?.click()"
    >
      <div class="drag-drop-content">
        <div v-if="isAnalyzing" class="analysis-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${analysisProgress}%` }" />
          </div>
          <div class="progress-text">Analyzing... {{ Math.round(analysisProgress) }}%</div>
        </div>
        <template v-else>
          <Upload :size="48" class="upload-icon" />
          <div class="drag-text">
            <h3>Drop files here or click to browse</h3>
            <p>
              {{ multiple ? 'Drop multiple files' : 'Drop a single file' }}
              <span v-if="maxFileSize"> (max {{ formatFileSize(maxFileSize) }})</span>
            </p>
          </div>
        </template>
      </div>
    </div>

    <!-- File queue -->
    <div v-if="draggedFiles.length > 0" class="file-queue">
      <div class="queue-header">
        <h4>Files to Analyze ({{ draggedFiles.length }})</h4>
        <div class="queue-actions">
          <template v-if="!isAnalyzing">
            <button
              @click="analyzeFiles"
              class="analyze-btn"
              :disabled="draggedFiles.length === 0"
            >
              <File :size="16" />
              Analyze All
            </button>
            <button @click="clearFiles" class="clear-btn">
              <X :size="16" />
              Clear
            </button>
          </template>
        </div>
      </div>

      <div class="file-list">
        <div
          v-for="draggedFile in draggedFiles"
          :key="draggedFile.id"
          :class="['file-item', draggedFile.status]"
        >
          <div class="file-info">
            <File :size="16" class="file-icon" />
            <div class="file-details">
              <div class="file-name">{{ draggedFile.file.name }}</div>
              <div class="file-size">{{ formatFileSize(draggedFile.file.size) }}</div>
            </div>
          </div>

          <div class="file-status">
            <div v-if="draggedFile.status === 'pending'" class="status-pending">Ready</div>
            <div v-if="draggedFile.status === 'analyzing'" class="status-analyzing">
              <div class="spinner" />
              Analyzing...
            </div>
            <div v-if="draggedFile.status === 'completed'" class="status-completed">
              <CheckCircle :size="16" />
              Complete
            </div>
            <div v-if="draggedFile.status === 'error'" class="status-error">
              <AlertCircle :size="16" />
              {{ draggedFile.error || 'Failed' }}
            </div>
          </div>

          <button
            v-if="!isAnalyzing"
            @click="removeFile(draggedFile.id)"
            class="remove-btn"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-vue-next';

interface DragDropProps {
  onFilesAnalyzed?: (results: any) => void;
  onAnalysisStart?: () => void;
  onAnalysisComplete?: () => void;
  className?: string;
  multiple?: boolean;
  acceptedTypes?: string[];
  maxFileSize?: number;
  disabled?: boolean;
}

interface DraggedFile {
  file: File;
  id: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  result?: any;
  error?: string;
}

const props = withDefaults(defineProps<DragDropProps>(), {
  className: '',
  multiple: true,
  acceptedTypes: () => ['*/*'],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  disabled: false,
  onFilesAnalyzed: undefined,
  onAnalysisStart: undefined,
  onAnalysisComplete: undefined,
});

const isDragOver = ref(false);
const draggedFiles = ref<DraggedFile[]>([]);
const isAnalyzing = ref(false);
const analysisProgress = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

const validateFiles = (files: FileList): DraggedFile[] => {
  const validFiles: DraggedFile[] = [];
  const errors: string[] = [];

  Array.from(files).forEach((file) => {
    if (file.size > props.maxFileSize) {
      errors.push(
        `${file.name} is too large (${formatFileSize(file.size)} > ${formatFileSize(props.maxFileSize)})`
      );
      return;
    }

    if (props.acceptedTypes[0] !== '*/*') {
      const fileType = file.type || getFileExtension(file.name);
      if (!props.acceptedTypes.some((type) => fileType.includes(type.replace('*/*', '')))) {
        errors.push(`${file.name} has unsupported type (${fileType})`);
        return;
      }
    }

    validFiles.push({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
    });
  });

  if (errors.length > 0) {
    console.error('File validation errors:', errors);
  }

  return validFiles;
};

const handleDragOver = () => {
  if (props.disabled) return;
  isDragOver.value = true;
};

const handleDragLeave = () => {
  isDragOver.value = false;
};

const handleDrop = (e: DragEvent) => {
  isDragOver.value = false;

  if (props.disabled) return;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const validFiles = validateFiles(files);
  if (validFiles.length === 0) return;

  draggedFiles.value = [...draggedFiles.value, ...validFiles].slice(0, props.multiple ? 10 : 1);
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const validFiles = validateFiles(files);
  if (validFiles.length === 0) return;

  draggedFiles.value = [...draggedFiles.value, ...validFiles].slice(0, props.multiple ? 10 : 1);

  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const analyzeFiles = async () => {
  if (draggedFiles.value.length === 0) return;

  isAnalyzing.value = true;
  props.onAnalysisStart?.();

  try {
    const results: any[] = [];

    for (let i = 0; i < draggedFiles.value.length; i++) {
      const draggedFile = draggedFiles.value[i];

      draggedFiles.value = draggedFiles.value.map((f) =>
        f.id === draggedFile.id ? { ...f, status: 'analyzing' } : f
      );

      analysisProgress.value = (i / draggedFiles.value.length) * 100;

      const formData = new FormData();
      formData.append('file', draggedFile.file);
      formData.append('fileName', draggedFile.file.name);
      formData.append('fileSize', draggedFile.file.size.toString());

      try {
        const response = await fetch('/api/analyze/file', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          results.push(result.data);

          draggedFiles.value = draggedFiles.value.map((f) =>
            f.id === draggedFile.id ? { ...f, status: 'completed', result: result.data } : f
          );
        } else {
          throw new Error(result.error || 'Analysis failed');
        }
      } catch (error: any) {
        draggedFiles.value = draggedFiles.value.map((f) =>
          f.id === draggedFile.id ? { ...f, status: 'error', error: error.message } : f
        );
      }
    }

    analysisProgress.value = 100;
    props.onFilesAnalyzed?.(results);
    props.onAnalysisComplete?.();

    setTimeout(() => {
      draggedFiles.value = [];
      analysisProgress.value = 0;
      isAnalyzing.value = false;
    }, 2000);
  } catch (error) {
    console.error('Analysis error:', error);
    isAnalyzing.value = false;
    analysisProgress.value = 0;
  }
};

const removeFile = (id: string) => {
  draggedFiles.value = draggedFiles.value.filter((f) => f.id !== id);
};

const clearFiles = () => {
  draggedFiles.value = [];
  analysisProgress.value = 0;
  isAnalyzing.value = false;
};

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};
</script>

<style scoped>
.drag-drop-container {
  @apply w-full;
}

.drag-drop-area {
  @apply border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer transition-colors;
}

.drag-drop-area:hover {
  @apply border-gray-500 bg-gray-800/50;
}

.drag-drop-area.drag-over {
  @apply border-blue-500 bg-blue-500/10;
}

.drag-drop-area.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.drag-drop-content {
  @apply flex flex-col items-center justify-center;
}

.upload-icon {
  @apply text-gray-400 mb-4;
}

.drag-text h3 {
  @apply text-lg font-medium text-white mb-2;
}

.drag-text p {
  @apply text-sm text-gray-400;
}

.analysis-progress {
  @apply w-full max-w-md;
}

.progress-bar {
  @apply w-full h-2 bg-gray-700 rounded-full overflow-hidden;
}

.progress-fill {
  @apply h-full bg-blue-500 transition-all duration-300;
}

.progress-text {
  @apply text-sm text-gray-400 mt-2;
}

.file-queue {
  @apply mt-4 space-y-3;
}

.queue-header {
  @apply flex items-center justify-between;
}

.queue-header h4 {
  @apply text-sm font-medium text-white;
}

.queue-actions {
  @apply flex gap-2;
}

.analyze-btn {
  @apply flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.clear-btn {
  @apply flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors;
}

.file-list {
  @apply space-y-2;
}

.file-item {
  @apply flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700;
}

.file-item.pending {
  @apply border-gray-600;
}

.file-item.analyzing {
  @apply border-blue-500/50 bg-blue-500/5;
}

.file-item.completed {
  @apply border-green-500/50 bg-green-500/5;
}

.file-item.error {
  @apply border-red-500/50 bg-red-500/5;
}

.file-info {
  @apply flex items-center gap-3;
}

.file-icon {
  @apply text-gray-400;
}

.file-details {
  @apply flex flex-col;
}

.file-name {
  @apply text-sm font-medium text-white;
}

.file-size {
  @apply text-xs text-gray-400;
}

.file-status {
  @apply flex items-center gap-2;
}

.status-pending {
  @apply text-xs text-gray-400;
}

.status-analyzing {
  @apply flex items-center gap-2 text-xs text-blue-400;
}

.status-completed {
  @apply flex items-center gap-2 text-xs text-green-400;
}

.status-error {
  @apply flex items-center gap-2 text-xs text-red-400;
}

.spinner {
  @apply w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin;
}

.remove-btn {
  @apply p-1 text-gray-400 hover:text-white transition-colors;
}
</style>

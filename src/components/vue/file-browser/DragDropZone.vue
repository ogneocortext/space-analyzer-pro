<template>
  <div
    :class="['relative', className]"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover.prevent="handleDragOver"
    @drop.prevent="handleDrop"
    data-drop-context="general"
  >
    <slot />

    <!-- Drag Overlay -->
    <Transition name="fade">
      <div
        v-if="state.isDragOver"
        class="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-10 pointer-events-none"
      >
        <div class="text-center">
          <div class="mb-4">
            <Upload class="w-12 h-12 text-blue-400 mx-auto" />
          </div>
          <div>
            <p class="text-blue-300 font-medium mb-2">Drop files here to analyze</p>
            <p class="text-blue-400/70 text-sm">
              {{ multiple ? 'Drop multiple files' : 'Drop one file' }}
            </p>
            <p v-if="maxSize" class="text-blue-400/50 text-xs mt-1">
              Max size: {{ formatFileSize(maxSize) }}
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Error Message -->
    <Transition name="slide">
      <div
        v-if="state.error"
        class="absolute top-4 right-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-w-sm z-20"
      >
        <div class="flex items-start space-x-2">
          <AlertCircle class="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-red-300 text-sm">{{ state.error }}</p>
          </div>
          <button
            @click="clearError"
            class="text-red-400 hover:text-red-300 transition-colors"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { Upload, X, AlertCircle } from 'lucide-vue-next';

interface DragDropZoneProps {
  onDrop: (files: File[], context?: string) => void;
  onTextDrop?: (text: string) => void;
  className?: string;
  disabled?: boolean;
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
}

const props = withDefaults(defineProps<DragDropZoneProps>(), {
  className: '',
  disabled: false,
  accept: () => [],
  maxSize: 100 * 1024 * 1024, // 100MB default
  multiple: true,
  onTextDrop: undefined,
});

interface DropZoneState {
  isDragging: boolean;
  isDragOver: boolean;
  dragCounter: number;
  error: string | null;
}

const state = reactive<DropZoneState>({
  isDragging: false,
  isDragOver: false,
  dragCounter: 0,
  error: null,
});

let dragCounter = 0;
let timeoutRef: NodeJS.Timeout | null = null;

const clearError = () => {
  state.error = null;
};

const showError = (message: string) => {
  state.error = message;
  if (timeoutRef) {
    clearTimeout(timeoutRef);
  }
  timeoutRef = setTimeout(clearError, 3000);
};

const validateFiles = (files: FileList): File[] => {
  const validFiles: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.size > props.maxSize) {
      showError(`File "${file.name}" exceeds maximum size of ${formatFileSize(props.maxSize)}`);
      continue;
    }

    if (
      props.accept.length > 0 &&
      !props.accept.some((type) => file.type.includes(type) || file.name.endsWith(type))
    ) {
      showError(`File type "${file.type}" not accepted`);
      continue;
    }

    validFiles.push(file);
  }

  return validFiles;
};

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (props.disabled) return;

  dragCounter++;

  if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
    state.isDragging = true;
    state.isDragOver = true;
    state.dragCounter = dragCounter;
  }
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  dragCounter--;

  if (dragCounter === 0) {
    state.isDragging = false;
    state.isDragOver = false;
    state.dragCounter = 0;
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (props.disabled) return;

  if (e.dataTransfer?.dropEffect === 'copy') {
    e.dataTransfer.dropEffect = 'copy';
  }
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (props.disabled) return;

  state.isDragging = false;
  state.isDragOver = false;
  state.dragCounter = 0;

  dragCounter = 0;

  // Handle text drop
  if (e.dataTransfer?.types.includes('text/plain') && props.onTextDrop) {
    const text = e.dataTransfer.getData('text/plain');
    if (text.trim()) {
      props.onTextDrop(text);
      return;
    }
  }

  // Handle file drop
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const files = validateFiles(e.dataTransfer.files);

    if (files.length > 0) {
      if (!props.multiple && files.length > 1) {
        showError('Only one file can be dropped at a time');
        return;
      }

      const context = (e.target as HTMLElement)
        .closest('[data-drop-context]')
        ?.getAttribute('data-drop-context') || undefined;
      props.onDrop(files, context);
    }
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

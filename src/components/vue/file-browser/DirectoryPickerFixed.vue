<template>
  <div v-if="isOpen" class="overlay">
    <div class="modal">
      <!-- Header -->
      <div class="header">
        <div class="headerContent">
          <div class="headerIcon">
            <FolderOpen :size="24" />
          </div>
          <div class="headerText">
            <h2 class="title">Select Directory for Analysis</h2>
            <p class="subtitle">
              Choose a directory to analyze with AI-powered insights
            </p>
          </div>
        </div>
        <button
          @click="onClose"
          class="closeButton"
          aria-label="Close directory picker"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Body -->
      <div class="body">
        <div class="content">
          <!-- Quick Access Section -->
          <div class="section">
            <h3 class="sectionTitle">
              <Search :size="16" class="sectionIcon" />
              Quick Access
            </h3>
            <div class="directoryGrid">
              <button
                v-for="directory in directories"
                :key="directory.path"
                @click="handleDirectorySelect(directory)"
                :disabled="!directory.isAccessible"
                :class="[
                  'directoryButton',
                  !directory.isAccessible ? 'disabled' : '',
                  (customPath || currentPath) === directory.path ? 'selected' : ''
                ]"
                :title="directory.description"
              >
                <div class="directoryIcon">
                  <component :is="directory.icon" :size="16" />
                </div>
                <div class="directoryInfo">
                  <div class="directoryName">{{ directory.name }}</div>
                  <div class="directoryPath">{{ formatPath(directory.path) }}</div>
                </div>
                <div v-if="!directory.isAccessible" class="accessibilityWarning">
                  <AlertCircle :size="12" />
                </div>
              </button>
            </div>
          </div>

          <!-- Windows File Explorer Integration -->
          <div class="section">
            <h3 class="sectionTitle">
              <Monitor :size="16" class="sectionIcon" />
              Windows File Explorer Integration
            </h3>
            <div class="explorerSection">
              <div class="explorerInfo">
                <div class="explorerIcon">
                  <Monitor :size="14" class="platformIcon" />
                </div>
                <div class="explorerText">
                  <div class="explorerTitle">Windows File Explorer</div>
                  <div class="explorerDescription">
                    <button @click="handleOpenExplorer" class="explorerButton">
                      <Monitor :size="16" />
                      Open File Picker
                    </button>
                    <p style="font-size: 12px; margin: 8px 0 0 0; color: #64748b">
                      Use the modern file picker to select a directory
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Path Input -->
          <div class="section">
            <h3 class="sectionTitle">
              <Terminal :size="16" class="sectionIcon" />
              Custom Path
            </h3>
            <div class="customPathSection">
              <div class="inputGroup">
                <input
                  ref="inputRef"
                  v-model="customPath"
                  type="text"
                  :placeholder="placeholder"
                  :class="['pathInput', error ? 'inputError' : '']"
                  aria-label="Custom directory path"
                  @input="handleCustomPathChange"
                />
                <button
                  @click="handleNativeFilePicker"
                  :disabled="loading"
                  class="browseButton"
                  title="Open native file picker"
                >
                  <div v-if="loading" class="spinner" />
                  <FolderOpen v-else :size="16" />
                </button>
              </div>

              <!-- Path Examples -->
              <div class="pathExamples">
                <div class="examplesTitle">Example paths:</div>
                <div class="examplesGrid">
                  <template v-if="platform === 'windows'">
                    <div class="example">
                      <code>C:\Users\Public\Documents</code>
                    </div>
                    <div class="example">
                      <code>D:\Projects</code>
                    </div>
                    <div class="example">
                      <code>.\src</code>
                    </div>
                  </template>
                  <template v-else-if="platform === 'macos'">
                    <div class="example">
                      <code>/Users/username/Documents</code>
                    </div>
                    <div class="example">
                      <code>~/Documents</code>
                    </div>
                    <div class="example">
                      <code>/Applications</code>
                    </div>
                  </template>
                  <template v-else-if="platform === 'linux'">
                    <div class="example">
                      <code>/home/username/Documents</code>
                    </div>
                    <div class="example">
                      <code>~/Documents</code>
                    </div>
                    <div class="example">
                      <code>/</code>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="errorSection">
            <div class="errorIcon">
              <AlertCircle :size="16" />
            </div>
            <div class="errorMessage">{{ error }}</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footerContent">
          <div class="platformInfo">
            <Monitor :size="14" class="platformIcon" />
            <span class="platformText">
              {{ platform === 'windows' ? 'Windows' : platform === 'macos' ? 'macOS' : 'Linux' }}
            </span>
          </div>
          <div class="footerActions">
            <button @click="onClose" class="cancelButton">
              Cancel
            </button>
            <button
              @click="handleSelect"
              :disabled="loading || (!customPath && !currentPath)"
              class="selectButton"
            >
              <template v-if="loading">
                <div class="buttonSpinner" />
                Selecting...
              </template>
              <template v-else>
                <Check :size="16" />
                Select Directory
              </template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  FolderOpen,
  X,
  Check,
  AlertCircle,
  HardDrive,
  Folder,
  Search,
  Home,
  Monitor,
  Globe,
  Terminal,
} from 'lucide-vue-next';

interface DirectoryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'drive' | 'special';
  icon: any;
  description?: string;
  isAccessible?: boolean;
}

const props = withDefaults(defineProps<DirectoryPickerProps>(), {
  initialPath: '',
});

const currentPath = ref(props.initialPath);
const customPath = ref('');
const error = ref('');
const loading = ref(false);
const platform = ref<'windows' | 'macos' | 'linux'>('windows');
const inputRef = ref<HTMLInputElement | null>(null);

// Detect platform on mount
onMounted(() => {
  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
    return 'windows'; // default fallback
  };
  platform.value = detectPlatform();
});

const placeholder = computed(() => {
  switch (platform.value) {
    case 'windows':
      return 'C:\\Users\\YourName\\Documents';
    case 'macos':
      return '/Users/username/Documents';
    case 'linux':
      return '/home/username/Documents';
    default:
      return 'Enter path';
  }
});

// Platform-specific directory configurations
const directories = computed<DirectoryEntry[]>(() => {
  switch (platform.value) {
    case 'windows':
      return [
        {
          name: 'Documents',
          path: 'C:\\Users\\%USERNAME%\\Documents',
          type: 'directory',
          icon: Folder,
          description: 'User documents folder',
          isAccessible: true,
        },
        {
          name: 'Desktop',
          path: 'C:\\Users\\%USERNAME%\\Desktop',
          type: 'directory',
          icon: Monitor,
          description: 'Desktop folder',
          isAccessible: true,
        },
        {
          name: 'Downloads',
          path: 'C:\\Users\\%USERNAME%\\Downloads',
          type: 'directory',
          icon: FolderOpen,
          description: 'Downloaded files',
          isAccessible: true,
        },
        {
          name: 'Local Disk (C:)',
          path: 'C:\\',
          type: 'drive',
          icon: HardDrive,
          description: 'Primary system drive',
          isAccessible: true,
        },
        {
          name: 'Projects (D:)',
          path: 'D:\\Projects',
          type: 'directory',
          icon: Folder,
          description: 'Projects directory on D drive',
          isAccessible: false,
        },
        {
          name: 'Source Code',
          path: '.\\src',
          type: 'directory',
          icon: Terminal,
          description: 'Current source directory',
          isAccessible: true,
        },
      ];
    case 'macos':
      return [
        {
          name: 'Documents',
          path: '/Users/%USERNAME%/Documents',
          type: 'directory',
          icon: Folder,
          description: 'User documents folder',
          isAccessible: true,
        },
        {
          name: 'Desktop',
          path: '/Users/%USERNAME%/Desktop',
          type: 'directory',
          icon: Monitor,
          description: 'Desktop folder',
          isAccessible: true,
        },
        {
          name: 'Downloads',
          path: '/Users/%USERNAME%/Downloads',
          type: 'directory',
          icon: FolderOpen,
          description: 'Downloaded files',
          isAccessible: true,
        },
        {
          name: 'Applications',
          path: '/Applications',
          type: 'directory',
          icon: Globe,
          description: 'Installed applications',
          isAccessible: true,
        },
        {
          name: 'Home Directory',
          path: '/Users/%USERNAME%',
          type: 'directory',
          icon: Home,
          description: 'User home directory',
          isAccessible: true,
        },
      ];
    case 'linux':
      return [
        {
          name: 'Documents',
          path: '/home/%USERNAME%/Documents',
          type: 'directory',
          icon: Folder,
          description: 'User documents folder',
          isAccessible: true,
        },
        {
          name: 'Desktop',
          path: '/home/%USERNAME%/Desktop',
          type: 'directory',
          icon: Monitor,
          description: 'Desktop folder',
          isAccessible: true,
        },
        {
          name: 'Downloads',
          path: '/home/%USERNAME%/Downloads',
          type: 'directory',
          icon: FolderOpen,
          description: 'Downloaded files',
          isAccessible: true,
        },
        {
          name: 'Home Directory',
          path: '/home/%USERNAME%',
          type: 'directory',
          icon: Home,
          description: 'User home directory',
          isAccessible: true,
        },
        {
          name: 'Root Filesystem',
          path: '/',
          type: 'special',
          icon: Globe,
          description: 'Root filesystem',
          isAccessible: true,
        },
      ];
    default:
      return [];
  }
});

const handleOpenExplorer = async () => {
  try {
    error.value = '';
    await handleNativeFilePicker();
  } catch (err) {
    console.error('Error opening file picker:', err);
    error.value = 'Failed to open file picker. Please enter path manually.';
  }
};

const validatePath = (path: string): boolean => {
  if (!path || path.trim() === '') {
    error.value = 'Please enter a valid path';
    return false;
  }

  const trimmedPath = path.trim();
  const hasInvalidChars = /[<>|"?*\x00-\x1f]/.test(trimmedPath);
  const isTooShort = trimmedPath.length < 1;
  const isJustSpaces = /^\s*$/.test(trimmedPath);

  if (hasInvalidChars || isTooShort || isJustSpaces) {
    error.value = 'Path contains invalid characters or is too short';
    return false;
  }

  const platformCheck = (() => {
    switch (platform.value) {
      case 'windows':
        return (
          /^[A-Za-z]:[\\/]?.*$/i.test(trimmedPath) ||
          /^\\\\[^\\]+\\.*/.test(trimmedPath) ||
          /^\.?[\\/]?.*/.test(trimmedPath) ||
          /^[a-zA-Z0-9_][a-zA-Z0-9_\s\-]*$/.test(trimmedPath)
        );
      case 'macos':
      case 'linux':
        return (
          /^\/.*$/.test(trimmedPath) ||
          /^~.*$/.test(trimmedPath) ||
          /^\.?[\\/]?.*/.test(trimmedPath) ||
          /^[a-zA-Z0-9_][a-zA-Z0-9_\s\-]*$/.test(trimmedPath)
        );
      default:
        return true;
    }
  })();

  if (!platformCheck) {
    const platformHint = (() => {
      switch (platform.value) {
        case 'windows':
          return 'Examples: C:\\Users\\Documents, Documents, .\\src, or \\\\server\\share';
        case 'macos':
          return 'Examples: /Users/username/Documents, ~/Documents, Documents, or ./src';
        case 'linux':
          return 'Examples: /home/username/Documents, ~/Documents, Documents, or ./src';
        default:
          return 'Enter a valid path for your system';
      }
    })();
    error.value = `Invalid path format. ${platformHint}`;
    return false;
  }

  return true;
};

const handleDirectorySelect = async (directoryEntry: DirectoryEntry) => {
  if (!directoryEntry.isAccessible) {
    error.value = 'This directory is not accessible on this system';
    return;
  }

  currentPath.value = directoryEntry.path;
  customPath.value = directoryEntry.path;
  error.value = '';
};

const handleCustomPathChange = () => {
  error.value = '';
};

const handleNativeFilePicker = async () => {
  try {
    loading.value = true;
    error.value = '';

    if ('showDirectoryPicker' in window) {
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });

      const path = await getDirectoryPath(directoryHandle);
      currentPath.value = path;
      customPath.value = path;
      console.log('Selected directory via File System Access API:', path);
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      (input as any).directory = true;
      (input as any).mozdirectory = true;

      input.addEventListener('change', (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const path = file.webkitRelativePath || file.name;
          currentPath.value = path;
          customPath.value = path;
          console.log('Selected directory via input element:', path);
        }
      });

      input.click();
    }
  } catch (err) {
    console.error('Failed to open native file picker:', err);
    error.value = 'Failed to open file picker. Please enter path manually.';
  } finally {
    loading.value = false;
  }
};

const getDirectoryPath = async (directoryHandle: any): Promise<string> => {
  try {
    if (directoryHandle.name) {
      return directoryHandle.name;
    }

    if (directoryHandle.resolve) {
      const pathParts: string[] = [];
      let currentHandle = directoryHandle;

      while (currentHandle && currentHandle.name !== '/') {
        pathParts.unshift(currentHandle.name);
        if (currentHandle.parent) {
          currentHandle = await currentHandle.parent();
        } else {
          break;
        }
      }

      return '/' + pathParts.join('/');
    }

    return directoryHandle.name || 'Unknown';
  } catch (err) {
    console.warn('Could not resolve directory path:', err);
    return directoryHandle.name || 'Unknown';
  }
};

const handleSelect = async () => {
  const pathToUse = customPath.value || currentPath.value;

  if (!validatePath(pathToUse)) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    props.onSelect(pathToUse);
    props.onClose();
    console.log('Directory selected for analysis:', pathToUse);
  } catch (err) {
    console.error('Directory selection failed:', err);
    error.value = 'Failed to access directory. Please check path and try again.';
  } finally {
    loading.value = false;
  }
};

const formatPath = (path: string): string => {
  return path
    .replace(/%USERNAME%/g, platform.value === 'windows' ? 'User' : 'username')
    .replace(/C:\\\\/g, 'C:\\')
    .replace(/\\\\/g, '\\');
};
</script>

<style scoped>
.overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
}

.modal {
  @apply bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto;
}

.header {
  @apply flex items-center justify-between p-6 border-b border-gray-700;
}

.headerContent {
  @apply flex items-center gap-3;
}

.headerIcon {
  @apply w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400;
}

.headerText {
  @apply flex-1;
}

.title {
  @apply text-xl font-semibold text-white;
}

.subtitle {
  @apply text-sm text-gray-400 mt-1;
}

.closeButton {
  @apply text-gray-400 hover:text-white transition-colors;
}

.body {
  @apply p-6;
}

.content {
  @apply space-y-6;
}

.section {
  @apply space-y-3;
}

.sectionTitle {
  @apply flex items-center gap-2 text-sm font-medium text-gray-300;
}

.sectionIcon {
  @apply text-gray-400;
}

.directoryGrid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-3;
}

.directoryButton {
  @apply flex items-center gap-3 p-3 bg-gray-800 border border-gray-600 rounded-lg hover:border-gray-500 transition-colors text-left;
}

.directoryButton.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.directoryButton.selected {
  @apply border-blue-500 bg-blue-500/10;
}

.directoryIcon {
  @apply text-gray-400;
}

.directoryInfo {
  @apply flex-1 min-w-0;
}

.directoryName {
  @apply text-sm font-medium text-white truncate;
}

.directoryPath {
  @apply text-xs text-gray-400 truncate;
}

.accessibilityWarning {
  @apply text-yellow-400;
}

.explorerSection {
  @apply p-4 bg-gray-800 border border-gray-600 rounded-lg;
}

.explorerInfo {
  @apply flex items-center gap-3;
}

.explorerIcon {
  @apply text-gray-400;
}

.explorerText {
  @apply flex-1;
}

.explorerTitle {
  @apply text-sm font-medium text-white;
}

.explorerDescription {
  @apply mt-1;
}

.explorerButton {
  @apply flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors;
}

.customPathSection {
  @apply space-y-3;
}

.inputGroup {
  @apply flex gap-2;
}

.pathInput {
  @apply flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.pathInput.inputError {
  @apply border-red-500 focus:ring-red-500;
}

.browseButton {
  @apply px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors;
}

.pathExamples {
  @apply space-y-2;
}

.examplesTitle {
  @apply text-xs text-gray-400;
}

.examplesGrid {
  @apply flex flex-wrap gap-2;
}

.example {
  @apply px-2 py-1 bg-gray-800 rounded;
}

.example code {
  @apply text-xs text-gray-300;
}

.errorSection {
  @apply flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg;
}

.errorIcon {
  @apply text-red-400;
}

.errorMessage {
  @apply text-sm text-red-400;
}

.footer {
  @apply flex items-center justify-end gap-3 p-6 border-t border-gray-700;
}

.footerContent {
  @apply flex items-center justify-between w-full;
}

.platformInfo {
  @apply flex items-center gap-2 text-sm text-gray-400;
}

.platformIcon {
  @apply text-gray-400;
}

.platformText {
  @apply text-gray-400;
}

.footerActions {
  @apply flex gap-3;
}

.cancelButton {
  @apply px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors;
}

.selectButton {
  @apply px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed;
}

.spinner {
  @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
}

.buttonSpinner {
  @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
}
</style>

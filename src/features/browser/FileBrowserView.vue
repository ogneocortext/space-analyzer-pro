<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useAnalysisStore } from "../../store/analysis";
import { Card, Button } from "../../design-system/components";
import {
  Search,
  Filter,
  Eye,
  X,
  Camera,
  Download,
  Share2,
  Trash2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Square,
  CheckSquare,
  AlertCircle,
  Loader2,
  LayoutList,
  LayoutGrid,
  Grid3x3,
  ArrowUpDown,
  Brain,
  Zap,
  FileText,
  Archive,
  Code,
  Terminal,
  Settings,
  File,
} from "lucide-vue-next";
import { use3DVisualization } from "../../composables/use3DVisualization";
import { use3DControls } from "../../composables/use3DControls";
import Visualization3DCanvas from "../../components/3d/Visualization3DCanvas.vue";
import Visualization3DControls from "../../components/3d/Visualization3DControls.vue";
import FileDetails3DPanel from "../../components/3d/FileDetails3DPanel.vue";

const store = useAnalysisStore();
const searchQuery = ref("");
const selectedCategory = ref<string>("all");
const sortBy = ref<"name" | "size" | "category">("name");
const viewMode = ref<"list" | "grid" | "preview" | "canvas">("list");
const selectedFile = ref<any>(null);
const showPreviewModal = ref(false);
const errorMessage = ref("");
const showError = ref(false);
const isLoading = computed(() => store.isLoading || false);
const isDeleting = ref<Set<string>>(new Set());
const hasData = computed(() => store.analysisResult !== null);
const successMessage = ref("");
const warningMessage = ref("");
const showWarning = ref(false);
const infoMessage = ref("");
const showInfo = ref(false);

// Enhanced features
const selectedFiles = ref<Set<string>>(new Set());
const showBulkActions = ref(false);
const currentPage = ref(1);
const itemsPerPage = ref(50);
const showKeyboardShortcuts = ref(false);
const focusedIndex = ref(-1);
const sortDirection = ref<"asc" | "desc">("asc");
const lastClickTime = ref(0);

// Enhanced search features
const searchFilters = ref({
  query: "",
  sizeMin: "",
  sizeMax: "",
  dateFrom: "",
  dateTo: "",
  extensions: [] as string[],
  includeHidden: false,
});
const showAdvancedSearch = ref(false);
const searchHistory = ref<string[]>([]);
const searchSuggestions = ref<string[]>([]);

// Message management
const messages = ref<
  Array<{
    id: string;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
    timestamp: number;
    autoHide?: number;
  }>
>([]);

// File preview enhancements
const previewCache = ref<Map<string, string>>(new Map());
const thumbnailCache = ref<Map<string, string>>(new Map());
const previewLoading = ref<Set<string>>(new Set());
const previewSettings = ref({
  generateThumbnails: true,
  thumbnailSize: 200,
  cachePreviews: true,
  previewTimeout: 5000,
});

// File operations
const clipboardFiles = ref<string[]>([]);
const dragStartFiles = ref<string[]>([]);
const dropTarget = ref<string | null>(null);
const isDragging = ref(false);

// File tagging system
const fileTags = ref<Map<string, string[]>>(new Map());
const availableTags = ref<string[]>([]);
const tagColors = ref<Map<string, string>>(new Map());

// File comparison
const compareFiles = ref<string[]>([]);
const showComparison = ref(false);
const comparisonResult = ref<any>(null);

// Real-time monitoring
const fileWatcher = ref<any>(null);
const recentChanges = ref<
  Array<{
    type: "created" | "modified" | "deleted";
    path: string;
    timestamp: number;
  }>
>([]);

// Enhanced UI state management
const showRenameModal = ref(false);
const showCreateFolderModal = ref(false);
const showShareModal = ref(false);
const showExportModal = ref(false);
const showAnalyticsModal = ref(false);
const showSettingsModal = ref(false);
const showTagModal = ref(false);
const showComparisonModal = ref(false);
const showAdvancedSearchModal = ref(false);

const modalData = ref({
  file: null as any,
  files: [] as string[],
  newName: "",
  folderName: "",
  shareMethod: "link",
  exportFormat: "zip",
  analytics: null as any,
  selectedTags: [] as string[],
  newTag: "",
  comparison: null as any,
});

// 3D Browser specific variables
const selected3DFile = ref<FileItem | null>(null);

interface FileItem {
  name: string;
  path: string;
  size: number;
  category: string;
  extension?: string;
  timestamps?: {
    created?: string;
    modified: string;
    accessed?: string;
  };
  // Windows API fields
  created?: string;
  accessed?: string;
  has_ads?: boolean;
  ads_count?: number;
  is_compressed?: boolean;
  compressed_size?: number;
  is_sparse?: boolean;
  is_reparse_point?: boolean;
  reparse_tag?: number;
  owner?: string;
  is_hard_link?: boolean;
  hard_link_count?: number;
}

// AI Summary Modal State
const summaryData = ref<{
  fileName: string;
  filePath: string;
  summary: string;
  fileType: string;
  cached: boolean;
  tokensUsed: number;
  responseTime: number;
} | null>(null);
const summaryError = ref<string | null>(null);
const summaryLoading = ref(false);

// Enhanced computed properties
const totalPages = computed(() => Math.ceil(filteredFiles.value.length / itemsPerPage.value));
const paginatedFiles = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredFiles.value.slice(start, end);
});

const hasSelection = computed(() => selectedFiles.value.size > 0);
const selectedCount = computed(() => selectedFiles.value.size);
const allSelected = computed(
  () =>
    paginatedFiles.value.length > 0 &&
    paginatedFiles.value.every((file) => selectedFiles.value.has(file.path))
);

const categories = computed(() => {
  const cats = new Set<string>();
  store.analysisResult?.files?.forEach((f: FileItem) => {
    if (f.category) {
      cats.add(f.category);
    }
  });
  return ["all", ...Array.from(cats)];
});

const filteredFiles = computed(() => {
  let files: FileItem[] = store.analysisResult?.files || [];

  // Enhanced search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    files = files.filter(
      (f: FileItem) =>
        f.name.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query) ||
        f.path.toLowerCase().includes(query) ||
        f.extension.toLowerCase().includes(query)
    );
  }

  // Advanced filters
  if (searchFilters.value.query) {
    const query = searchFilters.value.query.toLowerCase();
    files = files.filter(
      (f: FileItem) => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)
    );
  }

  // Size filter
  if (searchFilters.value.sizeMin) {
    const minSize = parseSize(searchFilters.value.sizeMin);
    files = files.filter((f: FileItem) => f.size >= minSize);
  }
  if (searchFilters.value.sizeMax) {
    const maxSize = parseSize(searchFilters.value.sizeMax);
    files = files.filter((f: FileItem) => f.size <= maxSize);
  }

  // Date filter
  if (searchFilters.value.dateFrom) {
    const fromDate = new Date(searchFilters.value.dateFrom);
    files = files.filter(
      (f: FileItem) => f.timestamps?.modified && new Date(f.timestamps.modified) >= fromDate
    );
  }
  if (searchFilters.value.dateTo) {
    const toDate = new Date(searchFilters.value.dateTo);
    files = files.filter(
      (f: FileItem) => f.timestamps?.modified && new Date(f.timestamps.modified) <= toDate
    );
  }

  // Extension filter
  if (searchFilters.value.extensions.length > 0) {
    files = files.filter((f: FileItem) =>
      searchFilters.value.extensions.includes(f.extension.toLowerCase())
    );
  }

  // Category filter
  if (selectedCategory.value !== "all") {
    files = files.filter((f: FileItem) => f.category === selectedCategory.value);
  }

  // Sort with direction
  files = [...files].sort((a, b) => {
    let comparison = 0;
    switch (sortBy.value) {
      case "size":
        comparison = b.size - a.size;
        break;
      case "category":
        comparison = a.category.localeCompare(b.category);
        break;
      default:
        comparison = a.name.localeCompare(b.name);
    }
    return sortDirection.value === "asc" ? comparison : -comparison;
  });

  return files;
});

// Watch for store errors
watch(
  () => store.error,
  (newError) => {
    if (newError) {
      errorMessage.value = newError;
      showError.value = true;
    }
  }
);

// Keyboard shortcuts
const keyboardShortcuts = {
  "Ctrl+A": () => selectAll(),
  Escape: () => clearSelection(),
  Delete: () => deleteSelected(),
  "Ctrl+C": () => copySelectedPaths(),
  "Ctrl+F": () => focusSearch(),
  "Ctrl+1": () => (viewMode.value = "list"),
  "Ctrl+2": () => (viewMode.value = "grid"),
  "Ctrl+3": () => (viewMode.value = "preview"),
  "Ctrl+4": () => (viewMode.value = "canvas"),
  ArrowUp: () => navigateUp(),
  ArrowDown: () => navigateDown(),
  Enter: () => openFocusedFile(),
  Space: () => toggleFocusedFile(),
  "?": () => (showKeyboardShortcuts.value = !showKeyboardShortcuts.value),
};

// Message management functions
function addMessage(
  type: "success" | "error" | "warning" | "info",
  title: string,
  message: string,
  autoHide = 5000
) {
  const id = Date.now().toString();
  messages.value.push({
    id,
    type,
    title,
    message,
    timestamp: Date.now(),
    autoHide,
  });

  // Auto-hide messages
  if (autoHide > 0) {
    setTimeout(() => {
      removeMessage(id);
    }, autoHide);
  }

  // Update legacy message refs for backward compatibility
  if (type === "error") {
    errorMessage.value = message;
    showError.value = true;
  } else if (type === "success") {
    successMessage.value = message;
  } else if (type === "warning") {
    warningMessage.value = message;
    showWarning.value = true;
  } else if (type === "info") {
    infoMessage.value = message;
    showInfo.value = true;
  }
}

function removeMessage(id: string) {
  const index = messages.value.findIndex((msg) => msg.id === id);
  if (index > -1) {
    messages.value.splice(index, 1);
  }
}

function clearAllMessages() {
  messages.value = [];
  errorMessage.value = "";
  showError.value = false;
  successMessage.value = "";
  warningMessage.value = "";
  showWarning.value = false;
  infoMessage.value = "";
  showInfo.value = false;
}

// Enhanced functions
function selectAll() {
  paginatedFiles.value.forEach((file) => {
    selectedFiles.value.add(file.path);
  });
  showBulkActions.value = true;
}

function clearSelection() {
  selectedFiles.value.clear();
  showBulkActions.value = false;
  focusedIndex.value = -1;
}

function toggleFileSelection(filePath: string, event?: MouseEvent) {
  if (event?.ctrlKey || event?.metaKey) {
    // Multi-select with Ctrl/Cmd
    if (selectedFiles.value.has(filePath)) {
      selectedFiles.value.delete(filePath);
    } else {
      selectedFiles.value.add(filePath);
    }
  } else if (event?.shiftKey && focusedIndex.value >= 0) {
    // Range selection with Shift
    const currentIndex = paginatedFiles.value.findIndex((f) => f.path === filePath);
    if (currentIndex >= 0) {
      const start = Math.min(focusedIndex.value, currentIndex);
      const end = Math.max(focusedIndex.value, currentIndex);
      for (let i = start; i <= end; i++) {
        selectedFiles.value.add(paginatedFiles.value[i].path);
      }
    }
  } else {
    // Single selection
    if (selectedFiles.value.has(filePath)) {
      selectedFiles.value.delete(filePath);
    } else {
      selectedFiles.value.clear();
      selectedFiles.value.add(filePath);
    }
  }

  showBulkActions.value = selectedFiles.value.size > 0;
}

function navigateUp() {
  if (focusedIndex.value > 0) {
    focusedIndex.value--;
  }
}

function navigateDown() {
  if (focusedIndex.value < paginatedFiles.value.length - 1) {
    focusedIndex.value++;
  }
}

function openFocusedFile() {
  if (focusedIndex.value >= 0 && focusedIndex.value < paginatedFiles.value.length) {
    openPreview(paginatedFiles.value[focusedIndex.value]);
  }
}

function toggleFocusedFile() {
  if (focusedIndex.value >= 0 && focusedIndex.value < paginatedFiles.value.length) {
    toggleFileSelection(paginatedFiles.value[focusedIndex.value].path);
  }
}

function focusSearch() {
  const searchInput = document.querySelector(
    'input[placeholder="Search files..."]'
  ) as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
  }
}

async function deleteSelected() {
  if (selectedFiles.value.size === 0) return;

  const count = selectedFiles.value.size;
  const message = `Are you sure you want to permanently delete ${count} file${count > 1 ? "s" : ""}?`;

  if (!confirm(message)) return;

  for (const filePath of selectedFiles.value) {
    await deleteFile(filePath);
  }

  clearSelection();
}

function copySelectedPaths() {
  if (selectedFiles.value.size === 0) return;

  const paths = Array.from(selectedFiles.value).join("\n");
  navigator.clipboard.writeText(paths);

  successMessage.value = `Copied ${selectedFiles.value.size} file path${
    selectedFiles.value.size > 1 ? "s" : ""
  } to clipboard`;
  setTimeout(() => {
    successMessage.value = "";
  }, 3000);
}

function copyToClipboard(path: string) {
  navigator.clipboard.writeText(path);
  successMessage.value = "File path copied to clipboard";
  setTimeout(() => {
    successMessage.value = "";
  }, 2000);
}

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

function handleFileClick(file: any, event: MouseEvent) {
  const currentTime = Date.now();
  const isDoubleClick = currentTime - lastClickTime.value < 300;

  if (isDoubleClick) {
    openPreview(file);
  } else {
    const index = paginatedFiles.value.findIndex((f) => f.path === file.path);
    focusedIndex.value = index;
    toggleFileSelection(file.path, event);
  }

  lastClickTime.value = currentTime;
}

// Helper function to parse size strings
function parseSize(sizeStr: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2] || "b";
  return value * (units[unit] || 1);
}

function clearError() {
  showError.value = false;
  errorMessage.value = "";
}

function clearSearch() {
  searchQuery.value = "";
}

// Category icon mapping
function getCategoryIcon(category: string) {
  return X; // Use default icon for all categories
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getOwnerShortName(owner: string): string {
  if (!owner) return "";
  // Extract username from DOMAIN\username format
  const parts = owner.split("\\");
  const username = parts[parts.length - 1];
  // Return first 8 characters to keep it short
  return username.length > 8 ? username.substring(0, 8) : username;
}

// AI Summary Function
async function getAISummary(file: FileItem) {
  summaryLoading.value = true;
  summaryError.value = null;
  showSummaryModal.value = true;
  summaryData.value = null;

  try {
    const response = await fetch("http://localhost:8080/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath: file.path,
        model: "phi4-mini:latest",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get summary");
    }

    const data = await response.json();
    summaryData.value = {
      fileName: file.name,
      filePath: file.path,
      summary: data.summary,
      fileType: data.fileType,
      cached: data.cached,
      tokensUsed: data.tokensUsed,
      responseTime: data.responseTime,
    };
  } catch (err: any) {
    summaryError.value = err.message || "An error occurred";
  } finally {
    summaryLoading.value = false;
  }
}

function closeSummaryModal() {
  showSummaryModal.value = false;
  summaryData.value = null;
  summaryError.value = null;
}

async function revealFile(filePath: string) {
  try {
    await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/files/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
  } catch (err) {
    console.error("Failed to reveal file:", err);
  }
}

function openPreview(file: any) {
  selectedFile.value = file;
  showPreviewModal.value = true;
}

function closePreview() {
  selectedFile.value = null;
  showPreviewModal.value = false;
}

function getFilePreviewType(file: any): string {
  const ext = file.extension?.toLowerCase() || "";
  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico"];
  const videoExts = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"];
  const audioExts = ["mp3", "wav", "flac", "aac", "ogg", "m4a"];
  const textExts = ["txt", "md", "json", "xml", "csv", "log", "ini", "config"];
  const codeExts = [
    "js",
    "ts",
    "vue",
    "py",
    "java",
    "cpp",
    "c",
    "h",
    "cs",
    "php",
    "rb",
    "go",
    "rs",
  ];

  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (textExts.includes(ext) || codeExts.includes(ext)) return "text";
  return "unknown";
}

async function deleteFile(filePath: string) {
  if (!confirm(`Are you sure you want to permanently delete this file?\n\n${filePath}`)) {
    return;
  }

  isDeleting.value.add(filePath);
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/files/delete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete file");
    }

    // Success - remove from UI locally
    if (store.analysisResult?.files) {
      const fileIndex = store.analysisResult.files.findIndex((f: any) => f.path === filePath);
      if (fileIndex !== -1) {
        store.analysisResult.files.splice(fileIndex, 1);
      }
    }

    successMessage.value = "File deleted successfully";
    setTimeout(() => {
      successMessage.value = "";
    }, 3000);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : "Failed to delete file";
  } finally {
    isDeleting.value.delete(filePath);
  }
}

// Accessibility improvements
function announceToScreenReader(message: string) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

function handleAccessibilityNavigation(event: KeyboardEvent) {
  const focusedElement = document.activeElement;
  const isFileItem = focusedElement?.closest("[data-file-item]");

  if (isFileItem) {
    switch (event.key) {
      case "Home":
        event.preventDefault();
        focusedIndex.value = 0;
        focusFileItem(0);
        break;
      case "End":
        event.preventDefault();
        focusedIndex.value = paginatedFiles.value.length - 1;
        focusFileItem(focusedIndex.value);
        break;
      case "PageUp":
        event.preventDefault();
        focusedIndex.value = Math.max(0, focusedIndex.value - 10);
        focusFileItem(focusedIndex.value);
        break;
      case "PageDown":
        event.preventDefault();
        focusedIndex.value = Math.min(paginatedFiles.value.length - 1, focusedIndex.value + 10);
        focusFileItem(focusedIndex.value);
        break;
    }
  }
}

function focusFileItem(index: number) {
  const fileItem = document.querySelector(`[data-file-item="${index}"]`) as HTMLElement;
  if (fileItem) {
    fileItem.focus();
    const file = paginatedFiles.value[index];
    announceToScreenReader(
      `File ${index + 1} of ${paginatedFiles.value.length}: ${file.name}, ${formatSize(file.size)}`
    );
  }
}

// Enhanced keyboard event handler with accessibility
function handleKeyboardEvent(event: KeyboardEvent) {
  // Handle accessibility navigation first
  handleAccessibilityNavigation(event);

  const key = [];
  if (event.ctrlKey) key.push("Ctrl");
  if (event.shiftKey) key.push("Shift");
  if (event.altKey) key.push("Alt");
  key.push(event.key);

  const shortcut = key.join("+");
  const handler = keyboardShortcuts[shortcut];

  if (handler) {
    event.preventDefault();
    handler();
  }
}

// Lifecycle hooks
onMounted(() => {
  document.addEventListener("keydown", handleKeyboardEvent);
  // Announce initial state
  announceToScreenReader(`File browser loaded with ${filteredFiles.value.length} files`);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyboardEvent);
});
</script>

<template>
  <div class="file-browser-view">
    <!-- Error Messages -->
    <div
      v-if="showError"
      class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 mb-4"
    >
      <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div class="flex-1">
        <p class="text-red-300 text-sm">
          {{ errorMessage }}
        </p>
      </div>
      <button class="text-red-400 hover:text-red-300 transition-colors" @click="clearError">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Success Message -->
    <div
      v-if="successMessage"
      class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 mb-4"
    >
      <div class="flex-1">
        <p class="text-emerald-400 text-sm">
          {{ successMessage }}
        </p>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="!hasData && !isLoading" class="text-center py-16 px-4">
      <div class="mb-6">
        <div
          class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <File class="w-12 h-12 text-slate-600" />
        </div>
        <h3 class="text-xl font-semibold text-slate-200 mb-2">No Scan Data Available</h3>
        <p class="text-slate-400 max-w-md mx-auto mb-6">
          You need to scan a directory first before you can browse files.
        </p>
      </div>
      <Button variant="primary" size="lg" @click="$router.push('/scan')">
        <Search class="w-5 h-5 mr-2" />
        Scan Directory
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col gap-4">
      <div class="flex items-center justify-center py-12">
        <div class="flex items-center gap-3 text-slate-400">
          <Loader2 class="w-6 h-6 animate-spin" />
          <span>Loading files...</span>
        </div>
      </div>
    </div>

    <!-- Enhanced Filters with Bulk Actions -->
    <Card v-if="hasData" padding="sm">
      <div class="flex flex-col gap-4">
        <!-- Bulk Actions Bar -->
        <div
          v-if="showBulkActions"
          class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <CheckSquare class="w-5 h-5 text-blue-400" />
            <span class="text-blue-300 font-medium"
              >{{ selectedCount }} file{{ selectedCount > 1 ? "s" : "" }} selected</span
            >
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm flex items-center gap-1 transition-colors"
              title="Copy paths (Ctrl+C)"
              @click="copySelectedPaths"
            >
              <Copy class="w-4 h-4" />
              Copy
            </button>
            <button
              class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center gap-1 transition-colors"
              title="Delete selected (Delete)"
              @click="deleteSelected"
            >
              <Trash2 class="w-4 h-4" />
              Delete
            </button>
            <button
              class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm flex items-center gap-1 transition-colors"
              title="Clear selection (Escape)"
              @click="clearSelection"
            >
              <X class="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="flex flex-wrap gap-4 items-center filter-container">
          <!-- Enhanced Search -->
          <div class="flex-1 min-w-[200px] relative">
            <Search class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search files... (Ctrl+F)"
              class="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-10 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              @keydown.ctrl.f.prevent="focusSearch"
            />
            <button
              v-if="searchQuery"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              @click="clearSearch"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Enhanced Category Filter -->
          <div class="relative">
            <Filter class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              v-model="selectedCategory"
              class="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-slate-100 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
              </option>
            </select>
            <ChevronDown
              class="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>

          <!-- Enhanced Sort with Direction -->
          <div class="relative">
            <ArrowUpDown class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              v-model="sortBy"
              class="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-slate-100 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="category">Category</option>
            </select>
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              :title="`Sort direction: ${sortDirection}`"
              @click="toggleSortDirection"
            >
              <component :is="sortDirection === 'asc' ? ChevronUp : ChevronDown" class="w-4 h-4" />
            </button>
          </div>

          <!-- Enhanced View Toggle -->
          <div class="flex gap-1 bg-slate-800 rounded-lg p-1 view-toggle">
            <button
              :class="[
                'px-3 py-1.5 rounded text-sm flex items-center gap-1',
                viewMode === 'list'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200',
              ]"
              title="List view (Ctrl+1)"
              @click="viewMode = 'list'"
            >
              <LayoutList class="w-4 h-4" />
              List
            </button>
            <button
              :class="[
                'px-3 py-1.5 rounded text-sm flex items-center gap-1',
                viewMode === 'grid'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200',
              ]"
              title="Grid view (Ctrl+2)"
              @click="viewMode = 'grid'"
            >
              <LayoutGrid class="w-4 h-4" />
              Grid
            </button>
            <button
              :class="[
                'px-3 py-1.5 rounded text-sm flex items-center gap-1',
                viewMode === 'preview'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200',
              ]"
              title="Preview view (Ctrl+3)"
              @click="viewMode = 'preview'"
            >
              <Eye class="w-4 h-4" />
              Preview
            </button>
            <button
              :class="[
                'px-3 py-1.5 rounded text-sm flex items-center gap-1',
                viewMode === 'canvas'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200',
              ]"
              title="Canvas view (Ctrl+4)"
              @click="viewMode = 'canvas'"
            >
              <Grid3x3 class="w-4 h-4" />
              Canvas
            </button>
          </div>

          <!-- Keyboard Shortcuts Help -->
          <button
            class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm flex items-center gap-1 transition-colors"
            title="Keyboard shortcuts (?)"
            @click="showKeyboardShortcuts = !showKeyboardShortcuts"
          >
            <span class="text-xs">?</span>
            Shortcuts
          </button>
        </div>

        <!-- Keyboard Shortcuts Panel -->
        <div
          v-if="showKeyboardShortcuts"
          class="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
        >
          <h4 class="text-sm font-semibold text-slate-200 mb-2">Keyboard Shortcuts</h4>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="text-slate-400">Ctrl+A - Select all</div>
            <div class="text-slate-400">Ctrl+C - Copy paths</div>
            <div class="text-slate-400">Ctrl+F - Focus search</div>
            <div class="text-slate-400">Delete - Delete selected</div>
            <div class="text-slate-400">Arrow Up/Down - Navigate</div>
            <div class="text-slate-400">Enter - Open file</div>
            <div class="text-slate-400">Space - Toggle selection</div>
            <div class="text-slate-400">Escape - Clear selection</div>
          </div>
        </div>
      </div>
    </Card>

    <!-- Enhanced Results Count with Pagination -->
    <div v-if="hasData" class="flex items-center justify-between mb-4">
      <p class="text-slate-400">
        Showing {{ paginatedFiles.length.toLocaleString() }} of
        {{ filteredFiles.length.toLocaleString() }} files
        <span v-if="searchQuery" class="text-slate-500">(filtered by "{{ searchQuery }}")</span>
      </p>

      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="flex items-center gap-2">
        <button
          :disabled="currentPage === 1"
          class="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-300 text-sm transition-colors"
          @click="currentPage = Math.max(1, currentPage - 1)"
        >
          Previous
        </button>
        <span class="text-slate-400 text-sm"> Page {{ currentPage }} of {{ totalPages }} </span>
        <button
          :disabled="currentPage === totalPages"
          class="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-300 text-sm transition-colors"
          @click="currentPage = Math.min(totalPages, currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Enhanced List View -->
    <div v-if="viewMode === 'list'" class="space-y-2 file-list files-container">
      <!-- Select All Checkbox -->
      <div
        v-if="paginatedFiles.length > 0"
        class="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg"
      >
        <button
          class="flex items-center gap-2 text-slate-300 hover:text-slate-100 transition-colors"
          @click="allSelected ? clearSelection() : selectAll()"
        >
          <component :is="allSelected ? CheckSquare : Square" class="w-4 h-4" />
          <span class="text-sm">{{ allSelected ? "Deselect All" : "Select All" }}</span>
        </button>
      </div>

      <div
        v-for="(file, index) in paginatedFiles"
        :key="file.path"
        :data-file-item="index"
        :class="[
          'flex items-center justify-between p-4 bg-slate-900 border rounded-lg transition-all cursor-pointer',
          selectedFiles.has(file.path)
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-slate-800 hover:border-slate-700',
          focusedIndex === index ? 'ring-2 ring-blue-500' : '',
        ]"
        tabindex="0"
        @click="handleFileClick(file, $event)"
        @dblclick="openPreview(file)"
      >
        <div class="flex items-center gap-4">
          <!-- Selection Checkbox -->
          <button
            class="flex items-center justify-center w-5 h-5 border border-slate-600 rounded transition-colors"
            :class="
              selectedFiles.has(file.path)
                ? 'bg-blue-500 border-blue-500'
                : 'hover:border-slate-400'
            "
            @click.stop="toggleFileSelection(file.path)"
          >
            <Check v-if="selectedFiles.has(file.path)" class="w-3 h-3 text-white" />
          </button>

          <!-- File Icon -->
          <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <component :is="getCategoryIcon(file.category)" class="w-5 h-5 text-slate-400" />
          </div>

          <!-- File Info -->
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-200 truncate">
              {{ file.name }}
            </p>
            <p class="text-sm text-slate-500 truncate">
              {{ file.path }}
            </p>
            <div class="flex gap-1 mt-1 flex-wrap">
              <span
                v-if="file.owner"
                class="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-xs"
                :title="file.owner"
                >{{ getOwnerShortName(file.owner) }}</span
              >
              <span
                v-if="file.is_hard_link"
                class="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
                title="Hard Link"
                >HL</span
              >
              <span
                v-if="file.has_ads"
                class="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                title="Alternate Data Streams"
                >ADS</span
              >
              <span
                v-if="file.is_compressed"
                class="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs"
                title="Compressed"
                >Compressed</span
              >
            </div>
          </div>
        </div>

        <!-- File Size and Category -->
        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="font-medium text-slate-200">
              {{ formatSize(file.size) }}
            </p>
            <p class="text-sm text-slate-500">
              {{ file.category }}
            </p>
          </div>

          <!-- Quick Actions -->
          <div
            class="flex gap-1 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
          >
            <button
              class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Preview (Enter)"
              @click.stop="openPreview(file)"
            >
              <Eye class="w-4 h-4 text-slate-400" />
            </button>
            <button
              class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="AI Summary"
              @click.stop="getAISummary(file)"
            >
              <Brain class="w-4 h-4 text-slate-400" />
            </button>
            <button
              class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Reveal in Explorer"
              @click.stop="revealFile(file.path)"
            >
              <ExternalLink class="w-4 h-4 text-slate-400" />
            </button>
            <button
              class="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Copy Path"
              @click.stop="copyToClipboard(file.path)"
            >
              <Copy class="w-4 h-4 text-slate-400" />
            </button>
            <button
              :disabled="isDeleting.has(file.path)"
              class="p-2 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              title="Delete"
              @click.stop="deleteFile(file.path)"
            >
              <Trash2 v-if="!isDeleting.has(file.path)" class="w-4 h-4 text-slate-400" />
              <div
                v-else
                class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Grid View -->
    <div
      v-else-if="viewMode === 'grid'"
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      <div
        v-for="file in paginatedFiles"
        :key="file.path"
        class="p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 cursor-pointer"
        @click="openPreview(file)"
      >
        <div class="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-3">
          <component :is="getCategoryIcon(file.category)" class="w-6 h-6 text-slate-400" />
        </div>
        <p class="font-medium text-slate-200 truncate">
          {{ file.name }}
        </p>
        <p class="text-sm text-slate-400">
          {{ formatSize(file.size) }}
        </p>
      </div>
    </div>

    <!-- Preview Modal -->
    <div
      v-if="showPreviewModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click="closePreview"
    >
      <div class="bg-slate-900 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto" @click.stop>
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-slate-200">File Preview</h3>
          <button class="text-slate-400 hover:text-slate-200" @click="closePreview">
            <X class="w-6 h-6" />
          </button>
        </div>

        <div v-if="selectedFile" class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center">
              <component
                :is="getCategoryIcon(selectedFile.category)"
                class="w-8 h-8 text-slate-400"
              />
            </div>
            <div>
              <h4 class="text-lg font-medium text-slate-200">
                {{ selectedFile.name }}
              </h4>
              <p class="text-slate-400">
                {{ selectedFile.path }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-500">Size:</span>
              <span class="text-slate-200 ml-2">{{ formatSize(selectedFile.size) }}</span>
            </div>
            <div>
              <span class="text-slate-500">Category:</span>
              <span class="text-slate-200 ml-2">{{ selectedFile.category }}</span>
            </div>
            <div>
              <span class="text-slate-500">Extension:</span>
              <span class="text-slate-200 ml-2">{{ selectedFile.extension }}</span>
            </div>
            <div v-if="selectedFile.owner">
              <span class="text-slate-500">Owner:</span>
              <span class="text-slate-200 ml-2">{{ selectedFile.owner }}</span>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              @click="getAISummary(selectedFile)"
            >
              <Brain class="w-4 h-4" />
              AI Summary
            </button>
            <button
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex items-center gap-2 transition-colors"
              @click="revealFile(selectedFile.path)"
            >
              <ExternalLink class="w-4 h-4" />
              Reveal in Explorer
            </button>
            <button
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex items-center gap-2 transition-colors"
              @click="copyToClipboard(selectedFile.path)"
            >
              <Copy class="w-4 h-4" />
              Copy Path
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Summary Modal -->
    <div
      v-if="showSummaryModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click="closeSummaryModal"
    >
      <div class="bg-slate-900 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto" @click.stop>
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold text-slate-200">AI Summary</h3>
          <button class="text-slate-400 hover:text-slate-200" @click="closeSummaryModal">
            <X class="w-6 h-6" />
          </button>
        </div>

        <div v-if="summaryLoading" class="flex items-center justify-center py-8">
          <Loader2 class="w-8 h-8 animate-spin text-blue-400" />
          <span class="ml-3 text-slate-300">Generating AI summary...</span>
        </div>

        <div v-else-if="summaryError" class="text-center py-8">
          <p class="text-red-400">
            {{ summaryError }}
          </p>
        </div>

        <div v-else-if="summaryData" class="flex flex-col gap-4">
          <div class="bg-slate-800 rounded-lg p-4">
            <h4 class="font-medium text-slate-200 mb-2">
              {{ summaryData.fileName }}
            </h4>
            <p class="text-slate-300 leading-relaxed">
              {{ summaryData.summary }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-500">File Type:</span>
              <span class="text-slate-200 ml-2">{{ summaryData.fileType }}</span>
            </div>
            <div>
              <span class="text-slate-500">Cached:</span>
              <span class="text-slate-200 ml-2">{{ summaryData.cached ? "Yes" : "No" }}</span>
            </div>
            <div>
              <span class="text-slate-500">Tokens Used:</span>
              <span class="text-slate-200 ml-2">{{ summaryData.tokensUsed.toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-slate-500">Response Time:</span>
              <span class="text-slate-200 ml-2">{{ summaryData.responseTime }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-browser-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Custom scrollbar */
.files-container {
  scrollbar-width: thin;
  scrollbar-color: #475569 #1e293b;
}

.files-container::-webkit-scrollbar {
  width: 8px;
}

.files-container::-webkit-scrollbar-track {
  background: #1e293b;
}

.files-container::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.files-container::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* Focus styles */
[data-file-item]:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Hover effects */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

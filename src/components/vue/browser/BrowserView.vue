<template>
  <div data-testid="browser-view" class="p-6 lg:p-8 bg-slate-900 min-h-screen">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">File Browser</h1>
          <p class="text-slate-400">Navigate and explore your analyzed files</p>
        </div>
        <button
          class="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          aria-label="Back to landing"
          @click="navigateToLanding"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
          Back
        </button>
      </div>

      <!-- Search Bar -->
      <div class="relative">
        <Search
          class="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
          :size="20"
          aria-hidden="true"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search files..."
          class="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          aria-label="Search files"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!analysisStore.data"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <FolderOpen :size="64" class="text-slate-600 mb-4" aria-hidden="true" />
      <h2 class="text-2xl font-semibold text-white mb-2">No Data Available</h2>
      <p class="text-slate-400 mb-6">Run an analysis to browse your files</p>
      <button
        class="bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        aria-label="Start analysis"
        @click="navigateToLanding"
      >
        Start Analysis
      </button>
    </div>

    <!-- File Browser Content -->
    <div v-else class="space-y-6">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-sm">
        <button
          class="text-cyan-400 hover:text-cyan-300 transition-colors"
          :class="{ 'text-slate-400 hover:text-slate-300': currentPath === '' }"
          @click="currentPath = ''"
        >
          Root
        </button>
        <span v-if="currentPath" class="text-slate-500">/</span>
        <template v-for="(part, index) in pathParts" :key="index">
          <span class="text-slate-500">/</span>
          <button
            class="text-cyan-400 hover:text-cyan-300 transition-colors"
            @click="navigateToPath(index)"
          >
            {{ part }}
          </button>
        </template>
      </div>

      <!-- Filter Tabs -->
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="filter in filters"
          :key="filter.value"
          :class="[
            'px-4 py-2 rounded-lg text-sm transition-colors',
            selectedFilter === filter.value
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
          ]"
          @click="selectedFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>

      <!-- File List -->
      <div class="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <!-- Table Header -->
        <div
          class="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-700/50 border-b border-slate-700 text-sm font-medium text-slate-300"
        >
          <div class="col-span-6">Name</div>
          <div class="col-span-2">Size</div>
          <div class="col-span-2">Type</div>
          <div class="col-span-2">Actions</div>
        </div>

        <!-- File Items -->
        <div class="divide-y divide-slate-700">
          <div
            v-for="item in filteredFiles"
            :key="item.path"
            class="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-slate-700/50 transition-colors items-center"
          >
            <div class="col-span-6 flex items-center gap-3">
              <Folder v-if="item.isDirectory" class="text-cyan-400" :size="20" aria-hidden="true" />
              <File v-else class="text-slate-400" :size="20" aria-hidden="true" />
              <span class="text-white truncate">{{ item.name }}</span>
            </div>
            <div class="col-span-2 text-slate-400 text-sm">
              {{ item.isDirectory ? "-" : formatBytes(item.size) }}
            </div>
            <div class="col-span-2 text-slate-400 text-sm">
              {{ item.extension || "Folder" }}
            </div>
            <div class="col-span-2 flex gap-2">
              <button
                v-if="item.isDirectory"
                class="text-cyan-400 hover:text-cyan-300 transition-colors"
                aria-label="Enter directory"
                title="Enter directory"
                @click="enterDirectory(item.path)"
              >
                <ChevronRight :size="16" aria-hidden="true" />
              </button>
              <button
                class="text-slate-400 hover:text-slate-300 transition-colors"
                aria-label="Reveal in explorer"
                title="Reveal in explorer"
                @click="revealInExplorer(item.path)"
              >
                <ExternalLink :size="16" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State for Filter -->
        <div v-if="filteredFiles.length === 0" class="px-6 py-12 text-center text-slate-400">
          No files found matching your criteria
        </div>
      </div>

      <!-- Statistics -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div class="text-slate-400 text-sm mb-1">Total Files</div>
          <div class="text-2xl font-bold text-white">
            {{ filteredFiles.length }}
          </div>
        </div>
        <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div class="text-slate-400 text-sm mb-1">Total Size</div>
          <div class="text-2xl font-bold text-white">
            {{ formatBytes(totalSize) }}
          </div>
        </div>
        <div class="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div class="text-slate-400 text-sm mb-1">Current Path</div>
          <div class="text-sm text-white truncate">
            {{ currentPath || "Root" }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { useRouter } from "vue-router";
import {
  Folder,
  File,
  Search,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
} from "lucide-vue-next";
import { analysisStoreKey } from "../../../types/injection";

interface FileItem {
  name: string;
  path: string;
  size: number;
  extension: string;
  isDirectory: boolean;
}

const router = useRouter();
const analysisStore = inject(analysisStoreKey)!;

const searchQuery = ref("");
const currentPath = ref("");
const selectedFilter = ref("all");

const filters = [
  { label: "All", value: "all" },
  { label: "Images", value: "images" },
  { label: "Documents", value: "documents" },
  { label: "Code", value: "code" },
  { label: "Media", value: "media" },
  { label: "Other", value: "other" },
];

const pathParts = computed(() => {
  if (!currentPath.value) return [];
  return currentPath.value.split(/[/\\]/).filter(Boolean);
});

const allFiles = computed((): FileItem[] => {
  if (!analysisStore.data?.files) return [];

  // Generate file structure from analysis data
  const files: FileItem[] = [];
  const baseDir = analysisStore.data.directoryPath || "";

  // If backend doesn't return individual files, create mock structure from categories
  if (analysisStore.data.files.length === 0 && analysisStore.data.categories) {
    Object.entries(analysisStore.data.categories).forEach(([category, data]: [string, any]) => {
      const count = data.count || 0;
      for (let i = 0; i < Math.min(count, 10); i++) {
        files.push({
          name: `${category.toLowerCase()}_file_${i + 1}.${getExtensionForCategory(category)}`,
          path: `${baseDir}\\${category}\\${category.toLowerCase()}_file_${i + 1}.${getExtensionForCategory(category)}`,
          size: (data.size || 0) / Math.max(count, 1),
          extension: getExtensionForCategory(category),
          isDirectory: false,
        });
      }
    });
  } else {
    // Use actual files from analysis
    analysisStore.data.files.forEach((file: any) => {
      files.push({
        name: file.name,
        path: file.path,
        size: file.size || 0,
        extension: file.extension || "",
        isDirectory: false,
      });
    });
  }

  return files;
});

const filteredFiles = computed(() => {
  let files = allFiles.value;

  // Filter by current path
  if (currentPath.value) {
    files = files.filter((f) => f.path.startsWith(currentPath.value));
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    files = files.filter(
      (f) => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query)
    );
  }

  // Filter by category
  if (selectedFilter.value !== "all") {
    const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
    const docExts = ["pdf", "doc", "docx", "txt", "rtf", "odt"];
    const codeExts = [
      "js",
      "ts",
      "py",
      "java",
      "cpp",
      "c",
      "h",
      "cs",
      "go",
      "rs",
      "vue",
      "jsx",
      "tsx",
    ];
    const mediaExts = ["mp4", "avi", "mov", "mp3", "wav", "flac", "mkv"];

    files = files.filter((f) => {
      const ext = f.extension.toLowerCase();
      switch (selectedFilter.value) {
        case "images":
          return imageExts.includes(ext);
        case "documents":
          return docExts.includes(ext);
        case "code":
          return codeExts.includes(ext);
        case "media":
          return mediaExts.includes(ext);
        case "other":
          return (
            !imageExts.includes(ext) &&
            !docExts.includes(ext) &&
            !codeExts.includes(ext) &&
            !mediaExts.includes(ext)
          );
        default:
          return true;
      }
    });
  }

  return files;
});

const totalSize = computed(() => {
  return filteredFiles.value.reduce((sum, f) => sum + f.size, 0);
});

const navigateToLanding = () => {
  router.push("/");
};

const navigateToPath = (index: number) => {
  const parts = pathParts.value.slice(0, index + 1);
  currentPath.value = parts.join("/");
};

const enterDirectory = (path: string) => {
  currentPath.value = path;
};

const revealInExplorer = (path: string) => {
  // This would call the backend to reveal the file in explorer
  console.warn("Reveal in explorer:", path);
  // TODO: Implement actual reveal functionality via backend API
};

const formatBytes = (bytes: number) => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const getExtensionForCategory = (category: string): string => {
  const extensions: Record<string, string> = {
    Images: "jpg",
    Videos: "mp4",
    Audio: "mp3",
    Documents: "pdf",
    Code: "js",
    Media: "mp4",
    System: "dll",
    Other: "txt",
  };
  return extensions[category] || "txt";
};
</script>

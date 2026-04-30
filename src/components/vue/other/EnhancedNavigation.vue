<template>
  <div>
    <!-- Mobile Header -->
    <div
      class="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800"
    >
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <button
            class="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Toggle sidebar"
            @click="toggleSidebar"
          >
            <X v-if="sidebarOpen" class="w-5 h-5" />
            <Menu v-else class="w-5 h-5" />
          </button>
          <div class="flex items-center gap-2">
            <BrainCircuit class="w-6 h-6 text-blue-400" />
            <span class="font-semibold text-white">Space Analyzer</span>
          </div>
        </div>

        <!-- Error Indicator -->
        <div
          v-if="hasErrors"
          class="flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30"
        >
          <AlertTriangle class="w-4 h-4 text-red-400" />
          <span class="text-xs text-red-300">{{ globalErrors.length }}</span>
        </div>
      </div>
    </div>

    <!-- Sidebar Navigation -->
    <div
      :class="[
        'fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 transform transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0 md:static md:inset-0',
      ]"
    >
      <!-- Sidebar Header -->
      <div class="flex items-center justify-between p-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center"
          >
            <BrainCircuit class="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-white">Space Analyzer</h1>
            <p class="text-xs text-slate-400">Pro Edition</p>
          </div>
        </div>
        <button
          class="md:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close sidebar"
          @click="toggleSidebar"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Search Bar -->
      <div class="p-4 border-b border-slate-800 relative">
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search features..."
            class="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            @focus="isSearchFocused = true"
            @blur="isSearchFocused = false"
            @keydown="handleSearchKeyDown"
          />
          <button
            v-if="searchQuery"
            class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
            aria-label="Clear search"
            @click="searchQuery = ''"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <div
          v-if="isSearchFocused && filteredItems.length > 0"
          class="absolute top-full left-4 right-4 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-auto"
        >
          <button
            v-for="item in filteredItems"
            :key="item.id"
            class="w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700 last:border-b-0 transition-colors"
            @click="handleNavigation(item)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <component :is="item.icon" class="w-4 h-4 text-slate-300" />
                <div>
                  <div class="text-white text-sm font-medium">
                    {{ item.label }}
                  </div>
                  <div v-if="item.description" class="text-xs text-slate-400">
                    {{ item.description }}
                  </div>
                </div>
              </div>
              <span
                v-if="item.beta"
                class="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
              >
                Beta
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Navigation Categories -->
      <nav class="flex-1 overflow-y-auto py-4">
        <div v-for="(items, category) in groupedItems" :key="category" class="mb-6">
          <div class="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {{ category.charAt(0).toUpperCase() + category.slice(1) }}
          </div>
          <div class="space-y-1">
            <button
              v-for="item in items"
              :key="item.id"
              :disabled="item.disabled || item.comingSoon"
              :class="[
                'w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200',
                currentPath === item.path
                  ? 'bg-blue-500/20 text-blue-300 border-r-2 border-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                item.disabled || item.comingSoon
                  ? 'opacity-50 cursor-not-allowed hover:bg-transparent'
                  : 'cursor-pointer',
              ]"
              :title="item.description"
              @click="handleNavigation(item)"
            >
              <component
                :is="item.icon"
                :class="['w-4 h-4', currentPath === item.path ? 'text-blue-400' : 'text-slate-400']"
              />
              <span class="flex-1 text-left">{{ item.label }}</span>
              <kbd
                v-if="item.shortcut"
                class="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600"
              >
                {{ item.shortcut }}
              </kbd>
              <span
                v-if="item.beta"
                class="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
              >
                Beta
              </span>
              <span
                v-if="item.comingSoon"
                class="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30"
              >
                Soon
              </span>
            </button>
          </div>
        </div>
      </nav>

      <!-- Sidebar Footer -->
      <div class="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-900/50 p-4">
        <!-- Error Status -->
        <div v-if="hasErrors" class="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <AlertTriangle class="w-4 h-4 text-red-400" />
              <span class="text-sm text-red-300">Errors</span>
            </div>
            <span class="text-xs text-red-400">{{ globalErrors.length }}</span>
          </div>
        </div>

        <!-- System Status -->
        <div class="space-y-2 text-xs text-slate-400">
          <div class="flex items-center justify-between">
            <span>Theme</span>
            <span class="text-slate-300 capitalize">{{ theme }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Font Size</span>
            <span class="text-slate-300 capitalize">{{ fontSize }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Version</span>
            <span class="text-slate-300">2.0.1</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Overlay for mobile -->
    <div
      v-if="sidebarOpen"
      class="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
      @click="toggleSidebar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  Settings,
  Folder,
  Activity,
  AlertTriangle,
  Menu,
  X,
  Search,
  FileText,
  Shield,
  Lightbulb,
  Clock,
  Eye,
  TrendingUp,
  Network,
  Cpu,
  Sparkles,
  FileType,
} from "lucide-vue-next";

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: any;
  description?: string;
  shortcut?: string;
  category: "primary" | "ai" | "analysis" | "tools" | "system";
  disabled?: boolean;
  beta?: boolean;
  comingSoon?: boolean;
}

const navigationItems: NavigationItem[] = [
  // Primary Navigation
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    description: "Overview and quick analysis",
    category: "primary",
    shortcut: "D",
  },
  {
    id: "neural",
    label: "Neural View",
    path: "/neural",
    icon: BrainCircuit,
    description: "AI-powered file relationships",
    category: "ai",
    shortcut: "N",
  },
  {
    id: "ai-chat",
    label: "AI Assistant",
    path: "/ai-chat",
    icon: MessageSquare,
    description: "Chat with AI about your files",
    category: "ai",
    shortcut: "A",
  },
  {
    id: "treemap",
    label: "Visualizations",
    path: "/treemap",
    icon: BarChart3,
    description: "Interactive data visualizations",
    category: "analysis",
    shortcut: "V",
  },
  {
    id: "file-browser",
    label: "File Browser",
    path: "/file-browser",
    icon: Folder,
    description: "Browse and manage files",
    category: "tools",
    shortcut: "F",
  },
  {
    id: "export",
    label: "Export Data",
    path: "/export",
    icon: FileText,
    description: "Export analysis results",
    category: "tools",
    shortcut: "E",
  },

  // AI Features
  {
    id: "ai-insights",
    label: "AI Insights",
    path: "/ai-insights",
    icon: Lightbulb,
    description: "AI-generated recommendations",
    category: "ai",
    beta: true,
  },
  {
    id: "ai-features",
    label: "AI Features",
    path: "/ai-features",
    icon: Sparkles,
    description: "Advanced AI capabilities",
    category: "ai",
    beta: true,
  },

  // Analysis Tools
  {
    id: "reports",
    label: "PDF Reports",
    path: "/reports",
    icon: FileType,
    description: "Generate and view PDF analysis reports",
    category: "analysis",
    shortcut: "R",
  },
  {
    id: "time-travel",
    label: "Time Travel",
    path: "/time-travel",
    icon: Clock,
    description: "Historical analysis comparison",
    category: "analysis",
    beta: true,
  },
  {
    id: "temperature",
    label: "Temperature Map",
    path: "/temperature",
    icon: Eye,
    description: "File access patterns",
    category: "analysis",
    beta: true,
  },
  {
    id: "optimization",
    label: "Optimization",
    path: "/optimization",
    icon: TrendingUp,
    description: "Storage optimization tools",
    category: "tools",
    beta: true,
  },

  // System Tools
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: Settings,
    description: "Application settings",
    category: "system",
    shortcut: "S",
  },
  {
    id: "integrations",
    label: "Integrations",
    path: "/integrations",
    icon: Network,
    description: "External service connections",
    category: "system",
    beta: true,
  },
  {
    id: "monitoring",
    label: "Monitoring",
    path: "/monitoring",
    icon: Activity,
    description: "System performance monitoring",
    category: "system",
    beta: true,
  },
  {
    id: "security",
    label: "Security",
    path: "/security",
    icon: Shield,
    description: "Security analysis and alerts",
    category: "system",
    beta: true,
  },
  {
    id: "automation",
    label: "Automation",
    path: "/automation",
    icon: Cpu,
    description: "Automated workflows",
    category: "tools",
    beta: true,
  },
];

const router = useRouter();
const route = useRoute();

const searchQuery = ref("");
const isSearchFocused = ref(false);

// Simulated store state
const sidebarOpen = ref(true);
const theme = ref("dark");
const fontSize = ref("medium");
const globalErrors = ref<any[]>([]);

const currentPath = computed(() => route.path);

const hasErrors = computed(() => globalErrors.value.length > 0);

// Filter navigation items based on search
const filteredItems = computed(() => {
  if (!searchQuery.value) return [];

  const query = searchQuery.value.toLowerCase();
  return navigationItems.filter((item) => {
    return (
      item.label.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });
});

// Group items by category
const groupedItems = computed(() => {
  const groups: Record<string, NavigationItem[]> = {};

  navigationItems.forEach((item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });

  return groups;
});

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

const handleNavigation = (item: NavigationItem) => {
  if (item.disabled || item.comingSoon) return;

  router.push(item.path);
  if (window.innerWidth < 768) {
    toggleSidebar();
  }
};

const handleSearchKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    searchQuery.value = "";
    isSearchFocused.value = false;
  }
};

// Keyboard navigation
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toUpperCase();
      const item = navigationItems.find((item) => item.shortcut === key);
      if (item) {
        e.preventDefault();
        handleNavigation(item);
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
});
</script>

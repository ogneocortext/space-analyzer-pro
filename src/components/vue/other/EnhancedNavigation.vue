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
      role="navigation"
      aria-label="Main navigation"
    >
      <!-- Sidebar Header -->
      <div class="flex items-center justify-between p-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center"
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
      <nav class="flex-1 overflow-y-auto py-4" role="menubar" aria-orientation="vertical">
        <div v-for="(items, category) in groupedItems" :key="category" class="mb-6">
          <h2
            class="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider"
            role="heading"
            :level="3"
          >
            {{ category.charAt(0).toUpperCase() + category.slice(1) }}
          </h2>
          <div class="space-y-1" role="group" :aria-label="category">
            <button
              v-for="item in items"
              :key="item.id"
              :disabled="item.disabled || item.comingSoon"
              :class="[
                'w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200',
                isActiveRoute(item.path)
                  ? 'bg-blue-500/20 text-blue-300 border-r-2 border-blue-400'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                item.disabled || item.comingSoon
                  ? 'opacity-50 cursor-not-allowed hover:bg-transparent'
                  : 'cursor-pointer',
              ]"
              :title="item.description"
              :aria-label="item.label + (item.description ? ': ' + item.description : '')"
              :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
              role="menuitem"
              @click="handleNavigation(item)"
            >
              <component
                :is="item.icon"
                :class="['w-4 h-4', isActiveRoute(item.path) ? 'text-blue-400' : 'text-slate-400']"
                aria-hidden="true"
              />
              <span class="flex-1 text-left">{{ item.label }}</span>
              <kbd
                v-if="item.shortcut"
                class="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600"
                aria-hidden="true"
              >
                {{ item.shortcut }}
              </kbd>
              <span
                v-if="item.beta"
                class="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
                aria-hidden="true"
              >
                Beta
              </span>
              <span
                v-if="item.comingSoon"
                class="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30"
                aria-hidden="true"
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
      aria-label="Close sidebar"
      @click="toggleSidebar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ROUTES, getRoutesByGroup, ROUTE_GROUPS, type RouteConfig } from "../../config/routes";
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  Settings,
  Folder,
  FolderOpen,
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
  Copy,
  Brain,
  Scan,
  Calendar,
  PieChart,
  Layers,
  Download,
  Zap,
  Globe,
  Code2,
  Database,
  TestTube,
  LayoutGrid,
  Share2,
  ChevronLeft,
  ChevronRight,
  FileScan,
  AlarmClock,
  type LucideIcon,
} from "lucide-vue-next";

interface NavigationItem extends RouteConfig {
  icon: LucideIcon;
}

// Icon mapping for navigation items
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderOpen,
  Scan,
  Clock,
  BarChart3,
  Copy,
  Brain,
  Sparkles,
  Search,
  LayoutGrid,
  Lightbulb,
  Share2,
  FileText,
  Code2,
  Activity,
  Settings,
  Database,
  BarChart,
  TestTube,
  Globe,
  AlertTriangle,
  TrendingUp,
  Network,
  Calendar,
  PieChart,
  Layers,
  Download,
  Zap,
  Shield,
  Eye,
  Folder,
  Cpu,
  FileType,
  MessageSquare,
  BrainCircuit,
  // Add missing icons that might be referenced
  FileScan,
  AlarmClock,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
};

// Convert ROUTES config to navigation items with proper icons
const navigationItems: NavigationItem[] = ROUTES.filter((route) => route.enabled).map((route) => ({
  ...route,
  icon: iconMap[route.icon] || LayoutDashboard,
  category: route.group as any,
  disabled: false,
  comingSoon: route.comingSoon || false,
}));

const router = useRouter();
const route = useRoute();

const searchQuery = ref("");
const isSearchFocused = ref(false);

// Sidebar state management
const sidebarOpen = ref(true);
const theme = ref("dark");
const fontSize = ref("medium");
const globalErrors = ref<any[]>([]);

// Initialize sidebar state based on screen size
const initializeSidebarState = () => {
  const isMobile = window.innerWidth < 768;
  const savedState = localStorage.getItem("sidebarOpen");

  if (savedState !== null) {
    sidebarOpen.value = savedState === "true";
  } else {
    sidebarOpen.value = !isMobile; // Auto-close on mobile
  }
};

// Handle window resize
const handleResize = () => {
  const isMobile = window.innerWidth < 768;
  if (isMobile && sidebarOpen.value) {
    sidebarOpen.value = false;
  }
};

const currentPath = computed(() => {
  // Handle path normalization for active states
  const path = route.path;

  // Remove hash and query params for comparison
  const cleanPath = path.split("?")[0].split("#")[0];

  // Ensure trailing slash for consistent comparison
  return cleanPath === "/" ? "/" : cleanPath.replace(/\/$/, "");
});

// Helper function to check if a route is active
const isActiveRoute = (itemPath: string): boolean => {
  const current = currentPath.value;

  // Exact match for root
  if (itemPath === "/") {
    return current === "/";
  }

  // Exact match or starts with path (for nested routes)
  return current === itemPath || current.startsWith(itemPath + "/");
};

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

// Group items by category using ROUTE_GROUPS
const groupedItems = computed(() => {
  const groups: Record<string, NavigationItem[]> = {};

  Object.keys(ROUTE_GROUPS).forEach((groupKey) => {
    const groupRoutes = navigationItems.filter((item) => item.group === groupKey);
    if (groupRoutes.length > 0) {
      groups[ROUTE_GROUPS[groupKey as keyof typeof ROUTE_GROUPS]] = groupRoutes;
    }
  });

  return groups;
});

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
  // Save state to localStorage
  localStorage.setItem("sidebarOpen", sidebarOpen.value.toString());
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

// Initialize and cleanup
onMounted(() => {
  // Initialize sidebar state
  initializeSidebarState();

  // Add resize listener
  window.addEventListener("resize", handleResize);

  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toUpperCase();
      const item = navigationItems.find((item) => {
        // Extract just the key part from shortcuts like "Ctrl+D"
        const shortcutKey = item.shortcut?.split("+").pop()?.toUpperCase();
        return shortcutKey === key;
      });
      if (item) {
        e.preventDefault();
        handleNavigation(item);
      }
    }

    // Handle ESC to close sidebar on mobile
    if (e.key === "Escape" && window.innerWidth < 768 && sidebarOpen.value) {
      toggleSidebar();
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
  };
});
</script>

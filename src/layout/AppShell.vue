<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAnalysisStore } from "@/store";
import {
  Activity,
  AlertTriangle,
  BarChart,
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  AlarmClock,
  Code2,
  Copy,
  Database,
  Clock,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  Lightbulb,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Menu,
  Scan,
  FileScan,
  Search,
  Settings,
  Share2,
  Sparkles,
  TestTube,
  TrendingUp,
  X,
} from "lucide-vue-next";
import type { RouteLocationNormalized } from "vue-router";
import type { LucideIcon } from "lucide-vue-next";
import BackgroundTaskIndicator from "@/components/BackgroundTaskIndicator.vue";
import SimpleNotificationCenter from "@/components/vue/other/SimpleNotificationCenter.vue";

const sidebarOpen = ref(true);
const sidebarCollapsed = ref(false);
const notificationBarCollapsed = ref(false);
const route = useRoute();
const router = useRouter();
const analysisStore = useAnalysisStore();

// Load sidebar state from localStorage on mount
onMounted(() => {
  const savedState = localStorage.getItem("sidebarCollapsed");
  if (savedState !== null) {
    sidebarCollapsed.value = savedState === "true";
    sidebarOpen.value = !sidebarCollapsed.value;
  }
});

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Folder,
  FolderOpen,
  FileScan,
  Scan,
  BarChart3,
  AlarmClock,
  Clock,
  Copy,
  Brain,
  Sparkles,
  TrendingUp,
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
  Layers,
};

const navigation = [
  { name: "Dashboard", path: "/", icon: "LayoutDashboard" },
  { name: "Files", path: "/file-browser", icon: "FolderOpen" },
  { name: "Scan", path: "/scan", icon: "Scan" },
  { name: "Scan History", path: "/scan-history", icon: "Clock" },
];

const analysisNav = [
  { name: "Largest Files", path: "/largest", icon: "BarChart3" },
  { name: "Old Files", path: "/old", icon: "Clock" },
  { name: "Duplicates", path: "/duplicates", icon: "Copy" },
  { name: "Empty Folders", path: "/empty", icon: "FolderOpen" },
  { name: "AI Organize", path: "/organize", icon: "Brain" },
  { name: "Cleanup", path: "/cleanup", icon: "Sparkles" },
  { name: "Trends", path: "/trends", icon: "TrendingUp" },
  { name: "Smart Search", path: "/search", icon: "Search" },
  { name: "Treemap", path: "/treemap", icon: "LayoutGrid" },
  { name: "Insights", path: "/insights", icon: "Lightbulb" },
  { name: "Network", path: "/network", icon: "Share2" },
  { name: "Reports", path: "/reports", icon: "FileText" },
  { name: "Code Complexity", path: "/complexity", icon: "Code2" },
];

const selfLearningNav = [
  { name: "Self-Learning", path: "/self-learning", icon: "Database" },
  { name: "Learning Analytics", path: "/learning-analytics", icon: "BarChart" },
  { name: "A/B Testing", path: "/ab-testing", icon: "TestTube" },
  { name: "3D Browser", path: "/3d-browser", icon: "Globe" },
];

const visualizationNav = [{ name: "Timeline", path: "/timeline", icon: "Clock" }];

const systemNav = [
  { name: "System Monitor", path: "/system", icon: "Activity" },
  { name: "Settings", path: "/settings", icon: "Settings" },
  { name: "Error Logs", path: "/admin/errors", icon: "AlertTriangle" },
];

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  sidebarOpen.value = !sidebarCollapsed.value;
  // Save state to localStorage
  localStorage.setItem("sidebarCollapsed", sidebarCollapsed.value.toString());
}

function getIcon(name: string): LucideIcon {
  return iconMap[name] || LayoutDashboard;
}

const activeRoutePath = computed(() => {
  // Handle path normalization for active states
  const currentPath = route.path;

  // Handle hash-based routing
  const hashPath = currentPath.includes("#") ? currentPath.split("#")[1] : currentPath;

  // Map legacy paths to new paths
  const pathMappings: Record<string, string> = {
    "/browser": "/file-browser",
    "/file-browser": "/file-browser",
    "/scan": "/scan",
    "/settings": "/settings",
    "/dashboard": "/dashboard",
    "/duplicates": "/duplicates",
    "/cleanup": "/cleanup",
    "/export": "/export",
    "/insights": "/insights",
    "/trends": "/trends",
    "/search": "/search",
    "/treemap": "/treemap",
    "/network": "/network",
    "/system": "/system",
    "/timeline": "/timeline",
    "/largest": "/largest",
    "/empty": "/empty",
    "/old": "/old",
    "/organize": "/organize",
    "/reports": "/reports",
    "/complexity": "/complexity",
    "/self-learning": "/self-learning",
    "/learning-analytics": "/learning-analytics",
    "/ab-testing": "/ab-testing",
    "/3d-browser": "/3d-browser",
    "/admin/errors": "/admin/errors",
  };

  return pathMappings[hashPath] || hashPath;
});

const topBarQuickActions = computed(() => [
  { name: "Scan Folder", path: "/scan", icon: "Scan", tone: "blue" },
  { name: "Browse Files", path: "/file-browser", icon: "FolderOpen", tone: "slate" },
  { name: "Insights", path: "/insights", icon: "Lightbulb", tone: "amber" },
  { name: "Export", path: "/export", icon: "FileText", tone: "emerald" },
]);

const currentAnalysisSummary = computed(() => {
  if (!analysisStore.isAnalysisRunning) return null;

  return {
    progress: analysisStore.progressData.percentage ?? analysisStore.progress ?? 0,
    files: analysisStore.progressData.files ?? 0,
    currentFile: analysisStore.progressData.currentFile || "Scanning...",
    path: analysisStore.path,
  };
});

function getBreadcrumbLabel(route: RouteLocationNormalized): string {
  // Get the last segment of the path for nested routes
  const path = route.path;
  const lastSegment = path.split("/").pop() || "";

  // Map common route segments to readable names
  const labelMap: Record<string, string> = {
    browser: "Files",
    scan: "Scan",
    largest: "Largest Files",
    old: "Old Files",
    duplicates: "Duplicates",
    empty: "Empty Folders",
    organize: "AI Organize",
    cleanup: "Cleanup",
    trends: "Trends",
    search: "Smart Search",
    treemap: "Treemap",
    insights: "Insights",
    network: "Network",
    timeline: "Timeline",
    system: "System Monitor",
    settings: "Settings",
    notifications: "Notifications",
    reports: "Reports",
    complexity: "Code Complexity",
  };

  // Return mapped label or format the segment
  return labelMap[lastSegment] || lastSegment.replace(/-/g, " ");
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex">
    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 transform transition-all duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        sidebarCollapsed ? 'w-16' : 'w-64',
        'lg:relative lg:translate-x-0',
      ]"
    >
      <!-- Sidebar Header -->
      <div class="flex items-center justify-between p-4 border-b border-slate-800">
        <transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          mode="out-in"
        >
          <span v-if="!sidebarCollapsed" class="text-xl font-bold text-blue-400 truncate">
            Space Analyzer
          </span>
          <span v-else class="text-lg font-bold text-blue-400"> SA </span>
        </transition>

        <!-- Toggle Button -->
        <div class="flex items-center gap-2">
          <!-- Mobile Close Button -->
          <button
            class="lg:hidden p-2 hover:bg-slate-800 rounded transition-colors"
            aria-label="Close sidebar menu"
            @click="toggleSidebar"
          >
            <X class="w-4 h-4" aria-hidden="true" />
          </button>

          <!-- Desktop Collapse/Expand Button -->
          <button
            class="hidden lg:flex p-2 hover:bg-slate-800 rounded transition-colors"
            :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            @click="toggleSidebar"
          >
            <ChevronLeft
              v-if="!sidebarCollapsed"
              class="w-4 h-4 text-slate-400 transition-transform duration-200"
              aria-hidden="true"
            />
            <ChevronRight
              v-else
              class="w-4 h-4 text-slate-400 transition-transform duration-200"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="p-4 space-y-6">
        <!-- Main Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed">Main</span>
              <span v-else>M</span>
            </transition>
          </div>
          <router-link
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
              activeRoutePath === item.path
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <!-- Active indicator -->
            <span
              v-if="activeRoutePath === item.path"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full"
              aria-hidden="true"
            />
            <component
              :is="getIcon(item.icon)"
              :class="[
                'shrink-0 transition-all duration-200',
                sidebarCollapsed ? 'w-4 h-4' : 'w-5 h-5',
                activeRoutePath === item.path
                  ? 'text-blue-400'
                  : 'text-slate-500 group-hover:text-slate-300',
              ]"
            />
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed" class="text-sm font-medium">{{ item.name }}</span>
              <span v-else class="text-xs font-medium" :title="item.name">
                {{ item.name.charAt(0) }}
              </span>
            </transition>
          </router-link>
        </div>

        <!-- Analysis Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed">Analysis</span>
              <span v-else>A</span>
            </transition>
          </div>
          <router-link
            v-for="item in analysisNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
              activeRoutePath === item.path
                ? 'bg-purple-600/10 text-purple-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <!-- Active indicator -->
            <span
              v-if="activeRoutePath === item.path"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-purple-500 rounded-r-full"
              aria-hidden="true"
            />
            <component
              :is="getIcon(item.icon)"
              :class="[
                'shrink-0 transition-all duration-200',
                sidebarCollapsed ? 'w-4 h-4' : 'w-5 h-5',
                activeRoutePath === item.path
                  ? 'text-purple-400'
                  : 'text-slate-500 group-hover:text-slate-300',
              ]"
            />
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed" class="text-sm font-medium">{{ item.name }}</span>
              <span v-else class="text-xs font-medium" :title="item.name">
                {{ item.name.charAt(0) }}
              </span>
            </transition>
          </router-link>
        </div>

        <!-- Self-Learning Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed">Self-Learning</span>
              <span v-else>SL</span>
            </transition>
          </div>
          <router-link
            v-for="item in selfLearningNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
              activeRoutePath === item.path
                ? 'bg-green-600/10 text-green-400'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <!-- Active indicator -->
            <span
              v-if="activeRoutePath === item.path"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-green-500 rounded-r-full"
              aria-hidden="true"
            />
            <component
              :is="getIcon(item.icon)"
              :class="[
                'shrink-0 transition-all duration-200',
                sidebarCollapsed ? 'w-4 h-4' : 'w-5 h-5',
                activeRoutePath === item.path
                  ? 'text-green-400'
                  : 'text-slate-500 group-hover:text-slate-300',
              ]"
            />
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed" class="text-sm font-medium">{{ item.name }}</span>
              <span v-else class="text-xs font-medium" :title="item.name">
                {{ item.name.charAt(0) }}
              </span>
            </transition>
          </router-link>
        </div>

        <!-- Visualization Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed">Visualization</span>
              <span v-else>V</span>
            </transition>
          </div>
          <router-link
            v-for="item in visualizationNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
              activeRoutePath === item.path
                ? 'bg-linear-to-r from-emerald-600/20 to-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <component
              :is="getIcon(item.icon)"
              :class="[
                'shrink-0 transition-all duration-200',
                sidebarCollapsed ? 'w-4 h-4' : 'w-5 h-5',
                activeRoutePath === item.path
                  ? 'text-emerald-400'
                  : 'text-slate-500 group-hover:text-slate-300',
              ]"
            />
            <transition
              enter-active-class="transition-all duration-200"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
              leave-active-class="transition-all duration-200"
              leave-from-class="opacity-100 scale-100"
              leave-to-class="opacity-0 scale-95"
              mode="out-in"
            >
              <span v-if="!sidebarCollapsed" class="text-sm font-medium">{{ item.name }}</span>
              <span v-else class="text-xs font-medium" :title="item.name">
                {{ item.name.charAt(0) }}
              </span>
            </transition>
          </router-link>
        </div>

        <!-- System Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            System
          </div>
          <router-link
            v-for="item in systemNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
              activeRoutePath === item.path
                ? 'bg-linear-to-r from-slate-600/30 to-slate-500/20 text-slate-300 border-l-2 border-slate-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <component
              :is="getIcon(item.icon)"
              :class="[
                'w-5 h-5 shrink-0',
                $route.path === item.path
                  ? 'text-slate-300'
                  : 'text-slate-500 group-hover:text-slate-300',
              ]"
            />
            <span class="text-sm font-medium">{{ item.name }}</span>
          </router-link>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top Bar -->
      <header
        class="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 shrink-0"
      >
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle sidebar menu"
            @click="toggleSidebar"
          >
            <Menu class="w-5 h-5 text-slate-400" aria-hidden="true" />
          </button>
          <!-- Breadcrumb Navigation -->
          <nav
            aria-label="Breadcrumb"
            class="hidden md:flex items-center text-sm"
            itemscope
            itemtype="https://schema.org/BreadcrumbList"
          >
            <ol class="flex items-center gap-1">
              <!-- Home/Dashboard -->
              <li
                itemprop="itemListElement"
                itemscope
                itemtype="https://schema.org/ListItem"
                class="flex items-center"
              >
                <router-link
                  to="/"
                  itemprop="item"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors"
                  :class="
                    $route.path === '/'
                      ? 'text-slate-100 bg-slate-800/50'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  "
                >
                  <LayoutDashboard class="w-4 h-4" aria-hidden="true" />
                  <span itemprop="name">Dashboard</span>
                </router-link>
                <meta itemprop="position" content="1" />
              </li>

              <template v-if="$route.path !== '/' && $route.path !== '/#/dashboard'">
                <li aria-hidden="true">
                  <ChevronRight class="w-4 h-4 text-slate-600" />
                </li>

                <!-- Parent route (e.g., Settings) -->
                <template v-if="$route.path.includes('/settings/')">
                  <li
                    itemprop="itemListElement"
                    itemscope
                    itemtype="https://schema.org/ListItem"
                    class="flex items-center"
                  >
                    <router-link
                      to="/settings"
                      itemprop="item"
                      class="px-2 py-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
                    >
                      <span itemprop="name">Settings</span>
                    </router-link>
                    <meta itemprop="position" content="2" />
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight class="w-4 h-4 text-slate-600" />
                  </li>
                </template>

                <!-- Current page -->
                <li
                  itemprop="itemListElement"
                  itemscope
                  itemtype="https://schema.org/ListItem"
                  class="flex items-center"
                >
                  <span itemprop="name" class="px-2 py-1 text-slate-200 font-medium capitalize">
                    {{ getBreadcrumbLabel($route) }}
                  </span>
                  <meta
                    itemprop="position"
                    :content="$route.path.includes('/settings/') ? '3' : '2'"
                  />
                </li>
              </template>
            </ol>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          <div class="hidden xl:flex items-center gap-2">
            <button
              v-for="action in topBarQuickActions"
              :key="action.path"
              class="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800/80"
              :class="{
                'bg-blue-500/10 text-blue-300 border-blue-500/20': action.tone === 'blue',
                'bg-emerald-500/10 text-emerald-300 border-emerald-500/20':
                  action.tone === 'emerald',
                'bg-amber-500/10 text-amber-300 border-amber-500/20': action.tone === 'amber',
              }"
              @click="router.push(action.path)"
            >
              <component :is="getIcon(action.icon)" class="h-4 w-4" />
              {{ action.name }}
            </button>
          </div>
          <slot name="top-bar-actions" />
          <div
            v-if="currentAnalysisSummary"
            class="hidden lg:flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2"
          >
            <Activity class="h-4 w-4 text-blue-300" />
            <div class="min-w-0">
              <div class="text-xs font-semibold text-blue-200">Analysis in progress</div>
              <div class="text-[11px] text-slate-300">
                {{ currentAnalysisSummary.files.toLocaleString() }} files ·
                {{ currentAnalysisSummary.progress }}%
              </div>
            </div>
          </div>
          <BackgroundTaskIndicator />
          <SimpleNotificationCenter />
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-auto p-4 lg:p-8">
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-4"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-4"
          mode="out-in"
        >
          <div :key="$route.path" class="max-w-7xl mx-auto">
            <slot />
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

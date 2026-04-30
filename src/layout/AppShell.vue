<script setup lang="ts">
import { ref } from "vue";
import {
  LayoutDashboard,
  FolderOpen,
  Scan,
  BarChart3,
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
  Menu,
  X,
  type LucideIcon,
} from "lucide-vue-next";
import NotificationCenter from "@/components/vue/other/NotificationCenter.vue";

const sidebarOpen = ref(false);

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderOpen,
  Scan,
  BarChart3,
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
};

const navigation = [
  { name: "Dashboard", path: "/", icon: "LayoutDashboard" },
  { name: "Files", path: "/browser", icon: "FolderOpen" },
  { name: "Scan", path: "/scan", icon: "Scan" },
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

const visualizationNav = [{ name: "Timeline", path: "/timeline", icon: "Clock" }];

const systemNav = [
  { name: "System Monitor", path: "/system", icon: "Activity" },
  { name: "Settings", path: "/settings", icon: "Settings" },
];

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function getIcon(name: string): LucideIcon {
  return iconMap[name] || LayoutDashboard;
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex">
    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:relative lg:translate-x-0',
      ]"
    >
      <div class="flex items-center justify-between p-4 border-b border-slate-800">
        <span class="text-xl font-bold text-blue-400">Space Analyzer</span>
        <button class="lg:hidden p-2 hover:bg-slate-800 rounded" @click="toggleSidebar">
          <X class="w-5 h-5" />
        </button>
      </div>

      <nav class="p-4 space-y-6">
        <!-- Main Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            Main
          </div>
          <router-link
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
              $route.path === item.path
                ? 'bg-linear-to-r from-blue-600/20 to-blue-500/10 text-blue-400 border-l-2 border-blue-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <component
              :is="getIcon(item.icon)"
              class="w-5 h-5 shrink-0"
              :class="
                $route.path === item.path
                  ? 'text-blue-400'
                  : 'text-slate-500 group-hover:text-slate-300'
              "
            />
            <span class="text-sm font-medium">{{ item.name }}</span>
          </router-link>
        </div>

        <!-- Analysis Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            Analysis
          </div>
          <router-link
            v-for="item in analysisNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
              $route.path === item.path
                ? 'bg-purple-600/20 text-purple-400 border-l-2 border-purple-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <component
              :is="getIcon(item.icon)"
              class="w-4 h-4 shrink-0"
              :class="
                $route.path === item.path
                  ? 'text-purple-400'
                  : 'text-slate-500 group-hover:text-slate-300'
              "
            />
            <span class="text-sm">{{ item.name }}</span>
          </router-link>
        </div>

        <!-- Visualization Navigation -->
        <div class="space-y-1">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 mb-2">
            Visualization
          </div>
          <router-link
            v-for="item in visualizationNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
              $route.path === item.path
                ? 'bg-linear-to-r from-emerald-600/20 to-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <component
              :is="getIcon(item.icon)"
              class="w-5 h-5 shrink-0"
              :class="
                $route.path === item.path
                  ? 'text-emerald-400'
                  : 'text-slate-500 group-hover:text-slate-300'
              "
            />
            <span class="text-sm font-medium">{{ item.name }}</span>
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
              $route.path === item.path
                ? 'bg-linear-to-r from-slate-600/30 to-slate-500/20 text-slate-300 border-l-2 border-slate-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-1',
            ]"
          >
            <component
              :is="getIcon(item.icon)"
              class="w-5 h-5 shrink-0"
              :class="
                $route.path === item.path
                  ? 'text-slate-300'
                  : 'text-slate-500 group-hover:text-slate-300'
              "
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
            @click="toggleSidebar"
          >
            <Menu class="w-5 h-5 text-slate-400" />
          </button>
          <div class="hidden md:flex items-center gap-2 text-sm text-slate-500">
            <span class="text-slate-400">Space Analyzer</span>
            <span class="text-slate-600">/</span>
            <span class="text-slate-300 capitalize">{{
              $route.name?.toString().replace(/-/g, " ") || "Dashboard"
            }}</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <slot name="top-bar-actions" />
          <NotificationCenter />
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

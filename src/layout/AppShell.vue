<script setup lang="ts">
import { ref } from "vue";

const sidebarOpen = ref(false);

const navigation = [
  { name: "Dashboard", path: "/", icon: "LayoutDashboard" },
  { name: "Files", path: "/browser", icon: "FolderOpen" },
  { name: "Scan", path: "/scan", icon: "Scan" },
];

const analysisNav = [
  { name: "Duplicates", path: "/duplicates", icon: "Copy" },
  { name: "Cleanup", path: "/cleanup", icon: "Sparkles" },
  { name: "Trends", path: "/trends", icon: "TrendingUp" },
  { name: "Smart Search", path: "/search", icon: "Search" },
  { name: "Treemap", path: "/treemap", icon: "LayoutGrid" },
];

const systemNav = [{ name: "Settings", path: "/settings", icon: "Settings" }];

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
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
        <button class="lg:hidden p-2 hover:bg-slate-800 rounded" @click="toggleSidebar">✕</button>
      </div>

      <nav class="p-4 space-y-6">
        <!-- Main Navigation -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Main</div>
          <router-link
            v-for="item in navigation"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              $route.path === item.path
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
            ]"
          >
            <span>{{ item.name }}</span>
          </router-link>
        </div>

        <!-- Analysis Navigation -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">
            Analysis
          </div>
          <router-link
            v-for="item in analysisNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              $route.path === item.path
                ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
            ]"
          >
            <span>{{ item.name }}</span>
          </router-link>
        </div>

        <!-- System Navigation -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">
            System
          </div>
          <router-link
            v-for="item in systemNav"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
              $route.path === item.path
                ? 'bg-slate-600/30 text-slate-300 border border-slate-600/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
            ]"
          >
            <span>{{ item.name }}</span>
          </router-link>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Bar -->
      <header
        class="h-16 bg-slate-900/50 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 lg:px-6"
      >
        <button class="lg:hidden p-2 hover:bg-slate-800 rounded" @click="toggleSidebar">☰</button>

        <div class="flex items-center gap-4">
          <slot name="top-bar-actions" />
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-auto p-4 lg:p-6">
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-4"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-4"
          mode="out-in"
        >
          <slot />
        </Transition>
      </main>
    </div>
  </div>
</template>

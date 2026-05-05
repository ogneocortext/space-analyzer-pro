<template>
  <div class="desktop-layout" :class="{ fullscreen: isFullscreen }">
    <!-- Custom Titlebar -->
    <DesktopTitlebar :title="windowTitle" :show-search="showSearch" @search="handleGlobalSearch" />

    <!-- Main Content Area -->
    <div class="desktop-content">
      <!-- Enhanced Sidebar -->
      <aside
        class="desktop-sidebar"
        :class="{ collapsed: sidebarCollapsed }"
        @mouseenter="onSidebarHover"
        @mouseleave="onSidebarLeave"
      >
        <div class="sidebar-header">
          <div class="logo-section" v-if="!sidebarCollapsed">
            <div class="app-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#6366f1" />
                <path d="M6 12L10 8L14 12L10 16L6 12Z" fill="white" />
              </svg>
            </div>
            <div class="app-info">
              <h1 class="app-name">Space Analyzer</h1>
              <span class="app-version">v{{ version }}</span>
            </div>
          </div>
          <button
            class="sidebar-toggle"
            @click="toggleSidebar"
            :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <ChevronLeft v-if="!sidebarCollapsed" class="icon" />
            <ChevronRight v-else class="icon" />
          </button>
        </div>

        <nav class="sidebar-nav">
          <!-- Quick Actions -->
          <div class="nav-section" v-if="!sidebarCollapsed">
            <div class="section-title">Quick Actions</div>
            <div class="quick-actions">
              <button @click="quickScan" class="quick-action-btn">
                <Scan class="action-icon" />
                <span>Quick Scan</span>
                <kbd>F1</kbd>
              </button>
              <button @click="openFolder" class="quick-action-btn">
                <FolderOpen class="action-icon" />
                <span>Open Folder</span>
                <kbd>Ctrl+O</kbd>
              </button>
              <button @click="viewReports" class="quick-action-btn">
                <FileText class="action-icon" />
                <span>Reports</span>
                <kbd>F2</kbd>
              </button>
            </div>
          </div>

          <!-- Navigation Menu -->
          <div class="nav-section">
            <div class="section-title" v-if="!sidebarCollapsed">Navigation</div>
            <router-link
              v-for="item in navigation"
              :key="item.path"
              :to="item.path"
              class="nav-item"
              :class="{ active: $route.path === item.path }"
            >
              <component :is="getIcon(item.icon)" class="nav-icon" />
              <span v-if="!sidebarCollapsed" class="nav-label">{{ item.name }}</span>
              <div v-if="item.badge && !sidebarCollapsed" class="nav-badge">{{ item.badge }}</div>
            </router-link>
          </div>

          <!-- System Info (Desktop Only) -->
          <div class="nav-section system-info" v-if="systemInfo && !sidebarCollapsed">
            <div class="section-title">System</div>
            <div class="system-stats">
              <div class="stat-item">
                <Cpu class="stat-icon" />
                <div class="stat-details">
                  <span class="stat-label">CPU Usage</span>
                  <div class="stat-bar">
                    <div class="stat-fill" :style="{ width: '45%' }"></div>
                  </div>
                </div>
              </div>
              <div class="stat-item">
                <HardDrive class="stat-icon" />
                <div class="stat-details">
                  <span class="stat-label">Memory</span>
                  <span class="stat-value"
                    >{{ formatBytes(systemInfo.used_memory) }} /
                    {{ formatBytes(systemInfo.total_memory) }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div class="sidebar-footer" v-if="!sidebarCollapsed">
          <button @click="openSettings" class="footer-btn">
            <Settings class="icon" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="desktop-main">
        <!-- Breadcrumb and Actions -->
        <header class="content-header">
          <div class="breadcrumb-section">
            <nav class="breadcrumb">
              <router-link to="/" class="breadcrumb-item">Home</router-link>
              <ChevronRight class="breadcrumb-separator" />
              <span class="breadcrumb-item current">{{ getCurrentPageName() }}</span>
            </nav>
          </div>

          <div class="header-actions">
            <slot name="header-actions" />
            <button
              @click="toggleFullscreen"
              class="action-btn"
              :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
            >
              <Maximize2 v-if="!isFullscreen" class="icon" />
              <Minimize2 v-else class="icon" />
            </button>
            <button @click="refreshContent" class="action-btn" title="Refresh">
              <RefreshCw class="icon" />
            </button>
          </div>
        </header>

        <!-- Page Content with Error Boundary -->
        <div class="content-body">
          <ErrorBoundary :isolate="true">
            <slot />
          </ErrorBoundary>
        </div>
      </main>
    </div>

    <!-- Status Bar -->
    <footer class="desktop-statusbar">
      <div class="status-left">
        <span class="status-item" v-if="scanProgress">
          <Activity class="status-icon" />
          {{ scanProgress.current_file }}
        </span>
      </div>

      <div class="status-center">
        <span class="status-item">{{ statusText }}</span>
      </div>

      <div class="status-right">
        <span class="status-item">{{ formatTime(new Date()) }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import {
  ChevronLeft,
  ChevronRight,
  Scan,
  FolderOpen,
  FileText,
  LayoutDashboard,
  BarChart3,
  Settings,
  Cpu,
  HardDrive,
  Maximize2,
  Minimize2,
  RefreshCw,
  Activity,
  type LucideIcon,
} from "lucide-vue-next";
import DesktopTitlebar from "./DesktopTitlebar.vue";
import { useTauriDesktop } from "@/composables/useTauriDesktop";
import ErrorBoundary from "@/components/vue/error-handling/ErrorBoundary.vue";

interface NavItem {
  name: string;
  path: string;
  icon: string;
  badge?: string | number;
}

const route = useRoute();
const { isTauri, selectDirectory, getSystemInfo, progress, isScanning } = useTauriDesktop();

// Reactive state
const sidebarCollapsed = ref(false);
const isFullscreen = ref(false);
const systemInfo = ref<any>(null);
const showSearch = ref(true);
const windowTitle = ref("Space Analyzer Pro");
const version = ref("2.8.9");

// Navigation items
const navigation: NavItem[] = [
  { name: "Dashboard", path: "/", icon: "LayoutDashboard" },
  { name: "File Browser", path: "/browser", icon: "FolderOpen" },
  { name: "Analysis", path: "/scan", icon: "Scan", badge: isScanning.value ? "1" : undefined },
  { name: "Reports", path: "/reports", icon: "BarChart3" },
];

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderOpen,
  Scan,
  BarChart3,
  Settings,
};

// Computed properties
const scanProgress = computed(() => progress.value);
const statusText = computed(() => {
  if (isScanning.value) return "Scanning in progress...";
  if (systemInfo.value) return `Ready • ${systemInfo.value.os_name}`;
  return "Ready";
});

// Methods
function getIcon(name: string): LucideIcon {
  return iconMap[name] || LayoutDashboard;
}

function getCurrentPageName(): string {
  const item = navigation.find((nav) => nav.path === route.path);
  return item?.name || "Unknown";
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function onSidebarHover() {
  // Auto-expand on hover if collapsed
  if (sidebarCollapsed.value) {
    // Optional: implement auto-expand on hover
  }
}

function onSidebarLeave() {
  // Optional: implement auto-collapse on leave
}

async function quickScan() {
  if (!isTauri.value) return;
  const path = await selectDirectory();
  if (path) {
    // Navigate to scan page with selected path
    // router.push(`/scan?path=${encodeURIComponent(path)}`)
  }
}

async function openFolder() {
  if (!isTauri.value) return;
  await selectDirectory();
}

function viewReports() {
  // router.push('/reports')
}

function openSettings() {
  // router.push('/settings')
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
}

function refreshContent() {
  window.location.reload();
}

function handleGlobalSearch(query: string) {
  console.log("Global search:", query);
  // Implement global search functionality
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey) {
    switch (event.key) {
      case "o":
        event.preventDefault();
        openFolder();
        break;
      case "b":
        event.preventDefault();
        toggleSidebar();
        break;
    }
  } else {
    switch (event.key) {
      case "F1":
        event.preventDefault();
        quickScan();
        break;
      case "F2":
        event.preventDefault();
        viewReports();
        break;
      case "F11":
        event.preventDefault();
        toggleFullscreen();
        break;
    }
  }
}

onMounted(async () => {
  if (isTauri.value) {
    try {
      systemInfo.value = await getSystemInfo();
    } catch (error) {
      console.warn("Failed to get system info:", error);
    }
  }

  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<style scoped>
.desktop-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.desktop-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.desktop-sidebar {
  width: 280px;
  background: linear-gradient(to bottom, #1e293b, #0f172a);
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  flex-shrink: 0;
}

.desktop-sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #334155;
  min-height: 60px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
}

.app-info h1 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #f1f5f9;
}

.app-version {
  font-size: 12px;
  color: #64748b;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #6366f1;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin: 0 16px 8px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
}

.quick-action-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.action-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.quick-action-btn kbd {
  margin-left: auto;
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
  font-size: 10px;
  font-family: monospace;
  padding: 2px 4px;
  border-radius: 3px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: #94a3b8;
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  font-size: 14px;
}

.nav-item:hover {
  background: rgba(99, 102, 241, 0.1);
  color: #f1f5f9;
}

.nav-item.active {
  background: rgba(99, 102, 241, 0.2);
  color: #6366f1;
}

.nav-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: #6366f1;
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

.nav-badge {
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

.system-stats {
  padding: 0 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  margin-bottom: 4px;
}

.stat-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
  flex-shrink: 0;
}

.stat-details {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 11px;
  color: #64748b;
  display: block;
}

.stat-bar {
  height: 3px;
  background: rgba(100, 116, 139, 0.2);
  border-radius: 2px;
  margin-top: 2px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  background: #22c55e;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.stat-value {
  font-size: 11px;
  color: #94a3b8;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #334155;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
}

.footer-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.desktop-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(30, 41, 59, 0.5);
  border-bottom: 1px solid #334155;
  min-height: 60px;
}

.breadcrumb-section {
  flex: 1;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-item {
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover {
  color: #f1f5f9;
}

.breadcrumb-item.current {
  color: #f1f5f9;
  font-weight: 500;
}

.breadcrumb-separator {
  width: 14px;
  height: 14px;
  color: #475569;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #f1f5f9;
}

.content-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.desktop-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #0f172a;
  border-top: 1px solid #334155;
  font-size: 12px;
  min-height: 32px;
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
}

.status-icon {
  width: 12px;
  height: 12px;
}

/* Collapsed sidebar adjustments */
.desktop-sidebar.collapsed .section-title,
.desktop-sidebar.collapsed .nav-label,
.desktop-sidebar.collapsed .app-info,
.desktop-sidebar.collapsed .sidebar-footer {
  display: none;
}

.desktop-sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}

.desktop-sidebar.collapsed .nav-badge {
  position: absolute;
  top: 6px;
  right: 6px;
}

/* Fullscreen mode */
.desktop-layout.fullscreen .desktop-statusbar {
  display: none;
}

.desktop-layout.fullscreen .content-header {
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(8px);
}

/* Scrollbar styling */
.desktop-sidebar::-webkit-scrollbar,
.content-body::-webkit-scrollbar {
  width: 6px;
}

.desktop-sidebar::-webkit-scrollbar-track,
.content-body::-webkit-scrollbar-track {
  background: transparent;
}

.desktop-sidebar::-webkit-scrollbar-thumb,
.content-body::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

.desktop-sidebar::-webkit-scrollbar-thumb:hover,
.content-body::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>

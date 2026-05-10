<!--
  Dashboard Layout Component
  Manages the overall dashboard layout structure
-->
<template>
  <div class="dashboard-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Dashboard Header -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-left">
          <button 
            @click="$emit('toggle-sidebar')"
            class="sidebar-toggle"
            aria-label="Toggle sidebar"
          >
            <Menu class="w-5 h-5" />
          </button>
          <div class="header-title">
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your space analysis overview.</p>
          </div>
        </div>
        
        <div class="header-right">
          <!-- Search Bar -->
          <div class="search-container">
            <Search class="search-icon" />
            <input
              v-model="localSearchQuery"
              type="text"
              placeholder="Search dashboard..."
              class="search-input"
              @input="handleSearch"
              @keyup.escape="clearSearch"
            />
            <button 
              v-if="localSearchQuery"
              @click="clearSearch"
              class="search-clear"
              aria-label="Clear search"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Header Actions -->
          <div class="header-actions">
            <button 
              @click="$emit('refresh-dashboard')"
              :disabled="isRefreshing"
              class="action-btn refresh-btn"
              aria-label="Refresh dashboard"
            >
              <RefreshCw :class="{ 'animate-spin': isRefreshing }" class="w-4 h-4" />
              <span class="action-text">Refresh</span>
            </button>
            
            <button 
              @click="$emit('open-settings')"
              class="action-btn settings-btn"
              aria-label="Settings"
            >
              <Settings class="w-4 h-4" />
            </button>
            
            <div class="user-menu">
              <button 
                @click="showUserMenu = !showUserMenu"
                class="user-menu-btn"
                aria-label="User menu"
              >
                <User class="w-4 h-4" />
              </button>
              <div v-if="showUserMenu" class="user-menu-dropdown">
                <button @click="$emit('view-profile')">Profile</button>
                <button @click="$emit('view-preferences')">Preferences</button>
                <button @click="$emit('logout')">Logout</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Dashboard Content -->
    <main class="dashboard-main">
      <!-- Sidebar -->
      <aside v-if="!sidebarCollapsed" class="dashboard-sidebar">
        <nav class="sidebar-nav">
          <div class="nav-section">
            <h3 class="nav-section-title">Overview</h3>
            <ul class="nav-list">
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'overview' }]"
                  @click="$emit('navigate', 'overview')"
                >
                  <LayoutDashboard class="w-4 h-4" />
                  <span>Overview</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'analytics' }]"
                  @click="$emit('navigate', 'analytics')"
                >
                  <BarChart3 class="w-4 h-4" />
                  <span>Analytics</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'reports' }]"
                  @click="$emit('navigate', 'reports')"
                >
                  <FileText class="w-4 h-4" />
                  <span>Reports</span>
                </button>
              </li>
            </ul>
          </div>
          
          <div class="nav-section">
            <h3 class="nav-section-title">Tools</h3>
            <ul class="nav-list">
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'analysis' }]"
                  @click="$emit('navigate', 'analysis')"
                >
                  <Search class="w-4 h-4" />
                  <span>Analysis</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'ai-insights' }]"
                  @click="$emit('navigate', 'ai-insights')"
                >
                  <BrainCircuit class="w-4 h-4" />
                  <span>AI Insights</span>
                </button>
              </li>
              <li>
                <button 
                  :class="['nav-item', { active: activeSection === 'file-browser' }]"
                  @click="$emit('navigate', 'file-browser')"
                >
                  <Folder class="w-4 h-4" />
                  <span>File Browser</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <div class="dashboard-content">
        <!-- Breadcrumbs -->
        <nav v-if="breadcrumbs.length > 0" class="breadcrumbs">
          <ol class="breadcrumb-list">
            <li v-for="(crumb, index) in breadcrumbs" :key="index">
              <button 
                v-if="index < breadcrumbs.length - 1"
                @click="$emit('navigate', crumb.path)"
                class="breadcrumb-link"
              >
                {{ crumb.label }}
              </button>
              <span v-else class="breadcrumb-current">{{ crumb.label }}</span>
              <ChevronRight v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator" />
            </li>
          </ol>
        </nav>

        <!-- Content Slot -->
        <div class="content-area">
          <slot />
        </div>
      </div>
    </main>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <Loader2 class="w-8 h-8 animate-spin" />
        <p>Loading dashboard...</p>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="error-banner">
      <div class="error-content">
        <AlertTriangle class="w-5 h-5" />
        <span>{{ error }}</span>
        <button @click="$emit('clear-error')" class="error-close">
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import {
  Menu,
  Search,
  X,
  RefreshCw,
  Settings,
  User,
  LayoutDashboard,
  BarChart3,
  FileText,
  BrainCircuit,
  Folder,
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-vue-next';

interface Breadcrumb {
  label: string;
  path: string;
}

interface Props {
  searchQuery?: string;
  isRefreshing?: boolean;
  isLoading?: boolean;
  error?: string | null;
  sidebarCollapsed?: boolean;
  activeSection?: string;
  breadcrumbs?: Breadcrumb[];
}

interface Emits {
  (e: 'toggle-sidebar'): void;
  (e: 'refresh-dashboard'): void;
  (e: 'open-settings'): void;
  (e: 'view-profile'): void;
  (e: 'view-preferences'): void;
  (e: 'logout'): void;
  (e: 'navigate', section: string): void;
  (e: 'update:searchQuery', query: string): void;
  (e: 'clear-error'): void;
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  isRefreshing: false,
  isLoading: false,
  error: null,
  sidebarCollapsed: false,
  activeSection: 'overview',
  breadcrumbs: () => [],
});

const emit = defineEmits<Emits>();

const localSearchQuery = ref(props.searchQuery);
const showUserMenu = ref(false);

// Handle search with debouncing
let searchTimeout: number;
const handleSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    emit('update:searchQuery', localSearchQuery.value);
  }, 300);
};

const clearSearch = () => {
  localSearchQuery.value = '';
  emit('update:searchQuery', '');
};

// Close user menu when clicking outside
const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.user-menu')) {
    showUserMenu.value = false;
  }
};

// Watch for prop changes
watch(() => props.searchQuery, (newValue) => {
  localSearchQuery.value = newValue;
});

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
  clearTimeout(searchTimeout);
});
</script>

<style scoped>
.dashboard-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #ffffff;
}

.dashboard-header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  background: #4b5563;
  color: #ffffff;
}

.header-title h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
  color: #ffffff;
}

.header-title p {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  width: 16px;
  height: 16px;
  color: #6b7280;
  pointer-events: none;
}

.search-input {
  width: 300px;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  color: #ffffff;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #6b7280;
}

.search-clear {
  position: absolute;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  background: #4b5563;
  border: none;
  border-radius: 0.25rem;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.search-clear:hover {
  background: #6b7280;
  color: #ffffff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  color: #d1d5db;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  background: #4b5563;
  color: #ffffff;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-text {
  @media (max-width: 768px) {
    display: none;
  }
}

.user-menu {
  position: relative;
}

.user-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 0.5rem;
  color: #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-menu-btn:hover {
  background: #4b5563;
  color: #ffffff;
}

.user-menu-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  min-width: 150px;
  z-index: 100;
}

.user-menu-dropdown button {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  color: #d1d5db;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-menu-dropdown button:hover {
  background: #374151;
  color: #ffffff;
}

.dashboard-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.dashboard-sidebar {
  width: 250px;
  background: #1e293b;
  border-right: 1px solid #334155;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.sidebar-nav {
  padding: 1rem;
}

.nav-section {
  margin-bottom: 2rem;
}

.nav-section:last-child {
  margin-bottom: 0;
}

.nav-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem 0;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  background: none;
  border: none;
  border-radius: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #374151;
  color: #d1d5db;
}

.nav-item.active {
  background: #3b82f6;
  color: #ffffff;
}

.dashboard-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.breadcrumbs {
  margin-bottom: 1.5rem;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
}

.breadcrumb-link {
  color: #3b82f6;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s ease;
}

.breadcrumb-link:hover {
  color: #2563eb;
}

.breadcrumb-current {
  color: #9ca3af;
}

.breadcrumb-separator {
  width: 16px;
  height: 16px;
  color: #6b7280;
}

.content-area {
  min-height: 0;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: #1e293b;
  border-radius: 0.75rem;
  color: #ffffff;
}

.error-banner {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: #ef4444;
  color: #ffffff;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 100;
  max-width: 400px;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #ffffff;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background 0.2s ease;
}

.error-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    padding: 0.75rem 1rem;
  }
  
  .search-input {
    width: 200px;
  }
  
  .dashboard-sidebar {
    position: fixed;
    top: 0;
    left: -250px;
    height: 100vh;
    z-index: 40;
    transition: left 0.3s ease;
  }
  
  .dashboard-layout:not(.sidebar-collapsed) .dashboard-sidebar {
    left: 0;
  }
  
  .dashboard-content {
    padding: 1rem;
  }
}

@media (max-width: 640px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .header-left {
    order: 2;
  }
  
  .header-right {
    order: 1;
    justify-content: space-between;
  }
  
  .search-input {
    width: 150px;
  }
  
  .dashboard-content {
    padding: 0.75rem;
  }
}
</style>
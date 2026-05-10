<!--
  Enhanced Dashboard - Refactored Version
  Now uses smaller, focused components for better maintainability
-->
<template>
  <DashboardLayout
    :search-query="searchQuery"
    :is-refreshing="isRefreshing"
    :is-loading="isLoading"
    :error="error"
    :sidebar-collapsed="sidebarCollapsed"
    :active-section="activeSection"
    :breadcrumbs="breadcrumbs"
    @toggle-sidebar="toggleSidebar"
    @refresh-dashboard="refreshData"
    @open-settings="openSettings"
    @view-profile="viewProfile"
    @view-preferences="viewPreferences"
    @logout="logout"
    @navigate="navigateTo"
    @update:searchQuery="handleSearch"
    @clear-error="clearError"
  >
    <!-- Dashboard Content -->
    <div class="dashboard-content">
      <!-- System Status -->
      <DashboardSystemStatus
        :system-status="systemStatus"
        :is-refreshing="isRefreshing"
        @refresh-status="refreshSystemStatus"
      />

      <!-- Stats Grid -->
      <DashboardStats :stats="stats" />

      <!-- Quick Actions -->
      <DashboardQuickActions
        :actions="quickActions"
        :selected-category="selectedCategory"
        :search-query="searchQuery"
        :is-loading="isLoading"
        :has-analysis-data="!!analysisData"
        @execute-action="handleQuickAction"
        @filter-category="filterByCategory"
        @clear-filters="clearFilters"
      />

      <!-- Recent Activity -->
      <DashboardRecentActivity
        :activities="recentActivity"
        :is-refreshing="isRefreshing"
        :is-loading-more="isLoadingMore"
        :has-more="hasMoreActivity"
        @refresh-activity="refreshActivity"
        @load-more="loadMoreActivity"
        @view-details="viewActivityDetails"
      />
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import DashboardLayout from './DashboardLayout.vue';
import DashboardSystemStatus from './DashboardSystemStatus.vue';
import DashboardStats from './DashboardStats.vue';
import DashboardQuickActions from './DashboardQuickActions.vue';
import DashboardRecentActivity from './DashboardRecentActivity.vue';
import { useDashboard } from '../../../composables/useDashboard';
import { useDebugLogger } from '../../../utils/DebugUtils';
import type { QuickAction, ActivityItem } from '../../../services/DashboardService';

interface Props {
  analysisData?: any;
  userPermissions?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true,
  refreshInterval: 60000,
});

const router = useRouter();
const logger = useDebugLogger('EnhancedDashboard-Refactored');

// Use dashboard composable for state management
const dashboard = useDashboard({
  analysisData: props.analysisData,
  userPermissions: props.userPermissions,
  autoRefresh: props.autoRefresh,
  refreshInterval: props.refreshInterval,
  enablePersistence: true,
});

// Extract reactive state from composable
const {
  data,
  isLoading,
  error,
  searchQuery,
  selectedCategory,
  isRefreshing,
  lastRefreshTime,
  stats,
  systemStatus,
  recentActivity,
  quickActions,
  hasData,
  hasError,
  isReady,
  filteredActivity,
  categories,
  storagePercentage,
  storageStatusColor,
  loadDashboardData,
  refreshData,
  handleQuickAction: executeQuickAction,
  search,
  clearSearch,
  filterByCategory,
  clearCategoryFilter,
  clearError,
  formatTime,
  formatStorageSize,
  getSystemStatusIcon,
  getActivityIcon,
  getCategoryColor,
  getCategoryIcon,
} = dashboard;

// Additional local state
const sidebarCollapsed = ref(false);
const activeSection = ref('overview');
const isLoadingMore = ref(false);
const hasMoreActivity = ref(true);

// Computed properties
const breadcrumbs = computed(() => {
  const crumbs = [
    { label: 'Dashboard', path: 'dashboard' },
  ];
  
  if (activeSection.value !== 'overview') {
    crumbs.push({
      label: formatSectionName(activeSection.value),
      path: activeSection.value,
    });
  }
  
  return crumbs;
});

// Methods
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  logger.info('Sidebar toggled', { collapsed: sidebarCollapsed.value });
};

const handleSearch = (query: string) => {
  searchQuery.value = query;
  search(query);
  logger.info('Dashboard search', { query });
};

const refreshSystemStatus = async () => {
  try {
    logger.info('Refreshing system status');
    // This would trigger a system status refresh
    await refreshData();
  } catch (error) {
    logger.error('Failed to refresh system status', error);
  }
};

const handleQuickAction = async (action: QuickAction) => {
  try {
    logger.info('Executing quick action', { actionId: action.id, category: action.category });
    await executeQuickAction(action);
    
    // Navigate to relevant section if needed
    if (action.category === 'analysis') {
      navigateTo('analysis');
    } else if (action.category === 'ai') {
      navigateTo('ai-insights');
    } else if (action.category === 'file-management') {
      navigateTo('file-browser');
    } else if (action.category === 'settings') {
      openSettings();
    }
  } catch (error) {
    logger.error('Failed to execute quick action', error);
  }
};

const clearFilters = () => {
  clearSearch();
  clearCategoryFilter();
  logger.info('Dashboard filters cleared');
};

const refreshActivity = async () => {
  try {
    logger.info('Refreshing activity');
    // This would trigger an activity refresh
    await refreshData();
  } catch (error) {
    logger.error('Failed to refresh activity', error);
  }
};

const loadMoreActivity = async () => {
  if (isLoadingMore.value) return;
  
  try {
    logger.info('Loading more activity');
    isLoadingMore.value = true;
    
    // Simulate loading more activity
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real implementation, this would load more data from the service
    hasMoreActivity.value = false; // Simulate no more data
    
    logger.info('More activity loaded');
  } catch (error) {
    logger.error('Failed to load more activity', error);
  } finally {
    isLoadingMore.value = false;
  }
};

const viewActivityDetails = (activity: ActivityItem) => {
  logger.info('Viewing activity details', { activityId: activity.id });
  
  // Navigate to activity details or show modal
  if (activity.category === 'analysis') {
    navigateTo('analysis');
  } else if (activity.category === 'ai') {
    navigateTo('ai-insights');
  }
};

const navigateTo = (section: string) => {
  logger.info('Navigating to section', { section });
  activeSection.value = section;
  
  // Use Vue Router if available
  if (router) {
    router.push(`/dashboard/${section}`);
  }
};

const openSettings = () => {
  logger.info('Opening settings');
  navigateTo('settings');
};

const viewProfile = () => {
  logger.info('Viewing profile');
  // Navigate to profile page
};

const viewPreferences = () => {
  logger.info('Viewing preferences');
  navigateTo('preferences');
};

const logout = () => {
  logger.info('Logging out');
  // Handle logout logic
  if (router) {
    router.push('/login');
  }
};

const formatSectionName = (section: string): string => {
  const names: Record<string, string> = {
    overview: 'Overview',
    analytics: 'Analytics',
    reports: 'Reports',
    analysis: 'Analysis',
    'ai-insights': 'AI Insights',
    'file-browser': 'File Browser',
    settings: 'Settings',
    preferences: 'Preferences',
  };
  return names[section] || section.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Keyboard shortcuts
const handleKeyboardShortcuts = (event: KeyboardEvent) => {
  // Ctrl/Cmd + K to focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    // Focus search input (this would be handled by the layout component)
  }
  
  // Ctrl/Cmd + R to refresh
  if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
    event.preventDefault();
    refreshData();
  }
  
  // Escape to clear search
  if (event.key === 'Escape' && searchQuery.value) {
    clearSearch();
  }
  
  // Ctrl/Cmd + / to toggle sidebar
  if ((event.ctrlKey || event.metaKey) && event.key === '/') {
    event.preventDefault();
    toggleSidebar();
  }
};

// Auto-refresh management
const startAutoRefresh = () => {
  if (props.autoRefresh && props.refreshInterval > 0) {
    logger.info('Starting auto-refresh', { interval: props.refreshInterval });
  }
};

const stopAutoRefresh = () => {
  logger.info('Stopping auto-refresh');
};

// Lifecycle
onMounted(async () => {
  logger.info('Enhanced Dashboard mounted', {
    hasAnalysisData: !!props.analysisData,
    userPermissions: props.userPermissions,
    autoRefresh: props.autoRefresh,
  });
  
  // Load initial data
  await loadDashboardData();
  
  // Add keyboard event listeners
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Start auto-refresh
  startAutoRefresh();
});

onUnmounted(() => {
  logger.info('Enhanced Dashboard unmounted');
  
  // Remove keyboard event listeners
  document.removeEventListener('keydown', handleKeyboardShortcuts);
  
  // Stop auto-refresh
  stopAutoRefresh();
});

// Watchers
watch(() => props.analysisData, (newData) => {
  if (newData) {
    logger.info('Analysis data updated', {
      totalSize: newData.totalSize,
      fileCount: newData.files?.length,
    });
    
    // Refresh dashboard data with new analysis data
    loadDashboardData(true);
  }
}, { deep: true });

watch(() => props.userPermissions, (newPermissions) => {
  if (newPermissions) {
    logger.info('User permissions updated', newPermissions);
    
    // Refresh dashboard data with new permissions
    loadDashboardData(true);
  }
});

watch(() => props.autoRefresh, (newValue) => {
  if (newValue) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// Expose methods for parent components if needed
defineExpose({
  refreshData,
  clearError,
  navigateTo,
  toggleSidebar,
  search,
  clearSearch,
  filterByCategory,
  clearFilters,
  getDashboardData: () => data.value,
  getStats: () => stats.value,
  getSystemStatus: () => systemStatus.value,
  getRecentActivity: () => recentActivity.value,
  getQuickActions: () => quickActions.value,
});
</script>

<style scoped>
.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dashboard-content {
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .dashboard-content {
    gap: 0.75rem;
  }
}
</style>
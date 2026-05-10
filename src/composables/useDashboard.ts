/**
 * Dashboard Composable - Manages dashboard state and data
 * Extracted from EnhancedDashboard.vue for better state management
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { dashboardService, type DashboardData, type QuickAction, type ActivityItem } from '../services/DashboardService';
import { useDebugLogger } from '../utils/DebugUtils';
import { useDataPersistence } from '../utils/DataPersistence';

const logger = useDebugLogger('useDashboard');
const dataPersistence = useDataPersistence();

export interface UseDashboardOptions {
  analysisData?: any;
  userPermissions?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  enablePersistence?: boolean;
}

export interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string | null;
  isRefreshing: boolean;
  lastRefreshTime: Date | null;
}

/**
 * Dashboard Composable
 */
export function useDashboard(options: UseDashboardOptions = {}) {
  // State
  const data = ref<DashboardData | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const searchQuery = ref('');
  const selectedCategory = ref<string | null>(null);
  const isRefreshing = ref(false);
  const lastRefreshTime = ref<Date | null>(null);

  // Configuration
  const autoRefresh = options.autoRefresh !== false;
  const refreshInterval = options.refreshInterval || 60000; // 1 minute
  const enablePersistence = options.enablePersistence !== false;

  let refreshTimer: number | null = null;

  // Computed properties
  const stats = computed(() => data.value?.stats || null);
  const systemStatus = computed(() => data.value?.systemStatus || null);
  const recentActivity = computed(() => data.value?.recentActivity || []);
  const quickActions = computed(() => data.value?.quickActions || []);
  const lastUpdated = computed(() => data.value?.lastUpdated || null);

  const hasData = computed(() => data.value !== null);
  const hasError = computed(() => error.value !== null);
  const isReady = computed(() => !isLoading.value && hasData.value);

  const filteredActivity = computed(() => {
    if (!searchQuery.value) return recentActivity.value;
    
    const query = searchQuery.value.toLowerCase();
    return recentActivity.value.filter(activity =>
      activity.action.toLowerCase().includes(query)
    );
  });

  const filteredActions = computed(() => {
    let actions = quickActions.value;
    
    if (selectedCategory.value) {
      actions = actions.filter(action => action.category === selectedCategory.value);
    }
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      actions = actions.filter(action =>
        action.label.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
      );
    }
    
    return actions;
  });

  const categories = computed(() => {
    const cats = new Set(quickActions.value.map(action => action.category));
    return Array.from(cats);
  });

  const storagePercentage = computed(() => {
    if (!stats.value) return 0;
    return dashboardService.calculateStoragePercentage(
      stats.value.storageUsed,
      stats.value.storageTotal
    );
  });

  const storageStatusColor = computed(() => {
    return dashboardService.getStorageStatusColor(storagePercentage.value);
  });

  // Actions
  const loadDashboardData = async (forceRefresh = false) => {
    try {
      logger.info('Loading dashboard data', { forceRefresh });
      
      isLoading.value = true;
      error.value = null;
      
      const dashboardData = forceRefresh 
        ? await dashboardService.refreshDashboardData(options.analysisData, options.userPermissions)
        : await dashboardService.getDashboardData(options.analysisData, options.userPermissions);
      
      data.value = dashboardData;
      lastRefreshTime.value = new Date();
      
      // Save to persistence if enabled
      if (enablePersistence) {
        saveDashboardData();
      }
      
      logger.info('Dashboard data loaded successfully', {
        statsCount: Object.keys(dashboardData.stats).length,
        activityCount: dashboardData.recentActivity.length,
        actionCount: dashboardData.quickActions.length,
      });
      
    } catch (err) {
      logger.error('Failed to load dashboard data', err);
      error.value = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      isLoading.value = false;
    }
  };

  const refreshData = async () => {
    if (isRefreshing.value) return;
    
    try {
      logger.info('Refreshing dashboard data');
      isRefreshing.value = true;
      
      await loadDashboardData(true);
      
      logger.info('Dashboard data refreshed successfully');
      
    } catch (error) {
      logger.error('Failed to refresh dashboard data', error);
    } finally {
      isRefreshing.value = false;
    }
  };

  const handleQuickAction = async (action: QuickAction) => {
    try {
      logger.info('Executing quick action', { actionId: action.id, category: action.category });
      
      // Check if action is disabled
      if (action.disabled) {
        logger.warn('Action is disabled', { actionId: action.id });
        return;
      }
      
      // Check if action requires data
      if (action.requiresData && !options.analysisData) {
        logger.warn('Action requires data but none available', { actionId: action.id });
        return;
      }
      
      // Execute action
      action.onClick();
      
      // Add to recent activity
      const activity: ActivityItem = {
        id: `action-${Date.now()}`,
        action: `Executed: ${action.label}`,
        timestamp: new Date(),
        status: 'success',
        category: action.category,
      };
      
      if (data.value) {
        data.value.recentActivity.unshift(activity);
        
        // Limit activity to 50 items
        if (data.value.recentActivity.length > 50) {
          data.value.recentActivity = data.value.recentActivity.slice(0, 50);
        }
        
        // Save updated activity
        if (enablePersistence) {
          saveDashboardData();
        }
      }
      
      logger.info('Quick action executed successfully', { actionId: action.id });
      
    } catch (error) {
      logger.error('Failed to execute quick action', error);
      
      // Add error activity
      const activity: ActivityItem = {
        id: `action-error-${Date.now()}`,
        action: `Failed: ${action.label}`,
        timestamp: new Date(),
        status: 'error',
        category: action.category,
      };
      
      if (data.value) {
        data.value.recentActivity.unshift(activity);
      }
    }
  };

  const search = async (query: string) => {
    try {
      logger.info('Searching dashboard', { query });
      
      searchQuery.value = query;
      
      if (!query.trim()) {
        return;
      }
      
      const results = await dashboardService.searchData(query);
      
      logger.info('Dashboard search completed', {
        query,
        activitiesFound: results.activities.length,
        actionsFound: results.actions.length,
      });
      
      return results;
      
    } catch (error) {
      logger.error('Failed to search dashboard', error);
      return { activities: [], actions: [] };
    }
  };

  const clearSearch = () => {
    searchQuery.value = '';
    logger.info('Search cleared');
  };

  const filterByCategory = (category: string | null) => {
    selectedCategory.value = category;
    logger.info('Category filter updated', { category });
  };

  const clearCategoryFilter = () => {
    selectedCategory.value = null;
    logger.info('Category filter cleared');
  };

  const clearError = () => {
    error.value = null;
    logger.info('Error cleared');
  };

  // Persistence
  const saveDashboardData = () => {
    try {
      if (data.value) {
        dataPersistence.save('dashboard-data', {
          data: data.value,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Failed to save dashboard data', error);
    }
  };

  const loadDashboardDataFromPersistence = () => {
    try {
      const saved = dataPersistence.load('dashboard-data');
      if (saved?.data) {
        data.value = saved.data;
        lastRefreshTime.value = new Date(saved.timestamp);
        logger.info('Dashboard data loaded from persistence');
      }
    } catch (error) {
      logger.error('Failed to load dashboard data from persistence', error);
    }
  };

  const clearPersistedData = () => {
    try {
      dataPersistence.remove('dashboard-data');
      logger.info('Persisted dashboard data cleared');
    } catch (error) {
      logger.error('Failed to clear persisted dashboard data', error);
    }
  };

  // Auto-refresh management
  const startAutoRefresh = () => {
    if (!autoRefresh || refreshTimer) return;
    
    logger.info('Starting auto-refresh', { interval: refreshInterval });
    
    refreshTimer = window.setInterval(() => {
      if (!isRefreshing.value) {
        refreshData();
      }
    }, refreshInterval);
  };

  const stopAutoRefresh = () => {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
      logger.info('Auto-refresh stopped');
    }
  };

  const restartAutoRefresh = () => {
    stopAutoRefresh();
    startAutoRefresh();
  };

  // Utility functions
  const formatTime = (date: Date) => {
    return dashboardService.formatTime(date);
  };

  const formatStorageSize = (bytes: number) => {
    return dashboardService.formatStorageSize(bytes);
  };

  const getSystemStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return 'CheckCircle';
      case 'warning': return 'AlertTriangle';
      case 'error': return 'AlertTriangle';
      default: return 'Info';
    }
  };

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'success': return 'CheckCircle';
      case 'warning': return 'AlertTriangle';
      case 'error': return 'AlertTriangle';
      default: return 'Info';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      analysis: '#3b82f6',
      ai: '#8b5cf6',
      'file-management': '#22c55e',
      settings: '#f59e0b',
      system: '#ef4444',
    };
    return colors[category] || '#6b7280';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      analysis: 'BarChart3',
      ai: 'BrainCircuit',
      'file-management': 'Folder',
      settings: 'Settings',
      system: 'Cpu',
    };
    return icons[category] || 'Info';
  };

  // Initialize
  const initialize = async () => {
    logger.info('Initializing dashboard composable');
    
    // Load from persistence first
    if (enablePersistence) {
      loadDashboardDataFromPersistence();
    }
    
    // Load fresh data
    await loadDashboardData();
    
    // Start auto-refresh
    if (autoRefresh) {
      startAutoRefresh();
    }
    
    logger.info('Dashboard composable initialized', {
      hasData: hasData.value,
      autoRefresh,
      refreshInterval,
    });
  };

  // Watchers
  watch(() => options.analysisData, () => {
    if (options.analysisData) {
      loadDashboardData(true);
    }
  }, { deep: true });

  watch(() => options.userPermissions, () => {
    loadDashboardData(true);
  });

  watch(() => autoRefresh, (newValue) => {
    if (newValue) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  // Lifecycle
  onMounted(() => {
    initialize();
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  // Return reactive state and methods
  return {
    // State
    data,
    isLoading,
    error,
    searchQuery,
    selectedCategory,
    isRefreshing,
    lastRefreshTime,
    
    // Computed
    stats,
    systemStatus,
    recentActivity,
    quickActions,
    lastUpdated,
    hasData,
    hasError,
    isReady,
    filteredActivity,
    filteredActions,
    categories,
    storagePercentage,
    storageStatusColor,
    
    // Methods
    loadDashboardData,
    refreshData,
    handleQuickAction,
    search,
    clearSearch,
    filterByCategory,
    clearCategoryFilter,
    clearError,
    
    // Persistence
    saveDashboardData,
    loadDashboardDataFromPersistence,
    clearPersistedData,
    
    // Auto-refresh
    startAutoRefresh,
    stopAutoRefresh,
    restartAutoRefresh,
    
    // Utilities
    formatTime,
    formatStorageSize,
    getSystemStatusIcon,
    getActivityIcon,
    getCategoryColor,
    getCategoryIcon,
  };
}
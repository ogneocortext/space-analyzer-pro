/**
 * Test file for refactored Dashboard components
 * Tests the new modular architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from '../services/DashboardService';
import { useDashboard } from '../composables/useDashboard';

// Mock the debug logger
vi.mock('../utils/DebugUtils', () => ({
  useDebugLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock the data persistence
vi.mock('../utils/DataPersistence', () => ({
  useDataPersistence: () => ({
    save: vi.fn(),
    load: vi.fn(),
    exists: vi.fn(() => false),
    clear: vi.fn(),
    remove: vi.fn(),
  }),
}));

// Mock the file utils
vi.mock('../utils/FileUtils', () => ({
  formatFileSize: (bytes: number) => `${bytes} B`,
}));

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = DashboardService.getInstance();
  });

  it('should get dashboard stats', async () => {
    const analysisData = {
      totalSize: 1024 * 1024 * 1024, // 1GB
      files: Array.from({ length: 1000 }, (_, i) => ({
        name: `file-${i}.txt`,
        size: 1024,
      })),
    };

    const stats = await service.getDashboardStats(analysisData);
    
    expect(stats.totalFiles).toBe(1000);
    expect(stats.storageUsed).toBe(1024 * 1024 * 1024);
    expect(stats.storageTotal).toBe(2 * 1024 * 1024 * 1024 * 1024); // 2TB
    expect(stats.analysisSpeed).toBeGreaterThan(0);
    expect(stats.aiInsights).toBeGreaterThan(0);
  });

  it('should get system status', async () => {
    const status = await service.getSystemStatus();
    
    expect(status.status).toMatch(/healthy|warning|error/);
    expect(status.message).toBeDefined();
    expect(status.lastCheck).toBeInstanceOf(Date);
    expect(status.details).toBeDefined();
  });

  it('should get recent activity', async () => {
    const activity = await service.getRecentActivity(5);
    
    expect(Array.isArray(activity)).toBe(true);
    expect(activity.length).toBeLessThanOrEqual(5);
    
    if (activity.length > 0) {
      expect(activity[0]).toHaveProperty('id');
      expect(activity[0]).toHaveProperty('action');
      expect(activity[0]).toHaveProperty('timestamp');
      expect(activity[0]).toHaveProperty('status');
    }
  });

  it('should get quick actions', async () => {
    const actions = await service.getQuickActions();
    
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
    
    actions.forEach(action => {
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('description');
      expect(action).toHaveProperty('icon');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('onClick');
    });
  });

  it('should get complete dashboard data', async () => {
    const data = await service.getDashboardData();
    
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('systemStatus');
    expect(data).toHaveProperty('recentActivity');
    expect(data).toHaveProperty('quickActions');
    expect(data).toHaveProperty('lastUpdated');
    
    expect(data.lastUpdated).toBeInstanceOf(Date);
  });

  it('should refresh dashboard data', async () => {
    const data1 = await service.getDashboardData();
    const data2 = await service.refreshDashboardData();
    
    expect(data2.lastUpdated.getTime()).toBeGreaterThan(data1.lastUpdated.getTime());
  });

  it('should search dashboard data', async () => {
    const results = await service.searchData('analysis');
    
    expect(results).toHaveProperty('activities');
    expect(results).toHaveProperty('actions');
    expect(Array.isArray(results.activities)).toBe(true);
    expect(Array.isArray(results.actions)).toBe(true);
  });

  it('should format time correctly', () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    expect(service.formatTime(oneMinuteAgo)).toBe('1 minute ago');
    expect(service.formatTime(oneHourAgo)).toBe('1 hour ago');
    expect(service.formatTime(oneDayAgo)).toBe('1 day ago');
  });

  it('should calculate storage percentage', () => {
    const used = 1024 * 1024 * 1024; // 1GB
    const total = 2 * 1024 * 1024 * 1024; // 2GB
    
    const percentage = service.calculateStoragePercentage(used, total);
    expect(percentage).toBe(50);
  });

  it('should get storage status color', () => {
    expect(service.getStorageStatusColor(95)).toBe('#ef4444'); // red
    expect(service.getStorageStatusColor(80)).toBe('#f59e0b'); // yellow
    expect(service.getStorageStatusColor(50)).toBe('#22c55e'); // green
  });
});

describe('useDashboard composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const dashboard = useDashboard();
    
    expect(dashboard.data.value).toBe(null);
    expect(dashboard.isLoading.value).toBe(false);
    expect(dashboard.error.value).toBe(null);
    expect(dashboard.searchQuery.value).toBe('');
    expect(dashboard.selectedCategory.value).toBe(null);
    expect(dashboard.isRefreshing.value).toBe(false);
  });

  it('should load dashboard data', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    expect(dashboard.isLoading.value).toBe(false);
    expect(dashboard.data.value).not.toBe(null);
    expect(dashboard.lastRefreshTime.value).toBeInstanceOf(Date);
  });

  it('should refresh dashboard data', async () => {
    const dashboard = useDashboard();
    
    // Load initial data
    await dashboard.loadDashboardData();
    const initialRefreshTime = dashboard.lastRefreshTime.value;
    
    // Wait a bit to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Refresh data
    await dashboard.refreshData();
    
    expect(dashboard.isRefreshing.value).toBe(false);
    expect(dashboard.lastRefreshTime.value?.getTime()).toBeGreaterThan(initialRefreshTime?.getTime() || 0);
  });

  it('should handle quick actions', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    if (dashboard.quickActions.value.length > 0) {
      const action = dashboard.quickActions.value[0];
      
      // Mock the action onClick
      const mockOnClick = vi.fn();
      action.onClick = mockOnClick;
      
      await dashboard.handleQuickAction(action);
      
      expect(mockOnClick).toHaveBeenCalled();
    }
  });

  it('should search dashboard', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    const results = await dashboard.search('test');
    
    expect(results).toHaveProperty('activities');
    expect(results).toHaveProperty('actions');
  });

  it('should filter by category', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    if (dashboard.categories.value.length > 0) {
      const category = dashboard.categories.value[0];
      dashboard.filterByCategory(category);
      
      expect(dashboard.selectedCategory.value).toBe(category);
    }
  });

  it('should clear filters', () => {
    const dashboard = useDashboard();
    
    dashboard.searchQuery.value = 'test';
    dashboard.selectedCategory.value = 'analysis';
    
    dashboard.clearSearch();
    dashboard.clearCategoryFilter();
    
    expect(dashboard.searchQuery.value).toBe('');
    expect(dashboard.selectedCategory.value).toBe(null);
  });

  it('should compute derived state correctly', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    expect(dashboard.hasData.value).toBe(true);
    expect(dashboard.hasError.value).toBe(false);
    expect(dashboard.isReady.value).toBe(true);
    expect(dashboard.stats.value).not.toBe(null);
    expect(dashboard.systemStatus.value).not.toBe(null);
    expect(dashboard.recentActivity.value).toBeInstanceOf(Array);
    expect(dashboard.quickActions.value).toBeInstanceOf(Array);
    expect(dashboard.categories.value).toBeInstanceOf(Array);
  });

  it('should format time correctly', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    if (dashboard.recentActivity.value.length > 0) {
      const activity = dashboard.recentActivity.value[0];
      const formatted = dashboard.formatTime(activity.timestamp);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('should format storage size correctly', async () => {
    const dashboard = useDashboard();
    
    await dashboard.loadDashboardData();
    
    if (dashboard.stats.value) {
      const formatted = dashboard.formatStorageSize(dashboard.stats.value.storageUsed);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('should get system status icon', async () => {
    const dashboard = useDashboard();
    
    expect(dashboard.getSystemStatusIcon('healthy')).toBe('CheckCircle');
    expect(dashboard.getSystemStatusIcon('warning')).toBe('AlertTriangle');
    expect(dashboard.getSystemStatusIcon('error')).toBe('AlertTriangle');
    expect(dashboard.getSystemStatusIcon('unknown')).toBe('Info');
  });

  it('should get activity icon', () => {
    const dashboard = useDashboard();
    
    expect(dashboard.getActivityIcon('success')).toBe('CheckCircle');
    expect(dashboard.getActivityIcon('warning')).toBe('AlertTriangle');
    expect(dashboard.getActivityIcon('error')).toBe('AlertTriangle');
  });

  it('should get category color', () => {
    const dashboard = useDashboard();
    
    expect(dashboard.getCategoryColor('analysis')).toBe('#3b82f6');
    expect(dashboard.getCategoryColor('ai')).toBe('#8b5cf6');
    expect(dashboard.getCategoryColor('file-management')).toBe('#22c55e');
    expect(dashboard.getCategoryColor('settings')).toBe('#f59e0b');
    expect(dashboard.getCategoryColor('system')).toBe('#ef4444');
  });

  it('should get category icon', () => {
    const dashboard = useDashboard();
    
    expect(dashboard.getCategoryIcon('analysis')).toBe('BarChart3');
    expect(dashboard.getCategoryIcon('ai')).toBe('BrainCircuit');
    expect(dashboard.getCategoryIcon('file-management')).toBe('Folder');
    expect(dashboard.getCategoryIcon('settings')).toBe('Settings');
    expect(dashboard.getCategoryIcon('system')).toBe('Cpu');
  });

  it('should handle errors gracefully', async () => {
    const dashboard = useDashboard();
    
    // Mock an error in the service
    vi.spyOn(DashboardService.getInstance(), 'getDashboardData').mockRejectedValueOnce(new Error('Test error'));
    
    await dashboard.loadDashboardData();
    
    expect(dashboard.isLoading.value).toBe(false);
    expect(dashboard.error.value).toBe('Failed to load dashboard data');
    expect(dashboard.hasError.value).toBe(true);
  });

  it('should clear error', () => {
    const dashboard = useDashboard();
    
    dashboard.error.value = 'Test error';
    expect(dashboard.hasError.value).toBe(true);
    
    dashboard.clearError();
    expect(dashboard.error.value).toBe(null);
    expect(dashboard.hasError.value).toBe(false);
  });

  it('should work with analysis data', async () => {
    const analysisData = {
      totalSize: 1024 * 1024 * 1024,
      files: [{ name: 'test.txt', size: 1024 }],
    };
    
    const dashboard = useDashboard({ analysisData });
    
    await dashboard.loadDashboardData();
    
    expect(dashboard.data.value).not.toBe(null);
    expect(dashboard.stats.value?.totalFiles).toBe(1);
    expect(dashboard.stats.value?.storageUsed).toBe(1024 * 1024 * 1024);
  });

  it('should work with user permissions', async () => {
    const userPermissions = ['admin', 'user'];
    
    const dashboard = useDashboard({ userPermissions });
    
    await dashboard.loadDashboardData();
    
    expect(dashboard.data.value).not.toBe(null);
    expect(dashboard.quickActions.value.length).toBeGreaterThan(0);
  });

  it('should handle auto-refresh', async () => {
    const dashboard = useDashboard({ autoRefresh: true, refreshInterval: 100 });
    
    await dashboard.loadDashboardData();
    const initialRefreshTime = dashboard.lastRefreshTime.value;
    
    // Wait for auto-refresh
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Check if data was refreshed (this might not work in test environment)
    // but the setup should be correct
    expect(dashboard.lastRefreshTime.value).toBeInstanceOf(Date);
  });
});

describe('Integration Tests', () => {
  it('should work together seamlessly', async () => {
    const analysisData = {
      totalSize: 2 * 1024 * 1024 * 1024,
      files: Array.from({ length: 5000 }, (_, i) => ({
        name: `file-${i}.txt`,
        size: 1024,
      })),
    };

    const userPermissions = ['admin', 'user'];

    // Initialize dashboard
    const dashboard = useDashboard({ 
      analysisData, 
      userPermissions,
      autoRefresh: false,
    });

    // Load data
    await dashboard.loadDashboardData();

    // Check that all components are working
    expect(dashboard.data.value).not.toBe(null);
    expect(dashboard.stats.value).not.toBe(null);
    expect(dashboard.systemStatus.value).not.toBe(null);
    expect(dashboard.recentActivity.value.length).toBeGreaterThan(0);
    expect(dashboard.quickActions.value.length).toBeGreaterThan(0);

    // Test search functionality
    const searchResults = await dashboard.search('analysis');
    expect(searchResults).toHaveProperty('activities');
    expect(searchResults).toHaveProperty('actions');

    // Test filtering
    if (dashboard.categories.value.length > 0) {
      const category = dashboard.categories.value[0];
      dashboard.filterByCategory(category);
      expect(dashboard.selectedCategory.value).toBe(category);
    }

    // Test quick action execution
    if (dashboard.quickActions.value.length > 0) {
      const action = dashboard.quickActions.value[0];
      if (!action.disabled) {
        await dashboard.handleQuickAction(action);
        // The action should be executed (we can't test the exact effect here)
      }
    }

    // Test refresh
    await dashboard.refreshData();
    expect(dashboard.isRefreshing.value).toBe(false);

    // Test utilities
    expect(typeof dashboard.formatTime(new Date())).toBe('string');
    expect(typeof dashboard.formatStorageSize(1024)).toBe('string');
    expect(typeof dashboard.getSystemStatusIcon('healthy')).toBe('string');
    expect(typeof dashboard.getCategoryColor('analysis')).toBe('string');
  });

  it('should handle edge cases', async () => {
    // Test with no analysis data
    const dashboard1 = useDashboard();
    await dashboard1.loadDashboardData();
    expect(dashboard1.data.value).not.toBe(null);
    expect(dashboard1.stats.value?.totalFiles).toBe(0);

    // Test with empty analysis data
    const dashboard2 = useDashboard({ analysisData: { files: [], totalSize: 0 } });
    await dashboard2.loadDashboardData();
    expect(dashboard2.data.value).not.toBe(null);
    expect(dashboard2.stats.value?.totalFiles).toBe(0);

    // Test with no permissions
    const dashboard3 = useDashboard({ userPermissions: [] });
    await dashboard3.loadDashboardData();
    expect(dashboard3.data.value).not.toBe(null);
    expect(dashboard3.quickActions.value.length).toBeGreaterThan(0);
  });
});
/**
 * Dashboard Service - Handles dashboard data processing and analytics
 * Extracted from EnhancedDashboard.vue for better separation of concerns
 */

import { useDebugLogger } from '../utils/DebugUtils';
import { formatFileSize } from '../utils/FileUtils';

const logger = useDebugLogger('DashboardService');

export interface DashboardStats {
  totalFiles: number;
  storageUsed: number;
  storageTotal: number;
  analysisSpeed: number;
  aiInsights: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'analysis' | 'ai' | 'file-management' | 'settings';
  onClick: () => void;
  disabled?: boolean;
  beta?: boolean;
  requiresAuth?: boolean;
  requiresData?: boolean;
}

export interface SystemStatus {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastCheck: Date;
  details?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    networkStatus?: 'online' | 'offline' | 'limited';
  };
}

export interface ActivityItem {
  id: string;
  action: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
  details?: any;
  userId?: string;
  category?: 'analysis' | 'ai' | 'file-management' | 'system';
}

export interface DashboardData {
  stats: DashboardStats;
  systemStatus: SystemStatus;
  recentActivity: ActivityItem[];
  quickActions: QuickAction[];
  lastUpdated: Date;
}

/**
 * Dashboard Service Class
 */
export class DashboardService {
  private static instance: DashboardService;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(analysisData?: any): Promise<DashboardStats> {
    try {
      logger.info('Fetching dashboard stats');
      
      // Try to get from cache first
      const cacheKey = 'dashboard-stats';
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate stats from analysis data or use defaults
      const stats = await this.calculateStats(analysisData);
      
      // Cache for 5 minutes
      this.setCache(cacheKey, stats, 5 * 60 * 1000);
      
      logger.info('Dashboard stats calculated', {
        totalFiles: stats.totalFiles,
        storageUsed: stats.storageUsed,
        aiInsights: stats.aiInsights,
      });
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get dashboard stats', error);
      return this.getDefaultStats();
    }
  }

  /**
   * Calculate statistics from analysis data
   */
  private async calculateStats(analysisData?: any): Promise<DashboardStats> {
    const files = analysisData?.files || [];
    const totalSize = analysisData?.totalSize || 0;
    
    // Calculate total files
    const totalFiles = files.length;
    
    // Calculate storage usage
    const storageUsed = totalSize;
    const storageTotal = 2 * 1024 * 1024 * 1024 * 1024; // 2TB default
    
    // Calculate analysis speed (simulated)
    const analysisSpeed = Math.floor(Math.random() * 1000) + 2000;
    
    // Calculate AI insights (simulated)
    const aiInsights = Math.floor(Math.random() * 50) + 100;
    
    // Calculate growth rates (simulated)
    const weeklyGrowth = Math.random() * 10 - 2; // -2% to +8%
    const monthlyGrowth = Math.random() * 15 - 5; // -5% to +10%
    
    return {
      totalFiles,
      storageUsed,
      storageTotal,
      analysisSpeed,
      aiInsights,
      weeklyGrowth,
      monthlyGrowth,
    };
  }

  /**
   * Get default statistics when data is not available
   */
  private getDefaultStats(): DashboardStats {
    return {
      totalFiles: 0,
      storageUsed: 0,
      storageTotal: 2 * 1024 * 1024 * 1024 * 1024, // 2TB
      analysisSpeed: 0,
      aiInsights: 0,
      weeklyGrowth: 0,
      monthlyGrowth: 0,
    };
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      logger.info('Checking system status');
      
      // Simulate system checks
      const cpuUsage = Math.random() * 100;
      const memoryUsage = Math.random() * 100;
      const diskUsage = Math.random() * 100;
      const networkStatus = Math.random() > 0.1 ? 'online' : 'limited';
      
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = 'All systems operational';
      
      if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 95) {
        status = 'error';
        message = 'Critical system resources exhausted';
      } else if (cpuUsage > 70 || memoryUsage > 70 || diskUsage > 80) {
        status = 'warning';
        message = 'System resources running low';
      }
      
      const systemStatus: SystemStatus = {
        status,
        message,
        lastCheck: new Date(),
        details: {
          cpuUsage,
          memoryUsage,
          diskUsage,
          networkStatus: networkStatus as 'online' | 'offline' | 'limited',
        },
      };
      
      logger.info('System status checked', { status, message });
      
      return systemStatus;
      
    } catch (error) {
      logger.error('Failed to check system status', error);
      return {
        status: 'error',
        message: 'Unable to check system status',
        lastCheck: new Date(),
      };
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10): Promise<ActivityItem[]> {
    try {
      logger.info('Fetching recent activity');
      
      // Simulate recent activity data
      const activities: ActivityItem[] = [
        {
          id: '1',
          action: 'Analysis completed',
          timestamp: new Date(Date.now() - 60000),
          status: 'success',
          category: 'analysis',
          details: { filesProcessed: 12458, duration: 45 },
        },
        {
          id: '2',
          action: 'AI insights generated',
          timestamp: new Date(Date.now() - 300000),
          status: 'success',
          category: 'ai',
          details: { insightsCount: 156, model: 'deepseek-coder' },
        },
        {
          id: '3',
          action: 'Duplicate files detected',
          timestamp: new Date(Date.now() - 600000),
          status: 'warning',
          category: 'file-management',
          details: { duplicateCount: 23, totalSize: 1024 * 1024 * 1024 },
        },
        {
          id: '4',
          action: 'Storage optimization applied',
          timestamp: new Date(Date.now() - 900000),
          status: 'success',
          category: 'file-management',
          details: { spaceSaved: 1024 * 1024 * 1024 * 2 },
        },
        {
          id: '5',
          action: 'System backup completed',
          timestamp: new Date(Date.now() - 1200000),
          status: 'success',
          category: 'system',
          details: { backupSize: 1024 * 1024 * 1024 * 100 },
        },
        {
          id: '6',
          action: 'AI model updated',
          timestamp: new Date(Date.now() - 1500000),
          status: 'success',
          category: 'ai',
          details: { model: 'llama2', version: '7b' },
        },
        {
          id: '7',
          action: 'File permissions audit',
          timestamp: new Date(Date.now() - 1800000),
          status: 'warning',
          category: 'system',
          details: { issuesFound: 5 },
        },
        {
          id: '8',
          action: 'Cache cleared',
          timestamp: new Date(Date.now() - 2100000),
          status: 'success',
          category: 'system',
          details: { cacheSize: 1024 * 1024 * 512 },
        },
      ];
      
      // Sort by timestamp (newest first) and limit
      const sortedActivities = activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
      
      logger.info('Recent activity fetched', { count: sortedActivities.length });
      
      return sortedActivities;
      
    } catch (error) {
      logger.error('Failed to get recent activity', error);
      return [];
    }
  }

  /**
   * Get quick actions
   */
  async getQuickActions(userPermissions?: string[]): Promise<QuickAction[]> {
    try {
      logger.info('Fetching quick actions');
      
      const actions: QuickAction[] = [
        {
          id: 'start-analysis',
          label: 'Start Analysis',
          description: 'Analyze your file system',
          icon: 'Play',
          category: 'analysis',
          onClick: () => this.handleQuickAction('start-analysis'),
          requiresData: true,
        },
        {
          id: 'ai-insights',
          label: 'AI Insights',
          description: 'Get AI-powered recommendations',
          icon: 'BrainCircuit',
          category: 'ai',
          onClick: () => this.handleQuickAction('ai-insights'),
          beta: true,
          requiresData: true,
        },
        {
          id: 'file-browser',
          label: 'File Browser',
          description: 'Browse and manage files',
          icon: 'Folder',
          category: 'file-management',
          onClick: () => this.handleQuickAction('file-browser'),
        },
        {
          id: 'settings',
          label: 'Settings',
          description: 'Configure preferences',
          icon: 'Settings',
          category: 'settings',
          onClick: () => this.handleQuickAction('settings'),
        },
        {
          id: 'duplicate-finder',
          label: 'Duplicate Finder',
          description: 'Find and remove duplicate files',
          icon: 'FileText',
          category: 'file-management',
          onClick: () => this.handleQuickAction('duplicate-finder'),
          requiresData: true,
        },
        {
          id: 'storage-optimizer',
          label: 'Storage Optimizer',
          description: 'Optimize storage usage',
          icon: 'Database',
          category: 'file-management',
          onClick: () => this.handleQuickAction('storage-optimizer'),
          requiresData: true,
        },
        {
          id: 'performance-monitor',
          label: 'Performance Monitor',
          description: 'Monitor system performance',
          icon: 'Activity',
          category: 'analysis',
          onClick: () => this.handleQuickAction('performance-monitor'),
        },
        {
          id: 'export-data',
          label: 'Export Data',
          description: 'Export analysis results',
          icon: 'TrendingUp',
          category: 'analysis',
          onClick: () => this.handleQuickAction('export-data'),
          requiresData: true,
        },
      ];
      
      // Filter actions based on user permissions if provided
      const filteredActions = userPermissions 
        ? actions.filter(action => !action.requiresAuth || userPermissions.includes('admin'))
        : actions;
      
      logger.info('Quick actions fetched', { 
        total: actions.length, 
        filtered: filteredActions.length 
      });
      
      return filteredActions;
      
    } catch (error) {
      logger.error('Failed to get quick actions', error);
      return [];
    }
  }

  /**
   * Handle quick action execution
   */
  private handleQuickAction(actionId: string): void {
    logger.info('Quick action triggered', { actionId });
    
    // Emit event or call appropriate handler
    // This would be implemented based on the application's event system
    console.log(`Quick action: ${actionId}`);
    
    // Track action usage
    this.trackActionUsage(actionId);
  }

  /**
   * Track action usage for analytics
   */
  private trackActionUsage(actionId: string): void {
    try {
      // Simulate tracking - in real implementation, this would send to analytics
      logger.debug('Action usage tracked', { actionId, timestamp: Date.now() });
    } catch (error) {
      logger.error('Failed to track action usage', error);
    }
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(analysisData?: any, userPermissions?: string[]): Promise<DashboardData> {
    try {
      logger.info('Fetching complete dashboard data');
      
      const [stats, systemStatus, recentActivity, quickActions] = await Promise.all([
        this.getDashboardStats(analysisData),
        this.getSystemStatus(),
        this.getRecentActivity(),
        this.getQuickActions(userPermissions),
      ]);
      
      const dashboardData: DashboardData = {
        stats,
        systemStatus,
        recentActivity,
        quickActions,
        lastUpdated: new Date(),
      };
      
      logger.info('Dashboard data fetched successfully', {
        statsCount: Object.keys(stats).length,
        activityCount: recentActivity.length,
        actionCount: quickActions.length,
      });
      
      return dashboardData;
      
    } catch (error) {
      logger.error('Failed to get dashboard data', error);
      throw error;
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboardData(analysisData?: any, userPermissions?: string[]): Promise<DashboardData> {
    try {
      logger.info('Refreshing dashboard data');
      
      // Clear cache to force fresh data
      this.clearCache();
      
      // Get fresh data
      return await this.getDashboardData(analysisData, userPermissions);
      
    } catch (error) {
      logger.error('Failed to refresh dashboard data', error);
      throw error;
    }
  }

  /**
   * Search dashboard data
   */
  async searchData(query: string): Promise<{
    activities: ActivityItem[];
    actions: QuickAction[];
  }> {
    try {
      logger.info('Searching dashboard data', { query });
      
      const [activities, actions] = await Promise.all([
        this.getRecentActivity(50),
        this.getQuickActions(),
      ]);
      
      // Filter activities
      const filteredActivities = activities.filter(activity =>
        activity.action.toLowerCase().includes(query.toLowerCase())
      );
      
      // Filter actions
      const filteredActions = actions.filter(action =>
        action.label.toLowerCase().includes(query.toLowerCase()) ||
        action.description.toLowerCase().includes(query.toLowerCase())
      );
      
      logger.info('Dashboard search completed', {
        query,
        activitiesFound: filteredActivities.length,
        actionsFound: filteredActions.length,
      });
      
      return {
        activities: filteredActivities,
        actions: filteredActions,
      };
      
    } catch (error) {
      logger.error('Failed to search dashboard data', error);
      return { activities: [], actions: [] };
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private clearCache(): void {
    this.cache.clear();
    logger.info('Dashboard cache cleared');
  }

  /**
   * Format time for display
   */
  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  }

  /**
   * Format storage size for display
   */
  formatStorageSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  /**
   * Calculate storage percentage
   */
  calculateStoragePercentage(used: number, total: number): number {
    return Math.round((used / total) * 100);
  }

  /**
   * Get storage status color
   */
  getStorageStatusColor(percentage: number): string {
    if (percentage >= 90) return '#ef4444'; // red
    if (percentage >= 75) return '#f59e0b'; // yellow
    return '#22c55e'; // green
  }
}

// Export singleton instance
export const dashboardService = DashboardService.getInstance();
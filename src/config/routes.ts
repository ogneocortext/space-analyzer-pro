// Route configuration for Space Analyzer Pro
// This file defines all valid routes and their properties

export interface RouteConfig {
  id: string;
  path: string;
  title: string;
  description: string;
  icon: string;
  group: 'core' | 'ai' | 'visualization' | 'tools' | 'system' | 'config';
  enabled: boolean;
  requiresData?: boolean;
}

export const ROUTES: RouteConfig[] = [
  // Core Features
  {
    id: 'dashboard',
    path: '/',
    title: 'Dashboard',
    description: 'Overview of your file system analysis',
    icon: 'LayoutDashboard',
    group: 'core',
    enabled: true
  },
  {
    id: 'file-browser',
    path: '/file-browser',
    title: 'File Browser',
    description: 'Navigate and explore your files',
    icon: 'Folder',
    group: 'core',
    enabled: true
  },
  {
    id: 'analysis',
    path: '/analysis',
    title: 'Analysis',
    description: 'Detailed file system analysis',
    icon: 'Search',
    group: 'core',
    enabled: true
  },

  // AI-Powered Features
  {
    id: 'ai-features',
    path: '/ai-features',
    title: 'AI Features',
    description: 'AI-powered insights and recommendations',
    icon: 'BrainCircuit',
    group: 'ai',
    enabled: true
  },
  {
    id: 'ai-insights',
    path: '/ai-insights',
    title: 'AI Insights',
    description: 'AI-powered insights and recommendations for your file system',
    icon: 'BrainCircuit',
    group: 'ai',
    enabled: true
  },
  {
    id: 'smart-analysis',
    path: '/smart-analysis',
    title: 'Smart Analysis',
    description: 'Optimized tool coordination with redundancy reduction',
    icon: 'Brain',
    group: 'ai',
    enabled: true
  },
  {
    id: 'neural',
    path: '/neural',
    title: 'Neural View',
    description: 'Neural network visualization',
    icon: 'Network',
    group: 'ai',
    enabled: true,
    requiresData: true
  },
  {
    id: 'chat',
    path: '/chat',
    title: 'AI Chat',
    description: 'Chat with AI assistant',
    icon: 'MessageSquare',
    group: 'ai',
    enabled: true
  },
  {
    id: 'predictive',
    path: '/predictive',
    title: 'Predictive',
    description: 'Storage forecasting and trends',
    icon: 'TrendingUp',
    group: 'ai',
    enabled: true,
    requiresData: true
  },
  {
    id: 'timetravel',
    path: '/timetravel',
    title: 'Time Travel',
    description: 'Compare different scan snapshots over time',
    icon: 'Calendar',
    group: 'ai',
    enabled: true
  },
  {
    id: 'temperature',
    path: '/temperature',
    title: 'File Temperature',
    description: 'View file access patterns and heatmaps',
    icon: 'Activity',
    group: 'ai',
    enabled: true,
    requiresData: true
  },

  // Visualization
  {
    id: 'visualization',
    path: '/visualization',
    title: 'Charts',
    description: 'Interactive data visualizations',
    icon: 'PieChart',
    group: 'visualization',
    enabled: true,
    requiresData: true
  },
  {
    id: 'treemap',
    path: '/treemap',
    title: 'Treemap',
    description: 'Hierarchical file visualization',
    icon: 'Layers',
    group: 'visualization',
    enabled: true
  },

  // Tools
  {
    id: 'duplicates',
    path: '/duplicates',
    title: 'Duplicates',
    description: 'Find and manage duplicate files',
    icon: 'Copy',
    group: 'tools',
    enabled: true
  },
  {
    id: 'optimization',
    path: '/optimization',
    title: 'Optimization',
    description: 'Storage optimization suggestions',
    icon: 'Zap',
    group: 'tools',
    enabled: true,
    requiresData: true
  },
  {
    id: 'automation',
    path: '/automation',
    title: 'Automation',
    description: 'Automated cleanup and maintenance',
    icon: 'Play',
    group: 'tools',
    enabled: true,
    requiresData: true
  },

  // System
  {
    id: 'monitoring',
    path: '/monitoring',
    title: 'Monitoring',
    description: 'Real-time system monitoring',
    icon: 'Activity',
    group: 'system',
    enabled: true,
    requiresData: true
  },
  {
    id: 'security',
    path: '/security',
    title: 'Security',
    description: 'Security analysis and scanning',
    icon: 'Shield',
    group: 'system',
    enabled: true,
    requiresData: true
  },
  {
    id: 'export',
    path: '/export',
    title: 'Export',
    description: 'Export analysis results',
    icon: 'Download',
    group: 'system',
    enabled: true
  },

  // Configuration
  {
    id: 'development',
    path: '/development',
    title: 'Development',
    description: 'Developer tools and APIs',
    icon: 'Code',
    group: 'config',
    enabled: true,
    requiresData: true
  },
  {
    id: 'integrations',
    path: '/integrations',
    title: 'Integrations',
    description: 'Third-party integrations',
    icon: 'Globe',
    group: 'config',
    enabled: true,
    requiresData: true
  },
  {
    id: 'settings',
    path: '/settings',
    title: 'Settings',
    description: 'Application settings',
    icon: 'Settings',
    group: 'config',
    enabled: true
  },
  {
    id: 'accessibility',
    path: '/accessibility',
    title: 'Accessibility',
    description: 'Accessibility settings and options',
    icon: 'Eye',
    group: 'config',
    enabled: true
  },
  {
    id: 'performance',
    path: '/performance',
    title: 'Performance',
    description: 'System performance metrics and optimization recommendations',
    icon: 'Cpu',
    group: 'config',
    enabled: true
  }
];

// Helper functions
export const getRouteById = (id: string): RouteConfig | undefined => {
  return ROUTES.find(route => route.id === id);
};

export const getRouteByPath = (path: string): RouteConfig | undefined => {
  return ROUTES.find(route => route.path === path);
};

export const getEnabledRoutes = (): RouteConfig[] => {
  return ROUTES.filter(route => route.enabled);
};

export const getRoutesByGroup = (group: RouteConfig['group']): RouteConfig[] => {
  return ROUTES.filter(route => route.group === group && route.enabled);
};

export const getRoutesRequiringData = (): RouteConfig[] => {
  return ROUTES.filter(route => route.requiresData && route.enabled);
};

// Simplified route groups for cleaner navigation
export const ROUTE_GROUPS = {
  core: [
    getRouteById('dashboard')!,
    getRouteById('file-browser')!,
    getRouteById('analysis')!
  ].filter(Boolean),

  ai: [
    getRouteById('ai-features')!, // Consolidated AI features
    getRouteById('chat')!, // Keep chat as primary AI interaction
    getRouteById('smart-analysis')! // Keep smart analysis
  ].filter(Boolean),

  visualization: [
    getRouteById('neural')!, // Primary visualization
    getRouteById('temperature')!, // File temperature heatmap
    getRouteById('treemap')! // Treemap view
  ].filter(Boolean),

  tools: [
    getRouteById('duplicates')!, // File management
    getRouteById('timetravel')!, // Time travel comparisons
    getRouteById('export')! // Export functionality
  ].filter(Boolean),

  system: [
    getRouteById('development')!, // Developer tools (moved from config)
    getRouteById('performance')!, // Performance monitoring
    getRouteById('monitoring')!, // System monitoring
    getRouteById('settings')! // Settings
  ].filter(Boolean)
};

// Navigation order for consistent sidebar display
export const NAVIGATION_ORDER = [
  'dashboard',
  'file-browser',
  'analysis',
  'ai-features',
  'ai-insights',
  'smart-analysis',
  'neural',
  'chat',
  'predictive',
  'timetravel',
  'temperature',
  'visualization',
  'treemap',
  'duplicates',
  'optimization',
  'automation',
  'monitoring',
  'security',
  'export',
  'development',
  'integrations',
  'settings',
  'accessibility',
  'performance'
];
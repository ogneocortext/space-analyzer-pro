// Centralized route configuration for the Space Analyzer application
import type { LucideIcon } from "lucide-vue-next";

export interface RouteConfig {
  id: string;
  path: string;
  name: string;
  title: string;
  icon: string;
  group: string;
  enabled: boolean;
  beta?: boolean;
  comingSoon?: boolean;
  shortcut?: string;
  description?: string;
  requiresAuth?: boolean;
  desktopOnly?: boolean;
}

export const ROUTES: RouteConfig[] = [
  // Core Navigation
  {
    id: "dashboard",
    path: "/",
    name: "dashboard",
    title: "Dashboard",
    icon: "LayoutDashboard",
    group: "core",
    enabled: true,
    description: "Main dashboard with overview and quick actions",
    shortcut: "Ctrl+D",
  },
  {
    id: "file-browser",
    path: "/file-browser",
    name: "file-browser",
    title: "File Browser",
    icon: "FolderOpen",
    group: "core",
    enabled: true,
    description: "Browse and explore your file system",
    shortcut: "Ctrl+B",
  },
  {
    id: "scan",
    path: "/scan",
    name: "scan",
    title: "Scan",
    icon: "Scan",
    group: "core",
    enabled: true,
    description: "Scan directories for analysis",
    shortcut: "Ctrl+S",
  },
  {
    id: "scan-history",
    path: "/scan-history",
    name: "scan-history",
    title: "Scan History",
    icon: "Clock",
    group: "core",
    enabled: true,
    description: "View previous scan results",
  },

  // Analysis Tools
  {
    id: "largest",
    path: "/largest",
    name: "largest",
    title: "Largest Files",
    icon: "BarChart3",
    group: "analysis",
    enabled: true,
    description: "Find the largest files in your system",
  },
  {
    id: "old",
    path: "/old",
    name: "old",
    title: "Old Files",
    icon: "Clock",
    group: "analysis",
    enabled: true,
    description: "Find old and unused files",
  },
  {
    id: "duplicates",
    path: "/duplicates",
    name: "duplicates",
    title: "Duplicates",
    icon: "Copy",
    group: "analysis",
    enabled: true,
    description: "Find duplicate files",
    shortcut: "Ctrl+U",
  },
  {
    id: "empty",
    path: "/empty",
    name: "empty",
    title: "Empty Folders",
    icon: "FolderOpen",
    group: "analysis",
    enabled: true,
    description: "Find empty folders",
  },

  // AI & Smart Features
  {
    id: "organize",
    path: "/organize",
    name: "organize",
    title: "AI Organize",
    icon: "Brain",
    group: "ai",
    enabled: true,
    beta: true,
    description: "AI-powered file organization",
    shortcut: "Ctrl+O",
  },
  {
    id: "cleanup",
    path: "/cleanup",
    name: "cleanup",
    title: "Cleanup",
    icon: "Sparkles",
    group: "ai",
    enabled: true,
    description: "Smart cleanup recommendations",
  },
  {
    id: "search",
    path: "/search",
    name: "search",
    title: "Smart Search",
    icon: "Search",
    group: "ai",
    enabled: true,
    description: "Semantic file search",
    shortcut: "Ctrl+F",
  },
  {
    id: "insights",
    path: "/insights",
    name: "insights",
    title: "Insights",
    icon: "Lightbulb",
    group: "ai",
    enabled: true,
    description: "AI-powered insights and recommendations",
  },

  // Visualization
  {
    id: "treemap",
    path: "/treemap",
    name: "treemap",
    title: "Treemap",
    icon: "LayoutGrid",
    group: "visualization",
    enabled: true,
    description: "Interactive treemap visualization",
  },
  {
    id: "timeline",
    path: "/timeline",
    name: "timeline",
    title: "Timeline",
    icon: "Clock",
    group: "visualization",
    enabled: true,
    description: "File activity timeline",
  },
  {
    id: "network",
    path: "/network",
    name: "network",
    title: "Network",
    icon: "Share2",
    group: "visualization",
    enabled: true,
    beta: true,
    description: "File relationship network",
  },

  // Reports & Exports
  {
    id: "reports",
    path: "/reports",
    name: "reports",
    title: "Reports",
    icon: "FileText",
    group: "reports",
    enabled: true,
    description: "Generate and view reports",
    shortcut: "Ctrl+R",
  },
  {
    id: "export",
    path: "/export",
    name: "export",
    title: "Export",
    icon: "Download",
    group: "reports",
    enabled: true,
    description: "Export analysis data",
  },
  {
    id: "trends",
    path: "/trends",
    name: "trends",
    title: "Trends",
    icon: "TrendingUp",
    group: "reports",
    enabled: true,
    description: "Storage usage trends",
  },

  // Advanced Features
  {
    id: "complexity",
    path: "/complexity",
    name: "complexity",
    title: "Code Complexity",
    icon: "Code2",
    group: "advanced",
    enabled: true,
    description: "Code complexity analysis",
  },
  {
    id: "self-learning",
    path: "/self-learning",
    name: "self-learning",
    title: "Self-Learning",
    icon: "Database",
    group: "advanced",
    enabled: true,
    beta: true,
    description: "Machine learning models",
  },
  {
    id: "learning-analytics",
    path: "/learning-analytics",
    name: "learning-analytics",
    title: "Learning Analytics",
    icon: "BarChart",
    group: "advanced",
    enabled: true,
    beta: true,
    description: "Learning model analytics",
  },
  {
    id: "ab-testing",
    path: "/ab-testing",
    name: "ab-testing",
    title: "A/B Testing",
    icon: "TestTube",
    group: "advanced",
    enabled: true,
    beta: true,
    description: "A/B testing framework",
  },
  {
    id: "3d-browser",
    path: "/3d-browser",
    name: "3d-browser",
    title: "3D Browser",
    icon: "Globe",
    group: "advanced",
    enabled: true,
    beta: true,
    description: "3D file browser visualization",
  },

  // System & Settings
  {
    id: "system",
    path: "/system",
    name: "system",
    title: "System Monitor",
    icon: "Activity",
    group: "system",
    enabled: true,
    description: "System resource monitoring",
  },
  {
    id: "settings",
    path: "/settings",
    name: "settings",
    title: "Settings",
    icon: "Settings",
    group: "system",
    enabled: true,
    description: "Application settings",
    shortcut: "Ctrl+,",
  },
  {
    id: "error-logs",
    path: "/admin/errors",
    name: "error-logs",
    title: "Error Logs",
    icon: "AlertTriangle",
    group: "system",
    enabled: true,
    description: "View application error logs",
    requiresAuth: true,
  },
];

// Helper functions for route management
export const getRoutesByGroup = (group: string): RouteConfig[] => {
  return ROUTES.filter((route) => route.group === group && route.enabled);
};

export const getRouteById = (id: string): RouteConfig | undefined => {
  return ROUTES.find((route) => route.id === id);
};

export const getRouteByPath = (path: string): RouteConfig | undefined => {
  return ROUTES.find((route) => route.path === path);
};

export const getEnabledRoutes = (): RouteConfig[] => {
  return ROUTES.filter((route) => route.enabled);
};

export const getBetaRoutes = (): RouteConfig[] => {
  return ROUTES.filter((route) => route.beta && route.enabled);
};

export const getComingSoonRoutes = (): RouteConfig[] => {
  return ROUTES.filter((route) => route.comingSoon);
};

// Group definitions for navigation
export const ROUTE_GROUPS = {
  core: "Core",
  analysis: "Analysis Tools",
  ai: "AI & Smart Features",
  visualization: "Visualization",
  reports: "Reports & Exports",
  advanced: "Advanced Features",
  system: "System & Settings",
} as const;

export type RouteGroup = keyof typeof ROUTE_GROUPS;

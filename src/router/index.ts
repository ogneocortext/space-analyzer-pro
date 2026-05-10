import { createRouter, createWebHashHistory } from "vue-router";

// Lazy load all route components for faster initial load
const DashboardView = () => import("../features/dashboard/DashboardView.vue");
const ScanView = () => import("../features/scanning/ScanView.vue");
const SettingsView = () => import("../features/settings/SettingsView.vue");
const DuplicateFinderView = () => import("../features/duplicates/DuplicateFinderView.vue");

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: DashboardView,
      meta: { preload: true }, // Preload dashboard as it's the landing page
    },
    {
      path: "/scan",
      name: "scan",
      component: ScanView,
      meta: { preload: true }, // Preload scan as it's a core feature
    },
    {
      path: "/scan-history",
      name: "scan-history",
      component: () => import("../features/scanning/ScanHistoryView.vue"),
    },
    {
      path: "/browser",
      name: "browser",
      redirect: "/file-browser",
    },
    {
      path: "/file-browser",
      name: "file-browser",
      component: () => import("../features/browser/FileBrowserView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
    },
    {
      path: "/settings/notifications",
      name: "notification-settings",
      component: () => import("../features/settings/NotificationSettingsView.vue"),
    },
    {
      path: "/duplicates",
      name: "duplicates",
      component: DuplicateFinderView,
    },
    {
      path: "/cleanup",
      name: "cleanup",
      component: () => import("../features/cleanup/CleanupRecommendationsView.vue"),
    },
    {
      path: "/export",
      name: "export",
      component: () => import("../features/export/ExportView.vue"),
    },
    {
      path: "/optimization",
      name: "optimization",
      component: () => import("../features/optimization/OptimizationView.vue"),
    },
    {
      path: "/automation",
      name: "automation",
      component: () => import("../features/automation/AutomationView.vue"),
    },
    {
      path: "/trends",
      name: "trends",
      component: () => import("../features/trends/TrendsView.vue"),
    },
    {
      path: "/search",
      name: "search",
      component: () => import("../features/search/SemanticSearchView.vue"),
    },
    {
      path: "/treemap",
      name: "treemap",
      component: () => import("../features/treemap/TreemapView.vue"),
    },
    {
      path: "/insights",
      name: "insights",
      component: () => import("../features/insights/InsightsView.vue"),
    },
    {
      path: "/network",
      name: "network",
      component: () => import("../features/network/NetworkView.vue"),
    },
    {
      path: "/system",
      name: "system",
      component: () => import("../features/system/SystemMonitorView.vue"),
    },
    {
      path: "/timeline",
      name: "timeline",
      component: () => import("../features/timeline/TimelineView.vue"),
    },
    {
      path: "/largest",
      name: "largest",
      component: () => import("../features/largest/LargestFilesView.vue"),
    },
    {
      path: "/empty",
      name: "empty",
      component: () => import("../features/empty/EmptyFoldersView.vue"),
    },
    {
      path: "/old",
      name: "old",
      component: () => import("../features/old/OldFilesView.vue"),
    },
    {
      path: "/organize",
      name: "organize",
      component: () => import("../features/organize/AutoOrganizeView.vue"),
    },
    {
      path: "/reports",
      name: "reports",
      component: () => import("../features/reports/ReportsView.vue"),
    },
    {
      path: "/complexity",
      name: "complexity",
      component: () => import("../features/complexity/ComplexityView.vue"),
    },
    // Advanced Self-Learning Features
    {
      path: "/self-learning",
      name: "self-learning",
      component: () => import("../features/self-learning/SelfLearningView.vue"),
    },
    {
      path: "/learning-analytics",
      name: "learning-analytics",
      component: () => import("../features/self-learning/LearningAnalyticsView.vue"),
    },
    {
      path: "/ab-testing",
      name: "ab-testing",
      component: () => import("../features/self-learning/ABTestingView.vue"),
    },
    {
      path: "/3d-browser",
      name: "3d-browser",
      component: () => import("../features/3d/FileSystem3DView.vue"),
    },
    // Admin/Debug Routes
    {
      path: "/admin/errors",
      name: "error-logs",
      component: () => import("../views/admin/ErrorLogView.vue"),
    },
  ],
});

// Performance optimizations
router.beforeEach((to, from) => {
  // Mark navigation start
  if (typeof performance !== "undefined") {
    performance.mark(`navigation-start-${to.name}`);
  }
  // Return undefined to continue navigation (Vue Router v4+ style)
  return;
});

router.afterEach((to) => {
  // Mark navigation end and measure
  if (typeof performance !== "undefined") {
    performance.mark(`navigation-end-${to.name}`);
    performance.measure(
      `navigation-${to.name}`,
      `navigation-start-${to.name}`,
      `navigation-end-${to.name}`
    );
  }
});

export default router;

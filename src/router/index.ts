import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../features/dashboard/DashboardView.vue";
import ScanView from "../features/scanning/ScanView.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: DashboardView,
    },
    {
      path: "/scan",
      name: "scan",
      component: ScanView,
    },
    {
      path: "/scan-history",
      name: "scan-history",
      component: () => import("../features/scanning/ScanHistoryView.vue"),
    },
    {
      path: "/browser",
      name: "browser",
      component: () => import("../features/browser/FileBrowserView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("../features/settings/SettingsView.vue"),
    },
    {
      path: "/settings/notifications",
      name: "notification-settings",
      component: () => import("../features/settings/NotificationSettingsView.vue"),
    },
    {
      path: "/duplicates",
      name: "duplicates",
      component: () => import("../features/duplicates/DuplicateFinderView.vue"),
    },
    {
      path: "/cleanup",
      name: "cleanup",
      component: () => import("../features/cleanup/CleanupRecommendationsView.vue"),
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

export default router;

import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "../features/dashboard/DashboardView.vue";
import ScanView from "../features/scanning/ScanView.vue";

const router = createRouter({
  history: createWebHistory(),
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
  ],
});

export default router;

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
  ],
});

export default router;

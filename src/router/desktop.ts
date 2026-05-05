import { createRouter, createWebHistory } from 'vue-router'
import DesktopLayout from '@/components/vue/desktop/DesktopLayout.vue'
import DesktopAppShell from '@/layout/DesktopAppShell.vue'

// Desktop-specific imports
import DesktopAnalysisPanel from '@/components/vue/desktop/DesktopAnalysisPanel.vue'
import DesktopFileBrowser from '@/components/vue/desktop/DesktopFileBrowser.vue'

// Regular imports (shared with web)
import Dashboard from '@/components/vue/Dashboard.vue'
import ScanView from '@/components/vue/Scan.vue'
import ReportsView from '@/components/vue/Reports.vue'
import SettingsView from '@/components/vue/Settings.vue'

const desktopRoutes = [
  {
    path: '/',
    name: 'DesktopDashboard',
    component: Dashboard,
    meta: {
      title: 'Dashboard - Space Analyzer Pro',
      requiresDesktop: true,
      icon: 'LayoutDashboard'
    }
  },
  {
    path: '/browser',
    name: 'DesktopFileBrowser',
    component: DesktopFileBrowser,
    meta: {
      title: 'File Browser - Space Analyzer Pro',
      requiresDesktop: true,
      icon: 'FolderOpen'
    }
  },
  {
    path: '/scan',
    name: 'DesktopScan',
    component: DesktopAnalysisPanel,
    meta: {
      title: 'Scan - Space Analyzer Pro',
      requiresDesktop: true,
      icon: 'Scan'
    }
  },
  {
    path: '/reports',
    name: 'DesktopReports',
    component: ReportsView,
    meta: {
      title: 'Reports - Space Analyzer Pro',
      requiresDesktop: true,
      icon: 'FileText'
    }
  },
  {
    path: '/settings',
    name: 'DesktopSettings',
    component: SettingsView,
    meta: {
      title: 'Settings - Space Analyzer Pro',
      requiresDesktop: true,
      icon: 'Settings'
    }
  },
  // Desktop-specific routes
  {
    path: '/desktop',
    name: 'DesktopHome',
    redirect: '/'
  },
  {
    path: '/desktop/analysis',
    name: 'DesktopAnalysis',
    component: DesktopAnalysisPanel,
    meta: {
      title: 'Desktop Analysis - Space Analyzer Pro',
      requiresDesktop: true
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: DesktopAppShell,
      children: desktopRoutes
    }
  ]
})

// Navigation guard for desktop routes
router.beforeEach((to, from, next) => {
  // Check if route requires desktop mode
  if (to.meta?.requiresDesktop) {
    // In a real implementation, you might check if running in Tauri
    // For now, we'll allow access to all routes
  }
  
  // Update document title
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
  
  next()
})

export default router

// Helper function to get desktop navigation items
export function getDesktopNavigation() {
  return desktopRoutes.map(route => ({
    name: route.name?.toString().replace('Desktop', '') || 'Unknown',
    path: route.path,
    icon: route.meta?.icon as string || 'LayoutDashboard'
  }))
}

// Helper function to check if route is desktop-specific
export function isDesktopRoute(path: string): boolean {
  return desktopRoutes.some(route => route.path === path)
}

import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '../components/vue/layout/LandingPage.vue'
import DashboardView from '../components/vue/dashboard/DashboardView.vue'
import BrowserView from '../components/vue/browser/BrowserView.vue'
import VisualizationView from '../components/vue/visualization/VisualizationView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/browser',
      name: 'browser',
      component: BrowserView
    },
    {
      path: '/visualization',
      name: 'visualization',
      component: VisualizationView
    }
  ]
})

export default router

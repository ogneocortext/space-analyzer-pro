import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../components/layout/LandingPage.vue')
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../components/dashboard/DashboardView.vue')
    }
  ]
})

export default router

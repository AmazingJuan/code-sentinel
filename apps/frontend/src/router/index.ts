// apps/frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

import DefaultLayout from '@/layouts/DefaultLayout.vue'
import FindingDetailView from '@/views/FindingDetailView.vue'
import FindingsView from '@/views/FindingsView.vue'
import LoginView from '@/views/LoginView.vue'
import OverviewView from '@/views/OverviewView.vue'
import ScanDetailView from '@/views/ScanDetailView.vue'
import ScansView from '@/views/ScansView.vue'
import { AuthService } from '@/services/AuthService'
import UsersView from '@/views/UsersView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'login', component: LoginView, meta: { title: 'Login' } },
    {
      path: '/',
      component: DefaultLayout,
      children: [
        {
          path: 'overview',
          name: 'overview',
          component: OverviewView,
          meta: { title: 'Security Overview', breadcrumb: 'overview' },
        },
        {
          path: 'scan',
          name: 'scan.index',
          component: ScansView,
          meta: { title: 'Recent Scans', breadcrumb: 'scan-reports' },
        },
        {
          path: 'scan/:id',
          name: 'scan.show',
          component: ScanDetailView,
          meta: { title: 'Scan Detail', breadcrumb: 'scan-reports/detail' },
        },
        {
          path: 'finding',
          name: 'finding.index',
          component: FindingsView,
          meta: { title: 'Findings', breadcrumb: 'findings' },
        },
        {
          path: 'finding/:id',
          name: 'finding.show',
          component: FindingDetailView,
          meta: { title: 'Finding Detail', breadcrumb: 'findings/detail' },
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { title: 'User Management', breadcrumb: 'users', adminOnly: true },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const isAuthenticated = Boolean(AuthService.getToken())

  if (to.name !== 'login' && !isAuthenticated) {
    return { name: 'login' }
  }

  if (to.name === 'login' && isAuthenticated) {
    return { name: 'overview' }
  }

  if (to.meta.adminOnly && AuthService.getUser()?.role !== 'admin') {
    return { name: 'overview' }
  }
})

export default router
// apps/frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

import type { AuthUser } from '@/interfaces/AuthInterface'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import FindingDetailView from '@/views/FindingDetailView.vue'
import FindingsView from '@/views/FindingsView.vue'
import LoginView from '@/views/LoginView.vue'
import OverviewView from '@/views/OverviewView.vue'
import ProjectAccessView from '@/views/ProjectAccessView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'
import ProjectsView from '@/views/ProjectsView.vue'
import ScanDetailView from '@/views/ScanDetailView.vue'
import ScansView from '@/views/ScansView.vue'
import { AuthService } from '@/services/AuthService'
import UsersView from '@/views/UsersView.vue'

type Role = AuthUser['role']

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    breadcrumb?: string
    /** RF-032: roles allowed to open the route. Omitted = any authenticated user. */
    roles?: Role[]
  }
}

const ANALYST_ONLY: Role[] = ['analyst']
const ADMIN_ONLY: Role[] = ['admin']

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
          meta: { title: 'Security Overview', breadcrumb: 'overview', roles: ANALYST_ONLY },
        },
        {
          path: 'projects',
          name: 'project.index',
          component: ProjectsView,
          meta: { title: 'Projects', breadcrumb: 'projects', roles: ANALYST_ONLY },
        },
        {
          path: 'projects/:id',
          name: 'project.show',
          component: ProjectDetailView,
          meta: { title: 'Project Configuration', breadcrumb: 'projects/detail', roles: ANALYST_ONLY },
        },
        {
          path: 'scan',
          name: 'scan.index',
          component: ScansView,
          meta: { title: 'Recent Scans', breadcrumb: 'scan-reports', roles: ANALYST_ONLY },
        },
        {
          path: 'scan/:id',
          name: 'scan.show',
          component: ScanDetailView,
          meta: { title: 'Scan Detail', breadcrumb: 'scan-reports/detail', roles: ANALYST_ONLY },
        },
        {
          path: 'finding',
          name: 'finding.index',
          component: FindingsView,
          meta: { title: 'Findings', breadcrumb: 'findings', roles: ANALYST_ONLY },
        },
        {
          path: 'finding/:id',
          name: 'finding.show',
          component: FindingDetailView,
          meta: { title: 'Finding Detail', breadcrumb: 'findings/detail', roles: ANALYST_ONLY },
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { title: 'User Management', breadcrumb: 'users', roles: ADMIN_ONLY },
        },
        {
          path: 'project-access',
          name: 'project-access.index',
          component: ProjectAccessView,
          meta: { title: 'Project Access', breadcrumb: 'project-access', roles: ADMIN_ONLY },
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
    return { name: AuthService.getHomeRouteName() }
  }

  // RF-032: a role that is not allowed on the route goes back to its own home.
  // The backend also answers 403; this only keeps the UI consistent.
  const allowedRoles = to.meta.roles
  if (!allowedRoles) return

  const role = AuthService.getUser()?.role
  if (!role) {
    // Token without a user: inconsistent session. Clearing it avoids a
    // redirect loop between login and the home page.
    AuthService.logout()
    return { name: 'login' }
  }
  if (!allowedRoles.includes(role)) {
    return { name: AuthService.getHomeRouteName() }
  }
})

export default router
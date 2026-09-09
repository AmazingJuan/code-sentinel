// apps/frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import ScansView from '@/views/ScansView.vue'
import ScanDetailView from '@/views/ScanDetailView.vue'
import FindingsView from '@/views/FindingsView.vue'
import FindingDetailView from '@/views/FindingDetailView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'login', component: LoginView, meta: { title: 'Login' } },
    { path: '/scan', name: 'scan.index', component: ScansView, meta: { title: 'Recent Scans' } },
    { path: '/scan/:id', name: 'scan.show', component: ScanDetailView, meta: { title: 'Scan Detail' } },
    { path: '/finding', name: 'finding.index', component: FindingsView, meta: { title: 'Findings' } },
    { path: '/finding/:id', name: 'finding.show', component: FindingDetailView, meta: { title: 'Finding Detail' } },
  ],
})

export default router
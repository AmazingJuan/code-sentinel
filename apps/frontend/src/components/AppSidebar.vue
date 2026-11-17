<!-- apps/frontend/src/components/AppSidebar.vue -->
<script setup lang="ts">
import {
  FileText,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  Settings,
  ShieldAlert,
  Terminal,
  UserRound,
  Wrench,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import type { AuthUser } from '@/interfaces/AuthInterface'
import { AuthService } from '@/services/AuthService'

const route = useRoute()

const emit = defineEmits<{ navigate: [] }>()

interface NavItem {
  label: string
  icon: typeof LayoutGrid
  routeName: string | null // null = route does not exist yet (another module)
  roles: AuthUser['role'][] // RF-032: who sees the item
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutGrid, routeName: 'overview', roles: ['analyst'] },
  { label: 'Projects', icon: FolderKanban, routeName: 'project.index', roles: ['analyst'] },
  { label: 'Scan Reports', icon: FileText, routeName: 'scan.index', roles: ['analyst'] },
  { label: 'Findings', icon: ShieldAlert, routeName: 'finding.index', roles: ['analyst'] },
  { label: 'Users', icon: UserRound, routeName: 'users', roles: ['admin'] },
  { label: 'Project Access', icon: KeyRound, routeName: 'project-access.index', roles: ['admin'] },
  { label: 'Security Tools', icon: Wrench, routeName: null, roles: ['analyst'] },
  { label: 'Settings', icon: Settings, routeName: null, roles: ['analyst'] },
]

const visibleNavItems = computed<NavItem[]>(() => {
  const role = AuthService.getUser()?.role
  return role ? navItems.filter((item) => item.roles.includes(role)) : []
})

function isActive(routeName: string): boolean {
  return route.name === routeName || route.matched.some((match) => match.name === routeName)
}
</script>

<template>
  <aside class="flex h-screen w-60 flex-col justify-between border-r border-sidebar-border bg-sidebar">
    <div>
      <div class="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div class="flex size-7 items-center justify-center rounded bg-primary/15 ring-1 ring-primary/30">
          <Terminal class="size-4 text-primary" />
        </div>
        <div class="flex flex-col leading-none">
          <span class="font-mono text-sm font-semibold tracking-tight text-sidebar-foreground">
            code<span class="text-primary">sentinel</span>
          </span>
          <span class="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            v1.0.0
          </span>
        </div>
      </div>

      <nav aria-label="Main Navigation" class="flex flex-1 flex-col gap-0.5 p-2">
        <p class="px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Navigation
        </p>
        <template v-for="item in visibleNavItems" :key="item.label">
          <RouterLink
            v-if="item.routeName"
            :to="{ name: item.routeName }"
            class="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
            :class="
              isActive(item.routeName)
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            "
            @click="emit('navigate')"
          >
            <component
              :is="item.icon"
              class="size-4 transition-colors"
              :class="isActive(item.routeName) ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'"
            />
            {{ item.label }}
            <span
              v-if="isActive(item.routeName)"
              class="ml-auto h-4 w-0.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          </RouterLink>

          <span
            v-else
            class="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/40"
            title="Coming soon"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </span>
        </template>
      </nav>
    </div>

    <div class="border-t border-sidebar-border p-3">
      <div class="flex items-center justify-between px-2 text-xs text-muted-foreground">
        <span class="font-mono text-[11px]">v1.0.0</span>
        <span class="inline-flex items-center gap-1.5 font-mono text-[11px]">
          <span class="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          online
        </span>
      </div>
    </div>
  </aside>
</template>

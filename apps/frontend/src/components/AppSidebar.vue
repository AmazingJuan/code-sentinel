<!-- apps/frontend/src/components/AppSidebar.vue -->
<script setup lang="ts">
import { FileText, FolderKanban, LayoutGrid, Settings, ShieldAlert, Terminal, UserRound, Wrench } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { AuthService } from '@/services/AuthService'

const route = useRoute()

const emit = defineEmits<{ navigate: [] }>()

interface NavItem {
  label: string
  icon: typeof LayoutGrid
  routeName: string | null // null = route does not exist yet (another module)
}

const navItems: NavItem[] = [
  { label: 'Overview', icon: LayoutGrid, routeName: 'overview' },
  { label: 'Projects', icon: FolderKanban, routeName: 'project.index' },
  { label: 'Scan Reports', icon: FileText, routeName: 'scan.index' },
  { label: 'Findings', icon: ShieldAlert, routeName: 'finding.index' },
  { label: 'Users', icon: UserRound, routeName: 'users' },
  { label: 'Security Tools', icon: Wrench, routeName: null },
  { label: 'Settings', icon: Settings, routeName: null },
]

function isActive(routeName: string): boolean {
  return route.name === routeName || route.matched.some((match) => match.name === routeName)
}
</script>

<template>
  <aside class="flex h-screen w-60 flex-col justify-between border-r border-gray-800 bg-[#0B0E14] px-4 py-5">
    <div>
      <div class="mb-8 flex items-center gap-2.5 px-1">
        <div class="flex size-8 items-center justify-center rounded-md bg-green-500/15 ring-1 ring-green-500/30">
          <Terminal class="size-4 text-green-400" />
        </div>
        <div class="leading-none">
          <span class="font-mono text-sm font-semibold text-white">
            code<span class="text-green-400">sentinel</span>
          </span>
          <p class="mt-0.5 text-[10px] text-gray-500">v1.0.0</p>
        </div>
      </div>

      <p class="mb-2 px-2 text-[10px] font-medium tracking-wider text-gray-500">NAVIGATION</p>
      <nav class="flex flex-col gap-0.5">
        <template v-for="item in navItems.filter((item) => item.routeName !== 'users' || AuthService.getUser()?.role === 'admin')" :key="item.label">
          <RouterLink
            v-if="item.routeName"
            :to="{ name: item.routeName }"
            class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors"
            :class="isActive(item.routeName) ? 'bg-gray-800/70 text-white' : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'"
            @click="emit('navigate')"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </RouterLink>

          <span
            v-else
            class="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-gray-600"
            title="Coming soon"
          >
            <component :is="item.icon" class="size-4" />
            {{ item.label }}
          </span>
        </template>
      </nav>
    </div>

    <div class="rounded-md border border-gray-800 bg-gray-900/50 p-3 font-mono text-xs">
      <p class="text-green-400">$ codesentinel scan</p>
      <p class="mt-1 text-gray-500">Run scans from the CLI. This console is the reporting layer.</p>
    </div>
  </aside>
</template>
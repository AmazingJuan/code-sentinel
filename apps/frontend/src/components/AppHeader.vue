<!-- apps/frontend/src/components/AppHeader.vue -->
<script setup lang="ts">
import { LogOut, Menu, Terminal } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '@/services/AuthService'

const emit = defineEmits<{ menu: [] }>()

const route = useRoute()
const router = useRouter()
const user = AuthService.getUser()
const initials = user?.name
  .split(' ')
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase() ?? 'U'

function handleLogout(): void {
  AuthService.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-800 bg-[#0B0E14]/90 px-4 backdrop-blur-sm sm:px-6">
    <button
      class="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 lg:hidden"
      aria-label="Open navigation"
      @click="emit('menu')"
    >
      <Menu class="size-5" />
    </button>

    <div class="flex items-center gap-2 font-mono text-sm text-gray-400">
      <Terminal class="size-4 text-green-400 lg:hidden" />
      <span>~/</span>
      <span class="text-gray-200">{{ String(route.meta.breadcrumb ?? route.name ?? '') }}</span>
    </div>

    <div class="ml-auto flex items-center gap-2 sm:gap-4">
      <span class="hidden items-center gap-1.5 rounded border border-gray-800 bg-gray-900/50 px-2 py-1 font-mono text-xs text-gray-500 sm:flex">
        <span class="size-1.5 rounded-full bg-green-400" aria-hidden="true" />
        engine online
      </span>
      <div class="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/40 px-2 py-1">
        <div class="flex size-6 items-center justify-center rounded-full bg-green-500/15 font-mono text-xs font-medium text-green-300">
          {{ initials }}
        </div>
        <div class="hidden leading-none sm:block">
          <p class="text-xs font-medium text-white">{{ user?.name }}</p>
          <p class="mt-0.5 text-[10px] text-gray-500">{{ user?.email }}</p>
        </div>
      </div>

      <button
        class="flex items-center gap-1.5 rounded-md border border-gray-800 px-2.5 py-1.5 text-xs text-gray-400 hover:border-red-900 hover:bg-red-950/30 hover:text-red-300"
        @click="handleLogout"
      >
        <LogOut class="size-3.5" />
        <span class="hidden sm:inline">Logout</span>
      </button>
    </div>
  </header>
</template>
<!-- apps/frontend/src/components/AppHeader.vue -->
<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '@/services/AuthService'

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
  <header class="flex h-14 items-center justify-between border-b border-gray-800 bg-[#0B0E14] px-6">
    <div class="flex items-center gap-2 font-mono text-sm text-gray-400">
      <span>~/</span>
      <span class="text-gray-200">{{ String(route.meta.breadcrumb ?? route.name ?? '') }}</span>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 rounded-md border border-gray-800 px-2 py-1">
        <div class="flex size-7 items-center justify-center rounded bg-green-900/40 text-xs font-semibold text-green-300">
          {{ initials }}
        </div>
        <div class="leading-none">
          <p class="text-xs font-medium text-white">{{ user?.name }}</p>
          <p class="mt-0.5 text-[10px] text-gray-500">{{ user?.email }}</p>
        </div>
      </div>

      <button
        class="flex items-center gap-1.5 rounded-md border border-gray-800 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200"
        @click="handleLogout"
      >
        <LogOut class="size-3.5" />
        Logout
      </button>
    </div>
  </header>
</template>
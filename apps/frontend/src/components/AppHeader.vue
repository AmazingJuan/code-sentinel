<!-- apps/frontend/src/components/AppHeader.vue -->
<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

// Datos mockeados — el módulo de autenticación real no es responsabilidad de este módulo.
const mockUser = {
  initials: 'AS',
  name: 'Alex Stone',
  role: 'security analyst',
}

const mockEngineStatus: 'online' | 'offline' = 'online'

const route = useRoute()
</script>

<template>
  <header class="flex h-14 items-center justify-between border-b border-gray-800 bg-[#0B0E14] px-6">
    <div class="flex items-center gap-2 font-mono text-sm text-gray-400">
      <span>~/</span>
      <span class="text-gray-200">{{ String(route.meta.breadcrumb ?? route.name ?? '') }}</span>
    </div>

    <div class="flex items-center gap-4">
      <span
        class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
        :class="mockEngineStatus === 'online'
          ? 'border-green-800 bg-green-900/30 text-green-300'
          : 'border-red-800 bg-red-900/30 text-red-300'"
      >
        <span class="size-1.5 rounded-full" :class="mockEngineStatus === 'online' ? 'bg-green-400' : 'bg-red-400'" />
        engine {{ mockEngineStatus }}
      </span>

      <div class="flex items-center gap-2 rounded-md border border-gray-800 px-2 py-1">
        <div class="flex size-7 items-center justify-center rounded bg-green-900/40 text-xs font-semibold text-green-300">
          {{ mockUser.initials }}
        </div>
        <div class="leading-none">
          <p class="text-xs font-medium text-white">{{ mockUser.name }}</p>
          <p class="mt-0.5 text-[10px] text-gray-500">{{ mockUser.role }}</p>
        </div>
      </div>

      <button class="flex items-center gap-1.5 rounded-md border border-gray-800 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200">
        <LogOut class="size-3.5" />
        Logout
      </button>
    </div>
  </header>
</template>
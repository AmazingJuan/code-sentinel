<script setup lang="ts">
import { LogOut, Menu, Terminal } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { AuthUser } from '@/interfaces/AuthInterface'
import { AuthService } from '@/services/AuthService'

const emit = defineEmits<{ menu: [] }>()

const route = useRoute()
const router = useRouter()
const user = computed<AuthUser | null>(() => AuthService.getUser())
const initials = computed<string>(
  () =>
    user.value?.name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U',
)

async function handleLogout(): Promise<void> {
  AuthService.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm sm:px-6">
    <button
      type="button"
      class="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
      aria-label="Open navigation"
      @click="emit('menu')"
    >
      <Menu class="size-5" />
    </button>

    <div class="flex items-center gap-2 font-mono text-sm text-muted-foreground">
      <Terminal class="size-4 text-primary lg:hidden" />
      <span>~/</span>
      <span class="text-foreground">{{ String(route.meta.breadcrumb ?? route.name ?? '') }}</span>
    </div>

    <div class="ml-auto flex items-center gap-2 sm:gap-4">
      <div class="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
        <div class="flex size-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-medium text-primary">
          {{ initials }}
        </div>
        <div class="hidden leading-none sm:block">
          <p class="text-xs font-medium text-foreground">{{ user?.name }}</p>
          <p class="mt-0.5 text-[10px] text-muted-foreground">{{ user?.email }}</p>
        </div>
      </div>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        aria-label="Log out"
        @click="handleLogout"
      >
        <LogOut class="size-3.5" />
        <span class="hidden sm:inline">Logout</span>
      </button>
    </div>
  </header>
</template>

<!-- apps/frontend/src/layouts/DefaultLayout.vue -->
<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'

const route = useRoute()
const mobileOpen = ref(false)

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})
</script>

<template>
  <div class="min-h-screen bg-[#0B0E14] text-gray-200">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-gray-800 lg:block">
      <AppSidebar />
    </aside>

    <div v-if="mobileOpen" class="fixed inset-0 z-50 lg:hidden">
      <button
        class="absolute inset-0 cursor-default bg-black/60"
        aria-label="Close navigation"
        @click="mobileOpen = false"
      />
      <aside class="relative h-full w-64 border-r border-gray-800 bg-[#0B0E14]">
        <button
          class="absolute right-2 top-3 rounded p-1 text-gray-400 hover:text-gray-200"
          aria-label="Close navigation"
          @click="mobileOpen = false"
        >
          <X class="size-4" />
        </button>
        <AppSidebar @navigate="mobileOpen = false" />
      </aside>
    </div>

    <div class="flex min-w-0 flex-1 flex-col lg:pl-60">
      <AppHeader @menu="mobileOpen = true" />
      <main class="flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-6xl">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
<!-- apps/frontend/src/components/StatusBadge.vue -->
<script setup lang="ts">
import type { ScanStatus } from '@/interfaces/ScanInterface'

defineProps<{ status: ScanStatus }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
    :class="status === 'completed' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="status === 'completed' ? 'bg-green-400' : 'bg-red-400'" />
    {{ status === 'completed' ? 'Completed' : 'Failed' }}
  </span>
</template>
<!-- apps/frontend/src/components/StatusBadge.vue -->
<script setup lang="ts">
import type { ScanStatus } from '@/interfaces/ScanInterface'

defineProps<{ status: ScanStatus }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
    :class="status === 'completed'
      ? 'border-green-800 bg-green-900/30 text-green-300'
      : 'border-red-800 bg-red-900/30 text-red-300'"
  >
    <span class="size-1.5 rounded-full" :class="status === 'completed' ? 'bg-green-400' : 'bg-red-400'" />
    {{ status === 'completed' ? 'Completed' : 'Failed' }}
  </span>
</template>
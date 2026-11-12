<!-- apps/frontend/src/components/StatusBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'

import { SCAN_STATUS_LABELS } from '@/interfaces/ScanInterface'
import type { ScanStatus } from '@/interfaces/ScanInterface'

const props = defineProps<{ status: ScanStatus }>()

interface BadgeStyle {
  badge: string
  dot: string
}

// RF-006: one visual style per lifecycle state.
const STYLES: Record<ScanStatus, BadgeStyle> = {
  pending: { badge: 'border-gray-700 bg-gray-800/40 text-gray-300', dot: 'bg-gray-400' },
  running: {
    badge: 'border-blue-800 bg-blue-900/30 text-blue-300',
    dot: 'bg-blue-400 animate-pulse',
  },
  completed: { badge: 'border-green-800 bg-green-900/30 text-green-300', dot: 'bg-green-400' },
  failed: { badge: 'border-red-800 bg-red-900/30 text-red-300', dot: 'bg-red-400' },
}

const style = computed<BadgeStyle>(() => STYLES[props.status])
const label = computed<string>(() => SCAN_STATUS_LABELS[props.status])
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
    :class="style.badge"
  >
    <span class="size-1.5 rounded-full" :class="style.dot" />
    {{ label }}
  </span>
</template>

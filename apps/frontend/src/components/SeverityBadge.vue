<!-- apps/frontend/src/components/SeverityBadge.vue -->
<script setup lang="ts">
import type { FindingSeverity } from '@/interfaces/FindingInterface'

defineProps<{ severity: FindingSeverity }>()

const colorMap: Record<FindingSeverity, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
}
</script>

<template>
  <span class="font-mono text-xs font-semibold uppercase" :class="colorMap[severity]">{{ severity }}</span>
</template>
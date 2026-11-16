<!-- apps/frontend/src/components/SeverityBadge.vue -->
<script setup lang="ts">
import type { FindingSeverity } from '@/interfaces/FindingInterface'

defineProps<{ severity: FindingSeverity | null }>()

const styles: Record<FindingSeverity, string> = {
  critical: 'bg-critical/15 text-critical border-critical/30',
  high: 'bg-high/15 text-high border-high/30',
  medium: 'bg-medium/15 text-medium border-medium/30',
  low: 'bg-low/15 text-low border-low/30',
}

const dotStyles: Record<FindingSeverity, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider"
    :class="severity ? styles[severity] : 'border-border bg-muted/40 text-muted-foreground'"
  >
    <span
      class="size-1.5 rounded-full"
      :class="severity ? dotStyles[severity] : 'bg-muted-foreground'"
      aria-hidden="true"
    />
    {{ severity ?? 'unclassified' }}
  </span>
</template>

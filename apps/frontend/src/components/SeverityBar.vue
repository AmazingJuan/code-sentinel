<script setup lang="ts">
import { computed } from 'vue'

import type { SeverityCounts } from '@/interfaces/SeverityCountsInterface'

interface Segment {
  key: keyof SeverityCounts
  label: string
  value: number
  colorClass: string
}

const props = withDefaults(
  defineProps<{
    counts: SeverityCounts
    showLegend?: boolean
  }>(),
  {
    showLegend: false,
  },
)

const total = computed<number>(() => {
  const sum =
    props.counts.critical + props.counts.high + props.counts.medium + props.counts.low
  return sum || 1
})

const segments = computed<Segment[]>(() => [
  { key: 'critical', label: 'Critical', value: props.counts.critical, colorClass: 'bg-critical' },
  { key: 'high', label: 'High', value: props.counts.high, colorClass: 'bg-high' },
  { key: 'medium', label: 'Medium', value: props.counts.medium, colorClass: 'bg-medium' },
  { key: 'low', label: 'Low', value: props.counts.low, colorClass: 'bg-low' },
])
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <template v-for="segment in segments" :key="segment.key">
        <div
          v-if="segment.value > 0"
          :class="segment.colorClass"
          :style="{ width: `${(segment.value / total) * 100}%` }"
          role="img"
          :aria-label="`${segment.label}: ${segment.value}`"
        />
      </template>
    </div>

    <div v-if="showLegend" class="flex flex-wrap gap-x-4 gap-y-1">
      <div
        v-for="segment in segments"
        :key="segment.key"
        class="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span class="size-2 rounded-sm" :class="segment.colorClass" aria-hidden="true" />
        <span class="capitalize">{{ segment.label }}</span>
        <span class="font-mono text-foreground">{{ segment.value }}</span>
      </div>
    </div>
  </div>
</template>


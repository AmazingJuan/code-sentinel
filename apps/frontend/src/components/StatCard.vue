<!-- apps/frontend/src/components/StatCard.vue -->
<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    icon: Component
    hint?: string
    tone?: 'default' | 'critical' | 'high' | 'primary'
  }>(),
  {
    hint: undefined,
    tone: 'default',
  },
)

const toneRing = computed(() => {
  const map: Record<string, string> = {
    default: 'text-muted-foreground bg-muted',
    primary: 'text-primary bg-primary/10',
    critical: 'text-critical bg-critical/10',
    high: 'text-high bg-high/10',
  }
  return map[props.tone] ?? map.default
})

const valueTone = computed(() => {
  const map: Record<string, string> = {
    default: 'text-foreground',
    primary: 'text-foreground',
    critical: 'text-critical',
    high: 'text-high',
  }
  return map[props.tone] ?? map.default
})
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4 transition-colors">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {{ label }}
      </span>
      <span class="flex size-7 items-center justify-center rounded" :class="toneRing">
        <component :is="icon" class="size-4" />
      </span>
    </div>
    <div class="mt-3 flex items-baseline gap-2">
      <span class="font-mono text-2xl font-semibold tabular-nums" :class="valueTone">
        {{ value }}
      </span>
      <span v-if="hint" class="text-xs text-muted-foreground">{{ hint }}</span>
    </div>
  </div>
</template>


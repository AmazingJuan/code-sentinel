<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    compact?: boolean
  }>(),
  {
    title: 'Loading data...',
    description: undefined,
    compact: false,
  },
)
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/40 text-center"
    :class="compact ? 'p-6' : 'min-h-[220px] p-10'"
  >
    <div class="relative flex items-center justify-center">
      <div class="absolute size-9 rounded-full bg-primary/20 blur-sm animate-pulse" />
      <Loader2 class="size-7 text-primary animate-spin" />
    </div>

    <h3
      class="mt-4 font-mono text-sm font-semibold tracking-tight text-foreground"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      {{ title }}
    </h3>

    <p
      v-if="description"
      class="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed"
    >
      {{ description }}
    </p>

    <div
      v-if="!compact"
      class="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider"
    >
      <span class="inline-block size-1.5 rounded-full bg-primary animate-ping" />
      <span>fetching telemetry</span>
    </div>
  </div>
</template>


<script setup lang="ts">
import { AlertTriangle, RotateCcw } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title?: string
    message: string
    retry?: boolean
    compact?: boolean
    actionLabel?: string
  }>(),
  {
    title: 'An error occurred',
    retry: true,
    compact: false,
    actionLabel: 'Try again',
  },
)

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-center transition-colors"
    :class="compact ? 'p-5' : 'min-h-[220px] p-8'"
    role="alert"
  >
    <div class="relative flex items-center justify-center">
      <div class="absolute size-9 rounded-full bg-destructive/20 blur-sm" />
      <div class="flex size-10 items-center justify-center rounded-full border border-destructive/40 bg-destructive/15">
        <AlertTriangle class="size-5 text-destructive" />
      </div>
    </div>

    <h3
      class="mt-3.5 font-mono text-sm font-semibold tracking-tight text-foreground"
      :class="compact ? 'text-xs' : 'text-sm'"
    >
      {{ title }}
    </h3>

    <p
      class="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed break-words"
    >
      {{ message }}
    </p>

    <div v-if="retry" class="mt-4 flex items-center gap-2">
      <button
        type="button"
        @click="emit('retry')"
        class="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-1.5 font-mono text-xs font-medium text-destructive transition-colors hover:bg-destructive/25 focus:outline-none focus:ring-1 focus:ring-destructive"
      >
        <RotateCcw class="size-3.5" />
        <span>{{ actionLabel }}</span>
      </button>

      <slot name="extra-actions" />
    </div>
  </div>
</template>


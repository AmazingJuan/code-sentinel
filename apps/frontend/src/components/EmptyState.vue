<!-- apps/frontend/src/components/EmptyState.vue -->
<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    icon?: Component
    title?: string
    description?: string
    actionLabel?: string
    compact?: boolean
  }>(),
  {
    icon: () => Inbox,
    title: 'No items found',
    description: undefined,
    actionLabel: undefined,
    compact: false,
  },
)

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/30 text-center"
    :class="compact ? 'p-6' : 'min-h-[200px] p-8'"
  >
    <div class="flex size-10 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground/70">
      <component :is="icon" class="size-5" />
    </div>

    <h3
      class="mt-3 font-mono text-sm font-semibold tracking-tight text-foreground"
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

    <div v-if="actionLabel" class="mt-4">
      <button
        type="button"
        @click="emit('action')"
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <span>{{ actionLabel }}</span>
      </button>
    </div>
    <slot name="extra" />
  </div>
</template>


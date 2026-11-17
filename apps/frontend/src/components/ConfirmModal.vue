<!-- apps/frontend/src/components/ConfirmModal.vue -->
<script setup lang="ts">
import { AlertTriangle, X } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    isDanger?: boolean
    isLoading?: boolean
  }>(),
  {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDanger: true,
    isLoading: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl transition-all"
    >
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex size-9 items-center justify-center rounded-lg border"
            :class="isDanger ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'"
          >
            <AlertTriangle class="size-4" />
          </div>
          <h3 class="font-mono text-base font-semibold text-foreground">
            {{ title }}
          </h3>
        </div>
        <button
          type="button"
          @click="emit('cancel')"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close dialog"
        >
          <X class="size-4" />
        </button>
      </div>

      <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
        {{ message }}
      </p>

      <div class="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          @click="emit('cancel')"
          :disabled="isLoading"
          class="rounded-md border border-border bg-muted/30 px-3.5 py-1.5 font-mono text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {{ cancelText }}
        </button>

        <button
          type="button"
          @click="emit('confirm')"
          :disabled="isLoading"
          class="rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors disabled:opacity-50"
          :class="isDanger ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'"
        >
          <span v-if="isLoading">Processing...</span>
          <span v-else>{{ confirmText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>


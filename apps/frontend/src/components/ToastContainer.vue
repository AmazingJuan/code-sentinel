<!-- apps/frontend/src/components/ToastContainer.vue -->
<script setup lang="ts">
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useToastStore, type ToastType } from '@/stores/toastStore'

const toastStore = useToastStore()

function getIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return CheckCircle2
    case 'error':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    case 'info':
    default:
      return Info
  }
}

function getClasses(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'border-primary/40 bg-card/95 text-foreground shadow-lg shadow-primary/5'
    case 'error':
      return 'border-destructive/50 bg-card/95 text-foreground shadow-lg shadow-destructive/10'
    case 'warning':
      return 'border-medium/50 bg-card/95 text-foreground shadow-lg shadow-medium/10'
    case 'info':
    default:
      return 'border-border bg-card/95 text-foreground shadow-lg'
  }
}

function getIconColor(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'text-primary'
    case 'error':
      return 'text-destructive'
    case 'warning':
      return 'text-medium'
    case 'info':
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <div
    aria-live="polite"
    aria-atomic="true"
    class="pointer-events-none fixed right-0 top-0 z-50 flex max-h-screen w-full max-w-sm flex-col gap-2 p-4 sm:p-6"
  >
    <TransitionGroup
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-4"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        class="pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3.5 backdrop-blur-md transition-all"
        :class="getClasses(toast.type)"
        role="alert"
      >
        <component
          :is="getIcon(toast.type)"
          class="mt-0.5 size-4 shrink-0"
          :class="getIconColor(toast.type)"
        />

        <div class="flex-1 min-w-0">
          <p class="font-mono text-xs font-semibold tracking-tight text-foreground">
            {{ toast.title }}
          </p>
          <p
            v-if="toast.message"
            class="mt-0.5 text-xs text-muted-foreground leading-relaxed break-words"
          >
            {{ toast.message }}
          </p>
        </div>

        <button
          type="button"
          @click="toastStore.remove(toast.id)"
          class="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X class="size-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>


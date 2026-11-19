import { defineStore, getActivePinia } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])

  function show(toast: Omit<ToastItem, 'id'>): string {
    const id = Math.random().toString(36).slice(2, 9)
    const duration = toast.duration ?? 4500
    const item: ToastItem = { ...toast, id, duration }

    toasts.value.push(item)

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }

    return id
  }

  function success(title: string, message?: string): string {
    return show({ type: 'success', title, message })
  }

  function error(title: string, message?: string): string {
    return show({ type: 'error', title, message, duration: 6000 })
  }

  function warning(title: string, message?: string): string {
    return show({ type: 'warning', title, message })
  }

  function info(title: string, message?: string): string {
    return show({ type: 'info', title, message })
  }

  function remove(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function clear(): void {
    toasts.value = []
  }

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    remove,
    clear,
  }
})

type ToastStore = Pick<
  ReturnType<typeof useToastStore>,
  'show' | 'success' | 'error' | 'warning' | 'info' | 'remove' | 'clear'
>

/** Returns a no-op store when no Pinia instance is active (e.g. isolated component tests). */
export function getToastStore(): ToastStore {
  try {
    if (getActivePinia()) {
      return useToastStore()
    }
  } catch {
    // Fall through to the no-op store.
  }

  return {
    show: () => '',
    success: () => '',
    error: () => '',
    warning: () => '',
    info: () => '',
    remove: () => {},
    clear: () => {},
  }
}

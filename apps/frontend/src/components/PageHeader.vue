<!-- apps/frontend/src/components/PageHeader.vue -->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  breadcrumb?: string
}>()
</script>

<template>
  <div class="mb-6">
    <div v-if="breadcrumb" class="mb-2 font-mono text-xs text-muted-foreground">
      {{ breadcrumb }}
    </div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-1 max-w-2xl text-sm text-muted-foreground">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

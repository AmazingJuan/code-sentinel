<!-- apps/frontend/src/components/ScanFilterBar.vue -->
<script setup lang="ts">
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'
import { SCAN_STATUS_LABELS, SCAN_STATUSES } from '@/interfaces/ScanInterface'
import type { ScanStatus } from '@/interfaces/ScanInterface'

withDefaults(
  defineProps<{
    projects?: { id: string; name: string }[]
  }>(),
  {
    projects: () => [],
  },
)

const filters = defineModel<ScanFiltersInterface>({ required: true })
defineEmits<{ (e: 'apply'): void }>()

// RF-006: the four states, in lifecycle order.
const statusOptions = SCAN_STATUSES.map(
  (status: ScanStatus): { value: ScanStatus; label: string } => ({
    value: status,
    label: SCAN_STATUS_LABELS[status],
  }),
)

const selectClass =
  'h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground'
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
    <div>
      <label :class="labelClass">PROJECT</label>
      <select v-model="filters.projectId" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">All projects</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>
    <div>
      <label :class="labelClass">DATE</label>
      <select :class="selectClass">
        <option>All time</option>
      </select>
    </div>
    <div>
      <label :class="labelClass">STATUS</label>
      <select v-model="filters.status" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">Any status</option>
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>
    <div>
      <label :class="labelClass">SEVERITY</label>
      <select v-model="filters.severity" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">Any severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  </div>
</template>

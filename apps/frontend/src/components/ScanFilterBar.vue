<script setup lang="ts">
import { ref, watch } from 'vue'

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
const emit = defineEmits<{ apply: [] }>()

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_PRESETS: { value: string; label: string; days: number | null }[] = [
  { value: 'all', label: 'All time', days: null },
  { value: '1', label: 'Last 24 hours', days: 1 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
]

const datePreset = ref<string>('all')

// Keep the preset in sync when the parent resets the filters.
watch(
  () => filters.value.dateFrom,
  (dateFrom: string | undefined): void => {
    if (!dateFrom) datePreset.value = 'all'
  },
)

function applyDatePreset(): void {
  const days = DATE_PRESETS.find((preset) => preset.value === datePreset.value)?.days ?? null
  if (days === null) {
    filters.value = { ...filters.value, dateFrom: undefined, dateTo: undefined }
  } else {
    // The API only applies the date range when both bounds are present.
    const now = new Date()
    filters.value = {
      ...filters.value,
      dateFrom: new Date(now.getTime() - days * DAY_MS).toISOString(),
      dateTo: now.toISOString(),
    }
  }
  emit('apply')
}

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
      <label for="scan-filter-project" :class="labelClass">PROJECT</label>
      <select id="scan-filter-project" v-model="filters.projectId" :class="selectClass" @change="emit('apply')">
        <option :value="undefined">All projects</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>
    <div>
      <label for="scan-filter-date" :class="labelClass">DATE</label>
      <select
        id="scan-filter-date"
        v-model="datePreset"
        :class="selectClass"
        @change="applyDatePreset"
      >
        <option v-for="preset in DATE_PRESETS" :key="preset.value" :value="preset.value">
          {{ preset.label }}
        </option>
      </select>
    </div>
    <div>
      <label for="scan-filter-status" :class="labelClass">STATUS</label>
      <select id="scan-filter-status" v-model="filters.status" :class="selectClass" @change="emit('apply')">
        <option :value="undefined">Any status</option>
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>
    <div>
      <label for="scan-filter-severity" :class="labelClass">SEVERITY</label>
      <select id="scan-filter-severity" v-model="filters.severity" :class="selectClass" @change="emit('apply')">
        <option :value="undefined">Any severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  </div>
</template>

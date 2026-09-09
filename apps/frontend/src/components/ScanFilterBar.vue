<!-- apps/frontend/src/components/ScanFilterBar.vue -->
<script setup lang="ts">
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'

const filters = defineModel<ScanFiltersInterface>({ required: true })
defineEmits<{ (e: 'apply'): void }>()

const selectClass =
  'h-9 w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 text-sm text-gray-200 outline-none focus:border-green-600'
const labelClass = 'mb-1.5 block text-[11px] tracking-wide text-gray-500'
</script>

<template>
  <div class="grid grid-cols-4 gap-4">
    <div>
      <label :class="labelClass">PROJECT</label>
      <select v-model="filters.projectId" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">All projects</option>
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
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
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
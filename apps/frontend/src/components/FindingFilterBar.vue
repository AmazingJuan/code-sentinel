<!-- apps/frontend/src/components/FindingFilterBar.vue -->
<script setup lang="ts">
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'

const filters = defineModel<FindingFiltersInterface>({ required: true })
defineEmits<{ (e: 'apply'): void }>()

const selectClass =
  'h-9 w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 text-sm text-gray-200 outline-none focus:border-green-600'
const labelClass = 'mb-1.5 block text-[11px] tracking-wide text-gray-500'
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
    <div>
      <label :class="labelClass">TOOL</label>
      <select v-model="filters.sourceTool" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">Any tool</option>
        <option value="SAST">SAST</option>
        <option value="Secret Scanner">Secret Scanner</option>
        <option value="Port Scanner">Port Scanner</option>
      </select>
    </div>
    <div>
      <label :class="labelClass">TYPE</label>
      <input
        v-model="filters.type"
        placeholder="e.g. SQL Injection"
        :class="selectClass"
        @change="$emit('apply')"
      />
    </div>
  </div>
</template>
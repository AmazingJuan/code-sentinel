<!-- apps/frontend/src/components/ScanFilterBar.vue -->
<script setup lang="ts">
import type { ScanFiltersInterface } from '@/interfaces/ScanInterface'

const filters = defineModel<ScanFiltersInterface>({ required: true })

defineEmits<{ (e: 'apply'): void }>()
</script>

<template>
  <div class="flex flex-wrap gap-4">
    <div>
      <label class="block text-xs text-gray-400">PROJECT</label>
      <input v-model="filters.projectId" placeholder="All projects" class="bg-gray-800 rounded px-2 py-1" />
    </div>
    <div>
      <label class="block text-xs text-gray-400">STATUS</label>
      <select v-model="filters.status" class="bg-gray-800 rounded px-2 py-1">
        <option :value="undefined">Any status</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
    </div>
    <div>
      <label class="block text-xs text-gray-400">SEVERITY</label>
      <select v-model="filters.severity" class="bg-gray-800 rounded px-2 py-1">
        <option :value="undefined">Any severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
    <button class="self-end rounded bg-blue-600 px-3 py-1" @click="$emit('apply')">Filter</button>
  </div>
</template>
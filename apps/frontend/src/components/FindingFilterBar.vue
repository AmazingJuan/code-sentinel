<!-- apps/frontend/src/components/FindingFilterBar.vue -->
<script setup lang="ts">
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'

const filters = defineModel<FindingFiltersInterface>({ required: true })
defineEmits<{ (e: 'apply'): void }>()

const selectClass =
  'h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'
const labelClass = 'mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground'
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div>
      <label for="filter-severity" :class="labelClass">SEVERITY</label>
      <select id="filter-severity" v-model="filters.severity" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">Any severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
    <div>
      <label for="filter-tool" :class="labelClass">TOOL</label>
      <select id="filter-tool" v-model="filters.sourceTool" :class="selectClass" @change="$emit('apply')">
        <option :value="undefined">Any tool</option>
        <option value="SAST">SAST</option>
        <option value="Secret Scanner">Secret Scanner</option>
        <option value="Port Scanner">Port Scanner</option>
        <option value="Semgrep">Semgrep</option>
        <option value="Gitleaks">Gitleaks</option>
        <option value="CodeSentinel">CodeSentinel</option>
      </select>
    </div>
    <div>
      <label for="filter-type" :class="labelClass">TYPE</label>
      <input
        id="filter-type"
        v-model="filters.type"
        placeholder="e.g. SQL Injection"
        :class="selectClass"
        @change="$emit('apply')"
      />
    </div>
  </div>
</template>

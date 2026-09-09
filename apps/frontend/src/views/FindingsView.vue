<!-- apps/frontend/src/views/FindingsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { FindingService } from '@/services/FindingService'
import type { FindingFiltersInterface, FindingInterface } from '@/interfaces/FindingInterface'
import SeverityBadge from '@/components/SeverityBadge.vue'

const findings = ref<FindingInterface[]>([])
const filters = ref<FindingFiltersInterface>({})

async function loadFindings(): Promise<void> {
  findings.value = await FindingService.getFindings(filters.value)
}

onMounted(loadFindings)
</script>

<template>
  <div class="p-6">
    <div class="flex gap-4">
      <select v-model="filters.severity" class="bg-gray-800 rounded px-2 py-1" @change="loadFindings">
        <option :value="undefined">Any severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select v-model="filters.sourceTool" class="bg-gray-800 rounded px-2 py-1" @change="loadFindings">
        <option :value="undefined">Any tool</option>
        <option value="SAST">SAST</option>
        <option value="Secret Scanner">Secret Scanner</option>
        <option value="Port Scanner">Port Scanner</option>
      </select>
    </div>

    <table class="mt-4 w-full text-left">
      <thead class="text-xs text-gray-400">
        <tr>
          <th>TYPE</th>
          <th>SEVERITY</th>
          <th>LOCATION</th>
          <th>TOOL</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="finding in findings" :key="finding.id" class="border-t border-gray-800">
          <td>
            <RouterLink :to="{ name: 'finding.show', params: { id: finding.id } }" class="text-green-400">
              {{ finding.type }}
            </RouterLink>
          </td>
          <td><SeverityBadge :severity="finding.severity" /></td>
          <td>{{ finding.filePath ? `${finding.filePath}:${finding.line}` : '—' }}</td>
          <td>{{ finding.sourceTool }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
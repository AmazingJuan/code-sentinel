<!-- apps/frontend/src/views/FindingsView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import FindingFilterBar from '@/components/FindingFilterBar.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { FindingService } from '@/services/FindingService'

const findings = ref<FindingInterface[]>([])
const filters = ref<FindingFiltersInterface>({})
const errorMessage = ref<string | null>(null)

async function loadFindings(): Promise<void> {
  errorMessage.value = null
  try {
    findings.value = await FindingService.getFindings(filters.value)
  } catch {
    errorMessage.value = 'We could not load the findings.'
  }
}

onMounted(loadFindings)
</script>

<template>
  <div class="p-8">
    <p class="font-mono text-xs text-gray-500">~/ findings</p>
    <h1 class="mt-1 text-2xl font-semibold text-white">Findings</h1>
    <p class="mt-1 text-sm text-gray-400">Security findings normalized across all scans and tools.</p>

    <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900/30 p-5">
      <FindingFilterBar v-model="filters" @apply="loadFindings" />
    </div>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>

    <div class="mt-4 overflow-hidden rounded-lg border border-gray-800">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-900/50 text-[11px] text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">TYPE</th>
            <th class="px-4 py-3 font-medium">SEVERITY</th>
            <th class="px-4 py-3 font-medium">LOCATION</th>
            <th class="px-4 py-3 font-medium">TOOL</th>
          </tr>
        </thead>
        <tbody>
          <RouterLink
            v-for="finding in findings"
            :key="finding.id"
            :to="{ name: 'finding.show', params: { id: finding.id } }"
            custom
            v-slot="{ navigate }"
          >
            <tr class="cursor-pointer border-t border-gray-800 hover:bg-gray-900/40" @click="navigate">
              <td class="px-4 py-3 text-gray-200">{{ finding.type }}</td>
              <td class="px-4 py-3"><SeverityBadge :severity="finding.severity" /></td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500">
                {{ finding.filePath ? `${finding.filePath}:${finding.line}` : '—' }}
              </td>
              <td class="px-4 py-3">
                <span class="rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-300">
                  {{ finding.sourceTool }}
                </span>
              </td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
    </div>
  </div>
</template>
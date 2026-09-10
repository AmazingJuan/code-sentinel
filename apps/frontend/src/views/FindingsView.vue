<!-- apps/frontend/src/views/FindingsView.vue -->
<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
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
  <div class="p-5 sm:p-8">
    <div class="mb-6">
      <p class="mb-2 font-mono text-xs text-gray-500">~/ findings</p>
      <h1 class="text-xl font-semibold tracking-tight text-white md:text-2xl">Findings</h1>
      <p class="mt-1 max-w-2xl text-sm text-gray-400">Every vulnerability normalized from SAST, secret and port scans.</p>
    </div>

    <div class="mb-4 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
      <FindingFilterBar v-model="filters" @apply="loadFindings" />
    </div>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>

    <div class="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/40">
      <table class="w-full min-w-[760px] text-left text-sm">
        <thead class="text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Severity</th>
            <th class="px-4 py-3 font-medium">Finding Type</th>
            <th class="px-4 py-3 font-medium">File / Path</th>
            <th class="px-4 py-3 font-medium">Line</th>
            <th class="px-4 py-3 font-medium">Tool</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-2 py-3"></th>
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
            <tr class="group cursor-pointer border-t border-gray-800/60 transition-colors hover:bg-gray-800/40" @click="navigate">
              <td class="px-4 py-3"><SeverityBadge :severity="finding.severity" /></td>
              <td class="px-4 py-3"><span class="font-medium text-gray-200 hover:text-green-400">{{ finding.type }}</span></td>
              <td class="px-4 py-3 font-mono text-xs text-cyan-400">{{ finding.filePath ?? '—' }}</td>
              <td class="px-4 py-3 font-mono text-gray-500">{{ finding.line ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ finding.sourceTool }}</td>
              <td class="px-4 py-3"><span class="rounded border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">Open</span></td>
              <td class="px-2 py-3 text-gray-500"><ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" /></td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
      <p v-if="findings.length === 0" class="px-4 py-12 text-center text-sm text-gray-500">No findings match the selected filters.</p>
    </div>
  </div>
</template>
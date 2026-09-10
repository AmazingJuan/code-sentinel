<!-- apps/frontend/src/views/ScansView.vue -->
<script setup lang="ts">
import { ChevronRight, ListFilter } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import ScanFilterBar from '@/components/ScanFilterBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import { ScanService } from '@/services/ScanService'

const scans = ref<ScanInterface[]>([])
const filters = ref<ScanFiltersInterface>({})
const isLoading = ref<boolean>(false)
const errorMessage = ref<string | null>(null)

async function loadScans(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    scans.value = await ScanService.getScans(filters.value)
  } catch {
    errorMessage.value = 'We could not load the scans. Please try again in a few seconds.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadScans)

function severityClass(value: number, tone: 'critical' | 'high' | 'medium' | 'low'): string {
  if (value === 0) return 'text-gray-600'
  const map = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-blue-400' }
  return map[tone]
}
</script>

<template>
  <div class="p-5 sm:p-8">
    <div class="mb-6">
      <p class="mb-2 font-mono text-xs text-gray-500">~/ scan-reports</p>
      <h1 class="text-xl font-semibold tracking-tight text-white md:text-2xl">Scan Reports</h1>
      <p class="mt-1 max-w-2xl text-sm text-gray-400">Historical scans performed by Code Sentinel, normalized across all tools.</p>
    </div>

    <div class="mb-4 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
        <ListFilter class="size-4" />
        Filters
      </div>
      <ScanFilterBar v-model="filters" @apply="loadScans" />
    </div>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>
    <p v-else class="mb-2 font-mono text-xs text-gray-500">
      {{ isLoading ? 'Loading…' : `${scans.length} scan${scans.length === 1 ? '' : 's'}` }}
    </p>

    <div class="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/40">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead class="text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Scan</th>
            <th class="px-4 py-3 font-medium">Project</th>
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Tools</th>
            <th class="px-3 py-3 text-right font-medium">Crit</th>
            <th class="px-3 py-3 text-right font-medium">High</th>
            <th class="px-3 py-3 text-right font-medium">Med</th>
            <th class="px-3 py-3 text-right font-medium">Low</th>
            <th class="px-3 py-3 text-right font-medium">Total</th>
            <th class="px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <RouterLink
            v-for="scan in scans"
            :key="scan.id"
            :to="{ name: 'scan.show', params: { id: scan.id } }"
            custom
            v-slot="{ navigate }"
          >
            <tr class="group cursor-pointer border-t border-gray-800/60 transition-colors hover:bg-gray-800/40" @click="navigate">
              <td class="px-4 py-3"><span class="font-mono text-green-400 hover:underline">#{{ scan.scanNumber }}</span></td>
              <td class="px-4 py-3 font-mono text-gray-200">{{ scan.project.name }}</td>
              <td class="px-4 py-3 text-gray-400">
                {{ new Date(scan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </td>
              <td class="px-4 py-3"><StatusBadge :status="scan.status" /></td>
              <td class="px-4 py-3">
                <span
                  v-for="tool in scan.tools"
                  :key="tool"
                  class="mr-1 rounded border border-gray-700 bg-gray-800/60 px-1.5 py-0.5 font-mono text-[10px] text-gray-400"
                >
                  {{ tool }}
                </span>
              </td>
              <td class="px-3 py-3 text-right"><span class="font-mono tabular-nums" :class="severityClass(scan.criticalCount, 'critical')">{{ scan.criticalCount }}</span></td>
              <td class="px-3 py-3 text-right"><span class="font-mono tabular-nums" :class="severityClass(scan.highCount, 'high')">{{ scan.highCount }}</span></td>
              <td class="px-3 py-3 text-right"><span class="font-mono tabular-nums" :class="severityClass(scan.mediumCount, 'medium')">{{ scan.mediumCount }}</span></td>
              <td class="px-3 py-3 text-right"><span class="font-mono tabular-nums" :class="severityClass(scan.lowCount, 'low')">{{ scan.lowCount }}</span></td>
              <td class="px-3 py-3 text-right font-mono font-medium tabular-nums text-white">{{ scan.totalCount }}</td>
              <td class="px-2 py-3 text-gray-500"><ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" /></td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
      <p v-if="!isLoading && scans.length === 0" class="px-4 py-12 text-center text-sm text-gray-500">No scans match the selected filters.</p>
    </div>
  </div>
</template>
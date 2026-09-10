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
  <div class="p-8">
    <p class="font-mono text-xs text-gray-500">~/ scan-reports</p>
    <h1 class="mt-1 text-2xl font-semibold text-white">Scan Reports</h1>
    <p class="mt-1 text-sm text-gray-400">Historical scans performed by Code Sentinel, normalized across all tools.</p>

    <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900/30 p-5">
      <div class="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <ListFilter class="size-4" />
        Filters
      </div>
      <ScanFilterBar v-model="filters" @apply="loadScans" />
    </div>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>
    <p v-else class="mt-5 font-mono text-sm text-gray-500">
      {{ isLoading ? 'Loading…' : `${scans.length} scans` }}
    </p>

    <div class="mt-2 overflow-hidden rounded-lg border border-gray-800">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-900/50 text-[11px] text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">SCAN</th>
            <th class="px-4 py-3 font-medium">PROJECT</th>
            <th class="px-4 py-3 font-medium">DATE</th>
            <th class="px-4 py-3 font-medium">STATUS</th>
            <th class="px-4 py-3 font-medium">TOOLS</th>
            <th class="px-4 py-3 text-right font-medium">CRIT</th>
            <th class="px-4 py-3 text-right font-medium">HIGH</th>
            <th class="px-4 py-3 text-right font-medium">MED</th>
            <th class="px-4 py-3 text-right font-medium">LOW</th>
            <th class="px-4 py-3 text-right font-medium">TOTAL</th>
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
            <tr class="cursor-pointer border-t border-gray-800 hover:bg-gray-900/40" @click="navigate">
              <td class="px-4 py-3 font-mono text-green-400">#{{ scan.scanNumber }}</td>
              <td class="px-4 py-3 font-mono text-gray-200">{{ scan.project.name }}</td>
              <td class="px-4 py-3 text-gray-400">
                {{ new Date(scan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </td>
              <td class="px-4 py-3"><StatusBadge :status="scan.status" /></td>
              <td class="px-4 py-3">
                <span
                  v-for="tool in scan.tools"
                  :key="tool"
                  class="mr-1 rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-300"
                >
                  {{ tool }}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-mono font-semibold" :class="severityClass(scan.criticalCount, 'critical')">{{ scan.criticalCount }}</td>
              <td class="px-4 py-3 text-right font-mono font-semibold" :class="severityClass(scan.highCount, 'high')">{{ scan.highCount }}</td>
              <td class="px-4 py-3 text-right font-mono font-semibold" :class="severityClass(scan.mediumCount, 'medium')">{{ scan.mediumCount }}</td>
              <td class="px-4 py-3 text-right font-mono font-semibold" :class="severityClass(scan.lowCount, 'low')">{{ scan.lowCount }}</td>
              <td class="px-4 py-3 text-right font-mono font-semibold text-white">{{ scan.totalCount }}</td>
              <td class="px-2 py-3 text-gray-600"><ChevronRight class="size-4" /></td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
    </div>
  </div>
</template>
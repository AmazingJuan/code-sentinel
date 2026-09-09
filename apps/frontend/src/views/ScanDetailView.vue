<!-- apps/frontend/src/views/ScanDetailView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import SeverityBadge from '@/components/SeverityBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import { FindingService } from '@/services/FindingService'
import { ScanService } from '@/services/ScanService'

const route = useRoute()
const scan = ref<ScanInterface | null>(null)
const findings = ref<FindingInterface[]>([])
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const id = route.params.id as string
  try {
    scan.value = await ScanService.getScanById(id)
    findings.value = await FindingService.getFindings({ scanId: id })
  } catch {
    errorMessage.value = 'No pudimos cargar el detalle de este scan.'
  }
})
</script>

<template>
  <div class="p-8">
    <p v-if="errorMessage" class="rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>

    <template v-else-if="scan">
      <p class="font-mono text-xs text-gray-500">~/ scan-reports/{{ scan.scanNumber }}</p>
      <div class="mt-1 flex items-center gap-3">
        <h1 class="font-mono text-2xl font-semibold text-white">#{{ scan.scanNumber }}</h1>
        <StatusBadge :status="scan.status" />
      </div>
      <p class="mt-1 text-sm text-gray-400">{{ scan.project.name }} · {{ new Date(scan.date).toLocaleDateString() }}</p>

      <div class="mt-4 flex gap-2">
        <span
          v-for="tool in scan.tools"
          :key="tool"
          class="rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-300"
        >
          {{ tool }}
        </span>
      </div>

      <h2 class="mt-8 text-sm font-medium tracking-wide text-gray-400">FINDINGS</h2>
      <p v-if="findings.length === 0" class="mt-2 text-sm text-gray-500">No findings for this scan.</p>

      <div v-else class="mt-2 overflow-hidden rounded-lg border border-gray-800">
        <div
          v-for="finding in findings"
          :key="finding.id"
          class="flex items-center justify-between border-t border-gray-800 px-4 py-3 first:border-t-0"
        >
          <div>
            <p class="text-sm text-gray-200">{{ finding.type }}</p>
            <p v-if="finding.filePath" class="mt-0.5 font-mono text-xs text-gray-500">
              {{ finding.filePath }}:{{ finding.line }}
            </p>
          </div>
          <SeverityBadge :severity="finding.severity" />
        </div>
      </div>
    </template>
  </div>
</template>
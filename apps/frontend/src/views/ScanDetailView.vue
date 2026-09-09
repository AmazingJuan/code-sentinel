<!-- apps/frontend/src/views/ScanDetailView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ScanService } from '@/services/ScanService'
import { FindingService } from '@/services/FindingService'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import StatusBadge from '@/components/StatusBadge.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'

const route = useRoute()
const scan = ref<ScanInterface | null>(null)
const findings = ref<FindingInterface[]>([])

onMounted(async () => {
  const id = route.params.id as string
  scan.value = await ScanService.getScanById(id)
  findings.value = await FindingService.getFindings({ scanId: id })
})
</script>

<template>
  <div v-if="scan" class="p-6">
    <h1 class="text-xl font-bold">Scan #{{ scan.scanNumber }} — {{ scan.project.name }}</h1>
    <StatusBadge :status="scan.status" class="mt-2" />

    <h2 class="mt-6 font-semibold">Findings</h2>
    <p v-if="findings.length === 0" class="text-gray-400">No findings for this scan.</p>
    <ul>
      <li v-for="finding in findings" :key="finding.id" class="mt-2 border-b border-gray-800 pb-2">
        <SeverityBadge :severity="finding.severity" /> — {{ finding.type }}
        <span v-if="finding.filePath" class="text-gray-400">({{ finding.filePath }}:{{ finding.line }})</span>
      </li>
    </ul>
  </div>
</template>
<!-- apps/frontend/src/views/FindingDetailView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import SeverityBadge from '@/components/SeverityBadge.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { FindingService } from '@/services/FindingService'

const route = useRoute()
const finding = ref<FindingInterface | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    finding.value = await FindingService.getFindingById(route.params.id as string)
  } catch {
    errorMessage.value = 'We could not load this finding.'
  }
})
</script>

<template>
  <div class="p-8">
    <p v-if="errorMessage" class="rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>

    <template v-else-if="finding">
      <p class="font-mono text-xs text-gray-500">~/ findings/{{ finding.id }}</p>
      <div class="mt-1 flex items-center gap-3">
        <h1 class="text-2xl font-semibold text-white">{{ finding.type }}</h1>
        <SeverityBadge :severity="finding.severity" />
      </div>

      <p v-if="finding.filePath" class="mt-2 font-mono text-sm text-gray-500">
        {{ finding.filePath }}:{{ finding.line }}
      </p>

      <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900/30 p-5">
        <p class="text-sm font-medium text-gray-400">Description</p>
        <p class="mt-1 text-sm text-gray-200">{{ finding.description }}</p>
      </div>

      <div class="mt-4 rounded-lg border border-gray-800 bg-gray-900/30 p-5">
        <p class="text-sm font-medium text-gray-400">Recommendation</p>
        <p class="mt-1 text-sm text-gray-200">{{ finding.recommendation }}</p>
      </div>

      <span class="mt-4 inline-block rounded border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-300">
        {{ finding.sourceTool }}
      </span>
    </template>
  </div>
</template>
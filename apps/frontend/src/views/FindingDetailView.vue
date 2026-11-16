<!-- apps/frontend/src/views/FindingDetailView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import SeverityBadge from '@/components/SeverityBadge.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { FindingService } from '@/services/FindingService'

const route = useRoute()
const finding = ref<FindingInterface | null>(null)
const errorMessage = ref<string | null>(null)

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    return 'You do not have access to this finding.'
  }
  return 'We could not load this finding.'
}

onMounted(async () => {
  try {
    finding.value = await FindingService.getFindingById(route.params.id as string)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  }
})
</script>

<template>
  <div class="p-5 sm:p-8">
    <p v-if="errorMessage" class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <template v-else-if="finding">
      <div class="mb-6">
        <p class="mb-2 font-mono text-xs text-muted-foreground">~/ findings</p>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold text-foreground">{{ finding.type }}</h1>
          <SeverityBadge :severity="finding.severity" />
        </div>

        <p v-if="finding.filePath" class="mt-2 font-mono text-sm text-muted-foreground">
          {{ finding.filePath }}:{{ finding.line }}
        </p>
      </div>

      <div class="mt-6 rounded-lg border border-border bg-card p-5">
        <p class="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</p>
        <p class="mt-2 text-sm text-foreground leading-relaxed">{{ finding.description }}</p>
      </div>

      <div class="mt-4 rounded-lg border border-border bg-card p-5">
        <p class="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommendation</p>
        <p class="mt-2 text-sm text-foreground leading-relaxed">{{ finding.recommendation }}</p>
      </div>

      <span class="mt-4 inline-block rounded border border-border bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
        {{ finding.sourceTool }}
      </span>
    </template>
  </div>
</template>

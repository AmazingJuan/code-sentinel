<!-- apps/frontend/src/views/FindingDetailView.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FindingService } from '@/services/FindingService'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import SeverityBadge from '@/components/SeverityBadge.vue'

const route = useRoute()
const finding = ref<FindingInterface | null>(null)

onMounted(async () => {
  finding.value = await FindingService.getFindingById(route.params.id as string)
})
</script>

<template>
  <div v-if="finding" class="p-6">
    <h1 class="text-xl font-bold">{{ finding.type }}</h1>
    <SeverityBadge :severity="finding.severity" class="mt-2" />
    <p class="mt-4">{{ finding.description }}</p>
    <p v-if="finding.filePath" class="text-gray-400">{{ finding.filePath }}:{{ finding.line }}</p>
    <p class="mt-4 font-semibold">Recommendation</p>
    <p>{{ finding.recommendation }}</p>
  </div>
</template>
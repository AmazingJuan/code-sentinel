<!-- apps/frontend/src/views/FindingDetailView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { Info, Lightbulb } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
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

const meta = computed(() => {
  if (!finding.value) return []
  return [
    { label: 'Finding ID', value: finding.value.id, mono: true },
    { label: 'Type', value: finding.value.type, mono: false },
    { label: 'Tool', value: finding.value.sourceTool, mono: false },
    { label: 'File', value: finding.value.filePath ?? '-', mono: true },
    { label: 'Line', value: finding.value.line !== null ? String(finding.value.line) : '-', mono: true },
  ]
})
</script>

<template>
  <div class="p-5 sm:p-8">
    <p v-if="errorMessage" role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <template v-else-if="finding">
      <PageHeader
        :title="finding.type"
        :breadcrumb="`~/ findings / ${finding.id}`"
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <SeverityBadge :severity="finding.severity" />
            <span class="inline-flex items-center rounded border border-high/25 bg-high/10 px-2 py-0.5 text-xs font-medium text-high">
              Open
            </span>
          </div>
        </template>
      </PageHeader>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <!-- Metadata grid -->
          <div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <div
              v-for="m in meta"
              :key="m.label"
              class="bg-card p-3"
            >
              <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{{ m.label }}</p>
              <p class="mt-1 truncate text-sm" :class="m.mono ? 'font-mono text-term-cyan' : 'text-foreground font-medium'">
                {{ m.value }}
              </p>
            </div>
          </div>

          <!-- Description -->
          <div class="rounded-lg border border-border bg-card p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Info class="size-4 text-muted-foreground" />
              Description
            </div>
            <p class="text-sm leading-relaxed text-muted-foreground">{{ finding.description }}</p>
          </div>

          <!-- Recommendation -->
          <div class="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Lightbulb class="size-4 text-primary" />
              Recommendation
            </div>
            <p class="text-sm leading-relaxed text-foreground">{{ finding.recommendation }}</p>
          </div>

          <p v-if="finding.filePath" class="font-mono text-xs text-muted-foreground">
            {{ finding.filePath }}:{{ finding.line }}
          </p>
        </div>

        <!-- Terminal inspector sidebar -->
        <div class="lg:col-span-1">
          <TerminalWindow
            title="zsh - codesentinel"
            :lines="[
              [{ text: '$ ', tone: 'prompt' }, { text: `codesentinel findings`, tone: 'default' }],
              [],
              [{ text: `[${(finding.severity ?? 'unclassified').toUpperCase()}] ${finding.type}`, tone: (finding.severity as any) ?? 'dim' }],
              [{ text: `Tool: ${finding.sourceTool}`, tone: 'dim' }],
              [{ text: `File: ${finding.filePath ?? '-'}`, tone: 'cyan' }],
              [{ text: `Line: ${finding.line ?? '-'}`, tone: 'cyan' }],
              [],
              [{ text: 'Status: Open', tone: 'high' }],
            ]"
          />
        </div>
      </div>
    </template>
  </div>
</template>

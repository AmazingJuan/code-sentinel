<!-- apps/frontend/src/views/ScanDetailView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { Calendar, ChevronRight, FolderKanban, GitBranch, GitCommit, Hash } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import SeverityBar from '@/components/SeverityBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import { buildCommitUrl } from '@/services/GitHelper'
import { FindingService } from '@/services/FindingService'
import { ScanService } from '@/services/ScanService'

const route = useRoute()
const scan = ref<ScanInterface | null>(null)
const findings = ref<FindingInterface[]>([])
const errorMessage = ref<string | null>(null)

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    return 'You do not have access to this scan.'
  }
  return 'We could not load the details for this scan.'
}

onMounted(async () => {
  const id = route.params.id as string
  try {
    scan.value = await ScanService.getScanById(id)
    findings.value = await FindingService.getFindings({ scanId: id })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  }
})

const commitUrl = computed(() => {
  return buildCommitUrl(scan.value?.project?.repo, scan.value?.commitSha)
})

const counts = computed(() => ({
  critical: scan.value?.criticalCount ?? 0,
  high: scan.value?.highCount ?? 0,
  medium: scan.value?.mediumCount ?? 0,
  low: scan.value?.lowCount ?? 0,
}))

const summaryItems = computed(() => [
  { label: 'Critical', value: scan.value?.criticalCount ?? 0, tone: 'text-critical' },
  { label: 'High', value: scan.value?.highCount ?? 0, tone: 'text-high' },
  { label: 'Medium', value: scan.value?.mediumCount ?? 0, tone: 'text-medium' },
  { label: 'Low', value: scan.value?.lowCount ?? 0, tone: 'text-low' },
  { label: 'Total', value: scan.value?.totalCount ?? 0, tone: 'text-foreground' },
])
</script>

<template>
  <div class="p-5 sm:p-8">
    <p v-if="errorMessage" role="alert" class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>

    <template v-else-if="scan">
      <PageHeader
        :title="`Scan Report #${scan.scanNumber}`"
        :breadcrumb="`~/ scan-reports / #${scan.scanNumber}`"
      >
        <template #actions>
          <StatusBadge :status="scan.status" />
        </template>
      </PageHeader>

      <!-- Meta Strip -->
      <div class="mb-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div class="bg-card p-4">
          <p class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <FolderKanban class="size-3.5" />
            Project
          </p>
          <p class="mt-1.5 font-mono text-sm font-medium text-foreground">
            {{ scan.project.name }}
          </p>
        </div>
        <div class="bg-card p-4">
          <p class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Hash class="size-3.5" />
            Scan ID
          </p>
          <p class="mt-1.5 font-mono text-sm font-medium text-foreground">
            #{{ scan.scanNumber }}
          </p>
        </div>
        <div class="bg-card p-4">
          <p class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <GitCommit class="size-3.5" />
            Git Commit / Branch
          </p>
          <p class="mt-1.5 flex items-center gap-1.5 font-mono text-sm font-medium text-foreground">
            <a
              v-if="scan.commitSha && commitUrl"
              :href="commitUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-term-cyan hover:underline"
            >
              {{ scan.commitSha.slice(0, 7) }}
            </a>
            <span v-else-if="scan.commitSha" class="text-term-cyan">{{ scan.commitSha.slice(0, 7) }}</span>
            <span v-else class="text-muted-foreground">-</span>
            <template v-if="scan.branch">
              <GitBranch class="ml-1.5 size-3 text-muted-foreground" />
              <span class="text-xs text-muted-foreground">{{ scan.branch }}</span>
            </template>
          </p>
        </div>
        <div class="bg-card p-4">
          <p class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Calendar class="size-3.5" />
            Date
          </p>
          <p class="mt-1.5 text-sm font-medium text-foreground">
            {{ new Date(scan.date).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <!-- Tools Used -->
      <div class="mb-6 flex flex-wrap items-center gap-2">
        <span class="font-mono text-xs text-muted-foreground">Configured tools:</span>
        <span
          v-for="tool in scan.tools"
          :key="tool"
          class="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
        >
          {{ tool }}
        </span>
      </div>

      <p
        v-if="scan.status === 'failed' && scan.errorMessage"
        role="alert"
        class="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
      >
        {{ scan.errorMessage }}
      </p>

      <!-- Status + Distribution Summary -->
      <div class="mb-6 grid gap-4 lg:grid-cols-3">
        <div class="rounded-lg border border-border bg-card p-4">
          <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Distribution</p>
          <div class="mt-3">
            <SeverityBar :counts="counts" show-legend />
          </div>
        </div>

        <div class="grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-border bg-border lg:col-span-2">
          <div
            v-for="item in summaryItems"
            :key="item.label"
            class="bg-card p-4 text-center"
          >
            <p class="font-mono text-xl font-semibold tabular-nums" :class="item.tone">
              {{ item.value }}
            </p>
            <p class="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {{ item.label }}
            </p>
          </div>
        </div>
      </div>

      <!-- Findings Section -->
      <h2 class="mt-8 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">FINDINGS</h2>
      <p v-if="findings.length === 0" class="mt-2 text-sm text-muted-foreground">No findings for this scan.</p>

      <div v-else class="mt-2 overflow-hidden rounded-lg border border-border bg-card">
        <RouterLink
          v-for="finding in findings"
          :key="finding.id"
          :to="{ name: 'finding.show', params: { id: finding.id } }"
          class="group flex items-center justify-between border-b border-border/60 px-4 py-3.5 transition-colors last:border-0 hover:bg-accent/40 cursor-pointer"
        >
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {{ finding.type }}
              </p>
              <span
                v-if="finding.cwe"
                class="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {{ finding.cwe }}
              </span>
            </div>
            <p v-if="finding.filePath" class="font-mono text-xs text-term-cyan">
              {{ finding.filePath }}:{{ finding.line }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <SeverityBadge :severity="finding.severity" />
            <ChevronRight class="size-4 text-muted-foreground opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
        </RouterLink>
      </div>
    </template>
  </div>
</template>

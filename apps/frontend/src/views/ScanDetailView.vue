<!-- apps/frontend/src/views/ScanDetailView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { Calendar, ChevronLeft, ChevronRight, FolderKanban, GitBranch, GitCommit, Hash } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

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
const router = useRouter()
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

function goBack(): void {
  if (window.history.state && window.history.state.back) {
    router.back()
  } else if (scan.value?.projectId) {
    router.push({ name: 'project.show', params: { id: scan.value.projectId } })
  } else {
    router.push({ name: 'scan.index' })
  }
}

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
    <!-- Navigation toolbar with back button & interactive breadcrumbs -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        @click="goBack"
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <ChevronLeft class="size-4" />
        <span>Back</span>
      </button>

      <nav aria-label="Breadcrumb" class="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <RouterLink to="/overview" class="hover:text-foreground transition-colors">overview</RouterLink>
        <span>/</span>
        <RouterLink
          v-if="scan?.project"
          :to="`/projects/${scan.project.id || scan.projectId}`"
          class="hover:text-primary transition-colors text-foreground font-medium"
        >
          {{ scan.project.name }}
        </RouterLink>
        <RouterLink v-else to="/scan" class="hover:text-foreground transition-colors">
          scans
        </RouterLink>
        <span>/</span>
        <span class="text-primary font-semibold">#scan-{{ scan?.scanNumber }}</span>
      </nav>
    </div>

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
          <RouterLink
            v-if="scan.project?.id || scan.projectId"
            :to="`/projects/${scan.project?.id || scan.projectId}`"
            class="mt-1.5 block font-mono text-sm font-medium text-primary hover:underline truncate"
          >
            {{ scan.project.name }}
          </RouterLink>
          <p v-else class="mt-1.5 font-mono text-sm font-medium text-foreground truncate">
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
            <span v-else-if="scan.commitSha" class="text-term-cyan">
              {{ scan.commitSha.slice(0, 7) }}
            </span>
            <span v-else class="text-muted-foreground">-</span>

            <span v-if="scan.branch" class="flex items-center gap-1 text-muted-foreground">
              <GitBranch class="size-3" />
              {{ scan.branch }}
            </span>
          </p>
        </div>
        <div class="bg-card p-4">
          <p class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <Calendar class="size-3.5" />
            Date
          </p>
          <p class="mt-1.5 font-mono text-sm text-foreground">
            {{ new Date(scan.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </p>
        </div>
      </div>

      <!-- Failure banner if scan failed -->
      <p
        v-if="scan.status === 'failed' && scan.errorMessage"
        role="alert"
        class="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
      >
        {{ scan.errorMessage }}
      </p>

      <!-- Severity summary -->
      <div class="mb-6 rounded-lg border border-border bg-card p-5">
        <p class="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Vulnerability distribution
        </p>
        <SeverityBar :counts="counts" class="mb-4" />
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div
            v-for="item in summaryItems"
            :key="item.label"
            class="rounded-md border border-border/60 bg-muted/20 p-3 text-center"
          >
            <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{{ item.label }}</p>
            <p class="mt-1 font-mono text-2xl font-bold" :class="item.tone">{{ item.value }}</p>
          </div>
        </div>
      </div>

      <!-- Findings table -->
      <div class="rounded-lg border border-border bg-card">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-foreground">Findings</h2>
            <p class="font-mono text-xs text-muted-foreground">
              {{ findings.length }} security defect{{ findings.length === 1 ? '' : 's' }} reported in this scan
            </p>
          </div>
        </div>

        <div v-if="findings.length === 0" class="p-8 text-center text-sm text-muted-foreground">
          No findings for this scan.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" class="px-5 py-3 font-medium">Severity</th>
                <th scope="col" class="px-5 py-3 font-medium">Finding Type</th>
                <th scope="col" class="px-5 py-3 font-medium">Location</th>
                <th scope="col" class="px-5 py-3 font-medium">Tool</th>
                <th scope="col" class="px-3 py-3"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="finding in findings"
                :key="finding.id"
                class="group border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
              >
                <td class="px-5 py-3.5">
                  <SeverityBadge :severity="finding.severity" />
                </td>
                <td class="px-5 py-3.5">
                  <RouterLink
                    :to="{ name: 'finding.show', params: { id: finding.id } }"
                    class="font-medium text-foreground transition-colors group-hover:text-primary hover:underline"
                  >
                    {{ finding.type }}
                  </RouterLink>
                  <p v-if="finding.cwe" class="font-mono text-[11px] text-muted-foreground">
                    {{ finding.cwe }}
                  </p>
                </td>
                <td class="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                  <span v-if="finding.filePath">
                    {{ finding.filePath }}<span v-if="finding.line !== null">:{{ finding.line }}</span>
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                  {{ finding.sourceTool }}
                </td>
                <td class="px-3 py-3.5 text-right">
                  <RouterLink
                    :to="{ name: 'finding.show', params: { id: finding.id } }"
                    class="inline-flex items-center text-muted-foreground hover:text-foreground"
                    title="View finding detail"
                  >
                    <ChevronRight class="size-4" />
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

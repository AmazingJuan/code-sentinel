<!-- apps/frontend/src/views/ScansView.vue -->
<script setup lang="ts">
import { ChevronRight, ListFilter } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import ScanFilterBar from '@/components/ScanFilterBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import LoadingState from '@/components/LoadingState.vue'
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'
import { computeProjectSummariesFromScans } from '@/interfaces/ScanInterface'
import type { ProjectScanSummaryInterface, ScanInterface } from '@/interfaces/ScanInterface'
import { ScanService } from '@/services/ScanService'

const route = useRoute()
const scans = ref<ScanInterface[]>([])
const allKnownScans = ref<ScanInterface[]>([])
const filters = ref<ScanFiltersInterface>({
  projectId: typeof route.query.projectId === 'string' ? route.query.projectId : undefined,
})
const isLoading = ref<boolean>(false)
const errorMessage = ref<string | null>(null)

const projectOptions = computed<{ id: string; name: string }[]>(() => {
  const map = new Map<string, string>()
  for (const scan of [...allKnownScans.value, ...scans.value]) {
    if (scan.projectId && scan.project?.name) {
      map.set(scan.projectId, scan.project.name)
    }
  }
  return Array.from(map.entries())
    .map(([id, name]): { id: string; name: string } => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const selectedProjectSummary = computed<ProjectScanSummaryInterface | null>(() => {
  if (!filters.value.projectId) return null
  const summaries = computeProjectSummariesFromScans(
    allKnownScans.value.length > 0 ? allKnownScans.value : scans.value,
  )
  return (
    summaries.find(
      (summary) => summary.projectId === filters.value.projectId,
    ) ?? null
  )
})

async function loadScans(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    const loaded = await ScanService.getScans(filters.value)
    scans.value = loaded
    if (!filters.value.projectId && !filters.value.status && !filters.value.severity) {
      allKnownScans.value = loaded
    } else if (allKnownScans.value.length === 0) {
      allKnownScans.value = loaded
    }
  } catch {
    errorMessage.value = 'We could not load the scans. Please try again in a few seconds.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadScans)

function severityClass(value: number, tone: 'critical' | 'high' | 'medium' | 'low'): string {
  if (value === 0) return 'text-muted-foreground/40'
  const map = {
    critical: 'text-critical',
    high: 'text-high',
    medium: 'text-medium',
    low: 'text-low',
  }
  return map[tone]
}

/**
 * RF-028: compares a completed scan's total findings against the immediately
 * preceding completed scan of the same project.
 */
function historicalDelta(scan: ScanInterface): number | null {
  if (scan.status !== 'completed') return null
  const source = allKnownScans.value.length > 0 ? allKnownScans.value : scans.value
  const previousCompleted = source
    .filter(
      (candidate) =>
        candidate.projectId === scan.projectId &&
        candidate.status === 'completed' &&
        candidate.scanNumber < scan.scanNumber,
    )
    .sort((a, b) => b.scanNumber - a.scanNumber)[0]

  if (!previousCompleted) return null
  return scan.totalCount - previousCompleted.totalCount
}
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="Scan Reports"
      breadcrumb="~/ scan-reports"
      description="Execution history and vulnerability metrics across projects."
    />

    <div class="mb-4 rounded-lg border border-border bg-card p-4">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ListFilter class="size-4" />
        Filters
      </div>
      <ScanFilterBar v-model="filters" :projects="projectOptions" @apply="loadScans" />
    </div>

    <div
      v-if="selectedProjectSummary"
      class="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-6"
    >
      <div class="sm:col-span-2">
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project Summary</p>
        <p class="mt-1 font-mono text-sm font-semibold text-foreground">
          {{ selectedProjectSummary.projectName }}
        </p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ selectedProjectSummary.scanCount }} historical scan{{
            selectedProjectSummary.scanCount === 1 ? '' : 's'
          }}
        </p>
      </div>
      <div>
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Critical</p>
        <p
          class="mt-1 font-mono text-lg font-semibold tabular-nums"
          :class="severityClass(selectedProjectSummary.criticalCount, 'critical')"
        >
          {{ selectedProjectSummary.criticalCount }}
        </p>
      </div>
      <div>
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">High</p>
        <p
          class="mt-1 font-mono text-lg font-semibold tabular-nums"
          :class="severityClass(selectedProjectSummary.highCount, 'high')"
        >
          {{ selectedProjectSummary.highCount }}
        </p>
      </div>
      <div>
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Medium</p>
        <p
          class="mt-1 font-mono text-lg font-semibold tabular-nums"
          :class="severityClass(selectedProjectSummary.mediumCount, 'medium')"
        >
          {{ selectedProjectSummary.mediumCount }}
        </p>
      </div>
      <div>
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Low</p>
        <p
          class="mt-1 font-mono text-lg font-semibold tabular-nums"
          :class="severityClass(selectedProjectSummary.lowCount, 'low')"
        >
          {{ selectedProjectSummary.lowCount }}
        </p>
      </div>
    </div>

    <p
      v-if="errorMessage"
      role="alert"
      class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      {{ errorMessage }}
    </p>
    <p v-else class="mb-2 font-mono text-xs text-muted-foreground">
      {{ isLoading ? 'Loading...' : `${scans.length} scan${scans.length === 1 ? '' : 's'}` }}
    </p>

    <div class="overflow-x-auto rounded-lg border border-border bg-card">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">Scan</th>
            <th scope="col" class="px-4 py-3 font-medium">Project</th>
            <th scope="col" class="px-4 py-3 font-medium">Date</th>
            <th scope="col" class="px-4 py-3 font-medium">Status</th>
            <th scope="col" class="px-4 py-3 font-medium">Tools</th>
            <th scope="col" class="px-3 py-3 text-right font-medium">Crit</th>
            <th scope="col" class="px-3 py-3 text-right font-medium">High</th>
            <th scope="col" class="px-3 py-3 text-right font-medium">Med</th>
            <th scope="col" class="px-3 py-3 text-right font-medium">Low</th>
            <th scope="col" class="px-3 py-3 text-right font-medium">Total</th>
            <th scope="col" class="px-2 py-3"><span class="sr-only">Actions</span></th>
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
            <tr
              class="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
              @click="navigate"
            >
              <td class="px-4 py-3">
                <span class="font-mono text-primary hover:underline">#{{ scan.scanNumber }}</span>
              </td>
              <td class="px-4 py-3 font-mono text-foreground">{{ scan.project.name }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {{
                  new Date(scan.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }}
              </td>
              <td class="px-4 py-3"><StatusBadge :status="scan.status" /></td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tool in scan.tools"
                    :key="tool"
                    class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {{ tool }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-3 text-right">
                <span
                  class="font-mono tabular-nums"
                  :class="severityClass(scan.criticalCount, 'critical')"
                >
                  {{ scan.criticalCount }}
                </span>
              </td>
              <td class="px-3 py-3 text-right">
                <span class="font-mono tabular-nums" :class="severityClass(scan.highCount, 'high')">
                  {{ scan.highCount }}
                </span>
              </td>
              <td class="px-3 py-3 text-right">
                <span
                  class="font-mono tabular-nums"
                  :class="severityClass(scan.mediumCount, 'medium')"
                >
                  {{ scan.mediumCount }}
                </span>
              </td>
              <td class="px-3 py-3 text-right">
                <span class="font-mono tabular-nums" :class="severityClass(scan.lowCount, 'low')">
                  {{ scan.lowCount }}
                </span>
              </td>
              <td class="px-3 py-3 text-right font-mono font-medium tabular-nums text-foreground">
                {{ scan.totalCount }}
                <span
                  v-if="historicalDelta(scan) !== null"
                  class="ml-1 text-[10px]"
                  :class="
                    (historicalDelta(scan) ?? 0) > 0
                      ? 'text-critical'
                      : (historicalDelta(scan) ?? 0) < 0
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  "
                >
                  {{
                    (historicalDelta(scan) ?? 0) > 0
                      ? `+${historicalDelta(scan)}`
                      : historicalDelta(scan) === 0
                        ? '='
                        : historicalDelta(scan)
                  }}
                </span>
              </td>
              <td class="px-2 py-3 text-muted-foreground">
                <ChevronRight
                  class="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
      <div v-if="isLoading" class="p-8">
        <LoadingState compact title="Loading security scans..." description="Filtering scans across projects, date ranges, and statuses..." />
      </div>
      <p
        v-else-if="scans.length === 0"
        class="px-4 py-12 text-center text-sm text-muted-foreground"
      >
        No scans match the selected filters.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, ListFilter } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import ScanFilterBar from '@/components/ScanFilterBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'
import { computeProjectSummariesFromScans } from '@/interfaces/ScanInterface'
import type { ProjectScanSummaryInterface, ScanInterface } from '@/interfaces/ScanInterface'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { formatDate, severityCountClass as severityClass } from '@/services/FormatHelper'
import { ScanService } from '@/services/ScanService'

interface ProjectOption {
  id: string
  name: string
}

function projectIdFromQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

const route = useRoute()
const scans = ref<ScanInterface[]>([])
// Unfiltered scan history: feeds the project options, project summary and historical deltas.
const allKnownScans = ref<ScanInterface[]>([])
const filters = ref<ScanFiltersInterface>({
  projectId: projectIdFromQuery(route.query.projectId),
})
const isLoading = ref<boolean>(false)
const errorMessage = ref<string | null>(null)

const historySource = computed<ScanInterface[]>(() =>
  allKnownScans.value.length > 0 ? allKnownScans.value : scans.value,
)

const projectOptions = computed<ProjectOption[]>(() => {
  const map = new Map<string, string>()
  for (const scan of [...allKnownScans.value, ...scans.value]) {
    if (scan.projectId && scan.project?.name) {
      map.set(scan.projectId, scan.project.name)
    }
  }
  return Array.from(map.entries())
    .map(([id, name]): ProjectOption => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name))
})

const selectedProjectSummary = computed<ProjectScanSummaryInterface | null>(() => {
  if (!filters.value.projectId) return null
  return (
    computeProjectSummariesFromScans(historySource.value).find(
      (summary) => summary.projectId === filters.value.projectId,
    ) ?? null
  )
})

/**
 * RF-028: change in total findings of each completed scan against the immediately
 * preceding completed scan of the same project. Scans without a predecessor are absent.
 */
const historicalDeltas = computed<Map<string, number>>(() => {
  const completedByProject = new Map<string, ScanInterface[]>()
  for (const scan of historySource.value) {
    if (scan.status !== 'completed') continue
    const group = completedByProject.get(scan.projectId) ?? []
    group.push(scan)
    completedByProject.set(scan.projectId, group)
  }

  const deltas = new Map<string, number>()
  for (const group of completedByProject.values()) {
    group.sort((first, second) => first.scanNumber - second.scanNumber)
    group.forEach((scan, index) => {
      const previous = index > 0 ? group[index - 1] : undefined
      if (previous) deltas.set(scan.id, scan.totalCount - previous.totalCount)
    })
  }
  return deltas
})

function historicalDelta(scan: ScanInterface): number | null {
  if (scan.status !== 'completed') return null
  return historicalDeltas.value.get(scan.id) ?? null
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-critical'
  if (delta < 0) return 'text-primary'
  return 'text-muted-foreground'
}

function deltaLabel(delta: number): string {
  if (delta > 0) return `+${delta}`
  return delta === 0 ? '=' : String(delta)
}

function hasActiveFilters(current: ScanFiltersInterface): boolean {
  return Boolean(
    current.projectId || current.status || current.severity || current.dateFrom || current.dateTo,
  )
}

let loadSequence = 0

async function loadScans(): Promise<void> {
  const sequence = ++loadSequence
  isLoading.value = true
  errorMessage.value = null
  try {
    const loaded = await ScanService.getScans(filters.value)
    // Drop responses that were superseded by a newer filter change.
    if (sequence !== loadSequence) return
    scans.value = loaded
    if (!hasActiveFilters(filters.value) || allKnownScans.value.length === 0) {
      allKnownScans.value = loaded
    }
  } catch (error) {
    if (sequence !== loadSequence) return
    errorMessage.value = extractErrorMessage(error, 'We could not load the scans. Please try again.')
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

function resetFilters(): void {
  filters.value = {}
  void loadScans()
}

// Overview links reuse this view with a different ?projectId.
watch(
  () => route.query.projectId,
  (projectId: unknown): void => {
    filters.value = { ...filters.value, projectId: projectIdFromQuery(projectId) }
    void loadScans()
  },
)

onMounted(loadScans)
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

    <div v-if="errorMessage" class="mt-5">
      <ErrorState
        title="Failed to Load Scans"
        :message="errorMessage"
        @retry="loadScans"
      />
    </div>
    <p v-else class="mb-2 font-mono text-xs text-muted-foreground">
      {{ isLoading ? 'Loading...' : `${scans.length} scan${scans.length === 1 ? '' : 's'}` }}
    </p>

    <div v-if="!errorMessage" class="overflow-x-auto rounded-lg border border-border bg-card">
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
                <RouterLink
                  :to="{ name: 'scan.show', params: { id: scan.id } }"
                  class="font-mono text-primary hover:underline"
                  @click.stop
                >
                  #{{ scan.scanNumber }}
                </RouterLink>
              </td>
              <td class="px-4 py-3 font-mono text-foreground">{{ scan.project.name }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {{ formatDate(scan.date) }}
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
                  :class="deltaClass(historicalDelta(scan) ?? 0)"
                >
                  {{ deltaLabel(historicalDelta(scan) ?? 0) }}
                </span>
              </td>
              <td class="px-2 py-3 text-muted-foreground">
                <ChevronRight
                  class="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
      <div v-if="isLoading" class="p-8">
        <LoadingState compact title="Loading security scans..." description="Filtering scans across projects, date ranges, and statuses..." />
      </div>
      <div
        v-else-if="scans.length === 0"
        class="p-8"
      >
        <EmptyState
          title="No security scans found"
          description="No scans match the selected project, status, or date range filters."
          action-label="Reset filters"
          @action="resetFilters"
        />
      </div>
    </div>
  </div>
</template>

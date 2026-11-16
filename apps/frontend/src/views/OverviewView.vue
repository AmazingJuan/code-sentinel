<!-- apps/frontend/src/views/OverviewView.vue -->
<script setup lang="ts">
import { Activity, ArrowRight, Bug, ScrollText, ShieldAlert } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import SeverityBar from '@/components/SeverityBar.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { computeProjectSummariesFromScans } from '@/interfaces/ScanInterface'
import type { ProjectScanSummaryInterface, ScanInterface } from '@/interfaces/ScanInterface'
import { FindingService } from '@/services/FindingService'
import { ScanService } from '@/services/ScanService'

const scans = ref<ScanInterface[]>([])
const findings = ref<FindingInterface[]>([])
const selectedProjectId = ref<string | undefined>(undefined)
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)

const projectSummaries = computed<ProjectScanSummaryInterface[]>(() =>
  computeProjectSummariesFromScans(scans.value),
)

const filteredScans = computed<ScanInterface[]>(() =>
  selectedProjectId.value
    ? scans.value.filter((scan) => scan.projectId === selectedProjectId.value)
    : scans.value,
)

const filteredScanIds = computed<Set<string>>(
  () => new Set(filteredScans.value.map((scan) => scan.id)),
)

const filteredFindings = computed<FindingInterface[]>(() =>
  selectedProjectId.value
    ? findings.value.filter((finding) => filteredScanIds.value.has(finding.scanId))
    : findings.value,
)

const recentScans = computed<ScanInterface[]>(() => filteredScans.value.slice(0, 5))
const recentFindings = computed<FindingInterface[]>(() =>
  filteredFindings.value
    .filter((finding) => finding.severity === 'critical' || finding.severity === 'high')
    .slice(0, 5),
)

// RF-029: calculate aggregate counters from the project summaries (derived from scans).
const aggregate = computed<{ critical: number; high: number; medium: number; low: number }>(() => {
  const summaries = selectedProjectId.value
    ? projectSummaries.value.filter(
        (project) => project.projectId === selectedProjectId.value,
      )
    : projectSummaries.value
  return summaries.reduce(
    (counts, project) => ({
      critical: counts.critical + project.criticalCount,
      high: counts.high + project.highCount,
      medium: counts.medium + project.mediumCount,
      low: counts.low + project.lowCount,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 },
  )
})

const aggregateTotal = computed<number>(() =>
  Object.values(aggregate.value).reduce((sum, count) => sum + count, 0),
)

const totalFindings = computed<number>(
  () => aggregateTotal.value || filteredFindings.value.length,
)

const latestDisplayScan = computed<ScanInterface | undefined>(
  () =>
    filteredScans.value.find((scan) => scan.status === 'completed') ?? filteredScans.value[0],
)

async function loadOverview(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null

  try {
    const [loadedScans, loadedFindings] = await Promise.all([
      ScanService.getScans(),
      FindingService.getFindings(),
    ])
    scans.value = loadedScans
    findings.value = loadedFindings
  } catch {
    errorMessage.value = 'We could not load the overview. Please try again in a few seconds.'
  } finally {
    isLoading.value = false
  }
}

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

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

onMounted(loadOverview)
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="Security Overview"
      breadcrumb="~/ overview"
      description="Findings normalized from CLI scans across all connected projects."
    >
      <template #actions>
        <div v-if="projectSummaries.length > 0" class="w-full sm:w-56">
          <label class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            PROJECT SCOPE
          </label>
          <select
            v-model="selectedProjectId"
            class="h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option :value="undefined">All projects</option>
            <option
              v-for="project in projectSummaries"
              :key="project.projectId"
              :value="project.projectId"
            >
              {{ project.projectName }}
            </option>
          </select>
        </div>
      </template>
    </PageHeader>

    <p
      v-if="errorMessage"
      class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      {{ errorMessage }}
    </p>

    <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Total Scans"
        :value="isLoading ? '-' : filteredScans.length"
        :hint="selectedProjectId ? 'selected project' : 'all time'"
        :icon="Activity"
        tone="primary"
      />
      <StatCard
        label="Total Findings"
        :value="isLoading ? '-' : totalFindings"
        hint="latest scan posture"
        :icon="Bug"
        tone="default"
      />
      <StatCard
        label="Critical"
        :value="isLoading ? '-' : aggregate.critical"
        hint="open"
        :icon="ShieldAlert"
        tone="critical"
      />
      <StatCard
        label="High"
        :value="isLoading ? '-' : aggregate.high"
        hint="open"
        :icon="ShieldAlert"
        tone="high"
      />
    </div>

    <section class="mt-6">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">Latest CLI run</h2>
        <span class="font-mono text-xs text-muted-foreground">
          scan #{{ latestDisplayScan?.scanNumber ?? '-' }} ·
          {{ latestDisplayScan?.project?.name ?? 'code-sentinel' }}
        </span>
      </div>
      <div class="grid gap-4 lg:grid-cols-5">
        <TerminalWindow
          class="lg:col-span-3"
          title="zsh - ~/projects/code-sentinel"
          :lines="[
            [
              { text: '$ ', tone: 'prompt' },
              {
                text: `codesentinel scan ./${latestDisplayScan?.project?.name ?? 'code-sentinel'}`,
                tone: 'default',
              },
            ],
            [],
            [{ text: 'Code Sentinel v1.0.0', tone: 'bold' }],
            [{ text: 'Security Analysis Engine', tone: 'dim' }],
            [],
            [
              {
                text: `Project: ./${latestDisplayScan?.project?.name ?? 'code-sentinel'}`,
                tone: 'dim',
              },
            ],
            [],
            [
              { text: '[1/4] Running SAST analysis............... ', tone: 'default' },
              { text: 'OK', tone: 'green' },
            ],
            [
              { text: '[2/4] Scanning for hardcoded secrets...... ', tone: 'default' },
              { text: 'OK', tone: 'green' },
            ],
            [
              { text: '[3/4] Scanning open ports................. ', tone: 'default' },
              { text: 'OK', tone: 'green' },
            ],
            [
              { text: '[4/4] Normalizing findings................ ', tone: 'default' },
              { text: 'OK', tone: 'green' },
            ],
            [],
            [{ text: 'Processing results...', tone: 'dim' }],
            [
              { text: 'Storing scan results............... ', tone: 'default' },
              { text: 'OK', tone: 'green' },
            ],
            [],
            [{ text: '--------------------------------------------', tone: 'rule' }],
            [{ text: ' SCAN COMPLETED', tone: 'bold' }],
            [{ text: '--------------------------------------------', tone: 'rule' }],
            [],
            [
              { text: 'CRITICAL    ', tone: 'default' },
              { text: String(latestDisplayScan?.criticalCount ?? 0), tone: 'critical' },
            ],
            [
              { text: 'HIGH        ', tone: 'default' },
              { text: String(latestDisplayScan?.highCount ?? 0), tone: 'high' },
            ],
            [
              { text: 'MEDIUM      ', tone: 'default' },
              { text: String(latestDisplayScan?.mediumCount ?? 0), tone: 'medium' },
            ],
            [
              { text: 'LOW         ', tone: 'default' },
              { text: String(latestDisplayScan?.lowCount ?? 0), tone: 'low' },
            ],
            [],
            [{ text: `Total findings: ${latestDisplayScan?.totalCount ?? 0}`, tone: 'default' }],
            [{ text: 'Report generated successfully.', tone: 'green' }],
            [{ text: `Scan ID: #${latestDisplayScan?.scanNumber ?? '-'}`, tone: 'cyan' }],
          ]"
        />

        <div class="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h3 class="text-sm font-medium text-foreground">Severity Distribution</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">Open findings across projects</p>
          <div class="mt-4">
            <SeverityBar :counts="aggregate" />
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div
              v-for="severity in ['critical', 'high', 'medium', 'low'] as const"
              :key="severity"
              class="rounded-md border border-border bg-background/50 p-2.5"
            >
              <SeverityBadge :severity="severity" />
              <p
                class="mt-2 font-mono text-lg font-semibold tabular-nums"
                :class="severityClass(aggregate[severity], severity)"
              >
                {{ aggregate[severity] }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="projectSummaries.length > 0" class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-foreground">Projects Security Overview</h2>
        <RouterLink
          :to="{ name: 'project.index' }"
          class="flex items-center gap-1 text-sm text-primary transition-colors hover:underline"
        >
          Manage projects <ArrowRight class="size-3.5" />
        </RouterLink>
      </div>
      <div class="overflow-x-auto rounded-lg border border-border bg-card">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th class="px-4 py-3 font-medium">PROJECT</th>
              <th class="px-4 py-3 font-medium">LATEST STATUS</th>
              <th class="px-4 py-3 font-medium">SCANS</th>
              <th class="px-4 py-3 font-medium">LAST SCAN</th>
              <th class="px-3 py-3 text-right font-medium">CRIT</th>
              <th class="px-3 py-3 text-right font-medium">HIGH</th>
              <th class="px-3 py-3 text-right font-medium">MED</th>
              <th class="px-3 py-3 text-right font-medium">LOW</th>
              <th class="px-3 py-3 text-right font-medium">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="project in projectSummaries"
              :key="project.projectId"
              class="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
            >
              <td class="px-4 py-3">
                <RouterLink
                  :to="{ name: 'scan.index', query: { projectId: project.projectId } }"
                  class="font-mono text-primary hover:underline"
                >
                  {{ project.projectName }}
                </RouterLink>
              </td>
              <td class="px-4 py-3"><StatusBadge :status="project.status" /></td>
              <td class="px-4 py-3 font-mono text-foreground">{{ project.scanCount }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ formatDate(project.lastScan) }}</td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(project.criticalCount, 'critical')"
              >
                {{ project.criticalCount }}
              </td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(project.highCount, 'high')"
              >
                {{ project.highCount }}
              </td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(project.mediumCount, 'medium')"
              >
                {{ project.mediumCount }}
              </td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(project.lowCount, 'low')"
              >
                {{ project.lowCount }}
              </td>
              <td class="px-3 py-3 text-right font-mono font-semibold text-foreground">
                {{ project.totalCount }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-foreground">Recent Scans</h2>
        <RouterLink
          :to="{ name: 'scan.index' }"
          class="flex items-center gap-1 text-sm text-primary transition-colors hover:underline"
        >
          View all <ArrowRight class="size-3.5" />
        </RouterLink>
      </div>
      <div class="overflow-x-auto rounded-lg border border-border bg-card">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th class="px-4 py-3 font-medium">SCAN</th>
              <th class="px-4 py-3 font-medium">PROJECT</th>
              <th class="px-4 py-3 font-medium">DATE</th>
              <th class="px-4 py-3 font-medium">STATUS</th>
              <th class="px-3 py-3 text-right font-medium">CRIT</th>
              <th class="px-3 py-3 text-right font-medium">HIGH</th>
              <th class="px-3 py-3 text-right font-medium">MED</th>
              <th class="px-3 py-3 text-right font-medium">LOW</th>
              <th class="px-3 py-3 text-right font-medium">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="scan in recentScans"
              :key="scan.id"
              class="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
            >
              <td class="px-4 py-3">
                <RouterLink
                  :to="{ name: 'scan.show', params: { id: scan.id } }"
                  class="font-mono text-primary hover:underline"
                >
                  #{{ scan.scanNumber }}
                </RouterLink>
              </td>
              <td class="px-4 py-3 font-mono text-foreground">{{ scan.project.name }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ formatDate(scan.date) }}</td>
              <td class="px-4 py-3"><StatusBadge :status="scan.status" /></td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(scan.criticalCount, 'critical')"
              >
                {{ scan.criticalCount }}
              </td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(scan.highCount, 'high')"
              >
                {{ scan.highCount }}
              </td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(scan.mediumCount, 'medium')"
              >
                {{ scan.mediumCount }}
              </td>
              <td
                class="px-3 py-3 text-right font-mono"
                :class="severityClass(scan.lowCount, 'low')"
              >
                {{ scan.lowCount }}
              </td>
              <td class="px-3 py-3 text-right font-mono font-semibold text-foreground">
                {{ scan.totalCount }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!isLoading && recentScans.length === 0" class="px-4 py-6 text-sm text-muted-foreground">
          No scans available yet.
        </p>
      </div>
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-foreground">Recent Findings</h2>
        <RouterLink
          :to="{ name: 'finding.index' }"
          class="flex items-center gap-1 text-sm text-primary transition-colors hover:underline"
        >
          View all <ArrowRight class="size-3.5" />
        </RouterLink>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="finding in recentFindings"
          :key="finding.id"
          :to="{ name: 'finding.show', params: { id: finding.id } }"
          class="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-accent/20"
        >
          <div class="flex items-center justify-between">
            <SeverityBadge :severity="finding.severity" />
            <span class="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <ScrollText class="size-3" />Scan report
            </span>
          </div>
          <p class="mt-3 font-medium text-foreground transition-colors group-hover:text-primary">
            {{ finding.type }}
          </p>
          <p class="mt-1 truncate font-mono text-xs text-term-cyan">
            {{ finding.filePath ?? 'Location unavailable'
            }}{{ finding.line !== null ? `:${finding.line}` : '' }}
          </p>
          <p class="mt-3 text-xs text-muted-foreground">{{ finding.sourceTool }}</p>
        </RouterLink>
      </div>
      <p
        v-if="!isLoading && recentFindings.length === 0"
        class="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
      >
        No critical or high findings available yet.
      </p>
    </section>
  </div>
</template>

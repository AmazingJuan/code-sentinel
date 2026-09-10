feat(all): add authentication and seeded demo access  - add JWT and local authentication flows - add user entity, service, DTOs, and guards - seed a bcrypt-hashed demo user - add frontend login and session persistence - protect frontend routes with auth state - update API client and English error messages - configure JWT and database environment variables<script setup lang="ts">
import { Activity, ArrowRight, Bug, ScrollText, ShieldAlert } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import SeverityBadge from '@/components/SeverityBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import { FindingService } from '@/services/FindingService'
import { ScanService } from '@/services/ScanService'

const scans = ref<ScanInterface[]>([])
const findings = ref<FindingInterface[]>([])
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

const recentScans = computed(() => scans.value.slice(0, 5))
const recentFindings = computed(() =>
  findings.value.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').slice(0, 5),
)

const aggregate = computed(() => scans.value.reduce(
  (counts, scan) => ({
    critical: counts.critical + scan.criticalCount,
    high: counts.high + scan.highCount,
    medium: counts.medium + scan.mediumCount,
    low: counts.low + scan.lowCount,
  }),
  { critical: 0, high: 0, medium: 0, low: 0 },
))

const totalFindings = computed(() => findings.value.length || Object.values(aggregate.value).reduce((sum, count) => sum + count, 0))

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
  if (value === 0) return 'text-gray-600'
  const map = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-blue-400' }
  return map[tone]
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(loadOverview)
</script>

<template>
  <div class="p-5 sm:p-8">
    <p class="font-mono text-xs text-gray-500">~/ overview</p>
    <h1 class="mt-1 text-2xl font-semibold text-white">Security Overview</h1>
    <p class="mt-1 text-sm text-gray-400">Findings normalized from CLI scans across all connected projects.</p>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>

    <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="stat in [
        { label: 'Total Scans', value: scans.length, hint: 'all time', icon: Activity, tone: 'text-white' },
        { label: 'Total Findings', value: totalFindings, hint: 'open + resolved', icon: Bug, tone: 'text-white' },
        { label: 'Critical', value: aggregate.critical, hint: 'open', icon: ShieldAlert, tone: 'text-red-400' },
        { label: 'High', value: aggregate.high, hint: 'open', icon: ShieldAlert, tone: 'text-orange-400' },
      ]" :key="stat.label" class="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">{{ stat.label }}</span>
          <component :is="stat.icon" class="size-4 text-gray-500" />
        </div>
        <p class="mt-3 font-mono text-2xl font-semibold tabular-nums" :class="stat.tone">
          {{ isLoading ? '—' : stat.value }}
        </p>
        <p class="mt-1 text-[11px] text-gray-500">{{ stat.hint }}</p>
      </div>
    </div>

    <section class="mt-6">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-medium text-gray-400">Latest CLI run</h2>
        <span class="font-mono text-xs text-gray-500">scan #{{ scans[0]?.scanNumber ?? '—' }} · code-sentinel</span>
      </div>
      <div class="grid gap-4 lg:grid-cols-5">
        <TerminalWindow class="lg:col-span-3" title="zsh — ~/projects/code-sentinel" :lines="[
          [{ text: '$ ', tone: 'prompt' }, { text: 'codesentinel scan ./code-sentinel', tone: 'default' }],
          [],
          [{ text: 'Code Sentinel v1.0.0', tone: 'bold' }],
          [{ text: 'Security Analysis Engine', tone: 'dim' }],
          [],
          [{ text: 'Project: ./code-sentinel', tone: 'dim' }],
          [],
          [{ text: '[1/4] Running SAST analysis............... ', tone: 'default' }, { text: 'OK', tone: 'green' }],
          [{ text: '[2/4] Scanning for hardcoded secrets...... ', tone: 'default' }, { text: 'OK', tone: 'green' }],
          [{ text: '[3/4] Scanning open ports................. ', tone: 'default' }, { text: 'OK', tone: 'green' }],
          [{ text: '[4/4] Normalizing findings................ ', tone: 'default' }, { text: 'OK', tone: 'green' }],
          [],
          [{ text: 'Processing results...', tone: 'dim' }],
          [{ text: 'Storing scan results............... ', tone: 'default' }, { text: 'OK', tone: 'green' }],
          [],
          [{ text: '--------------------------------------------', tone: 'rule' }],
          [{ text: ' SCAN COMPLETED', tone: 'bold' }],
          [{ text: '--------------------------------------------', tone: 'rule' }],
          [],
          [{ text: 'CRITICAL    ', tone: 'default' }, { text: String(scans[0]?.criticalCount ?? 0), tone: 'critical' }],
          [{ text: 'HIGH        ', tone: 'default' }, { text: String(scans[0]?.highCount ?? 0), tone: 'high' }],
          [{ text: 'MEDIUM      ', tone: 'default' }, { text: String(scans[0]?.mediumCount ?? 0), tone: 'medium' }],
          [{ text: 'LOW         ', tone: 'default' }, { text: String(scans[0]?.lowCount ?? 0), tone: 'low' }],
          [],
          [{ text: `Total findings: ${scans[0]?.totalCount ?? 0}`, tone: 'default' }],
          [{ text: 'Report generated successfully.', tone: 'green' }],
          [{ text: `Scan ID: #${scans[0]?.scanNumber ?? '—'}`, tone: 'cyan' }],
        ]" />

        <div class="rounded-lg border border-gray-800 bg-gray-900/40 p-4 lg:col-span-2">
          <h3 class="text-sm font-medium text-white">Severity Distribution</h3>
          <p class="mt-0.5 text-xs text-gray-500">Open findings across projects</p>
          <div class="mt-4 flex h-3 overflow-hidden rounded-full bg-gray-800">
            <span v-for="severity in [
              { key: 'critical', color: 'bg-red-500' },
              { key: 'high', color: 'bg-orange-400' },
              { key: 'medium', color: 'bg-yellow-300' },
              { key: 'low', color: 'bg-blue-400' },
            ]" :key="severity.key" :class="severity.color" :style="{ width: `${totalFindings ? (aggregate[severity.key as keyof typeof aggregate] / Object.values(aggregate).reduce((sum, count) => sum + count, 0)) * 100 : 0}%` }" />
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div v-for="severity in ['critical', 'high', 'medium', 'low'] as const" :key="severity" class="rounded-md border border-gray-800 bg-[#0B0E14]/40 p-2.5">
              <SeverityBadge :severity="severity" />
              <p class="mt-2 font-mono text-lg font-semibold tabular-nums" :class="severityClass(aggregate[severity], severity)">{{ aggregate[severity] }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-white">Recent Scans</h2>
        <RouterLink :to="{ name: 'scan.index' }" class="flex items-center gap-1 text-sm text-green-400 hover:underline">View all <ArrowRight class="size-3.5" /></RouterLink>
      </div>
      <div class="overflow-x-auto rounded-lg border border-gray-800">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-gray-900/50 text-[11px] text-gray-500">
            <tr>
              <th class="px-4 py-3 font-medium">SCAN</th><th class="px-4 py-3 font-medium">PROJECT</th><th class="px-4 py-3 font-medium">DATE</th><th class="px-4 py-3 font-medium">STATUS</th><th class="px-3 py-3 text-right font-medium">CRIT</th><th class="px-3 py-3 text-right font-medium">HIGH</th><th class="px-3 py-3 text-right font-medium">MED</th><th class="px-3 py-3 text-right font-medium">LOW</th><th class="px-3 py-3 text-right font-medium">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="scan in recentScans" :key="scan.id" class="border-t border-gray-800 hover:bg-gray-900/40">
              <td class="px-4 py-3"><RouterLink :to="{ name: 'scan.show', params: { id: scan.id } }" class="font-mono text-green-400 hover:underline">#{{ scan.scanNumber }}</RouterLink></td>
              <td class="px-4 py-3 font-mono text-gray-200">{{ scan.project.name }}</td><td class="px-4 py-3 text-gray-400">{{ formatDate(scan.date) }}</td><td class="px-4 py-3"><StatusBadge :status="scan.status" /></td>
              <td class="px-3 py-3 text-right font-mono" :class="severityClass(scan.criticalCount, 'critical')">{{ scan.criticalCount }}</td><td class="px-3 py-3 text-right font-mono" :class="severityClass(scan.highCount, 'high')">{{ scan.highCount }}</td><td class="px-3 py-3 text-right font-mono" :class="severityClass(scan.mediumCount, 'medium')">{{ scan.mediumCount }}</td><td class="px-3 py-3 text-right font-mono" :class="severityClass(scan.lowCount, 'low')">{{ scan.lowCount }}</td><td class="px-3 py-3 text-right font-mono font-semibold text-white">{{ scan.totalCount }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!isLoading && recentScans.length === 0" class="px-4 py-6 text-sm text-gray-500">No scans available yet.</p>
      </div>
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between"><h2 class="text-base font-semibold text-white">Recent Findings</h2><RouterLink :to="{ name: 'finding.index' }" class="flex items-center gap-1 text-sm text-green-400 hover:underline">View all <ArrowRight class="size-3.5" /></RouterLink></div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink v-for="finding in recentFindings" :key="finding.id" :to="{ name: 'finding.show', params: { id: finding.id } }" class="group rounded-lg border border-gray-800 bg-gray-900/40 p-4 hover:border-green-500/40">
          <div class="flex items-center justify-between"><SeverityBadge :severity="finding.severity" /><span class="flex items-center gap-1 font-mono text-xs text-gray-500"><ScrollText class="size-3" />Scan report</span></div>
          <p class="mt-3 font-medium text-gray-200 group-hover:text-green-400">{{ finding.type }}</p><p class="mt-1 truncate font-mono text-xs text-cyan-400">{{ finding.filePath ?? 'Location unavailable' }}{{ finding.line !== null ? `:${finding.line}` : '' }}</p><p class="mt-3 text-xs text-gray-500">{{ finding.sourceTool }}</p>
        </RouterLink>
      </div>
      <p v-if="!isLoading && recentFindings.length === 0" class="rounded-lg border border-dashed border-gray-800 px-4 py-6 text-sm text-gray-500">No critical or high findings available yet.</p>
    </section>
  </div>
</template>

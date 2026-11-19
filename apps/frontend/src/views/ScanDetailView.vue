<script setup lang="ts">
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  GitBranch,
  GitCommit,
  Hash,
  Lock,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import SeverityBar from '@/components/SeverityBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import type { SeverityCounts } from '@/interfaces/SeverityCountsInterface'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { FindingService } from '@/services/FindingService'
import { formatDateTime } from '@/services/FormatHelper'
import { buildCommitUrl, formatCommitSha } from '@/services/GitHelper'
import { ReportService } from '@/services/ReportService'
import { ScanService } from '@/services/ScanService'
import { getToastStore } from '@/stores/toastStore'

type ReportFormat = 'html' | 'json'

interface SummaryItem {
  label: string
  value: number
  tone: string
}

const MIN_REPORT_PASSWORD_LENGTH = 4

const route = useRoute()
const router = useRouter()
const toastStore = getToastStore()
const scan = ref<ScanInterface | null>(null)
const findings = ref<FindingInterface[]>([])
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)

const isExportModalOpen = ref<boolean>(false)
const reportPassword = ref<string>('')
const reportFormat = ref<ReportFormat>('html')
const isDownloading = ref<boolean>(false)
const exportError = ref<string | null>(null)

const projectId = computed<string | null>(
  () => scan.value?.project?.id || scan.value?.projectId || null,
)

const commitUrl = computed<string | null>(() =>
  buildCommitUrl(scan.value?.project?.repo, scan.value?.commitSha),
)

const counts = computed<SeverityCounts>(() => ({
  critical: scan.value?.criticalCount ?? 0,
  high: scan.value?.highCount ?? 0,
  medium: scan.value?.mediumCount ?? 0,
  low: scan.value?.lowCount ?? 0,
}))

const summaryItems = computed<SummaryItem[]>(() => [
  { label: 'Critical', value: counts.value.critical, tone: 'text-critical' },
  { label: 'High', value: counts.value.high, tone: 'text-high' },
  { label: 'Medium', value: counts.value.medium, tone: 'text-medium' },
  { label: 'Low', value: counts.value.low, tone: 'text-low' },
  { label: 'Total', value: scan.value?.totalCount ?? 0, tone: 'text-foreground' },
])

let loadSequence = 0

async function loadScanDetails(id: string): Promise<void> {
  const sequence = ++loadSequence
  isLoading.value = true
  errorMessage.value = null
  try {
    const [loadedScan, loadedFindings] = await Promise.all([
      ScanService.getScanById(id),
      FindingService.getFindings({ scanId: id }),
    ])
    if (sequence !== loadSequence) return
    scan.value = loadedScan
    findings.value = loadedFindings
  } catch (error) {
    if (sequence !== loadSequence) return
    scan.value = null
    errorMessage.value = extractErrorMessage(error, 'We could not load the details for this scan.', {
      forbidden: 'You do not have access to this scan.',
    })
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

function reload(): void {
  void loadScanDetails(String(route.params.id))
}

async function goBack(): Promise<void> {
  if (window.history.state?.back) {
    router.back()
  } else if (projectId.value) {
    await router.push({ name: 'project.show', params: { id: projectId.value } })
  } else {
    await router.push({ name: 'scan.index' })
  }
}

function openExportModal(): void {
  exportError.value = null
  reportPassword.value = ''
  isExportModalOpen.value = true
}

function closeExportModal(): void {
  if (isDownloading.value) return
  isExportModalOpen.value = false
  // Do not keep the report password in memory after the dialog closes.
  reportPassword.value = ''
  exportError.value = null
}

async function handleDownloadReport(): Promise<void> {
  if (!scan.value?.id || isDownloading.value) return
  if (reportPassword.value.length < MIN_REPORT_PASSWORD_LENGTH) {
    exportError.value = `Password must be at least ${MIN_REPORT_PASSWORD_LENGTH} characters long.`
    return
  }
  isDownloading.value = true
  exportError.value = null
  try {
    await ReportService.downloadProtectedReport(scan.value.id, reportPassword.value, reportFormat.value)
    isDownloading.value = false
    closeExportModal()
    toastStore.success('Report downloaded', 'Protected security report generated successfully.')
  } catch {
    exportError.value = 'Failed to generate protected report. Please verify your permissions.'
  } finally {
    isDownloading.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isExportModalOpen.value) closeExportModal()
}

document.addEventListener('keydown', onKeydown)
onBeforeUnmount((): void => document.removeEventListener('keydown', onKeydown))

// The same view instance is reused when navigating between scans.
watch(
  () => route.params.id,
  (id: string | string[] | undefined): void => {
    if (id) void loadScanDetails(String(id))
  },
  { immediate: true },
)
</script>

<template>
  <div class="p-5 sm:p-8">
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
        <RouterLink :to="{ name: 'overview' }" class="hover:text-foreground transition-colors">overview</RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink
          v-if="scan?.project && projectId"
          :to="{ name: 'project.show', params: { id: projectId } }"
          class="hover:text-primary transition-colors text-foreground font-medium"
        >
          {{ scan.project.name }}
        </RouterLink>
        <RouterLink v-else :to="{ name: 'scan.index' }" class="hover:text-foreground transition-colors">
          scans
        </RouterLink>
        <span aria-hidden="true">/</span>
        <span class="text-primary font-semibold">#scan-{{ scan?.scanNumber ?? '...' }}</span>
      </nav>
    </div>

    <div v-if="errorMessage" class="mt-4">
      <ErrorState
        title="Scan Report Unavailable"
        :message="errorMessage"
        @retry="reload"
      >
        <template #extra-actions>
          <button
            type="button"
            @click="goBack"
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <span>Back to Scans</span>
          </button>
        </template>
      </ErrorState>
    </div>

    <div v-else-if="isLoading" class="mt-6">
      <LoadingState
        title="Loading scan report..."
        description="Retrieving execution metadata, findings breakdown, and tool logs..."
      />
    </div>

    <template v-else-if="scan">
      <PageHeader
        :title="`Scan Report #${scan.scanNumber}`"
        :breadcrumb="`~/ scan-reports / #${scan.scanNumber}`"
      >
        <template #actions>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="openExportModal"
              class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
              title="Download password-protected report (RF-033 / RF-034)"
            >
              <Lock class="size-3.5 text-primary" />
              <span>Export Report</span>
            </button>
            <StatusBadge :status="scan.status" />
          </div>
        </template>
      </PageHeader>

      <div class="mb-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div class="bg-card p-4">
          <p class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <FolderKanban class="size-3.5" />
            Project
          </p>
          <RouterLink
            v-if="projectId"
            :to="{ name: 'project.show', params: { id: projectId } }"
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
              {{ formatCommitSha(scan.commitSha) }}
            </a>
            <span v-else-if="scan.commitSha" class="text-term-cyan">
              {{ formatCommitSha(scan.commitSha) }}
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
            {{ formatDateTime(scan.date) }}
          </p>
        </div>
      </div>

      <p
        v-if="scan.status === 'failed' && scan.errorMessage"
        role="alert"
        class="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
      >
        {{ scan.errorMessage }}
      </p>

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
                    :aria-label="`View finding ${finding.type}`"
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

    <div
      v-if="isExportModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-report-title"
    >
      <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div class="flex items-center gap-2 text-primary">
          <Lock class="size-5" />
          <h3 id="export-report-title" class="text-base font-semibold text-foreground">Export Protected Report</h3>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          Code Sentinel security reports are encrypted with password protection (RF-033 &amp; RF-034). Set a password to encrypt and protect the security results.
        </p>

        <form @submit.prevent="handleDownloadReport" class="mt-4 space-y-4">
          <div>
            <label for="report-password" class="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Report Password
            </label>
            <input
              id="report-password"
              v-model="reportPassword"
              type="password"
              autocomplete="new-password"
              :minlength="MIN_REPORT_PASSWORD_LENGTH"
              :placeholder="`Enter password (min ${MIN_REPORT_PASSWORD_LENGTH} characters)...`"
              required
              class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label for="report-format" class="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Format
            </label>
            <select
              id="report-format"
              v-model="reportFormat"
              class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="html">Protected Interactive HTML (Offline Encrypted)</option>
              <option value="json">Encrypted Security JSON</option>
            </select>
          </div>

          <p v-if="exportError" role="alert" class="text-xs text-destructive">
            {{ exportError }}
          </p>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              @click="closeExportModal"
              :disabled="isDownloading"
              class="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isDownloading"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              <Lock v-if="!isDownloading" class="size-3.5" />
              <span>{{ isDownloading ? 'Generating...' : 'Download Report' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

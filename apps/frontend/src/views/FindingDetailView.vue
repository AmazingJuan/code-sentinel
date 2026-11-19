<script setup lang="ts">
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommit,
  Info,
  Lightbulb,
  ShieldAlert,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

import CodeViewer from '@/components/CodeViewer.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { TerminalLine } from '@/interfaces/TerminalInterface'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { FindingService } from '@/services/FindingService'
import { buildCommitUrl, buildFileDeepLink, formatCommitSha } from '@/services/GitHelper'
import { getVulnerabilityIntel, type VulnerabilityDetails } from '@/services/VulnerabilityIntel'

interface MetaItem {
  label: string
  value: string
  mono: boolean
  link: RouteLocationRaw | null
}

const route = useRoute()
const router = useRouter()
const finding = ref<FindingInterface | null>(null)
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)
const copiedSha = ref<boolean>(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const projectId = computed<string | null>(() => finding.value?.scan?.project?.id ?? null)

const effectiveCommitSha = computed<string | null>(
  () => finding.value?.commitSha || finding.value?.scan?.commitSha || null,
)

const effectiveBranch = computed<string>(() => finding.value?.scan?.branch || 'main')

const repoUrl = computed<string | null>(() => finding.value?.scan?.project?.repo || null)

const gitDeepLink = computed<string | null>(() =>
  buildFileDeepLink(
    repoUrl.value,
    finding.value?.filePath,
    finding.value?.line,
    effectiveCommitSha.value || effectiveBranch.value,
  ),
)

const commitWebUrl = computed<string | null>(() =>
  buildCommitUrl(repoUrl.value, effectiveCommitSha.value),
)

const intel = computed<VulnerabilityDetails | null>(() =>
  finding.value ? getVulnerabilityIntel(finding.value.type, finding.value.cwe) : null,
)

const meta = computed<MetaItem[]>(() => {
  const current = finding.value
  if (!current) return []
  return [
    {
      label: 'Project',
      value: current.scan?.project?.name ?? 'Unassigned',
      mono: false,
      link: projectId.value ? { name: 'project.show', params: { id: projectId.value } } : null,
    },
    {
      label: 'Scan Report',
      value: current.scan ? `#${current.scan.scanNumber}` : 'N/A',
      mono: true,
      link: current.scan?.id ? { name: 'scan.show', params: { id: current.scan.id } } : null,
    },
    { label: 'Finding ID', value: current.id, mono: true, link: null },
    { label: 'Type', value: current.type, mono: false, link: null },
    { label: 'CWE', value: intel.value?.cwe ?? 'CWE-Unknown', mono: true, link: null },
    { label: 'Tool', value: current.sourceTool, mono: false, link: null },
    { label: 'File', value: current.filePath ?? '-', mono: true, link: null },
    {
      label: 'Line',
      value: current.line !== null ? String(current.line) : '-',
      mono: true,
      link: null,
    },
  ]
})

const terminalLines = computed<TerminalLine[]>(() => {
  const current = finding.value
  if (!current) return []
  const commitLines: TerminalLine[] = effectiveCommitSha.value
    ? [[{ text: `Commit: ${formatCommitSha(effectiveCommitSha.value)}`, tone: 'default' }]]
    : []
  return [
    [
      { text: '$ ', tone: 'prompt' },
      { text: `codesentinel inspect ${current.id}`, tone: 'default' },
    ],
    [],
    [
      {
        text: `[${(current.severity ?? 'unclassified').toUpperCase()}] ${current.type}`,
        tone: current.severity ?? 'dim',
      },
    ],
    [{ text: `Project: ${current.scan?.project?.name ?? 'Unassigned'}`, tone: 'default' }],
    [{ text: `CWE: ${intel.value?.cwe ?? 'N/A'}`, tone: 'default' }],
    [{ text: `Tool: ${current.sourceTool}`, tone: 'dim' }],
    [{ text: `File: ${current.filePath ?? '-'}`, tone: 'cyan' }],
    [{ text: `Line: ${current.line ?? '-'}`, tone: 'cyan' }],
    ...commitLines,
    [],
    [{ text: 'Status: Open', tone: 'high' }],
  ]
})

let loadSequence = 0

async function loadFinding(id: string): Promise<void> {
  const sequence = ++loadSequence
  isLoading.value = true
  errorMessage.value = null
  try {
    const loaded = await FindingService.getFindingById(id)
    if (sequence === loadSequence) finding.value = loaded
  } catch (error) {
    if (sequence !== loadSequence) return
    finding.value = null
    errorMessage.value = extractErrorMessage(error, 'We could not load this finding.', {
      forbidden: 'You do not have access to this finding.',
    })
  } finally {
    if (sequence === loadSequence) isLoading.value = false
  }
}

function reload(): void {
  void loadFinding(String(route.params.id))
}

async function goBack(): Promise<void> {
  if (window.history.state?.back) {
    router.back()
  } else if (projectId.value) {
    await router.push({ name: 'project.show', params: { id: projectId.value } })
  } else {
    await router.push({ name: 'finding.index' })
  }
}

async function copyCommitSha(): Promise<void> {
  if (!effectiveCommitSha.value) return
  try {
    await navigator.clipboard.writeText(effectiveCommitSha.value)
    copiedSha.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout((): void => {
      copiedSha.value = false
    }, 2000)
  } catch {
    // Clipboard access can be denied by the browser; copying is best-effort.
  }
}

onBeforeUnmount((): void => clearTimeout(copiedTimer))

// The same view instance is reused when navigating between findings.
watch(
  () => route.params.id,
  (id: string | string[] | undefined): void => {
    if (id) void loadFinding(String(id))
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
          v-if="finding?.scan?.project && projectId"
          :to="{ name: 'project.show', params: { id: projectId } }"
          class="hover:text-primary transition-colors text-foreground font-medium"
        >
          {{ finding.scan.project.name }}
        </RouterLink>
        <RouterLink v-else :to="{ name: 'finding.index' }" class="hover:text-foreground transition-colors">
          findings
        </RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink
          v-if="finding?.scan"
          :to="{ name: 'scan.show', params: { id: finding.scan.id } }"
          class="hover:text-primary transition-colors text-muted-foreground"
        >
          #scan-{{ finding.scan.scanNumber }}
        </RouterLink>
        <span v-if="finding?.scan" aria-hidden="true">/</span>
        <span class="text-primary truncate max-w-[180px]">{{ finding?.type }}</span>
      </nav>
    </div>

    <div v-if="errorMessage" class="mt-4">
      <ErrorState
        title="Vulnerability Finding Unavailable"
        :message="errorMessage"
        @retry="reload"
      >
        <template #extra-actions>
          <button
            type="button"
            @click="goBack"
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <span>Back to Findings</span>
          </button>
        </template>
      </ErrorState>
    </div>

    <div v-else-if="isLoading" class="mt-6">
      <LoadingState
        title="Loading vulnerability details..."
        description="Retrieving finding telemetry, code snippet, and mitigation intelligence..."
      />
    </div>

    <template v-else-if="finding">
      <PageHeader
        :title="finding.type"
        :breadcrumb="`~/ findings / ${finding.id}`"
      >
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <SeverityBadge :severity="finding.severity" />
            <a
              v-if="intel?.cwe"
              :href="intel.cweUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
              title="View definition on MITRE CWE"
            >
              <span>{{ intel.cwe }}</span>
              <ArrowUpRight class="size-3" />
            </a>
            <a
              v-if="gitDeepLink"
              :href="gitDeepLink"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 rounded border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink class="size-3.5" />
              <span>Open in Repository</span>
            </a>
          </div>
        </template>
      </PageHeader>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            <div
              v-for="m in meta"
              :key="m.label"
              class="bg-card p-3"
            >
              <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{{ m.label }}</p>
              <RouterLink
                v-if="m.link"
                :to="m.link"
                class="mt-1 block truncate text-sm font-medium text-primary hover:underline"
                :class="m.mono ? 'font-mono' : ''"
              >
                {{ m.value }}
              </RouterLink>
              <p
                v-else
                class="mt-1 truncate text-sm"
                :class="m.mono ? 'font-mono text-term-cyan' : 'text-foreground font-medium'"
              >
                {{ m.value }}
              </p>
            </div>
          </div>

          <div
            v-if="effectiveCommitSha || finding.scan?.branch"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3.5 text-xs"
          >
            <div class="flex flex-wrap items-center gap-4">
              <div v-if="effectiveCommitSha" class="flex items-center gap-1.5 font-mono">
                <GitCommit class="size-3.5 text-muted-foreground" />
                <span class="text-muted-foreground">Commit:</span>
                <a
                  v-if="commitWebUrl"
                  :href="commitWebUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-semibold text-foreground hover:underline"
                >
                  {{ formatCommitSha(effectiveCommitSha) }}
                </a>
                <span v-else class="font-semibold text-foreground">{{ formatCommitSha(effectiveCommitSha) }}</span>
                <button
                  type="button"
                  class="ml-1 text-muted-foreground hover:text-foreground"
                  title="Copy full commit SHA"
                  aria-label="Copy full commit SHA"
                  @click="copyCommitSha"
                >
                  <Check v-if="copiedSha" class="size-3 text-emerald-500" />
                  <Copy v-else class="size-3" />
                </button>
              </div>

              <div v-if="finding.scan?.branch" class="flex items-center gap-1.5 font-mono">
                <GitBranch class="size-3.5 text-muted-foreground" />
                <span class="text-muted-foreground">Branch:</span>
                <span class="font-semibold text-foreground">{{ finding.scan.branch }}</span>
              </div>
            </div>

            <span class="font-mono text-[11px] text-muted-foreground">
              {{ intel?.owaspCategory }}
            </span>
          </div>

          <div class="space-y-2">
            <h2 class="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              VULNERABILITY LOCATION & CODE CONTEXT
            </h2>
            <CodeViewer
              :file-path="finding.filePath"
              :target-line="finding.line"
              :code-snippet="finding.codeSnippet"
            />
          </div>

          <div class="rounded-lg border border-border bg-card p-5">
            <div class="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert class="size-4 text-high" />
              Threat & Impact Analysis
            </div>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ intel?.impact }}
            </p>
          </div>

          <div class="rounded-lg border border-border bg-card p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Info class="size-4 text-muted-foreground" />
              Scanner Diagnostic
            </div>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ finding.description || 'The scanner did not provide a description for this finding.' }}
            </p>
          </div>

          <div class="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb class="size-4 text-primary" />
              Remediation Guidance
            </div>
            <p v-if="finding.recommendation" class="text-sm leading-relaxed text-foreground">
              {{ finding.recommendation }}
            </p>

            <ul v-if="intel?.remediationSteps && intel.remediationSteps.length > 0" class="mt-3.5 space-y-1.5 text-xs text-foreground/90">
              <li v-for="(step, idx) in intel.remediationSteps" :key="idx" class="flex items-start gap-2">
                <span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{{ step }}</span>
              </li>
            </ul>

            <div v-if="intel?.codeDiff" class="mt-5 space-y-3">
              <p class="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Code Remediation Example (Before & After)
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-md border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs">
                  <p class="mb-1.5 flex items-center gap-1 font-semibold text-destructive">
                    <AlertTriangle class="size-3.5" />
                    Vulnerable (Before)
                  </p>
                  <pre class="overflow-x-auto whitespace-pre text-[11px] leading-relaxed text-foreground/80"><code>{{ intel.codeDiff.vulnerable }}</code></pre>
                </div>

                <div class="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 font-mono text-xs">
                  <p class="mb-1.5 flex items-center gap-1 font-semibold text-emerald-500">
                    <Check class="size-3.5" />
                    Remediated (After)
                  </p>
                  <pre class="overflow-x-auto whitespace-pre text-[11px] leading-relaxed text-foreground/80"><code>{{ intel.codeDiff.remediated }}</code></pre>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ intel.codeDiff.explanation }}
              </p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <TerminalWindow
            title="zsh - codesentinel"
            :lines="terminalLines"
          />
        </div>
      </div>
    </template>
  </div>
</template>

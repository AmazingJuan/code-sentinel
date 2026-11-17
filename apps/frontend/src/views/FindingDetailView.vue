<!-- apps/frontend/src/views/FindingDetailView.vue -->
<script setup lang="ts">
import axios from 'axios'
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
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import CodeViewer from '@/components/CodeViewer.vue'
import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import TerminalWindow from '@/components/TerminalWindow.vue'
import LoadingState from '@/components/LoadingState.vue'
import ErrorState from '@/components/ErrorState.vue'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { buildCommitUrl, buildFileDeepLink } from '@/services/GitHelper'
import { FindingService } from '@/services/FindingService'
import { getVulnerabilityIntel } from '@/services/VulnerabilityIntel'

const route = useRoute()
const router = useRouter()
const finding = ref<FindingInterface | null>(null)
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)
const copiedSha = ref(false)

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 403) {
    return 'You do not have access to this finding.'
  }
  return 'We could not load this finding.'
}

onMounted(async () => {
  isLoading.value = true
  try {
    finding.value = await FindingService.getFindingById(route.params.id as string)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    isLoading.value = false
  }
})

function goBack(): void {
  if (window.history.state && window.history.state.back) {
    router.back()
  } else if (finding.value?.scan?.project?.id) {
    router.push({ name: 'project.show', params: { id: finding.value.scan.project.id } })
  } else {
    router.push({ name: 'finding.index' })
  }
}

const effectiveCommitSha = computed(() => {
  return finding.value?.commitSha || finding.value?.scan?.commitSha || null
})

const effectiveBranch = computed(() => {
  return finding.value?.scan?.branch || 'main'
})

const repoUrl = computed(() => {
  return finding.value?.scan?.project?.repo || null
})

const gitDeepLink = computed(() => {
  return buildFileDeepLink(
    repoUrl.value,
    finding.value?.filePath,
    finding.value?.line,
    effectiveCommitSha.value || effectiveBranch.value,
  )
})

const commitWebUrl = computed(() => {
  return buildCommitUrl(repoUrl.value, effectiveCommitSha.value)
})

const intel = computed(() => {
  if (!finding.value) return null
  return getVulnerabilityIntel(finding.value.type, finding.value.cwe)
})

interface MetaItem {
  label: string
  value: string
  mono: boolean
  isCwe?: boolean
  link?: string | null
}

const meta = computed<MetaItem[]>(() => {
  if (!finding.value) return []
  return [
    {
      label: 'Project',
      value: finding.value.scan?.project?.name ?? 'Unassigned',
      mono: false,
      link: finding.value.scan?.project?.id
        ? `/projects/${finding.value.scan.project.id}`
        : null,
    },
    {
      label: 'Scan Report',
      value: finding.value.scan ? `#${finding.value.scan.scanNumber}` : 'N/A',
      mono: true,
      link: finding.value.scan?.id
        ? `/scan/${finding.value.scan.id}`
        : null,
    },
    { label: 'Finding ID', value: finding.value.id, mono: true, link: null },
    { label: 'Type', value: finding.value.type, mono: false, link: null },
    { label: 'CWE', value: intel.value?.cwe ?? 'CWE-Unknown', mono: true, isCwe: true, link: null },
    { label: 'Tool', value: finding.value.sourceTool, mono: false, link: null },
    { label: 'File', value: finding.value.filePath ?? '-', mono: true, link: null },
    { label: 'Line', value: finding.value.line !== null ? String(finding.value.line) : '-', mono: true, link: null },
  ]
})

async function copyCommitSha(): Promise<void> {
  if (!effectiveCommitSha.value) return
  try {
    await navigator.clipboard.writeText(effectiveCommitSha.value)
    copiedSha.value = true
    setTimeout(() => {
      copiedSha.value = false
    }, 2000)
  } catch {
    // Clipboard permission
  }
}
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
          v-if="finding?.scan?.project"
          :to="`/projects/${finding.scan.project.id}`"
          class="hover:text-primary transition-colors text-foreground font-medium"
        >
          {{ finding.scan.project.name }}
        </RouterLink>
        <RouterLink v-else to="/finding" class="hover:text-foreground transition-colors">
          findings
        </RouterLink>
        <span>/</span>
        <RouterLink
          v-if="finding?.scan"
          :to="`/scan/${finding.scan.id}`"
          class="hover:text-primary transition-colors text-muted-foreground"
        >
          #scan-{{ finding.scan.scanNumber }}
        </RouterLink>
        <span v-if="finding?.scan">/</span>
        <span class="text-primary truncate max-w-[180px]">{{ finding?.type }}</span>
      </nav>
    </div>

    <div v-if="errorMessage" class="mt-4">
      <ErrorState
        title="Vulnerability Finding Unavailable"
        :message="errorMessage"
        :retry="false"
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
          <!-- Metadata grid -->
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

          <!-- Git Context Strip -->
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
                  {{ effectiveCommitSha.slice(0, 7) }}
                </a>
                <span v-else class="font-semibold text-foreground">{{ effectiveCommitSha.slice(0, 7) }}</span>
                <button
                  type="button"
                  class="ml-1 text-muted-foreground hover:text-foreground"
                  title="Copy full commit SHA"
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

          <!-- Code Snippet Inspector -->
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

          <!-- Threat & Impact Analysis -->
          <div class="rounded-lg border border-border bg-card p-5">
            <div class="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert class="size-4 text-high" />
              Threat & Impact Analysis
            </div>
            <p class="text-sm leading-relaxed text-muted-foreground">
              {{ intel?.impact }}
            </p>
          </div>

          <!-- Description -->
          <div class="rounded-lg border border-border bg-card p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Info class="size-4 text-muted-foreground" />
              Scanner Diagnostic
            </div>
            <p class="text-sm leading-relaxed text-muted-foreground">{{ finding.description }}</p>
          </div>

          <!-- Remediation Guide -->
          <div class="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <div class="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb class="size-4 text-primary" />
              Remediation Guidance
            </div>
            <p class="text-sm leading-relaxed text-foreground">{{ finding.recommendation }}</p>

            <ul v-if="intel?.remediationSteps && intel.remediationSteps.length > 0" class="mt-3.5 space-y-1.5 text-xs text-foreground/90">
              <li v-for="(step, idx) in intel.remediationSteps" :key="idx" class="flex items-start gap-2">
                <span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{{ step }}</span>
              </li>
            </ul>

            <!-- Before & After Code Fix -->
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

        <!-- Terminal inspector sidebar -->
        <div class="lg:col-span-1">
          <TerminalWindow
            title="zsh - codesentinel"
            :lines="[
              [{ text: '$ ', tone: 'prompt' }, { text: `codesentinel inspect ${finding.id}`, tone: 'default' }],
              [],
              [{ text: `[${(finding.severity ?? 'unclassified').toUpperCase()}] ${finding.type}`, tone: (finding.severity as any) ?? 'dim' }],
              [{ text: `Project: ${finding.scan?.project?.name ?? 'Unassigned'}`, tone: 'default' }],
              [{ text: `CWE: ${intel?.cwe ?? 'N/A'}`, tone: 'default' }],
              [{ text: `Tool: ${finding.sourceTool}`, tone: 'dim' }],
              [{ text: `File: ${finding.filePath ?? '-'}`, tone: 'cyan' }],
              [{ text: `Line: ${finding.line ?? '-'}`, tone: 'cyan' }],
              ...(effectiveCommitSha ? [[{ text: `Commit: ${effectiveCommitSha.slice(0, 7)}`, tone: 'default' as const }]] : []),
              [],
              [{ text: 'Status: Open', tone: 'high' }],
            ]"
          />
        </div>
      </div>
    </template>
  </div>
</template>

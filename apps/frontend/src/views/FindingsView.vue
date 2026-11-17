<!-- apps/frontend/src/views/FindingsView.vue -->
<script setup lang="ts">
import { ChevronRight, FolderKanban, RotateCcw, Search, ShieldAlert } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import SeverityBadge from '@/components/SeverityBadge.vue'
import LoadingState from '@/components/LoadingState.vue'
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import { FindingService } from '@/services/FindingService'
import { ProjectService } from '@/services/ProjectService'

const findings = ref<FindingInterface[]>([])
const projects = ref<ProjectInterface[]>([])
const filters = ref<FindingFiltersInterface>({})
const selectedProjectId = ref<string>('')
const searchQuery = ref('')
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

async function loadData(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    const [loadedFindings, loadedProjects] = await Promise.all([
      FindingService.getFindings(filters.value),
      ProjectService.getProjects().catch(() => [] as ProjectInterface[]),
    ])
    findings.value = loadedFindings
    projects.value = loadedProjects
  } catch {
    errorMessage.value = 'We could not load the findings.'
  } finally {
    isLoading.value = false
  }
}

async function applyFilters(): Promise<void> {
  errorMessage.value = null
  try {
    findings.value = await FindingService.getFindings(filters.value)
  } catch {
    errorMessage.value = 'We could not load the findings.'
  }
}

function resetFilters(): void {
  filters.value = {}
  selectedProjectId.value = ''
  searchQuery.value = ''
  applyFilters()
}

const displayedFindings = computed(() => {
  let list = findings.value

  if (selectedProjectId.value) {
    list = list.filter((f) => f.scan?.projectId === selectedProjectId.value || f.scan?.project?.id === selectedProjectId.value)
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return list

  return list.filter((f) => {
    const projectName = f.scan?.project?.name ?? ''
    return (
      f.type.toLowerCase().includes(query) ||
      (f.cwe && f.cwe.toLowerCase().includes(query)) ||
      (f.filePath && f.filePath.toLowerCase().includes(query)) ||
      f.sourceTool.toLowerCase().includes(query) ||
      (f.description && f.description.toLowerCase().includes(query)) ||
      projectName.toLowerCase().includes(query)
    )
  })
})

const stats = computed(() => {
  const all = displayedFindings.value
  return {
    total: all.length,
    critical: all.filter((f) => f.severity === 'critical').length,
    high: all.filter((f) => f.severity === 'high').length,
    medium: all.filter((f) => f.severity === 'medium').length,
    low: all.filter((f) => f.severity === 'low').length,
  }
})

onMounted(loadData)
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="Security Findings"
      breadcrumb="~/ findings"
      description="Aggregated vulnerabilities and security defects across all analyzed projects."
    />

    <!-- Quick Severity Metric Counters -->
    <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div class="rounded-lg border border-border bg-card p-3.5 text-center">
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total Findings</p>
        <p class="mt-1 font-mono text-2xl font-bold text-foreground">{{ stats.total }}</p>
      </div>
      <div class="rounded-lg border border-critical/30 bg-critical/5 p-3.5 text-center">
        <p class="font-mono text-[10px] uppercase tracking-wider text-critical">Critical</p>
        <p class="mt-1 font-mono text-2xl font-bold text-critical">{{ stats.critical }}</p>
      </div>
      <div class="rounded-lg border border-high/30 bg-high/5 p-3.5 text-center">
        <p class="font-mono text-[10px] uppercase tracking-wider text-high">High</p>
        <p class="mt-1 font-mono text-2xl font-bold text-high">{{ stats.high }}</p>
      </div>
      <div class="rounded-lg border border-medium/30 bg-medium/5 p-3.5 text-center">
        <p class="font-mono text-[10px] uppercase tracking-wider text-medium">Medium</p>
        <p class="mt-1 font-mono text-2xl font-bold text-medium">{{ stats.medium }}</p>
      </div>
      <div class="rounded-lg border border-low/30 bg-low/5 p-3.5 text-center">
        <p class="font-mono text-[10px] uppercase tracking-wider text-low">Low</p>
        <p class="mt-1 font-mono text-2xl font-bold text-low">{{ stats.low }}</p>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="mb-5 space-y-3 rounded-lg border border-border bg-card p-4">
      <div class="relative">
        <Search class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter by finding type, CWE, project, file path, or source tool..."
          class="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <!-- Project filter -->
        <div>
          <label for="filter-project" class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">PROJECT</label>
          <select
            id="filter-project"
            v-model="selectedProjectId"
            class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">All Projects</option>
            <option v-for="proj in projects" :key="proj.id" :value="proj.id">
              {{ proj.name }}
            </option>
          </select>
        </div>

        <!-- Severity filter -->
        <div>
          <label for="filter-severity" class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">SEVERITY</label>
          <select
            id="filter-severity"
            v-model="filters.severity"
            class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            @change="applyFilters"
          >
            <option :value="undefined">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <!-- Tool filter -->
        <div>
          <label for="filter-tool" class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">TOOL</label>
          <select
            id="filter-tool"
            v-model="filters.sourceTool"
            class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            @change="applyFilters"
          >
            <option :value="undefined">All Tools</option>
            <option value="Semgrep">Semgrep</option>
            <option value="Gitleaks">Gitleaks</option>
            <option value="SAST">SAST</option>
            <option value="Secret Scanner">Secret Scanner</option>
            <option value="Port Scanner">Port Scanner</option>
            <option value="CodeSentinel">CodeSentinel</option>
          </select>
        </div>

        <!-- Actions / Reset -->
        <div class="flex items-end">
          <button
            type="button"
            @click="resetFilters"
            class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <RotateCcw class="size-3.5" />
            <span>Reset filters</span>
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="errorMessage"
      role="alert"
      class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      {{ errorMessage }}
    </p>

    <!-- Table -->
    <div class="overflow-x-auto rounded-lg border border-border bg-card">
      <table class="w-full min-w-[840px] text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">Severity</th>
            <th scope="col" class="px-4 py-3 font-medium">Finding Type & CWE</th>
            <th scope="col" class="px-4 py-3 font-medium">Project</th>
            <th scope="col" class="px-4 py-3 font-medium">File / Path</th>
            <th scope="col" class="px-4 py-3 font-medium">Tool</th>
            <th scope="col" class="px-4 py-3 font-medium">Scan</th>
            <th scope="col" class="px-2 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="isLoading"
            class="border-b border-border/60"
          >
            <td colspan="7" class="p-8 text-center">
              <LoadingState
                compact
                title="Loading security findings..."
                description="Filtering vulnerabilities across projects, tools, and severity thresholds..."
              />
            </td>
          </tr>

          <tr
            v-else-if="displayedFindings.length === 0"
            class="border-b border-border/60"
          >
            <td colspan="7" class="py-12 text-center text-sm text-muted-foreground">
              <ShieldAlert class="mx-auto mb-2 size-6 opacity-40" />
              No security findings match the selected filters.
            </td>
          </tr>

          <tr
            v-for="finding in displayedFindings"
            :key="finding.id"
            class="group border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
          >
            <td class="px-4 py-3">
              <SeverityBadge :severity="finding.severity" />
            </td>
            <td class="px-4 py-3">
              <RouterLink
                :to="{ name: 'finding.show', params: { id: finding.id } }"
                class="font-medium text-foreground transition-colors group-hover:text-primary hover:underline"
              >
                {{ finding.type }}
              </RouterLink>
              <span
                v-if="finding.cwe"
                class="ml-2 font-mono text-[10px] text-muted-foreground"
              >
                {{ finding.cwe }}
              </span>
            </td>
            <td class="px-4 py-3">
              <RouterLink
                v-if="finding.scan?.project?.id"
                :to="{ name: 'project.show', params: { id: finding.scan.project.id } }"
                class="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-primary hover:underline"
              >
                <FolderKanban class="size-3 text-muted-foreground" />
                <span>{{ finding.scan.project.name }}</span>
              </RouterLink>
              <span v-else-if="finding.scan?.project?.name" class="font-mono text-xs text-muted-foreground">
                {{ finding.scan.project.name }}
              </span>
              <span v-else class="font-mono text-xs text-muted-foreground">-</span>
            </td>
            <td class="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-muted-foreground" :title="finding.filePath ?? undefined">
              <span v-if="finding.filePath">
                {{ finding.filePath }}<span v-if="finding.line !== null" class="text-primary">:{{ finding.line }}</span>
              </span>
              <span v-else>-</span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
              {{ finding.sourceTool }}
            </td>
            <td class="px-4 py-3">
              <RouterLink
                v-if="finding.scan?.id"
                :to="{ name: 'scan.show', params: { id: finding.scan.id } }"
                class="font-mono text-xs text-term-cyan hover:underline"
              >
                #{{ finding.scan.scanNumber }}
              </RouterLink>
              <span v-else class="font-mono text-xs text-muted-foreground">-</span>
            </td>
            <td class="px-2 py-3 text-right">
              <RouterLink
                :to="{ name: 'finding.show', params: { id: finding.id } }"
                class="inline-flex items-center text-muted-foreground group-hover:text-foreground"
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

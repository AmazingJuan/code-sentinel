<!-- apps/frontend/src/views/ProjectsView.vue -->
<script setup lang="ts">
import { ChevronRight, ExternalLink, FolderKanban, Search, Terminal } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import LoadingState from '@/components/LoadingState.vue'
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import { ProjectService } from '@/services/ProjectService'

const projects = ref<ProjectInterface[]>([])
const searchQuery = ref('')
const isLoading = ref<boolean>(false)
const errorMessage = ref<string | null>(null)

async function loadProjects(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    projects.value = await ProjectService.getProjects()
  } catch {
    errorMessage.value = 'We could not load the registered projects. Please try again in a few seconds.'
  } finally {
    isLoading.value = false
  }
}

const filteredProjects = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return projects.value
  return projects.value.filter(
    (p) => p.name.toLowerCase().includes(q) || p.repo.toLowerCase().includes(q),
  )
})

const stats = computed(() => {
  const all = projects.value
  return {
    total: all.length,
    critical: all.filter((p) => p.criticalCount > 0).length,
    scanned: all.filter((p) => p.status === 'completed').length,
    pending: all.filter((p) => p.status === 'pending').length,
  }
})

function formatDate(value: string | null): string {
  if (!value) return 'Never scanned'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(loadProjects)
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="Projects & Repositories"
      breadcrumb="~/ projects"
      description="Manage registered codebases, security postures, and scan configurations."
    />

    <!-- Quick Stats Cards -->
    <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-lg border border-border bg-card p-4">
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total Projects</p>
        <p class="mt-1 font-mono text-2xl font-bold text-foreground">{{ stats.total }}</p>
      </div>
      <div class="rounded-lg border border-critical/30 bg-critical/5 p-4">
        <p class="font-mono text-[10px] uppercase tracking-wider text-critical">Projects with Criticals</p>
        <p class="mt-1 font-mono text-2xl font-bold text-critical">{{ stats.critical }}</p>
      </div>
      <div class="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p class="font-mono text-[10px] uppercase tracking-wider text-primary">Analyzed Projects</p>
        <p class="mt-1 font-mono text-2xl font-bold text-primary">{{ stats.scanned }}</p>
      </div>
      <div class="rounded-lg border border-border bg-muted/20 p-4">
        <p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Pending Initial Scan</p>
        <p class="mt-1 font-mono text-2xl font-bold text-muted-foreground">{{ stats.pending }}</p>
      </div>
    </div>

    <!-- Zero-Touch CLI Discovery Banner -->
    <div class="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono text-xs font-bold text-primary">
          <Terminal class="size-4" />
        </div>
        <div>
          <div class="text-sm font-semibold text-foreground">Zero-Touch Project Discovery</div>
          <div class="text-xs text-muted-foreground">
            Projects are automatically recognized and registered the moment you run a scan from the CLI.
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 rounded border border-border bg-muted/60 px-3 py-1.5 font-mono text-xs text-foreground">
        <span class="font-bold text-primary">$</span>
        <code>npx @amazingwalin/code-sentinel-cli scan</code>
      </div>
    </div>

    <!-- Search Toolbar -->
    <div class="mb-4">
      <div class="relative">
        <Search class="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter projects by repository or name..."
          class="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>

    <p v-if="errorMessage" role="alert" class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>
    <p v-else class="mb-2 font-mono text-xs text-muted-foreground">
      {{ isLoading ? 'Loading...' : `${projects.length} project${projects.length === 1 ? '' : 's'}` }}
    </p>

    <!-- Table -->
    <div v-if="!errorMessage" class="overflow-x-auto rounded-lg border border-border bg-card">
      <div v-if="isLoading" class="p-10">
        <LoadingState
          title="Loading security projects..."
          description="Fetching registered repositories, vulnerability metrics, and scan assignments..."
        />
      </div>

      <table v-else-if="projects.length > 0" class="w-full min-w-[760px] text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" class="px-5 py-3 font-medium">Project Name</th>
            <th scope="col" class="px-5 py-3 font-medium">Repository</th>
            <th scope="col" class="px-5 py-3 font-medium">Status</th>
            <th scope="col" class="px-5 py-3 font-medium">Vulnerabilities</th>
            <th scope="col" class="px-5 py-3 font-medium">Last Scan</th>
            <th scope="col" class="px-3 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="project in filteredProjects"
            :key="project.id"
            class="group transition-colors hover:bg-accent/40"
          >
            <td class="px-5 py-4">
              <RouterLink
                :to="{ name: 'project.show', params: { id: project.id } }"
                class="flex items-center gap-2 font-medium text-foreground transition-colors group-hover:text-primary hover:underline"
              >
                <FolderKanban class="size-4 text-muted-foreground" />
                <span class="text-sm font-semibold">{{ project.name }}</span>
              </RouterLink>
            </td>

            <td class="max-w-[260px] truncate px-5 py-4 font-mono text-xs text-muted-foreground" :title="project.repo">
              <span v-if="project.repo" class="inline-flex items-center gap-1.5">
                <ExternalLink class="size-3 shrink-0" />
                <span class="truncate">{{ project.repo }}</span>
              </span>
              <span v-else>-</span>
            </td>

            <td class="px-5 py-4">
              <StatusBadge :status="project.status === 'pending' ? 'pending' : project.status === 'completed' ? 'completed' : 'failed'" />
            </td>

            <td class="px-5 py-4">
              <div class="flex items-center gap-1.5 font-mono text-xs">
                <span
                  v-if="project.criticalCount > 0"
                  class="rounded bg-critical/15 px-1.5 py-0.5 font-bold text-critical"
                  title="Critical issues"
                >
                  {{ project.criticalCount }}C
                </span>
                <span
                  v-if="project.highCount > 0"
                  class="rounded bg-high/15 px-1.5 py-0.5 font-bold text-high"
                  title="High issues"
                >
                  {{ project.highCount }}H
                </span>
                <span
                  v-if="project.mediumCount > 0"
                  class="rounded bg-medium/15 px-1.5 py-0.5 font-medium text-medium"
                  title="Medium issues"
                >
                  {{ project.mediumCount }}M
                </span>
                <span
                  v-if="project.lowCount > 0"
                  class="rounded bg-low/15 px-1.5 py-0.5 text-low"
                  title="Low issues"
                >
                  {{ project.lowCount }}L
                </span>
                <span
                  v-if="project.criticalCount === 0 && project.highCount === 0 && project.mediumCount === 0 && project.lowCount === 0"
                  class="text-muted-foreground"
                >
                  0 issues
                </span>
              </div>
            </td>

            <td class="px-5 py-4 font-mono text-xs text-muted-foreground">
              {{ formatDate(project.lastScan) }}
            </td>

            <td class="px-3 py-4 text-right">
              <RouterLink
                :to="{ name: 'project.show', params: { id: project.id } }"
                class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Dashboard</span>
                <ChevronRight class="size-3.5" />
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!isLoading && projects.length === 0" class="px-4 py-12 text-center text-sm text-muted-foreground">
        <p class="font-medium text-foreground">No projects detected yet</p>
        <p class="mt-1 text-xs">
          Run <code class="rounded bg-muted px-1.5 py-0.5 text-primary">npx @amazingwalin/code-sentinel-cli scan</code> inside any repository to automatically register and analyze it.
        </p>
      </div>
    </div>
  </div>
</template>

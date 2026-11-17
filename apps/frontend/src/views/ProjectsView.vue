<!-- apps/frontend/src/views/ProjectsView.vue -->
<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import type { ProjectInterface, ProjectStatus } from '@/interfaces/ProjectInterface'
import { ProjectService } from '@/services/ProjectService'

const projects = ref<ProjectInterface[]>([])
const isLoading = ref<boolean>(false)
const errorMessage = ref<string | null>(null)

const hasProjects = computed<boolean>(() => projects.value.length > 0)

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

function statusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = { pending: 'Pending scan', completed: 'Completed', failed: 'Failed' }
  return labels[status]
}

function statusClass(status: ProjectStatus): string {
  const classes: Record<ProjectStatus, string> = {
    pending: 'border-border bg-muted/40 text-muted-foreground',
    completed: 'border-primary/30 bg-primary/10 text-primary',
    failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  }
  return classes[status]
}

function formatDate(value: string | null): string {
  if (!value) return 'Never scanned'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(loadProjects)
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="Projects"
      breadcrumb="~/ projects"
      description="Configured software repositories and security profiles."
    />

    <div class="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono text-xs font-bold text-primary">
          &gt;_
        </div>
        <div>
          <div class="text-sm font-medium text-foreground">Zero-Touch Project Discovery</div>
          <div class="text-xs text-muted-foreground">
            Projects are automatically identified and registered in your console as soon as you run a security scan.
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
        <span class="font-semibold text-primary">$</span>
        <code>npx @amazingwalin/code-sentinel-cli scan</code>
      </div>
    </div>

    <p v-if="errorMessage" role="alert" class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ errorMessage }}
    </p>
    <p v-else class="mb-2 font-mono text-xs text-muted-foreground">
      {{ isLoading ? 'Loading...' : `${projects.length} project${projects.length === 1 ? '' : 's'}` }}
    </p>

    <div v-if="!errorMessage" class="overflow-x-auto rounded-lg border border-border bg-card">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">Project</th>
            <th scope="col" class="px-4 py-3 font-medium">Source</th>
            <th scope="col" class="px-4 py-3 font-medium">Status</th>
            <th scope="col" class="px-4 py-3 font-medium">Last scan</th>
            <th scope="col" class="px-3 py-3 text-right font-medium">Findings</th>
            <th scope="col" class="px-2 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <RouterLink
            v-for="project in projects"
            :key="project.id"
            :to="{ name: 'project.show', params: { id: project.id } }"
            custom
            v-slot="{ navigate }"
          >
            <tr class="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40" @click="navigate">
              <td class="px-4 py-3 font-mono font-medium text-primary hover:underline">{{ project.name }}</td>
              <td class="max-w-xs truncate px-4 py-3 font-mono text-xs text-term-cyan" :title="project.repo">{{ project.repo }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium" :class="statusClass(project.status)">
                  <span class="size-1.5 rounded-full" :class="project.status === 'completed' ? 'bg-primary' : project.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground'" aria-hidden="true" />
                  {{ statusLabel(project.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ formatDate(project.lastScan) }}</td>
              <td class="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                {{ project.criticalCount + project.highCount + project.mediumCount + project.lowCount }}
              </td>
              <td class="px-2 py-3 text-muted-foreground"><ChevronRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" /></td>
            </tr>
          </RouterLink>
        </tbody>
      </table>
      <div v-if="!isLoading && !hasProjects" class="px-4 py-12 text-center text-sm text-muted-foreground">
        <p class="font-medium text-foreground">No projects detected yet</p>
        <p class="mt-1 text-xs">Run <code class="rounded bg-muted px-1.5 py-0.5 text-primary">npx @amazingwalin/code-sentinel-cli scan</code> inside any repository to automatically register and analyze it.</p>
      </div>
    </div>
  </div>
</template>

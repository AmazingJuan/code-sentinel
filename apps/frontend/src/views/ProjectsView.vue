<!-- apps/frontend/src/views/ProjectsView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { ChevronRight, FolderPlus } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'
import type { ProjectInterface, ProjectStatus } from '@/interfaces/ProjectInterface'
import { ProjectService } from '@/services/ProjectService'

const projects = ref<ProjectInterface[]>([])
const isLoading = ref<boolean>(false)
const isSubmitting = ref<boolean>(false)
const errorMessage = ref<string | null>(null)
const formErrorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const form = ref<{ name: string; repo: string }>({ name: '', repo: '' })

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

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(' ')
    if (message) return message
  }
  return fallback
}

async function registerProject(): Promise<void> {
  formErrorMessage.value = null
  successMessage.value = null
  isSubmitting.value = true
  try {
    const project = await ProjectService.createProject({ name: form.value.name, repo: form.value.repo })
    projects.value = [project, ...projects.value]
    form.value = { name: '', repo: '' }
    successMessage.value = `Project "${project.name}" was registered successfully and is ready for configuration and scanning.`
  } catch (error) {
    formErrorMessage.value = extractErrorMessage(error, 'We could not register this project.')
  } finally {
    isSubmitting.value = false
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

    <div class="mb-6 rounded-lg border border-border bg-card p-5">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <FolderPlus class="size-4 text-primary" />
        Register a new project
      </div>

      <p v-if="formErrorMessage" role="alert" class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        {{ formErrorMessage }}
      </p>
      <p v-if="successMessage" role="status" class="mb-3 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
        {{ successMessage }}
      </p>

      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="registerProject">
        <div>
          <label for="project-name" class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">PROJECT NAME</label>
          <input
            id="project-name"
            v-model="form.name"
            required
            maxlength="120"
            placeholder="payments-service"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="project-repo" class="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">SOURCE CODE LOCATION</label>
          <input
            id="project-repo"
            v-model="form.repo"
            required
            maxlength="500"
            placeholder="git@github.com:org/payments-service.git"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div class="sm:col-span-2">
          <button
            type="submit"
            :disabled="isSubmitting"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isSubmitting ? 'Registering...' : 'Register project' }}
          </button>
        </div>
      </form>
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
      <p v-if="!isLoading && !hasProjects" class="px-4 py-12 text-center text-sm text-muted-foreground">
        No projects have been registered yet. Use the form above to register your first project.
      </p>
    </div>
  </div>
</template>

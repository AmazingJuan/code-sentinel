<!-- apps/frontend/src/views/ProjectsView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { FolderPlus } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

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
    pending: 'border-gray-700 bg-gray-800/40 text-gray-300',
    completed: 'border-green-800 bg-green-900/30 text-green-300',
    failed: 'border-red-800 bg-red-900/30 text-red-300',
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
    <div class="mb-6">
      <p class="mb-2 font-mono text-xs text-gray-500">~/ projects</p>
      <h1 class="text-xl font-semibold tracking-tight text-white md:text-2xl">Projects</h1>
      <p class="mt-1 max-w-2xl text-sm text-gray-400">Register software projects so they can be configured and analyzed by Code Sentinel.</p>
    </div>

    <div class="mb-6 rounded-lg border border-gray-800 bg-gray-900/40 p-5">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
        <FolderPlus class="size-4" />
        Register a new project
      </div>

      <p v-if="formErrorMessage" class="mb-3 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
        {{ formErrorMessage }}
      </p>
      <p v-if="successMessage" class="mb-3 rounded-md border border-green-900 bg-green-950/40 px-4 py-2 text-sm text-green-300">
        {{ successMessage }}
      </p>

      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="registerProject">
        <div>
          <label for="project-name" class="mb-1.5 block text-[11px] tracking-wide text-gray-500">PROJECT NAME</label>
          <input
            id="project-name"
            v-model="form.name"
            required
            maxlength="120"
            placeholder="payments-service"
            class="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-green-600"
          />
        </div>
        <div>
          <label for="project-repo" class="mb-1.5 block text-[11px] tracking-wide text-gray-500">SOURCE CODE LOCATION</label>
          <input
            id="project-repo"
            v-model="form.repo"
            required
            maxlength="500"
            placeholder="git@github.com:org/payments-service.git"
            class="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-green-600"
          />
        </div>
        <div class="sm:col-span-2">
          <button
            type="submit"
            :disabled="isSubmitting"
            class="rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isSubmitting ? 'Registering…' : 'Register project' }}
          </button>
        </div>
      </form>
    </div>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>
    <p v-else class="mb-2 font-mono text-xs text-gray-500">
      {{ isLoading ? 'Loading…' : `${projects.length} project${projects.length === 1 ? '' : 's'}` }}
    </p>

    <div v-if="!errorMessage" class="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/40">
      <table class="w-full min-w-[640px] text-left text-sm">
        <thead class="text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th class="px-4 py-3 font-medium">Project</th>
            <th class="px-4 py-3 font-medium">Source</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Last scan</th>
            <th class="px-3 py-3 text-right font-medium">Findings</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in projects" :key="project.id" class="border-t border-gray-800/60">
            <td class="px-4 py-3 font-mono text-gray-200">{{ project.name }}</td>
            <td class="max-w-xs truncate px-4 py-3 text-gray-400" :title="project.repo">{{ project.repo }}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium" :class="statusClass(project.status)">
                {{ statusLabel(project.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-400">{{ formatDate(project.lastScan) }}</td>
            <td class="px-3 py-3 text-right font-mono tabular-nums text-white">
              {{ project.criticalCount + project.highCount + project.mediumCount + project.lowCount }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!isLoading && !hasProjects" class="px-4 py-12 text-center text-sm text-gray-500">
        No projects have been registered yet. Use the form above to register your first project.
      </p>
    </div>
  </div>
</template>

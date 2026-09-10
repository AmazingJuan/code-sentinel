<!-- apps/frontend/src/views/ProjectDetailView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { ChevronLeft, Settings2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import ProjectAssignmentsPanel from '@/components/ProjectAssignmentsPanel.vue'
import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import { SCAN_TOOLS } from '@/interfaces/ScanInterface'
import type { ScanTool } from '@/interfaces/ScanInterface'
import type { ProjectInterface, ProjectStatus } from '@/interfaces/ProjectInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'
import { AuthService } from '@/services/AuthService'
import { ProjectService } from '@/services/ProjectService'
import { UserService } from '@/services/UserService'

const route = useRoute()
const project = ref<ProjectInterface | null>(null)
const isLoading = ref<boolean>(false)
const isSaving = ref<boolean>(false)
const errorMessage = ref<string | null>(null)
const formErrorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const form = ref<{ repo: string; tools: ScanTool[] }>({ repo: '', tools: [] })

const isAdmin = computed<boolean>(() => AuthService.getUser()?.role === 'admin')

const assignments = ref<ProjectAssignment[]>([])
const allUsers = ref<ManagedUser[]>([])
const isLoadingAssignments = ref<boolean>(false)
const isSavingAssignment = ref<boolean>(false)
const assignmentErrorMessage = ref<string | null>(null)

const availableUsers = computed<ManagedUser[]>(() => {
  const assignedUserIds = new Set(assignments.value.map((assignment) => assignment.userId))
  return allUsers.value.filter((user) => !assignedUserIds.has(user.id))
})

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    if (error.response?.status === 403) return 'You do not have access to this project.'
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(' ')
    if (message) return message
  }
  return fallback
}

async function loadProject(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    const id = route.params.id as string
    project.value = await ProjectService.getProjectById(id)
    form.value = { repo: project.value.repo, tools: [...project.value.tools] }
    if (isAdmin.value) {
      await loadAssignments()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not load this project.')
  } finally {
    isLoading.value = false
  }
}

async function loadAssignments(): Promise<void> {
  if (!project.value) return
  isLoadingAssignments.value = true
  assignmentErrorMessage.value = null
  try {
    const [projectAssignments, users] = await Promise.all([
      ProjectService.getAssignments(project.value.id),
      allUsers.value.length > 0 ? Promise.resolve(allUsers.value) : UserService.findAll(),
    ])
    assignments.value = projectAssignments
    allUsers.value = users
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(error, 'We could not load the project assignments.')
  } finally {
    isLoadingAssignments.value = false
  }
}

async function assignUser(userId: string): Promise<void> {
  if (!project.value) return
  isSavingAssignment.value = true
  assignmentErrorMessage.value = null
  try {
    const assignment = await ProjectService.assignUser(project.value.id, userId)
    assignments.value = [...assignments.value, assignment]
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(error, 'We could not assign this user.')
  } finally {
    isSavingAssignment.value = false
  }
}

async function unassignUser(userId: string): Promise<void> {
  if (!project.value) return
  isSavingAssignment.value = true
  assignmentErrorMessage.value = null
  try {
    await ProjectService.unassignUser(project.value.id, userId)
    assignments.value = assignments.value.filter((assignment) => assignment.userId !== userId)
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(error, 'We could not remove this assignment.')
  } finally {
    isSavingAssignment.value = false
  }
}

function toggleTool(tool: ScanTool): void {
  form.value.tools = form.value.tools.includes(tool)
    ? form.value.tools.filter((selected) => selected !== tool)
    : [...form.value.tools, tool]
}

async function saveConfiguration(): Promise<void> {
  if (!project.value) return
  formErrorMessage.value = null
  successMessage.value = null

  if (form.value.tools.length === 0) {
    formErrorMessage.value = 'Select at least one security tool.'
    return
  }

  isSaving.value = true
  try {
    project.value = await ProjectService.updateProject(project.value.id, {
      repo: form.value.repo,
      tools: form.value.tools,
    })
    form.value = { repo: project.value.repo, tools: [...project.value.tools] }
    successMessage.value = 'Configuration saved. These settings will be used for the next security scan.'
  } catch (error) {
    formErrorMessage.value = extractErrorMessage(error, 'We could not save this configuration.')
  } finally {
    isSaving.value = false
  }
}

function statusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = { pending: 'Pending scan', completed: 'Completed', failed: 'Failed' }
  return labels[status]
}

onMounted(loadProject)
</script>

<template>
  <div class="p-5 sm:p-8">
    <RouterLink :to="{ name: 'project.index' }" class="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
      <ChevronLeft class="size-4" />
      Back to projects
    </RouterLink>

    <p v-if="errorMessage" class="mt-3 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>
    <p v-else-if="isLoading" class="mt-3 text-sm text-gray-500">Loading…</p>

    <template v-else-if="project">
      <p class="font-mono text-xs text-gray-500">~/ projects/{{ project.name }}</p>
      <h1 class="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">{{ project.name }}</h1>
      <p class="mt-1 text-sm text-gray-400">Status: {{ statusLabel(project.status) }}</p>

      <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900/40 p-5">
        <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
          <Settings2 class="size-4" />
          Security analysis configuration
        </div>

        <p v-if="formErrorMessage" class="mb-3 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {{ formErrorMessage }}
        </p>
        <p v-if="successMessage" class="mb-3 rounded-md border border-green-900 bg-green-950/40 px-4 py-2 text-sm text-green-300">
          {{ successMessage }}
        </p>

        <form class="grid gap-4" @submit.prevent="saveConfiguration">
          <div>
            <label for="project-repo" class="mb-1.5 block text-[11px] tracking-wide text-gray-500">SOURCE CODE LOCATION</label>
            <input
              id="project-repo"
              v-model="form.repo"
              required
              maxlength="500"
              class="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-green-600"
            />
          </div>

          <div>
            <p class="mb-1.5 text-[11px] tracking-wide text-gray-500">SECURITY TOOLS</p>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="tool in SCAN_TOOLS"
                :key="tool"
                class="flex cursor-pointer items-center gap-2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200"
              >
                <input
                  type="checkbox"
                  :checked="form.tools.includes(tool)"
                  class="size-4 accent-green-500"
                  @change="toggleTool(tool)"
                />
                {{ tool }}
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="isSaving"
              class="rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ isSaving ? 'Saving…' : 'Save configuration' }}
            </button>
          </div>
        </form>
      </div>

      <ProjectAssignmentsPanel
        v-if="isAdmin"
        :assignments="assignments"
        :available-users="availableUsers"
        :is-loading="isLoadingAssignments"
        :is-saving="isSavingAssignment"
        :error-message="assignmentErrorMessage"
        @assign="assignUser"
        @unassign="unassignUser"
      />
    </template>
  </div>
</template>

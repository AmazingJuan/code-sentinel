<!-- apps/frontend/src/views/ProjectAccessView.vue -->
<!--
  RF-035 + RF-032: the administrator assigns projects to analysts here. It
  only ever sees each project's id and name (GET /projects/directory), never
  its configuration, scans, findings or reports.
-->
<script setup lang="ts">
import axios from 'axios'
import { KeyRound } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import ProjectAssignmentsPanel from '@/components/ProjectAssignmentsPanel.vue'
import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import type { ProjectDirectoryEntryInterface } from '@/interfaces/ProjectDirectoryEntryInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'
import { ProjectService } from '@/services/ProjectService'
import { UserService } from '@/services/UserService'

const projects = ref<ProjectDirectoryEntryInterface[]>([])
const selectedProjectId = ref<string>('')
const assignments = ref<ProjectAssignment[]>([])
const analysts = ref<ManagedUser[]>([])
const isLoading = ref<boolean>(false)
const isLoadingAssignments = ref<boolean>(false)
const isSaving = ref<boolean>(false)
const errorMessage = ref<string | null>(null)
const assignmentErrorMessage = ref<string | null>(null)

// Only analysts can be assigned: an admin never accesses project content.
const availableUsers = computed<ManagedUser[]>(() => {
  const assignedUserIds = new Set(assignments.value.map((assignment) => assignment.userId))
  return analysts.value.filter((user) => !assignedUserIds.has(user.id))
})

const projectPlaceholder = computed<string>(() =>
  projects.value.length === 0 ? 'No projects registered yet' : 'Select a project',
)

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join(' ')
    if (message) return message
  }
  return fallback
}

async function loadDirectory(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    const [directory, users] = await Promise.all([
      ProjectService.getDirectory(),
      UserService.findAll(),
    ])
    projects.value = directory
    analysts.value = users.filter((user) => user.role === 'analyst')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not load the projects.')
  } finally {
    isLoading.value = false
  }
}

async function selectProject(projectId: string): Promise<void> {
  selectedProjectId.value = projectId
  assignments.value = []
  if (!projectId) return

  isLoadingAssignments.value = true
  assignmentErrorMessage.value = null
  try {
    assignments.value = await ProjectService.getAssignments(projectId)
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(
      error,
      'We could not load the project assignments.',
    )
  } finally {
    isLoadingAssignments.value = false
  }
}

async function assignUser(userId: string): Promise<void> {
  if (!selectedProjectId.value) return
  isSaving.value = true
  assignmentErrorMessage.value = null
  try {
    const assignment = await ProjectService.assignUser(selectedProjectId.value, userId)
    assignments.value = [...assignments.value, assignment]
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(error, 'We could not assign this user.')
  } finally {
    isSaving.value = false
  }
}

async function unassignUser(userId: string): Promise<void> {
  if (!selectedProjectId.value) return
  isSaving.value = true
  assignmentErrorMessage.value = null
  try {
    await ProjectService.unassignUser(selectedProjectId.value, userId)
    assignments.value = assignments.value.filter((assignment) => assignment.userId !== userId)
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(
      error,
      'We could not remove this assignment.',
    )
  } finally {
    isSaving.value = false
  }
}

function onProjectChange(event: Event): void {
  void selectProject((event.target as HTMLSelectElement).value)
}

onMounted(loadDirectory)
</script>

<template>
  <div class="p-5 sm:p-8">
    <p class="font-mono text-xs text-gray-500">~/ project-access</p>
    <h1 class="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">Project access</h1>
    <p class="mt-1 text-sm text-gray-500">
      Choose which analysts can work on each project. Security content stays private to them.
    </p>

    <p
      v-if="errorMessage"
      class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300"
    >
      {{ errorMessage }}
    </p>
    <p v-else-if="isLoading" class="mt-5 text-sm text-gray-500">Loading…</p>

    <template v-else>
      <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900/40 p-5">
        <label
          for="project-select"
          class="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-400"
        >
          <KeyRound class="size-4" />
          Project
        </label>
        <select
          id="project-select"
          :value="selectedProjectId"
          :disabled="projects.length === 0"
          class="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-80"
          @change="onProjectChange"
        >
          <option value="" disabled>
            {{ projectPlaceholder }}
          </option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>

      <ProjectAssignmentsPanel
        v-if="selectedProjectId"
        :assignments="assignments"
        :available-users="availableUsers"
        :is-loading="isLoadingAssignments"
        :is-saving="isSaving"
        :error-message="assignmentErrorMessage"
        @assign="assignUser"
        @unassign="unassignUser"
      />
    </template>
  </div>
</template>
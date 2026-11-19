<script setup lang="ts">
// RF-035 + RF-032: the administrator assigns projects to analysts here. It only ever
// sees each project's id and name (GET /projects/directory), never its security content.
import { KeyRound } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import ProjectAssignmentsPanel from '@/components/ProjectAssignmentsPanel.vue'
import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import type { ProjectDirectoryEntryInterface } from '@/interfaces/ProjectDirectoryEntryInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { ProjectService } from '@/services/ProjectService'
import { UserService } from '@/services/UserService'
import { getToastStore } from '@/stores/toastStore'

const toastStore = getToastStore()
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
  assignmentErrorMessage.value = null
  if (!projectId) return

  isLoadingAssignments.value = true
  try {
    const loaded = await ProjectService.getAssignments(projectId)
    // Ignore a slow response for a project the admin has already switched away from.
    if (selectedProjectId.value === projectId) assignments.value = loaded
  } catch (error) {
    if (selectedProjectId.value !== projectId) return
    assignmentErrorMessage.value = extractErrorMessage(
      error,
      'We could not load the project assignments.',
    )
  } finally {
    if (selectedProjectId.value === projectId) isLoadingAssignments.value = false
  }
}

async function assignUser(userId: string): Promise<void> {
  const projectId = selectedProjectId.value
  if (!projectId) return
  isSaving.value = true
  assignmentErrorMessage.value = null
  try {
    const assignment = await ProjectService.assignUser(projectId, userId)
    if (selectedProjectId.value === projectId) {
      assignments.value = [...assignments.value, assignment]
    }
    toastStore.success('Analyst assigned', 'User granted access to project.')
  } catch (error) {
    assignmentErrorMessage.value = extractErrorMessage(error, 'We could not assign this user.')
  } finally {
    isSaving.value = false
  }
}

async function unassignUser(userId: string): Promise<void> {
  const projectId = selectedProjectId.value
  if (!projectId) return
  isSaving.value = true
  assignmentErrorMessage.value = null
  try {
    await ProjectService.unassignUser(projectId, userId)
    if (selectedProjectId.value === projectId) {
      assignments.value = assignments.value.filter((assignment) => assignment.userId !== userId)
    }
    toastStore.success('Analyst removed', 'Project access revoked.')
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
    <PageHeader
      title="Project access"
      breadcrumb="~/ project-access"
      description="Manage analyst assignments and repository permissions."
    />

    <div v-if="errorMessage" class="mt-5">
      <ErrorState
        title="Failed to Load Projects"
        :message="errorMessage"
        @retry="loadDirectory"
      />
    </div>
    <div v-else-if="isLoading" class="mt-5">
      <LoadingState compact title="Loading projects..." />
    </div>

    <template v-else>
      <div class="mt-6 rounded-lg border border-border bg-card p-5">
        <label
          for="project-select"
          class="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <KeyRound class="size-4 text-primary" />
          Project
        </label>
        <select
          id="project-select"
          :value="selectedProjectId"
          :disabled="projects.length === 0"
          class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 sm:w-80"
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

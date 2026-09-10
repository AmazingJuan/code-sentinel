<!-- apps/frontend/src/components/ProjectAssignmentsPanel.vue -->
<script setup lang="ts">
import { UserMinus, UserPlus, Users } from 'lucide-vue-next'
import { ref } from 'vue'

import type { ProjectAssignment } from '@/interfaces/ProjectAssignmentInterface'
import type { ManagedUser } from '@/interfaces/UserInterface'

const props = defineProps<{
  assignments: ProjectAssignment[]
  availableUsers: ManagedUser[]
  isLoading: boolean
  isSaving: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  assign: [userId: string]
  unassign: [userId: string]
}>()

const selectedUserId = ref<string>('')

function submitAssignment(): void {
  if (!selectedUserId.value) return
  emit('assign', selectedUserId.value)
  selectedUserId.value = ''
}
</script>

<template>
  <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900/40 p-5">
    <div class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
      <Users class="size-4" />
      Project access
    </div>

    <p v-if="props.errorMessage" class="mb-3 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
      {{ props.errorMessage }}
    </p>

    <form class="mb-4 flex flex-wrap items-center gap-3" @submit.prevent="submitAssignment">
      <select
        v-model="selectedUserId"
        :disabled="props.isSaving || props.availableUsers.length === 0"
        class="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>
          {{ props.availableUsers.length === 0 ? 'No other users available' : 'Select a user to assign' }}
        </option>
        <option v-for="user in props.availableUsers" :key="user.id" :value="user.id">{{ user.name }} ({{ user.email }})</option>
      </select>
      <button
        type="submit"
        :disabled="props.isSaving || !selectedUserId"
        class="inline-flex items-center gap-1.5 rounded-md bg-green-500 px-3 py-2 text-sm font-medium text-gray-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UserPlus class="size-4" />
        Assign
      </button>
    </form>

    <p v-if="props.isLoading" class="text-sm text-gray-500">Loading assignments…</p>
    <p v-else-if="props.assignments.length === 0" class="text-sm text-gray-500">No users are assigned to this project yet.</p>
    <ul v-else class="divide-y divide-gray-800/70">
      <li v-for="assignment in props.assignments" :key="assignment.id" class="flex items-center justify-between py-2 text-sm">
        <div>
          <p class="text-gray-200">{{ assignment.user.name }}</p>
          <p class="text-xs text-gray-500">{{ assignment.user.email }}</p>
        </div>
        <button
          type="button"
          :disabled="props.isSaving"
          class="inline-flex items-center gap-1 text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
          @click="emit('unassign', assignment.userId)"
        >
          <UserMinus class="size-4" />
          Remove
        </button>
      </li>
    </ul>
  </div>
</template>

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
  <div class="mt-6 rounded-lg border border-border bg-card p-5">
    <div class="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
      <Users class="size-4 text-primary" />
      Project access
    </div>

    <p v-if="props.errorMessage" class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {{ props.errorMessage }}
    </p>

    <form class="mb-4 flex flex-wrap items-center gap-3" @submit.prevent="submitAssignment">
      <select
        v-model="selectedUserId"
        :disabled="props.isSaving || props.availableUsers.length === 0"
        class="rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>
          {{ props.availableUsers.length === 0 ? 'No other users available' : 'Select a user to assign' }}
        </option>
        <option v-for="user in props.availableUsers" :key="user.id" :value="user.id">{{ user.name }} ({{ user.email }})</option>
      </select>
      <button
        type="submit"
        :disabled="props.isSaving || !selectedUserId"
        class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UserPlus class="size-4" />
        Assign
      </button>
    </form>

    <p v-if="props.isLoading" class="text-sm text-muted-foreground">Loading assignments…</p>
    <p v-else-if="props.assignments.length === 0" class="text-sm text-muted-foreground">No users are assigned to this project yet.</p>
    <ul v-else class="divide-y divide-border/60">
      <li v-for="assignment in props.assignments" :key="assignment.id" class="flex items-center justify-between py-2 text-sm">
        <div>
          <p class="text-foreground">{{ assignment.user.name }}</p>
          <p class="text-xs text-muted-foreground">{{ assignment.user.email }}</p>
        </div>
        <button
          type="button"
          :disabled="props.isSaving"
          class="inline-flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          @click="emit('unassign', assignment.userId)"
        >
          <UserMinus class="size-4" />
          Remove
        </button>
      </li>
    </ul>
  </div>
</template>

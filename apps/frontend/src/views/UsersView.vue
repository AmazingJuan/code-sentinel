<script setup lang="ts">
import { AlertCircle, CheckCircle2, UserPlus, Users } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import ConfirmModal from '@/components/ConfirmModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import PageHeader from '@/components/PageHeader.vue'
import type { CreateUserPayload, ManagedUser } from '@/interfaces/UserInterface'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { UserService } from '@/services/UserService'
import { getToastStore } from '@/stores/toastStore'

function emptyForm(): CreateUserPayload {
  return { name: '', email: '', password: '', role: 'analyst' }
}

const toastStore = getToastStore()
const users = ref<ManagedUser[]>([])
const loadErrorMessage = ref<string>('')
const errorMessage = ref<string>('')
const successMessage = ref<string>('')
const isLoading = ref<boolean>(false)
const isSubmitting = ref<boolean>(false)
const form = ref<CreateUserPayload>(emptyForm())
const editingUserId = ref<string | null>(null)
const pendingDeleteUser = ref<ManagedUser | null>(null)
const isDeleting = ref<boolean>(false)

const deleteConfirmMessage = computed<string>(() =>
  pendingDeleteUser.value
    ? `Delete ${pendingDeleteUser.value.name} (${pendingDeleteUser.value.email})? This cannot be undone.`
    : '',
)

async function loadUsers(): Promise<void> {
  isLoading.value = true
  loadErrorMessage.value = ''
  try {
    users.value = await UserService.findAll()
  } catch (error) {
    loadErrorMessage.value = extractErrorMessage(error, 'We could not load users.')
  } finally {
    isLoading.value = false
  }
}

async function createUser(): Promise<void> {
  await UserService.create(form.value)
  form.value = emptyForm()
  successMessage.value = 'User created successfully.'
  toastStore.success('User created', 'The user account has been successfully created.')
  await loadUsers()
}

async function saveUser(id: string): Promise<void> {
  const { name, email, role } = form.value
  const updatedUser = await UserService.update(id, { name, email, role })
  users.value = users.value.map((user) => (user.id === updatedUser.id ? updatedUser : user))
  cancelEditing()
  successMessage.value = 'User updated successfully.'
  toastStore.success('User updated', 'User details have been saved.')
}

async function submitForm(): Promise<void> {
  if (isSubmitting.value) return
  const editingId = editingUserId.value
  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (editingId) await saveUser(editingId)
    else await createUser()
  } catch (error) {
    errorMessage.value = extractErrorMessage(
      error,
      editingId ? 'We could not update this user.' : 'We could not create this user.',
    )
  } finally {
    isSubmitting.value = false
  }
}

function startEditing(user: ManagedUser): void {
  editingUserId.value = user.id
  form.value = { name: user.name, email: user.email, password: '', role: user.role }
}

function cancelEditing(): void {
  editingUserId.value = null
  form.value = emptyForm()
}

function requestDelete(user: ManagedUser): void {
  pendingDeleteUser.value = user
}

function cancelDelete(): void {
  if (!isDeleting.value) pendingDeleteUser.value = null
}

async function confirmDelete(): Promise<void> {
  const user = pendingDeleteUser.value
  if (!user) return
  isDeleting.value = true
  errorMessage.value = ''
  try {
    await UserService.remove(user.id)
    users.value = users.value.filter((candidate) => candidate.id !== user.id)
    if (editingUserId.value === user.id) cancelEditing()
    toastStore.success('User deleted', 'The user has been removed.')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not delete this user.')
  } finally {
    isDeleting.value = false
    pendingDeleteUser.value = null
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="p-5 sm:p-8">
    <PageHeader
      title="User management"
      breadcrumb="~/ users"
      description="Manage user accounts and role permissions."
    />

    <div
      v-if="errorMessage"
      role="alert"
      class="mt-5 flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <div class="flex items-center gap-2">
        <AlertCircle class="size-4 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>
      <button type="button" @click="errorMessage = ''" class="text-xs hover:underline">Dismiss</button>
    </div>

    <div
      v-if="successMessage"
      role="status"
      class="mt-5 flex items-start justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 class="size-4 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
      <button type="button" @click="successMessage = ''" class="text-xs hover:underline">Dismiss</button>
    </div>

    <div class="mt-6 rounded-lg border border-border bg-card p-5">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <UserPlus class="size-4 text-primary" />
        {{ editingUserId ? 'Edit user' : 'Create new user' }}
      </div>

      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="submitForm">
        <div>
          <label for="user-name" class="sr-only">Name</label>
          <input
            id="user-name"
            v-model="form.name"
            required
            autocomplete="off"
            placeholder="Name"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="user-email" class="sr-only">Email</label>
          <input
            id="user-email"
            v-model="form.email"
            required
            type="email"
            autocomplete="off"
            placeholder="Email"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div v-if="!editingUserId">
          <label for="user-password" class="sr-only">Temporary password</label>
          <input
            id="user-password"
            v-model="form.password"
            required
            minlength="8"
            type="password"
            autocomplete="new-password"
            placeholder="Temporary password"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="user-role" class="sr-only">Role</label>
          <select
            id="user-role"
            v-model="form.role"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="flex gap-3 sm:col-span-2">
          <button
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Saving...' : editingUserId ? 'Save changes' : 'Create user' }}
          </button>
          <button
            v-if="editingUserId"
            class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            type="button"
            @click="cancelEditing"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>

    <div class="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
      <div v-if="isLoading" class="p-8">
        <LoadingState compact title="Loading user directory..." description="Fetching administrators and security analysts..." />
      </div>
      <div v-else-if="loadErrorMessage" class="p-4">
        <ErrorState compact title="Failed to Load Users" :message="loadErrorMessage" @retry="loadUsers" />
      </div>
      <div v-else-if="users.length === 0" class="p-4">
        <EmptyState compact :icon="Users" title="No users yet" description="Create the first account with the form above." />
      </div>
      <table v-else class="w-full min-w-[560px] text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">Name</th>
            <th scope="col" class="px-4 py-3 font-medium">Email</th>
            <th scope="col" class="px-4 py-3 font-medium">Role</th>
            <th scope="col" class="px-4 py-3 font-medium text-right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40">
            <td class="px-4 py-3 font-medium text-foreground">{{ user.name }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ user.email }}</td>
            <td class="px-4 py-3">
              <span class="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-mono capitalize text-muted-foreground">
                {{ user.role }}
              </span>
            </td>
            <td class="space-x-3 whitespace-nowrap px-4 py-3 text-right">
              <button type="button" class="text-sm font-medium text-primary hover:underline" :aria-label="'Edit user ' + user.name" @click="startEditing(user)">Edit</button>
              <button type="button" class="text-sm font-medium text-destructive hover:underline" :aria-label="'Delete user ' + user.name" @click="requestDelete(user)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmModal
      :is-open="pendingDeleteUser !== null"
      title="Delete user"
      :message="deleteConfirmMessage"
      confirm-text="Delete"
      :is-loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

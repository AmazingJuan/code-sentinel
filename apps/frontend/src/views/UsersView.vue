<!-- apps/frontend/src/views/UsersView.vue -->
<script setup lang="ts">
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import LoadingState from '@/components/LoadingState.vue'
import type { ManagedUser } from '@/interfaces/UserInterface'
import { UserService } from '@/services/UserService'
import { extractErrorMessage } from '@/services/ErrorHelper'
import { getToastStore } from '@/stores/toastStore'

const toastStore = getToastStore()
const users = ref<ManagedUser[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const form = ref({ name: '', email: '', password: '', role: 'analyst' as ManagedUser['role'] })
const editingUserId = ref<string | null>(null)

async function loadUsers(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    users.value = await UserService.findAll()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not load users.')
  } finally {
    isLoading.value = false
  }
}

async function createUser(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await UserService.create(form.value)
    form.value = { name: '', email: '', password: '', role: 'analyst' }
    successMessage.value = 'User created successfully.'
    toastStore.success('User created', 'The user account has been successfully created.')
    await loadUsers()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not create this user.')
  }
}

function startEditing(user: ManagedUser): void {
  editingUserId.value = user.id
  form.value = { name: user.name, email: user.email, password: '', role: user.role }
}

function cancelEditing(): void {
  editingUserId.value = null
  form.value = { name: '', email: '', password: '', role: 'analyst' }
}

async function saveUser(): Promise<void> {
  if (!editingUserId.value) return
  errorMessage.value = ''
  try {
    const updatedUser = await UserService.update(editingUserId.value, form.value)
    users.value = users.value.map((user) => user.id === updatedUser.id ? updatedUser : user)
    cancelEditing()
    successMessage.value = 'User updated successfully.'
    toastStore.success('User updated', 'User details have been saved.')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not update this user.')
  }
}

async function deleteUser(id: string): Promise<void> {
  if (!window.confirm('Delete this user?')) return
  errorMessage.value = ''
  try {
    await UserService.remove(id)
    users.value = users.value.filter((user) => user.id !== id)
    toastStore.success('User deleted', 'The user has been removed.')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'We could not delete this user.')
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

      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="editingUserId ? saveUser() : createUser()">
        <div>
          <label for="user-name" class="sr-only">Name</label>
          <input
            id="user-name"
            v-model="form.name"
            required
            aria-label="User name"
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
            aria-label="User email"
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
            aria-label="Temporary password"
            placeholder="Temporary password"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="user-role" class="sr-only">Role</label>
          <select
            id="user-role"
            v-model="form.role"
            aria-label="User role"
            class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="flex gap-3 sm:col-span-2">
          <button
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            type="submit"
          >
            {{ editingUserId ? 'Save changes' : 'Create user' }}
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

    <div class="mt-6 overflow-hidden rounded-lg border border-border bg-card">
      <div v-if="isLoading" class="p-8">
        <LoadingState compact title="Loading user directory..." description="Fetching administrators and security analysts..." />
      </div>
      <table v-else class="w-full text-left text-sm">
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
            <td class="space-x-3 px-4 py-3 text-right">
              <button class="text-sm font-medium text-primary hover:underline" :aria-label="'Edit user ' + user.name" @click="startEditing(user)">Edit</button>
              <button class="text-sm font-medium text-destructive hover:underline" :aria-label="'Delete user ' + user.name" @click="deleteUser(user.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<!-- apps/frontend/src/views/UsersView.vue -->
<script setup lang="ts">
import axios from 'axios'
import { UserPlus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import type { ManagedUser } from '@/interfaces/UserInterface'
import { UserService } from '@/services/UserService'

const users = ref<ManagedUser[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const form = ref({ name: '', email: '', password: '', role: 'analyst' as ManagedUser['role'] })
const editingUserId = ref<string | null>(null)

async function loadUsers(): Promise<void> {
  isLoading.value = true
  try {
    users.value = await UserService.findAll()
  } catch {
    errorMessage.value = 'We could not load users.'
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
    await loadUsers()
  } catch (error) {
    if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
      const message = error.response?.data?.message
      errorMessage.value = Array.isArray(message) ? message.join(' ') : message ?? 'We could not create this user.'
    } else {
      errorMessage.value = 'We could not create this user.'
    }
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
  } catch {
    errorMessage.value = 'We could not update this user.'
  }
}

async function deleteUser(id: string): Promise<void> {
  if (!window.confirm('Delete this user?')) return
  try {
    await UserService.remove(id)
    users.value = users.value.filter((user) => user.id !== id)
  } catch {
    errorMessage.value = 'We could not delete this user.'
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

    <p v-if="errorMessage" class="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mt-5 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">{{ successMessage }}</p>

    <div class="mt-6 rounded-lg border border-border bg-card p-5">
      <div class="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <UserPlus class="size-4 text-primary" />
        {{ editingUserId ? 'Edit user' : 'Create new user' }}
      </div>

      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="editingUserId ? saveUser() : createUser()">
        <input
          v-model="form.name"
          required
          placeholder="Name"
          class="rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <input
          v-model="form.email"
          required
          type="email"
          placeholder="Email"
          class="rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <input
          v-if="!editingUserId"
          v-model="form.password"
          required
          minlength="8"
          type="password"
          placeholder="Temporary password"
          class="rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <select
          v-model="form.role"
          class="rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="analyst">Analyst</option>
          <option value="admin">Admin</option>
        </select>
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
      <p v-if="isLoading" class="p-5 text-sm text-muted-foreground">Loading users...</p>
      <table v-else class="w-full text-left text-sm">
        <thead class="border-b border-border bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Email</th>
            <th class="px-4 py-3 font-medium">Role</th>
            <th class="px-4 py-3 font-medium"></th>
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
              <button class="text-sm font-medium text-primary hover:underline" @click="startEditing(user)">Edit</button>
              <button class="text-sm font-medium text-destructive hover:underline" @click="deleteUser(user.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

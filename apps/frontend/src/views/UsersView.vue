<script setup lang="ts">
import axios from 'axios'
import { onMounted, ref } from 'vue'
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
  <div class="p-8">
    <p class="font-mono text-xs text-gray-500">~/ users</p>
    <h1 class="mt-1 text-2xl font-semibold text-white">User management</h1>
    <p class="mt-1 text-sm text-gray-500">Create and remove access to the Code Sentinel console.</p>

    <p v-if="errorMessage" class="mt-5 rounded-md border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">{{ errorMessage }}</p>
    <p v-if="successMessage" class="mt-5 rounded-md border border-green-900 bg-green-950/40 px-4 py-2 text-sm text-green-300">{{ successMessage }}</p>

    <form class="mt-6 grid gap-3 rounded-lg border border-gray-800 bg-gray-900/30 p-5 sm:grid-cols-2" @submit.prevent="editingUserId ? saveUser() : createUser()">
      <input v-model="form.name" required placeholder="Name" class="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white" />
      <input v-model="form.email" required type="email" placeholder="Email" class="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white" />
      <input v-if="!editingUserId" v-model="form.password" required minlength="8" type="password" placeholder="Temporary password" class="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white" />
      <select v-model="form.role" class="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white">
        <option value="analyst">Analyst</option>
        <option value="admin">Admin</option>
      </select>
      <div class="flex gap-3 sm:col-span-2">
        <button class="rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-green-400" type="submit">{{ editingUserId ? 'Save changes' : 'Create user' }}</button>
        <button v-if="editingUserId" class="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800" type="button" @click="cancelEditing">Cancel</button>
      </div>
    </form>

    <div class="mt-6 overflow-hidden rounded-lg border border-gray-800">
      <p v-if="isLoading" class="p-5 text-sm text-gray-500">Loading users...</p>
      <table v-else class="w-full text-left text-sm">
        <thead class="border-b border-gray-800 bg-gray-900/60 text-xs uppercase tracking-wider text-gray-500"><tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3"></th></tr></thead>
        <tbody><tr v-for="user in users" :key="user.id" class="border-b border-gray-800/70 last:border-0"><td class="px-4 py-3 text-white">{{ user.name }}</td><td class="px-4 py-3 text-gray-400">{{ user.email }}</td><td class="px-4 py-3 text-gray-400">{{ user.role }}</td><td class="space-x-3 px-4 py-3 text-right"><button class="text-green-400 hover:text-green-300" @click="startEditing(user)">Edit</button><button class="text-red-400 hover:text-red-300" @click="deleteUser(user.id)">Delete</button></td></tr></tbody>
      </table>
    </div>
  </div>
</template>
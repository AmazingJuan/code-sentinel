import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { AuthUser } from '@/interfaces/AuthInterface'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const token = ref<string | null>(null)
    const user = ref<AuthUser | null>(null)

    function setSession(accessToken: string, authenticatedUser: AuthUser): void {
      token.value = accessToken
      user.value = authenticatedUser
    }

    function logout(): void {
      token.value = null
      user.value = null
    }

    return { token, user, setSession, logout }
  },
  { persist: true },
)
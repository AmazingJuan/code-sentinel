import axios from 'axios'

import type { AuthUser, LoginResponse } from '@/interfaces/AuthInterface'
import { useAuthStore } from '@/stores/authStore'
import { httpClient } from './httpClient'

export const AuthService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { data } = await httpClient.post<LoginResponse>('/auth/login', { email, password })
    useAuthStore().setSession(data.accessToken, data.user)

    return data.user
  },

  getToken(): string | null {
    return useAuthStore().token
  },

  getUser(): AuthUser | null {
    return useAuthStore().user
  },

  /**
 * RF-032: each role has its own landing page. The admin never lands on
 * security content; the analyst starts on the security overview.
 */
  getHomeRouteName(): 'users' | 'overview' {
    return useAuthStore().user?.role === 'admin' ? 'users' : 'overview'
  },

  logout(): void {
    useAuthStore().logout()
  },

  getErrorMessage(error: unknown): string {
    if (axios.isAxiosError<{ message?: string | string[] }>(error)) {
      const message = error.response?.data?.message
      if (Array.isArray(message)) return message.join(' ')
      if (message) return message
      if (error.response?.status === 401) return 'Incorrect email or password.'
    }

    return 'We could not sign you in. Please try again.'
  },
}

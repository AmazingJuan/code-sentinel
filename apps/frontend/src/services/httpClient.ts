import axios from 'axios'

import { useAuthStore } from '@/stores/authStore'

export const httpClient = axios.create({
  baseURL:
    (import.meta.env.CODE_SENTINEL_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_URL as string | undefined) ??
    'http://localhost:8000',
})

httpClient.interceptors.request.use((config) => {
  const token = useAuthStore().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Only an explicit 401 from an authenticated endpoint ends the session; network
    // failures and 5xx responses must not log the user out. A failed login is a 401 too.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      if (!url.includes('/auth/login')) {
        useAuthStore().logout()
      }
    }
    return Promise.reject(error)
  },
)

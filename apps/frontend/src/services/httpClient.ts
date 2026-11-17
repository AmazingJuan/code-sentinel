// apps/frontend/src/services/httpClient.ts
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
  (error) => {
    // Only clear session on an explicit 401 from an authenticated endpoint
    // Never clear on network failures or 5xx server reboots
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/auth/login')) {
        useAuthStore().logout()
      }
    }
    return Promise.reject(error)
  },
)
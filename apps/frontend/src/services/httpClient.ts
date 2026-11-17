// apps/frontend/src/services/httpClient.ts
import axios from 'axios'

import { useAuthStore } from '@/stores/authStore'

export const httpClient = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000',
})

httpClient.interceptors.request.use((config) => {
  const token = useAuthStore().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})
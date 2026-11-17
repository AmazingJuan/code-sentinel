import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import type { AuthUser } from '@/interfaces/AuthInterface'
import { AuthService } from '@/services/AuthService'
import { httpClient } from '@/services/httpClient'
import { useAuthStore } from '@/stores/authStore'

describe('AuthService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchCurrentUser retrieves profile and updates store when token is valid', async () => {
    const authStore = useAuthStore()
    authStore.token = 'valid-token'

    const mockUser: AuthUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'demo@code-sentinel.local',
      name: 'Demo User',
      role: 'analyst',
    }

    vi.spyOn(httpClient, 'get').mockResolvedValueOnce({ data: mockUser })

    const result = await AuthService.fetchCurrentUser()
    expect(result).toEqual(mockUser)
    expect(authStore.user).toEqual(mockUser)
    expect(authStore.token).toBe('valid-token')
  })

  it('fetchCurrentUser logs out on 401 response', async () => {
    const authStore = useAuthStore()
    authStore.token = 'expired-token'
    authStore.user = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'demo@code-sentinel.local',
      name: 'Demo User',
      role: 'analyst',
    }

    vi.spyOn(httpClient, 'get').mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    })

    const result = await AuthService.fetchCurrentUser()
    expect(result).toBeNull()
    expect(authStore.token).toBeNull()
    expect(authStore.user).toBeNull()
  })

  it('fetchCurrentUser preserves local session on server error or network outage', async () => {
    const authStore = useAuthStore()
    authStore.token = 'valid-token'
    const currentUser: AuthUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'demo@code-sentinel.local',
      name: 'Demo User',
      role: 'analyst',
    }
    authStore.user = currentUser

    vi.spyOn(httpClient, 'get').mockRejectedValueOnce(new Error('Network Error'))

    const result = await AuthService.fetchCurrentUser()
    expect(result).toEqual(currentUser)
    expect(authStore.token).toBe('valid-token')
    expect(authStore.user).toEqual(currentUser)
  })
})

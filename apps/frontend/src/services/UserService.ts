import type { CreateUserPayload, ManagedUser, UpdateUserPayload } from '@/interfaces/UserInterface'
import { httpClient } from '@/services/httpClient'

export const UserService = {
  async findAll(): Promise<ManagedUser[]> {
    const { data } = await httpClient.get<ManagedUser[]>('/users')
    return data
  },

  async create(payload: CreateUserPayload): Promise<ManagedUser> {
    const { data } = await httpClient.post<ManagedUser>('/users', payload)
    return data
  },

  async update(id: string, payload: UpdateUserPayload): Promise<ManagedUser> {
    const { data } = await httpClient.patch<ManagedUser>(`/users/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/users/${id}`)
  },
}

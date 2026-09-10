import type { ManagedUser } from '@/interfaces/UserInterface'
import { httpClient } from './httpClient'

export const UserService = {
  async findAll(): Promise<ManagedUser[]> {
    const { data } = await httpClient.get<ManagedUser[]>('/users')
    return data
  },

  async create(payload: { name: string; email: string; password: string; role: ManagedUser['role'] }): Promise<ManagedUser> {
    const { data } = await httpClient.post<ManagedUser>('/users', payload)
    return data
  },

  async update(id: string, payload: { name: string; email: string; role: ManagedUser['role'] }): Promise<ManagedUser> {
    const { data } = await httpClient.patch<ManagedUser>(`/users/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/users/${id}`)
  },
}
import type { ManagedUser } from '@/interfaces/UserInterface'

export interface ProjectAssignment {
  id: string
  projectId: string
  userId: string
  assignedAt: string
  user: ManagedUser
}

// apps/frontend/src/interfaces/ProjectAssignmentInterface.ts
import type { ManagedUser } from './UserInterface'

export interface ProjectAssignment {
  id: string
  projectId: string
  userId: string
  assignedAt: string
  user: ManagedUser
}

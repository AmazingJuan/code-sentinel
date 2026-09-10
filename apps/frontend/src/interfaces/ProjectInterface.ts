// apps/frontend/src/interfaces/ProjectInterface.ts
export type ProjectStatus = 'pending' | 'completed' | 'failed'

export interface ProjectInterface {
  id: string
  name: string
  repo: string
  status: ProjectStatus
  lastScan: string | null
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  createdAt: string
  userId: string
}

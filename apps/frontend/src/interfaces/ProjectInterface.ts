// apps/frontend/src/interfaces/ProjectInterface.ts
import type { ScanTool } from './ScanInterface'

export type ProjectStatus = 'pending' | 'completed' | 'failed'

export interface ProjectInterface {
  id: string
  name: string
  repo: string
  tools: ScanTool[]
  status: ProjectStatus
  lastScan: string | null
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  createdAt: string
  userId: string
}

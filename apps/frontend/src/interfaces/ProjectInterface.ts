import type { ScanTool } from '@/interfaces/ScanInterface'

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

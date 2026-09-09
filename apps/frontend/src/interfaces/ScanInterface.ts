// apps/frontend/src/interfaces/ScanInterface.ts
import type { ProjectInterface } from './ProjectInterface'

export type ScanStatus = 'completed' | 'failed'
export type ScanTool = 'SAST' | 'Secret Scanner' | 'Port Scanner'

export interface ScanInterface {
  id: string
  scanNumber: number
  project: ProjectInterface
  projectId: string
  date: string
  status: ScanStatus
  tools: ScanTool[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalCount: number
}
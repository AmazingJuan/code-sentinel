// apps/frontend/src/interfaces/ScanInterface.ts
import type { ProjectInterface } from './ProjectInterface'

// RF-006: same lifecycle as the backend (pending → running → completed | failed).
export const SCAN_STATUSES = ['pending', 'running', 'completed', 'failed'] as const
export type ScanStatus = (typeof SCAN_STATUSES)[number]

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

export type ScanTool = 'SAST' | 'Secret Scanner' | 'Port Scanner'
export const SCAN_TOOLS: ScanTool[] = ['SAST', 'Secret Scanner', 'Port Scanner']

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
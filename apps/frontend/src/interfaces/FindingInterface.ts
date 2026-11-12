// apps/frontend/src/interfaces/FindingInterface.ts
import type { ScanTool } from './ScanInterface'

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface FindingInterface {
  id: string
  scanId: string
  type: string
  severity: FindingSeverity | null
  toolCategory?: ScanTool
  filePath: string | null
  line: number | null
  sourceTool: string
  description: string | null
  recommendation: string | null
}
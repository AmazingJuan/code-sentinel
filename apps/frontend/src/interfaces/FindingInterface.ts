// apps/frontend/src/interfaces/FindingInterface.ts
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface FindingInterface {
  id: string
  scanId: string
  type: string
  severity: FindingSeverity
  filePath: string | null
  line: number | null
  sourceTool: string
  description: string | null
  recommendation: string | null
}
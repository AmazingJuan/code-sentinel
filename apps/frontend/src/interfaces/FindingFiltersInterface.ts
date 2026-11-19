import type { FindingSeverity } from '@/interfaces/FindingInterface'

export interface FindingFiltersInterface {
  type?: string
  severity?: FindingSeverity
  scanId?: string
  sourceTool?: string
  toolCategory?: string
}

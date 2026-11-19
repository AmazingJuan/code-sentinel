import type { FindingSeverity } from '@/interfaces/FindingInterface'
import type { ScanStatus } from '@/interfaces/ScanInterface'

export interface ScanFiltersInterface {
  projectId?: string
  dateFrom?: string
  dateTo?: string
  status?: ScanStatus
  severity?: FindingSeverity
}

// apps/frontend/src/interfaces/ScanFiltersInterface.ts
import type { ScanStatus } from './ScanInterface'

export interface ScanFiltersInterface {
  projectId?: string
  dateFrom?: string
  dateTo?: string
  status?: ScanStatus
  severity?: 'critical' | 'high' | 'medium' | 'low'
}
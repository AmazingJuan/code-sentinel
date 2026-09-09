// apps/frontend/src/interfaces/ScanFiltersInterface.ts
export interface ScanFiltersInterface {
  projectId?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
}
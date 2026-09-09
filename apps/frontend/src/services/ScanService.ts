// apps/frontend/src/services/ScanService.ts
import type { ScanFiltersInterface } from '@/interfaces/ScanFiltersInterface'
import type { ScanInterface } from '@/interfaces/ScanInterface'
import { httpClient } from '@/services/httpClient'

export class ScanService {
  static async getScans(filters: ScanFiltersInterface = {}): Promise<ScanInterface[]> {
    const response = await httpClient.get<ScanInterface[]>('/scans', { params: filters })
    return response.data
  }

  static async getScanById(id: string): Promise<ScanInterface> {
    const response = await httpClient.get<ScanInterface>(`/scans/${id}`)
    return response.data
  }
}
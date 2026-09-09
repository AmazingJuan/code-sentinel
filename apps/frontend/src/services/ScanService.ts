// apps/frontend/src/services/ScanService.ts
import { httpClient } from '@/services/httpClient'
import type { ScanFiltersInterface, ScanInterface } from '@/interfaces/ScanInterface'

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
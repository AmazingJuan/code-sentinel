// apps/frontend/src/services/FindingService.ts
import { httpClient } from '@/services/httpClient'
import type { FindingFiltersInterface, FindingInterface } from '@/interfaces/FindingInterface'

export class FindingService {
  static async getFindings(filters: FindingFiltersInterface = {}): Promise<FindingInterface[]> {
    const response = await httpClient.get<FindingInterface[]>('/findings', { params: filters })
    return response.data
  }

  static async getFindingById(id: string): Promise<FindingInterface> {
    const response = await httpClient.get<FindingInterface>(`/findings/${id}`)
    return response.data
  }
}
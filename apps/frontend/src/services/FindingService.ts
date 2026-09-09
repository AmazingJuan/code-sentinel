// apps/frontend/src/services/FindingService.ts
import type { FindingFiltersInterface } from '@/interfaces/FindingFiltersInterface'
import type { FindingInterface } from '@/interfaces/FindingInterface'
import { httpClient } from '@/services/httpClient'

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
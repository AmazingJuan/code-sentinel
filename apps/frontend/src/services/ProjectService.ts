// apps/frontend/src/services/ProjectService.ts
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import { httpClient } from '@/services/httpClient'

export type CreateProjectDto = Omit<
  ProjectInterface,
  'id' | 'status' | 'lastScan' | 'criticalCount' | 'highCount' | 'mediumCount' | 'lowCount' | 'createdAt' | 'userId'
>

export class ProjectService {
  static async getProjects(): Promise<ProjectInterface[]> {
    const response = await httpClient.get<ProjectInterface[]>('/projects')
    return response.data
  }

  static async createProject(payload: CreateProjectDto): Promise<ProjectInterface> {
    const response = await httpClient.post<ProjectInterface>('/projects', payload)
    return response.data
  }
}

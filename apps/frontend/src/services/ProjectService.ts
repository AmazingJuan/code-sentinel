// apps/frontend/src/services/ProjectService.ts
import type { ProjectInterface } from '@/interfaces/ProjectInterface'
import { httpClient } from '@/services/httpClient'

export type CreateProjectDto = Omit<
  ProjectInterface,
  'id' | 'tools' | 'status' | 'lastScan' | 'criticalCount' | 'highCount' | 'mediumCount' | 'lowCount' | 'createdAt' | 'userId'
>

export type UpdateProjectDto = Partial<Pick<ProjectInterface, 'repo' | 'tools'>>

export class ProjectService {
  static async getProjects(): Promise<ProjectInterface[]> {
    const response = await httpClient.get<ProjectInterface[]>('/projects')
    return response.data
  }

  static async getProjectById(id: string): Promise<ProjectInterface> {
    const response = await httpClient.get<ProjectInterface>(`/projects/${id}`)
    return response.data
  }

  static async createProject(payload: CreateProjectDto): Promise<ProjectInterface> {
    const response = await httpClient.post<ProjectInterface>('/projects', payload)
    return response.data
  }

  static async updateProject(id: string, payload: UpdateProjectDto): Promise<ProjectInterface> {
    const response = await httpClient.patch<ProjectInterface>(`/projects/${id}`, payload)
    return response.data
  }
}

// apps/backend/src/scans/scans.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { Scan } from './scan.entity';
import { ProjectsService } from '../projects/projects.service';
import { RequestingUser } from '../types/requesting-user.type';

export interface ScanFilters {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan) private readonly scanRepository: Repository<Scan>,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAll(
    filters: ScanFilters,
    requester: RequestingUser,
  ): Promise<Scan[]> {
    const where: FindOptionsWhere<Scan> = {};

    if (filters.status) where.status = filters.status as Scan['status'];
    if (filters.dateFrom && filters.dateTo) {
      where.date = Between(
        new Date(filters.dateFrom),
        new Date(filters.dateTo),
      );
    }

    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    if (accessibleProjectIds !== null) {
      if (filters.projectId) {
        if (!accessibleProjectIds.includes(filters.projectId)) return [];
        where.projectId = filters.projectId;
      } else {
        if (accessibleProjectIds.length === 0) return [];
        where.projectId = In(accessibleProjectIds);
      }
    } else if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    const severityColumnMap: Record<string, keyof Scan> = {
      critical: 'criticalCount',
      high: 'highCount',
      medium: 'mediumCount',
      low: 'lowCount',
    };

    let scans = await this.scanRepository.find({
      where,
      order: { scanNumber: 'DESC' },
    });

    if (filters.severity) {
      const column = severityColumnMap[filters.severity];
      scans = scans.filter((scan) => (scan[column] as number) > 0);
    }

    return scans;
  }

  async findOne(id: string, requester: RequestingUser): Promise<Scan> {
    const scan = await this.scanRepository.findOne({
      where: { id },
      relations: { findings: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${id} not found`);

    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    if (
      accessibleProjectIds !== null &&
      !accessibleProjectIds.includes(scan.projectId)
    ) {
      throw new ForbiddenException('You are not assigned to this project');
    }

    return scan;
  }

  /** Ids of the scans that belong to any of the given projects. */
  async findScanIdsForProjects(projectIds: string[]): Promise<string[]> {
    if (projectIds.length === 0) return [];
    const scans = await this.scanRepository.find({
      where: { projectId: In(projectIds) },
      select: { id: true },
    });
    return scans.map((scan) => scan.id);
  }

  /**
   * Looks up the project a scan belongs to, without enforcing access. Used
   * by other services (e.g. findings) that need to resolve a scan's project
   * before applying their own access check.
   */
  async findProjectIdForScan(scanId: string): Promise<string | null> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      select: { id: true, projectId: true },
    });
    return scan ? scan.projectId : null;
  }
}

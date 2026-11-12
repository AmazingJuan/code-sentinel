// apps/backend/src/findings/findings.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Finding, FindingSeverity } from './finding.entity';
import { ProjectsService } from '../projects/projects.service';
import { isScanTool, ScanTool } from '../scans/scan.entity';
import { ScansService } from '../scans/scans.service';
import { RequestingUser } from '../types/requesting-user.type';

export interface FindingFilters {
  type?: string;
  severity?: string;
  scanId?: string;
  sourceTool?: string;
  toolCategory?: string;
}

@Injectable()
export class FindingsService {
  constructor(
    @InjectRepository(Finding)
    private readonly findingRepository: Repository<Finding>,
    private readonly projectsService: ProjectsService,
    private readonly scansService: ScansService,
  ) {}

  async findAll(
    filters: FindingFilters,
    requester: RequestingUser,
  ): Promise<Finding[]> {
    const where: FindOptionsWhere<Finding> = {};
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity as FindingSeverity;
    if (filters.toolCategory) {
      where.toolCategory = filters.toolCategory as ScanTool;
    }
    if (filters.sourceTool) {
      if (isScanTool(filters.sourceTool) && !filters.toolCategory) {
        where.toolCategory = filters.sourceTool;
      } else {
        where.sourceTool = filters.sourceTool;
      }
    }

    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    if (filters.scanId) {
      const scanProjectId = await this.scansService.findProjectIdForScan(
        filters.scanId,
      );
      if (!scanProjectId || !accessibleProjectIds.includes(scanProjectId))
        return [];
      where.scanId = filters.scanId;
    } else {
      if (accessibleProjectIds.length === 0) return [];
      const accessibleScanIds =
        await this.scansService.findScanIdsForProjects(accessibleProjectIds);
      if (accessibleScanIds.length === 0) return [];
      where.scanId = In(accessibleScanIds);
    }

    return this.findingRepository.find({ where, order: { severity: 'ASC' } });
  }

  async findOne(id: string, requester: RequestingUser): Promise<Finding> {
    const finding = await this.findingRepository.findOne({ where: { id } });
    if (!finding) throw new NotFoundException(`Finding ${id} not found`);

    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    const scanProjectId = await this.scansService.findProjectIdForScan(
      finding.scanId,
    );
    if (!scanProjectId || !accessibleProjectIds.includes(scanProjectId)) {
      throw new ForbiddenException('You are not assigned to this project');
    }

    return finding;
  }
}

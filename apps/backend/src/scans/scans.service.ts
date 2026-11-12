// apps/backend/src/scans/scans.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { CreateScanDto } from './dto/create-scan.dto';
import { SubmitScanResultsDto } from './dto/submit-scan-results.dto';
import { UpdateScanStatusDto } from './dto/update-scan-status.dto';
import {
  canTransitionScanStatus,
  computeProjectCountersFromScans,
  isResultScanStatus,
  isScanStatus,
  isScanTool,
  Scan,
  SCAN_STATUSES,
  SCAN_TOOLS,
} from './scan.entity';
import { Finding, isFindingSeverity } from '../findings/finding.entity';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { RequestingUser } from '../types/requesting-user.type';

export interface ScanFilters {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

const FORBIDDEN_SECRET_KEYS = ['Secret', 'secret', 'Match', 'match'] as const;

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan) private readonly scanRepository: Repository<Scan>,
    private readonly projectsService: ProjectsService,
    @Optional()
    @InjectRepository(Finding)
    private readonly findingRepository?: Repository<Finding>,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
  ) {}

  async create(
    createScanDto: CreateScanDto,
    requester: RequestingUser,
  ): Promise<Scan> {
    if (!createScanDto.projectId || !createScanDto.projectId.trim()) {
      throw new BadRequestException('projectId is required');
    }
    if (
      !Array.isArray(createScanDto.tools) ||
      createScanDto.tools.length === 0 ||
      !createScanDto.tools.every((tool) => isScanTool(tool))
    ) {
      throw new BadRequestException(
        `Invalid tools. Use one or more of: ${SCAN_TOOLS.join(', ')}`,
      );
    }

    await this.assertProjectAccess(createScanDto.projectId, requester);

    const latestScans = await this.scanRepository.find({
      order: { scanNumber: 'DESC' },
      take: 1,
    });
    const nextScanNumber = (latestScans[0]?.scanNumber ?? 1000) + 1;

    const scan = this.scanRepository.create({
      scanNumber: nextScanNumber,
      projectId: createScanDto.projectId,
      status: 'pending',
      errorMessage: null,
      tools: createScanDto.tools,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalCount: 0,
    });

    return this.scanRepository.save(scan);
  }

  async updateStatus(
    id: string,
    updateScanStatusDto: UpdateScanStatusDto,
    requester: RequestingUser,
  ): Promise<Scan> {
    if (!isScanStatus(updateScanStatusDto.status)) {
      throw new BadRequestException(
        `Invalid status "${String(updateScanStatusDto.status)}". Use one of: ${SCAN_STATUSES.join(', ')}`,
      );
    }

    const scan = await this.findScanForAuthorizedUser(id, requester);

    if (!canTransitionScanStatus(scan.status, updateScanStatusDto.status)) {
      throw new ConflictException(
        `Cannot transition scan from "${scan.status}" to "${updateScanStatusDto.status}"`,
      );
    }

    if (updateScanStatusDto.status === 'failed') {
      if (
        !updateScanStatusDto.errorMessage ||
        !updateScanStatusDto.errorMessage.trim()
      ) {
        throw new BadRequestException(
          'errorMessage is required when status is "failed"',
        );
      }
      scan.errorMessage = updateScanStatusDto.errorMessage.trim();
    }
    scan.status = updateScanStatusDto.status;

    return this.scanRepository.save(scan);
  }

  async submitResults(
    id: string,
    submitScanResultsDto: SubmitScanResultsDto,
    requester: RequestingUser,
  ): Promise<Scan> {
    if (!isResultScanStatus(submitScanResultsDto.status)) {
      throw new BadRequestException(
        'Result status must be "completed" or "failed"',
      );
    }

    const scan = await this.findScanForAuthorizedUser(id, requester);

    if (!canTransitionScanStatus(scan.status, submitScanResultsDto.status)) {
      throw new ConflictException(
        `Cannot transition scan from "${scan.status}" to "${submitScanResultsDto.status}"`,
      );
    }

    const findingsInput = submitScanResultsDto.findings ?? [];

    if (submitScanResultsDto.status === 'failed') {
      if (
        !submitScanResultsDto.errorMessage ||
        !submitScanResultsDto.errorMessage.trim()
      ) {
        throw new BadRequestException(
          'errorMessage is required when status is "failed"',
        );
      }
      if (findingsInput.length > 0) {
        throw new BadRequestException(
          'findings must be empty when status is "failed"',
        );
      }
    } else {
      for (const item of findingsInput) {
        this.validateFindingItem(item as unknown as Record<string, unknown>);
      }
    }

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const item of findingsInput) {
      if (item.severity === 'critical') criticalCount += 1;
      else if (item.severity === 'high') highCount += 1;
      else if (item.severity === 'medium') mediumCount += 1;
      else if (item.severity === 'low') lowCount += 1;
    }

    if (findingsInput.length > 0 && this.findingRepository) {
      const findingEntities = findingsInput.map((item) =>
        this.findingRepository!.create({
          scanId: scan.id,
          type: item.type,
          severity: item.severity ?? null,
          toolCategory: item.toolCategory,
          sourceTool: item.sourceTool,
          filePath: item.filePath ?? null,
          line: item.line ?? null,
          description: item.description ?? null,
          recommendation: item.recommendation ?? null,
        }),
      );
      await this.findingRepository.save(findingEntities);
    }

    scan.status = submitScanResultsDto.status;
    scan.errorMessage =
      submitScanResultsDto.status === 'failed'
        ? submitScanResultsDto.errorMessage!.trim()
        : null;
    scan.criticalCount = criticalCount;
    scan.highCount = highCount;
    scan.mediumCount = mediumCount;
    scan.lowCount = lowCount;
    scan.totalCount = findingsInput.length;

    const savedScan = await this.scanRepository.save(scan);
    await this.syncProjectCounters(scan.projectId, savedScan);
    return savedScan;
  }

  async findAll(
    filters: ScanFilters,
    requester: RequestingUser,
  ): Promise<Scan[]> {
    const where: FindOptionsWhere<Scan> = {};

    if (filters.status) {
      // RF-006: reject unknown states instead of silently returning nothing.
      if (!isScanStatus(filters.status)) {
        throw new BadRequestException(
          `Invalid status "${filters.status}". Use one of: ${SCAN_STATUSES.join(', ')}`,
        );
      }
      where.status = filters.status;
    }
    if (filters.dateFrom && filters.dateTo) {
      where.date = Between(
        new Date(filters.dateFrom),
        new Date(filters.dateTo),
      );
    }

    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    if (filters.projectId) {
      if (!accessibleProjectIds.includes(filters.projectId)) return [];
      where.projectId = filters.projectId;
    } else {
      if (accessibleProjectIds.length === 0) return [];
      where.projectId = In(accessibleProjectIds);
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

    await this.assertProjectAccess(scan.projectId, requester);

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

  private async findScanForAuthorizedUser(
    id: string,
    requester: RequestingUser,
  ): Promise<Scan> {
    const scan = await this.scanRepository.findOne({ where: { id } });
    if (!scan) throw new NotFoundException(`Scan ${id} not found`);

    await this.assertProjectAccess(scan.projectId, requester);

    return scan;
  }

  private async assertProjectAccess(
    projectId: string,
    requester: RequestingUser,
  ): Promise<void> {
    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    if (!accessibleProjectIds.includes(projectId)) {
      throw new ForbiddenException('You are not assigned to this project');
    }
  }

  private async syncProjectCounters(
    projectId: string,
    latestScan: Scan,
  ): Promise<void> {
    if (!this.projectRepository) return;

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) return;

    const projectScans =
      (await this.scanRepository.find({
        where: { projectId },
        order: { scanNumber: 'DESC' },
      })) ?? [];
    const allScans = projectScans.some((s) => s.id === latestScan.id)
      ? projectScans
      : [latestScan, ...projectScans];

    const counters = computeProjectCountersFromScans(allScans);
    project.status = counters.status;
    project.lastScan = counters.lastScan;
    project.criticalCount = counters.criticalCount;
    project.highCount = counters.highCount;
    project.mediumCount = counters.mediumCount;
    project.lowCount = counters.lowCount;

    await this.projectRepository.save(project);
  }

  private validateFindingItem(item: Record<string, unknown>): void {
    for (const key of FORBIDDEN_SECRET_KEYS) {
      if (key in item) {
        throw new BadRequestException(
          'Findings must never include raw secret values (Secret or Match)',
        );
      }
    }
    if (typeof item.type !== 'string' || !item.type.trim()) {
      throw new BadRequestException('Finding type is required');
    }
    if (
      item.severity !== null &&
      item.severity !== undefined &&
      (typeof item.severity !== 'string' || !isFindingSeverity(item.severity))
    ) {
      throw new BadRequestException('Invalid finding severity');
    }
    if (
      typeof item.toolCategory !== 'string' ||
      !isScanTool(item.toolCategory)
    ) {
      throw new BadRequestException('Invalid finding toolCategory');
    }
    if (typeof item.sourceTool !== 'string' || !item.sourceTool.trim()) {
      throw new BadRequestException('Finding sourceTool is required');
    }
  }
}

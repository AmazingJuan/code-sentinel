import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  EntityManager,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { isUniqueViolation } from '../common/postgres-errors';
import {
  Finding,
  FindingSeverity,
  isFindingSeverity,
} from '../findings/finding.entity';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { RequestingUser } from '../types/requesting-user.type';
import { CreateScanDto } from './dto/create-scan.dto';
import {
  ScanFindingItemDto,
  SubmitScanResultsDto,
} from './dto/submit-scan-results.dto';
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
  ScanStatus,
} from './scan.entity';

export interface ScanFilters {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  severity?: FindingSeverity;
}

type SeverityCounters = Pick<
  Scan,
  'criticalCount' | 'highCount' | 'mediumCount' | 'lowCount'
>;

const SEVERITY_COUNTER_COLUMN: Record<FindingSeverity, keyof SeverityCounters> =
  {
    critical: 'criticalCount',
    high: 'highCount',
    medium: 'mediumCount',
    low: 'lowCount',
  };

// Scanners report raw secrets under these keys (e.g. Gitleaks). They must
// never be persisted, even if a client bypasses DTO whitelisting.
const FORBIDDEN_SECRET_KEYS = ['Secret', 'secret', 'Match', 'match'] as const;

const FIRST_SCAN_NUMBER_BASE = 1000;
const SCAN_NUMBER_MAX_ATTEMPTS = 3;
const NOT_ASSIGNED_MESSAGE = 'You are not assigned to this project';

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan) private readonly scanRepository: Repository<Scan>,
    private readonly projectsService: ProjectsService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async create(
    createScanDto: CreateScanDto,
    requester: RequestingUser,
  ): Promise<Scan> {
    if (!createScanDto.projectId?.trim()) {
      throw new BadRequestException('projectId is required');
    }
    if (
      !Array.isArray(createScanDto.tools) ||
      createScanDto.tools.length === 0 ||
      !createScanDto.tools.every((tool: string): boolean => isScanTool(tool))
    ) {
      throw new BadRequestException(
        `Invalid tools. Use one or more of: ${SCAN_TOOLS.join(', ')}`,
      );
    }

    await this.assertProjectAccess(createScanDto.projectId, requester);

    // scanNumber is a global sequence derived from the current maximum; two
    // concurrent creates can pick the same value, so a unique violation is
    // retried with a freshly computed number.
    for (let attempt = 1; ; attempt += 1) {
      const scan = this.scanRepository.create({
        scanNumber: await this.nextScanNumber(),
        projectId: createScanDto.projectId,
        commitSha: createScanDto.commitSha ?? null,
        branch: createScanDto.branch ?? null,
        status: 'pending',
        errorMessage: null,
        tools: createScanDto.tools,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalCount: 0,
      });
      try {
        return await this.scanRepository.save(scan);
      } catch (error: unknown) {
        if (!isUniqueViolation(error) || attempt >= SCAN_NUMBER_MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  async updateStatus(
    id: string,
    updateScanStatusDto: UpdateScanStatusDto,
    requester: RequestingUser,
  ): Promise<Scan> {
    const nextStatus = updateScanStatusDto.status;
    if (!isScanStatus(nextStatus)) {
      throw new BadRequestException(
        `Invalid status "${String(nextStatus)}". Use one of: ${SCAN_STATUSES.join(', ')}`,
      );
    }

    const scan = await this.findScanForAuthorizedUser(id, requester);
    this.assertTransition(scan.status, nextStatus);

    let errorMessage = scan.errorMessage;
    if (nextStatus === 'failed') {
      errorMessage = this.requireErrorMessage(updateScanStatusDto.errorMessage);
    }

    await this.transitionScan(this.scanRepository, scan, nextStatus, {
      errorMessage,
    });
    return scan;
  }

  async submitResults(
    id: string,
    submitScanResultsDto: SubmitScanResultsDto,
    requester: RequestingUser,
  ): Promise<Scan> {
    const nextStatus = submitScanResultsDto.status;
    if (!isResultScanStatus(nextStatus)) {
      throw new BadRequestException(
        'Result status must be "completed" or "failed"',
      );
    }

    const scan = await this.findScanForAuthorizedUser(id, requester);
    this.assertTransition(scan.status, nextStatus);

    const findingsInput = submitScanResultsDto.findings ?? [];
    let errorMessage: string | null = null;
    if (nextStatus === 'failed') {
      errorMessage = this.requireErrorMessage(
        submitScanResultsDto.errorMessage,
      );
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

    const counters = this.countBySeverity(findingsInput);
    const commitSha = submitScanResultsDto.commitSha || scan.commitSha;
    const branch = submitScanResultsDto.branch || scan.branch;

    // Findings and the status change are committed atomically; the
    // status-guarded update makes a concurrent submission for the same scan
    // fail with 409 instead of storing duplicated findings.
    await this.scanRepository.manager.transaction(
      async (manager: EntityManager): Promise<void> => {
        await this.transitionScan(
          manager.getRepository(Scan),
          scan,
          nextStatus,
          {
            errorMessage,
            commitSha,
            branch,
            ...counters,
            totalCount: findingsInput.length,
          },
        );

        if (findingsInput.length > 0) {
          const findingRepository = manager.getRepository(Finding);
          await findingRepository.save(
            findingsInput.map((item: ScanFindingItemDto): Finding =>
              findingRepository.create({
                scanId: scan.id,
                type: item.type,
                severity: item.severity ?? null,
                toolCategory: item.toolCategory,
                sourceTool: item.sourceTool,
                filePath: item.filePath ?? null,
                line: item.line ?? null,
                commitSha: item.commitSha ?? commitSha ?? null,
                cwe: item.cwe ?? null,
                codeSnippet: item.codeSnippet ?? null,
                description: item.description ?? null,
                recommendation: item.recommendation ?? null,
              }),
            ),
          );
        }
      },
    );

    await this.syncProjectCounters(scan.projectId, scan);
    return scan;
  }

  async findAll(
    filters: ScanFilters,
    requester: RequestingUser,
  ): Promise<Scan[]> {
    const where: FindOptionsWhere<Scan> = {};

    if (filters.status) {
      if (!isScanStatus(filters.status)) {
        throw new BadRequestException(
          `Invalid status "${filters.status}". Use one of: ${SCAN_STATUSES.join(', ')}`,
        );
      }
      where.status = filters.status;
    }

    const dateFrom = this.parseDateFilter('dateFrom', filters.dateFrom);
    const dateTo = this.parseDateFilter('dateTo', filters.dateTo);
    if (dateFrom && dateTo) {
      where.date = Between(dateFrom, dateTo);
    } else if (dateFrom) {
      where.date = MoreThanOrEqual(dateFrom);
    } else if (dateTo) {
      where.date = LessThanOrEqual(dateTo);
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

    const scans = await this.scanRepository.find({
      where,
      order: { scanNumber: 'DESC' },
    });

    if (!filters.severity) return scans;
    const column = SEVERITY_COUNTER_COLUMN[filters.severity];
    if (!column) {
      throw new BadRequestException(`Invalid severity "${filters.severity}"`);
    }
    return scans.filter((scan: Scan): boolean => scan[column] > 0);
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

  async findScanIdsForProjects(projectIds: string[]): Promise<string[]> {
    if (projectIds.length === 0) return [];
    const scans = await this.scanRepository.find({
      where: { projectId: In(projectIds) },
      select: { id: true },
    });
    return scans.map((scan: Scan): string => scan.id);
  }

  /**
   * Resolves the project a scan belongs to without enforcing access, so
   * callers (e.g. findings) can apply their own authorization check.
   */
  async findProjectIdForScan(scanId: string): Promise<string | null> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      select: { id: true, projectId: true },
    });
    return scan ? scan.projectId : null;
  }

  private async nextScanNumber(): Promise<number> {
    const latestScans = await this.scanRepository.find({
      order: { scanNumber: 'DESC' },
      take: 1,
    });
    return (latestScans[0]?.scanNumber ?? FIRST_SCAN_NUMBER_BASE) + 1;
  }

  private assertTransition(from: ScanStatus, to: ScanStatus): void {
    if (!canTransitionScanStatus(from, to)) {
      throw new ConflictException(
        `Cannot transition scan from "${from}" to "${to}"`,
      );
    }
  }

  private requireErrorMessage(errorMessage: string | null | undefined): string {
    const trimmed = errorMessage?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'errorMessage is required when status is "failed"',
      );
    }
    return trimmed;
  }

  /**
   * Persists a status change only if the row still has the status that was
   * read, so concurrent transitions cannot overwrite each other.
   */
  private async transitionScan(
    repository: Repository<Scan>,
    scan: Scan,
    nextStatus: ScanStatus,
    changes: Partial<Omit<Scan, 'id' | 'status'>>,
  ): Promise<void> {
    const result = await repository.update(
      { id: scan.id, status: scan.status },
      { ...changes, status: nextStatus },
    );
    if (!result.affected) {
      throw new ConflictException(
        'The scan was modified concurrently; reload it and retry',
      );
    }
    Object.assign(scan, changes, { status: nextStatus });
  }

  private countBySeverity(findings: ScanFindingItemDto[]): SeverityCounters {
    const counters: SeverityCounters = {
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    };
    for (const item of findings) {
      if (item.severity) {
        counters[SEVERITY_COUNTER_COLUMN[item.severity]] += 1;
      }
    }
    return counters;
  }

  private parseDateFilter(
    name: string,
    value: string | undefined,
  ): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${name} must be a valid ISO 8601 date`);
    }
    return date;
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
      throw new ForbiddenException(NOT_ASSIGNED_MESSAGE);
    }
  }

  /**
   * Recomputes the project's denormalized status and severity counters from
   * its scan history (RF-028 / RF-029).
   */
  private async syncProjectCounters(
    projectId: string,
    latestScan: Scan,
  ): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) return;

    const projectScans =
      (await this.scanRepository.find({
        where: { projectId },
        order: { scanNumber: 'DESC' },
      })) ?? [];
    const allScans = projectScans.some(
      (existingScan: Scan): boolean => existingScan.id === latestScan.id,
    )
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

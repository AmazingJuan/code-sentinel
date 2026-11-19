import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { In, ObjectLiteral, Repository } from 'typeorm';

import { Finding } from '../findings/finding.entity';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { RequestingUser } from '../types/requesting-user.type';
import { UserRole } from '../users/entities/user.entity';
import { SubmitScanResultsDto } from './dto/submit-scan-results.dto';
import {
  canTransitionScanStatus,
  computeProjectCountersFromScans,
  isResultScanStatus,
  isScanStatus,
  isScanTool,
  Scan,
  ScanStatus,
} from './scan.entity';
import { ScansService } from './scans.service';

const SCAN_REPOSITORY_TOKEN = 'ScanRepository';
const FINDING_REPOSITORY_TOKEN = 'FindingRepository';
const PROJECT_REPOSITORY_TOKEN = 'ProjectRepository';

type MockRepository<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

interface MockProjectsService {
  getAccessibleProjectIds: jest.Mock<Promise<string[]>, [RequestingUser]>;
}

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((entity: Partial<T>): Partial<T> => ({ ...entity })),
    save: jest.fn((entity: Partial<T>): Promise<Partial<T>> =>
      Promise.resolve(entity),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

/** Runs transaction callbacks against the same mocked repositories. */
function attachTransactionManager(
  repository: MockRepository<Scan>,
  findingRepository: MockRepository<Finding>,
): void {
  const manager = {
    getRepository: (entity: unknown): MockRepository<ObjectLiteral> =>
      entity === Finding ? findingRepository : repository,
  };
  Object.assign(repository, {
    manager: {
      transaction: jest.fn(
        (work: (txManager: typeof manager) => Promise<unknown>) =>
          work(manager),
      ),
    },
  });
}

describe('ScansService', () => {
  let service: ScansService;
  let repository: MockRepository<Scan>;
  let findingRepository: MockRepository<Finding>;
  let projectRepository: MockRepository<Project>;
  let projectsService: MockProjectsService;

  const analyst: RequestingUser = { id: 'u1', role: UserRole.ANALYST };

  const mockScans: Partial<Scan>[] = [
    {
      id: '1',
      scanNumber: 1042,
      projectId: 'p1',
      status: 'completed',
      errorMessage: null,
      criticalCount: 1,
      highCount: 3,
      mediumCount: 5,
      lowCount: 2,
      totalCount: 11,
    },
    {
      id: '2',
      scanNumber: 1038,
      projectId: 'p2',
      status: 'failed',
      errorMessage: 'Invalid repository path',
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalCount: 0,
    },
  ];

  beforeEach(async () => {
    projectsService = {
      getAccessibleProjectIds: jest
        .fn<Promise<string[]>, [RequestingUser]>()
        .mockResolvedValue(['p1', 'p2']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScansService,
        {
          provide: SCAN_REPOSITORY_TOKEN,
          useValue: createMockRepository<Scan>(),
        },
        {
          provide: FINDING_REPOSITORY_TOKEN,
          useValue: createMockRepository<Finding>(),
        },
        {
          provide: PROJECT_REPOSITORY_TOKEN,
          useValue: createMockRepository(),
        },
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();

    service = module.get<ScansService>(ScansService);
    repository = module.get(SCAN_REPOSITORY_TOKEN);
    findingRepository = module.get(FINDING_REPOSITORY_TOKEN);
    projectRepository = module.get(PROJECT_REPOSITORY_TOKEN);
    attachTransactionManager(repository, findingRepository);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('create (POST /scans — RF-005, RF-006)', (): void => {
    it('retries with a fresh scanNumber when a concurrent create took the same one', async (): Promise<void> => {
      repository
        .find!.mockResolvedValueOnce([{ scanNumber: 1044 }])
        .mockResolvedValueOnce([{ scanNumber: 1045 }]);
      repository
        .save!.mockRejectedValueOnce({ code: '23505' })
        .mockImplementationOnce((scan: Partial<Scan>) =>
          Promise.resolve({ id: 'scan-new', ...scan }),
        );

      const result = await service.create(
        { projectId: 'p1', tools: ['SAST'] },
        analyst,
      );

      expect(result.scanNumber).toBe(1046);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('creates a pending scan with the next scanNumber', async (): Promise<void> => {
      repository.find!.mockResolvedValue([{ scanNumber: 1044 }]);
      repository.save!.mockImplementation((scan: Partial<Scan>) =>
        Promise.resolve({ id: 'scan-new', ...scan }),
      );

      const result = await service.create(
        { projectId: 'p1', tools: ['SAST', 'Secret Scanner'] },
        analyst,
      );

      expect(result.id).toBe('scan-new');
      expect(result.scanNumber).toBe(1045);
      expect(result.status).toBe('pending');
      expect(result.errorMessage).toBeNull();
      expect(result.totalCount).toBe(0);
    });

    it('rejects with ForbiddenException (403) when the analyst is not assigned to the project (RF-035)', async (): Promise<void> => {
      await expect(
        service.create({ projectId: 'p9', tools: ['SAST'] }, analyst),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects with BadRequestException (400) when tools is empty or contains an invalid tool', async (): Promise<void> => {
      await expect(
        service.create({ projectId: 'p1', tools: [] }, analyst),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({ projectId: '  ', tools: ['SAST'] }, analyst),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({ projectId: 'p1', tools: ['DAST' as never] }, analyst),
      ).rejects.toThrow(BadRequestException);
    });

    it('starts scanNumber at 1001 when there are no previous scans', async (): Promise<void> => {
      repository.find!.mockResolvedValue([]);
      const result = await service.create(
        { projectId: 'p1', tools: ['SAST'] },
        analyst,
      );
      expect(result.scanNumber).toBe(1001);
    });
  });

  describe('updateStatus (PATCH /scans/:id/status — RF-006)', (): void => {
    it('returns 409 when the scan changed concurrently', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'running',
      });
      repository.update!.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.updateStatus(
          'scan-1',
          { status: 'failed', errorMessage: 'Scanner timeout' },
          analyst,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows the pending → running transition', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'pending',
      });

      const result = await service.updateStatus(
        'scan-1',
        { status: 'running' },
        analyst,
      );

      expect(result.status).toBe('running');
      expect(repository.update).toHaveBeenCalledWith(
        { id: 'scan-1', status: 'pending' },
        expect.objectContaining({ status: 'running' }),
      );
    });

    it('moves to failed with an errorMessage and rejects a missing errorMessage or invalid status', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'running',
      });

      await expect(
        service.updateStatus('scan-1', { status: 'invalid' as never }, analyst),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStatus(
          'scan-1',
          { status: 'failed', errorMessage: '   ' },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      const result = await service.updateStatus(
        'scan-1',
        { status: 'failed', errorMessage: 'Scanner timeout' },
        analyst,
      );
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Scanner timeout');
    });

    it('throws NotFoundException when updating the status of a missing scan', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', { status: 'running' }, analyst),
      ).rejects.toThrow(NotFoundException);
    });

    it.each<[ScanStatus, ScanStatus]>([
      ['completed', 'running'],
      ['failed', 'running'],
      ['running', 'pending'],
      ['pending', 'completed'],
    ])(
      'rejects the invalid transition %s → %s with ConflictException (409)',
      async (fromStatus: ScanStatus, toStatus: ScanStatus): Promise<void> => {
        repository.findOne!.mockResolvedValue({
          id: 'scan-1',
          projectId: 'p1',
          status: fromStatus,
        });

        await expect(
          service.updateStatus('scan-1', { status: toStatus }, analyst),
        ).rejects.toThrow(ConflictException);
        expect(repository.update).not.toHaveBeenCalled();
      },
    );

    it('rejects with ForbiddenException (403) when the analyst is not assigned to the project', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p9',
        status: 'pending',
      });

      await expect(
        service.updateStatus('scan-1', { status: 'running' }, analyst),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitResults (POST /scans/:id/results — RF-010, RF-018, RF-019, RF-021, RF-022, RF-023)', (): void => {
    const sampleResults: SubmitScanResultsDto = {
      status: 'completed',
      errorMessage: null,
      findings: [
        {
          type: 'github-pat',
          severity: 'high',
          toolCategory: 'Secret Scanner',
          sourceTool: 'Gitleaks',
          filePath: 'src/config.ts',
          line: 12,
          description: 'GitHub Personal Access Token detected.',
          recommendation:
            'Revoke the token and load it from an environment variable.',
        },
        {
          type: 'javascript.lang.security.audit.eval-detected',
          severity: 'critical',
          toolCategory: 'SAST',
          sourceTool: 'Semgrep',
          filePath: 'src/eval.ts',
          line: 4,
          description: 'Dynamic code evaluation detected.',
          recommendation: 'Avoid eval().',
        },
        {
          type: 'generic-api-key',
          severity: null,
          toolCategory: 'Secret Scanner',
          sourceTool: 'Gitleaks',
          filePath: null,
          line: null,
          description: 'Generic secret detected without file reference.',
          recommendation: 'Rotate exposed credentials.',
        },
      ],
    };

    it('rejects a concurrent submission with 409 before storing findings', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'running',
      });
      repository.update!.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.submitResults('scan-1', sampleResults, analyst),
      ).rejects.toThrow(ConflictException);
      expect(findingRepository.save).not.toHaveBeenCalled();
      expect(projectRepository.save).not.toHaveBeenCalled();
    });

    it('stores normalized findings and computes scan counters when closing as completed', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'running',
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalCount: 0,
      });

      const result = await service.submitResults(
        'scan-1',
        sampleResults,
        analyst,
      );

      expect(findingRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            scanId: 'scan-1',
            type: 'github-pat',
            toolCategory: 'Secret Scanner',
            sourceTool: 'Gitleaks',
          }),
          expect.objectContaining({
            scanId: 'scan-1',
            type: 'generic-api-key',
            severity: null,
            filePath: null,
            line: null,
            toolCategory: 'Secret Scanner',
            sourceTool: 'Gitleaks',
          }),
        ]),
      );
      expect(result.status).toBe('completed');
      expect(result.errorMessage).toBeNull();
      expect(result.criticalCount).toBe(1);
      expect(result.highCount).toBe(1);
      expect(result.mediumCount).toBe(0);
      expect(result.lowCount).toBe(0);
      expect(result.totalCount).toBe(3);
    });

    it('allows closing as failed from pending or running and stores the errorMessage', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'pending',
      });

      const result = await service.submitResults(
        'scan-1',
        {
          status: 'failed',
          errorMessage: 'Invalid project path (RF-004)',
          findings: [],
        },
        analyst,
      );

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Invalid project path (RF-004)');
      expect(result.totalCount).toBe(0);
      expect(findingRepository.save).not.toHaveBeenCalled();
    });

    it('requires an errorMessage and no findings when status is failed', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'running',
      });

      await expect(
        service.submitResults(
          'scan-1',
          { status: 'failed', errorMessage: null, findings: [] },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitResults(
          'scan-1',
          {
            status: 'failed',
            errorMessage: 'Tool crashed',
            findings: sampleResults.findings,
          },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects with ConflictException (409) when submitting results to a closed scan', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'completed',
      });

      await expect(
        service.submitResults('scan-1', sampleResults, analyst),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects any finding that carries a plaintext Secret or Match value', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'running',
      });

      const payloadWithRawSecret = {
        status: 'completed',
        errorMessage: null,
        findings: [
          {
            ...sampleResults.findings[0],
            Secret: 'ghp_leaked_token_value',
          },
        ],
      } as unknown as SubmitScanResultsDto;

      await expect(
        service.submitResults('scan-1', payloadWithRawSecret, analyst),
      ).rejects.toThrow(BadRequestException);
      expect(findingRepository.save).not.toHaveBeenCalled();
    });

    it('validates finding fields (status, type, severity, toolCategory, sourceTool) and syncs project counters', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        scanNumber: 1045,
        projectId: 'p1',
        date: new Date('2026-08-14T00:00:00.000Z'),
        status: 'running',
      });

      await expect(
        service.submitResults(
          'scan-1',
          { status: 'running' as never, findings: [] },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitResults(
          'scan-1',
          {
            status: 'completed',
            findings: [{ ...sampleResults.findings[0], type: '   ' }],
          },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitResults(
          'scan-1',
          {
            status: 'completed',
            findings: [
              { ...sampleResults.findings[0], severity: 'urgent' as never },
            ],
          },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitResults(
          'scan-1',
          {
            status: 'completed',
            findings: [
              { ...sampleResults.findings[0], toolCategory: 'DAST' as never },
            ],
          },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitResults(
          'scan-1',
          {
            status: 'completed',
            findings: [{ ...sampleResults.findings[0], sourceTool: '' }],
          },
          analyst,
        ),
      ).rejects.toThrow(BadRequestException);

      projectRepository.findOne!.mockResolvedValue({
        id: 'p1',
        name: 'code-sentinel',
        status: 'pending',
        lastScan: null,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });
      repository.find!.mockResolvedValue([]);

      const completed = await service.submitResults(
        'scan-1',
        {
          status: 'completed',
          findings: [
            {
              type: 'medium-issue',
              severity: 'medium',
              toolCategory: 'SAST',
              sourceTool: 'Semgrep',
            },
            {
              type: 'low-issue',
              severity: 'low',
              toolCategory: 'SAST',
              sourceTool: 'Semgrep',
            },
          ],
        },
        analyst,
      );

      expect(completed.mediumCount).toBe(1);
      expect(completed.lowCount).toBe(1);
      expect(projectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'p1',
          status: 'completed',
          mediumCount: 1,
          lowCount: 1,
        }),
      );
    });

    it('reuses the project scan list when it already contains the current scan', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        scanNumber: 1045,
        projectId: 'p1',
        date: new Date('2026-08-14T00:00:00.000Z'),
        status: 'running',
      });
      projectRepository.findOne!.mockResolvedValue({
        id: 'p1',
        name: 'code-sentinel',
        status: 'running',
        lastScan: null,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });
      repository.find!.mockResolvedValue([
        {
          id: 'scan-1',
          scanNumber: 1045,
          projectId: 'p1',
          status: 'completed',
          date: new Date('2026-08-14T00:00:00.000Z'),
          criticalCount: 2,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
        },
      ]);

      const completed = await service.submitResults(
        'scan-1',
        {
          status: 'completed',
          findings: [
            {
              type: 'crit-issue',
              severity: 'critical',
              toolCategory: 'SAST',
              sourceTool: 'Semgrep',
            },
          ],
        },
        analyst,
      );

      expect(completed.criticalCount).toBe(1);
      expect(projectRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', (): void => {
    it('returns scans of the assigned projects when no filters are given', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({}, analyst);
      expect(repository.find).toHaveBeenCalledWith({
        where: { projectId: In(['p1', 'p2']) },
        order: { scanNumber: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('filters by projectId when provided', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockScans[0]]);
      await service.findAll({ projectId: 'p1' }, analyst);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'p1' }) as unknown,
        }),
      );
    });

    it.each(['pending', 'running', 'completed', 'failed'])(
      'accepts %s as a status filter (RF-006)',
      async (status: string): Promise<void> => {
        repository.find!.mockResolvedValue([]);
        await service.findAll({ status }, analyst);
        expect(repository.find).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status }) as unknown,
          }),
        );
      },
    );

    it('rejects an unknown status with BadRequestException (RF-006)', async (): Promise<void> => {
      await expect(
        service.findAll({ status: 'done' }, analyst),
      ).rejects.toThrow(BadRequestException);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('returns [] when the requested projectId is not assigned to the user', async (): Promise<void> => {
      const result = await service.findAll({ projectId: 'p9' }, analyst);
      expect(result).toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('filters by severity, keeping only scans with a count > 0', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({ severity: 'critical' }, analyst);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('populates projectId on every returned scan (RF-007)', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({}, analyst);
      result.forEach((scan) => {
        expect(scan.projectId).toBeDefined();
      });
    });

    it('filters by the dateFrom/dateTo range and returns [] without accessible projects', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockScans[0]]);
      await service.findAll(
        { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
        analyst,
      );
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.anything() as unknown,
          }) as unknown,
        }),
      );

      projectsService.getAccessibleProjectIds.mockResolvedValueOnce([]);
      const empty = await service.findAll({}, analyst);
      expect(empty).toEqual([]);
    });
  });

  describe('findScanIdsForProjects & findProjectIdForScan', (): void => {
    it('returns scan ids for the given projects or [] for an empty list', async (): Promise<void> => {
      expect(await service.findScanIdsForProjects([])).toEqual([]);
      repository.find!.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      expect(await service.findScanIdsForProjects(['p1'])).toEqual([
        's1',
        's2',
      ]);
    });

    it('returns the projectId of a scan or null when it does not exist', async (): Promise<void> => {
      repository.findOne!.mockResolvedValueOnce({ id: 's1', projectId: 'p1' });
      expect(await service.findProjectIdForScan('s1')).toBe('p1');

      repository.findOne!.mockResolvedValueOnce(null);
      expect(await service.findProjectIdForScan('missing')).toBeNull();
    });
  });

  describe('scan.entity helpers', (): void => {
    it('validates statuses, result statuses, tools and transitions', (): void => {
      expect(isScanStatus('pending')).toBe(true);
      expect(isScanStatus('unknown')).toBe(false);
      expect(isResultScanStatus('completed')).toBe(true);
      expect(isResultScanStatus('failed')).toBe(true);
      expect(isResultScanStatus('running')).toBe(false);
      expect(isScanTool('SAST')).toBe(true);
      expect(isScanTool('Other')).toBe(false);
      expect(canTransitionScanStatus('pending', 'running')).toBe(true);
      expect(canTransitionScanStatus('completed', 'failed')).toBe(false);
      expect(computeProjectCountersFromScans([])).toEqual({
        status: 'pending',
        lastScan: null,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });
    });
  });

  describe('findOne', (): void => {
    it('returns the scan when it exists', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockScans[0]);
      const result = await service.findOne('1', analyst);
      expect(result).toEqual(mockScans[0]);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: { findings: true },
      });
    });

    it('throws NotFoundException when the scan does not exist', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', analyst)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the scan belongs to an unassigned project', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        ...mockScans[0],
        projectId: 'p9',
      });
      await expect(service.findOne('1', analyst)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('includes the findings of the selected scan (RF-027)', async (): Promise<void> => {
      const scanWithFindings = {
        ...mockScans[0],
        findings: [
          { id: 'f1', scanId: '1', type: 'SQL Injection', severity: 'high' },
        ],
      };
      repository.findOne!.mockResolvedValue(scanWithFindings);

      const result = await service.findOne('1', analyst);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].scanId).toBe('1');
    });

    it('reports no findings when the array is empty (RF-027)', async (): Promise<void> => {
      const scanWithoutFindings = { ...mockScans[0], findings: [] };
      repository.findOne!.mockResolvedValue(scanWithoutFindings);

      const result = await service.findOne('1', analyst);

      expect(result.findings).toEqual([]);
    });
  });

  describe('computeProjectCountersFromScans (RF-028, RF-029)', (): void => {
    it('computes project counters from the latest completed scan, ignoring in-progress scans', (): void => {
      const counters = computeProjectCountersFromScans([
        {
          scanNumber: 1043,
          date: new Date('2026-08-13T00:00:00.000Z'),
          status: 'running',
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
        },
        {
          scanNumber: 1042,
          date: new Date('2026-08-12T00:00:00.000Z'),
          status: 'completed',
          criticalCount: 1,
          highCount: 3,
          mediumCount: 5,
          lowCount: 2,
        },
        {
          scanNumber: 1039,
          date: new Date('2026-08-08T00:00:00.000Z'),
          status: 'completed',
          criticalCount: 2,
          highCount: 4,
          mediumCount: 4,
          lowCount: 3,
        },
      ]);

      expect(counters).toEqual({
        status: 'completed',
        lastScan: new Date('2026-08-12T00:00:00.000Z'),
        criticalCount: 1,
        highCount: 3,
        mediumCount: 5,
        lowCount: 2,
      });
    });

    it('returns pending status and zero counters when no scan is closed', (): void => {
      const counters = computeProjectCountersFromScans([
        {
          scanNumber: 1044,
          date: new Date('2026-08-13T00:00:00.000Z'),
          status: 'pending',
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
        },
      ]);

      expect(counters).toEqual({
        status: 'pending',
        lastScan: null,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      });
    });
  });
});

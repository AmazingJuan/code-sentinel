import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { In, ObjectLiteral, Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { ScansService } from '../scans/scans.service';
import { RequestingUser } from '../types/requesting-user.type';
import { UserRole } from '../users/entities/user.entity';
import { Finding, isFindingSeverity } from './finding.entity';
import { FindingsService } from './findings.service';

const FINDING_REPOSITORY_TOKEN = 'FindingRepository';

type MockRepository<T extends ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

interface MockProjectsService {
  getAccessibleProjectIds: jest.Mock<Promise<string[]>, [RequestingUser]>;
}

interface MockScansService {
  findScanIdsForProjects: jest.Mock<Promise<string[]>, [string[]]>;
  findProjectIdForScan: jest.Mock<Promise<string | null>, [string]>;
}

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('FindingsService', () => {
  let service: FindingsService;
  let repository: MockRepository<Finding>;
  let projectsService: MockProjectsService;
  let scansService: MockScansService;

  const analyst: RequestingUser = { id: 'u1', role: UserRole.ANALYST };

  const mockFindings: Partial<Finding>[] = [
    {
      id: 'f1',
      scanId: 's1',
      type: 'Hardcoded Secret',
      severity: 'critical',
      sourceTool: 'Secret Scanner',
      filePath: 'src/config.js',
      line: 12,
    },
    {
      id: 'f2',
      scanId: 's1',
      type: 'SQL Injection',
      severity: 'high',
      sourceTool: 'SAST',
    },
  ];

  beforeEach(async () => {
    projectsService = {
      getAccessibleProjectIds: jest
        .fn<Promise<string[]>, [RequestingUser]>()
        .mockResolvedValue(['p1']),
    };
    scansService = {
      findScanIdsForProjects: jest
        .fn<Promise<string[]>, [string[]]>()
        .mockResolvedValue(['s1']),
      findProjectIdForScan: jest
        .fn<Promise<string | null>, [string]>()
        .mockResolvedValue('p1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindingsService,
        {
          provide: FINDING_REPOSITORY_TOKEN,
          useValue: createMockRepository<Finding>(),
        },
        { provide: ProjectsService, useValue: projectsService },
        { provide: ScansService, useValue: scansService },
      ],
    }).compile();

    service = module.get<FindingsService>(FindingsService);
    repository = module.get(FINDING_REPOSITORY_TOKEN);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('findAll', (): void => {
    it('rejects an unknown severity or toolCategory with BadRequestException', async (): Promise<void> => {
      await expect(
        service.findAll({ severity: 'urgent' }, analyst),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findAll({ toolCategory: 'DAST' }, analyst),
      ).rejects.toThrow(BadRequestException);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('returns the findings of accessible scans when no filters are given', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);
      const result = await service.findAll({}, analyst);
      expect(repository.find).toHaveBeenCalledWith({
        where: { scanId: In(['s1']) },
        order: { severity: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('filters by severity when provided', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockFindings[0]]);
      await service.findAll({ severity: 'critical' }, analyst);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: 'critical' }) as unknown,
        }),
      );
    });

    it('returns the full finding set without filters (RF-026)', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);
      const result = await service.findAll({}, analyst);
      expect(result).toHaveLength(mockFindings.length);
    });

    it('returns [] when the requested scanId belongs to an unassigned project', async (): Promise<void> => {
      scansService.findProjectIdForScan.mockResolvedValue('p9');
      const result = await service.findAll({ scanId: 's9' }, analyst);
      expect(result).toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('filters by assigned scanId, type, toolCategory and sourceTool (including the legacy category)', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockFindings[0]]);

      await service.findAll(
        {
          scanId: 's1',
          type: 'Hardcoded Secret',
          toolCategory: 'Secret Scanner',
          sourceTool: 'Gitleaks',
        },
        analyst,
      );

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scanId: 's1',
            type: 'Hardcoded Secret',
            toolCategory: 'Secret Scanner',
            sourceTool: 'Gitleaks',
          },
        }),
      );

      await service.findAll({ sourceTool: 'SAST' }, analyst);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ toolCategory: 'SAST' }) as unknown,
        }),
      );
    });

    it('returns [] when the user has no assigned projects or those projects have no scans', async (): Promise<void> => {
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce([]);
      expect(await service.findAll({}, analyst)).toEqual([]);

      scansService.findScanIdsForProjects.mockResolvedValueOnce([]);
      expect(await service.findAll({}, analyst)).toEqual([]);
    });

    it('isFindingSeverity accepts valid severities and rejects invalid ones', (): void => {
      expect(isFindingSeverity('critical')).toBe(true);
      expect(isFindingSeverity('high')).toBe(true);
      expect(isFindingSeverity('medium')).toBe(true);
      expect(isFindingSeverity('low')).toBe(true);
      expect(isFindingSeverity('none')).toBe(false);
    });
  });

  describe('findOne', (): void => {
    it('throws NotFoundException when the finding does not exist', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', analyst)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the finding belongs to an unassigned project', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockFindings[0]);
      scansService.findProjectIdForScan.mockResolvedValue('p9');
      await expect(service.findOne('f1', analyst)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the finding even without a severity (RF-022)', async (): Promise<void> => {
      const findingWithoutSeverity = {
        id: 'f3',
        scanId: 's1',
        type: 'Unknown Issue',
        severity: null,
      };
      repository.findOne!.mockResolvedValue(findingWithoutSeverity);

      const result = await service.findOne('f3', analyst);

      expect(result.severity).toBeNull();
    });

    it('returns the finding without filePath/line when they do not apply (RF-021)', async (): Promise<void> => {
      const globalFinding = {
        id: 'f4',
        scanId: 's1',
        type: 'Exposed Service',
        severity: 'medium',
        filePath: null,
        line: null,
        sourceTool: 'Custom Tool',
      };
      repository.findOne!.mockResolvedValue(globalFinding);

      const result = await service.findOne('f4', analyst);

      expect(result.filePath).toBeNull();
      expect(result.line).toBeNull();
    });

    it('returns filePath and line when the finding has a code location (RF-021)', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockFindings[0]);

      const result = await service.findOne('f1', analyst);

      expect(result.filePath).toBeDefined();
      expect(result.line).toBeDefined();
    });
  });
});

// apps/backend/src/findings/findings.service.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { In, ObjectLiteral, Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { ScansService } from '../scans/scans.service';
import { RequestingUser } from '../types/requesting-user.type';
import { UserRole } from '../users/entities/user.entity';
import { Finding } from './finding.entity';
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
    it('debe retornar los findings de los scans accesibles cuando no hay filtros', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);
      const result = await service.findAll({}, analyst);
      expect(repository.find).toHaveBeenCalledWith({
        where: { scanId: In(['s1']) },
        order: { severity: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe filtrar por severity cuando se provee', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockFindings[0]]);
      await service.findAll({ severity: 'critical' }, analyst);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: 'critical' }) as unknown,
        }),
      );
    });

    it('sin filtros debe retornar el set completo de findings (RF-026)', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);
      const result = await service.findAll({}, analyst);
      expect(result).toHaveLength(mockFindings.length);
    });

    it('debe retornar [] si el scanId pedido es de un proyecto no asignado', async (): Promise<void> => {
      scansService.findProjectIdForScan.mockResolvedValue('p9');
      const result = await service.findAll({ scanId: 's9' }, analyst);
      expect(result).toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne', (): void => {
    it('debe lanzar NotFoundException cuando el finding no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', analyst)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar ForbiddenException si el finding es de un proyecto no asignado', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockFindings[0]);
      scansService.findProjectIdForScan.mockResolvedValue('p9');
      await expect(service.findOne('f1', analyst)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debe retornar el finding aunque no tenga severity provista (RF-022)', async (): Promise<void> => {
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

    it('debe retornar el finding sin filePath/line cuando no aplican (RF-021)', async (): Promise<void> => {
      const portFinding = {
        id: 'f4',
        scanId: 's1',
        type: 'Open Port',
        severity: 'medium',
        filePath: null,
        line: null,
        sourceTool: 'Port Scanner',
      };
      repository.findOne!.mockResolvedValue(portFinding);

      const result = await service.findOne('f4', analyst);

      expect(result.filePath).toBeNull();
      expect(result.line).toBeNull();
    });

    it('debe retornar filePath y line cuando el finding sí tiene ubicación en código (RF-021)', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockFindings[0]);

      const result = await service.findOne('f1', analyst);

      expect(result.filePath).toBeDefined();
      expect(result.line).toBeDefined();
    });
  });
});

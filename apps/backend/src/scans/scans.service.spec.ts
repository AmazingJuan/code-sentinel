// apps/backend/src/scans/scans.service.spec.ts
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
  };
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
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('create (POST /scans — RF-005, RF-006)', (): void => {
    it('debe crear un scan en estado pending con el siguiente scanNumber', async (): Promise<void> => {
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

    it('debe rechazar con ForbiddenException (403) si el analista no está asignado al proyecto (RF-035)', async (): Promise<void> => {
      await expect(
        service.create({ projectId: 'p9', tools: ['SAST'] }, analyst),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('debe rechazar con BadRequestException (400) si tools está vacío o tiene una herramienta inválida', async (): Promise<void> => {
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

    it('debe iniciar scanNumber en 1001 cuando no existen scans previos', async (): Promise<void> => {
      repository.find!.mockResolvedValue([]);
      const result = await service.create(
        { projectId: 'p1', tools: ['SAST'] },
        analyst,
      );
      expect(result.scanNumber).toBe(1001);
    });
  });

  describe('updateStatus (PATCH /scans/:id/status — RF-006)', (): void => {
    it('debe permitir la transición pending → running', async (): Promise<void> => {
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
      expect(repository.save).toHaveBeenCalled();
    });

    it('debe permitir pasar a failed con errorMessage y rechazar si falta errorMessage o status inválido', async (): Promise<void> => {
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

    it('debe lanzar NotFoundException si el scan no existe al actualizar estado', async (): Promise<void> => {
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
      'debe rechazar la transición inválida %s → %s con ConflictException (409)',
      async (fromStatus: ScanStatus, toStatus: ScanStatus): Promise<void> => {
        repository.findOne!.mockResolvedValue({
          id: 'scan-1',
          projectId: 'p1',
          status: fromStatus,
        });

        await expect(
          service.updateStatus('scan-1', { status: toStatus }, analyst),
        ).rejects.toThrow(ConflictException);
        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it('debe rechazar con ForbiddenException (403) si el analista no está asignado al proyecto', async (): Promise<void> => {
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
          type: 'open-port-8080',
          severity: null,
          toolCategory: 'Port Scanner',
          sourceTool: 'CodeSentinel',
          filePath: null,
          line: null,
          description: 'Port 8080 is exposed.',
          recommendation: 'Close the port or restrict access.',
        },
      ],
    };

    it('debe guardar los findings normalizados y calcular los conteos del scan al cerrar como completed', async (): Promise<void> => {
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
            type: 'open-port-8080',
            severity: null,
            filePath: null,
            line: null,
            toolCategory: 'Port Scanner',
            sourceTool: 'CodeSentinel',
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

    it('debe permitir cerrar en failed desde pending o running guardando errorMessage', async (): Promise<void> => {
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

    it('debe exigir errorMessage y findings vacío cuando status es failed', async (): Promise<void> => {
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

    it('debe rechazar con ConflictException (409) si se intenta enviar resultados a un scan ya cerrado', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        id: 'scan-1',
        projectId: 'p1',
        status: 'completed',
      });

      await expect(
        service.submitResults('scan-1', sampleResults, analyst),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar por seguridad cualquier finding que incluya Secret o Match en texto plano', async (): Promise<void> => {
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

    it('debe validar campos de findings (status inválido, type, severity, toolCategory, sourceTool) y sincronizar contadores del proyecto', async (): Promise<void> => {
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
  });

  describe('findAll', (): void => {
    it('debe retornar los scans de los proyectos asignados cuando no hay filtros', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({}, analyst);
      expect(repository.find).toHaveBeenCalledWith({
        where: { projectId: In(['p1', 'p2']) },
        order: { scanNumber: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe filtrar por projectId cuando se provee', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockScans[0]]);
      await service.findAll({ projectId: 'p1' }, analyst);
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'p1' }) as unknown,
        }),
      );
    });

    it.each(['pending', 'running', 'completed', 'failed'])(
      'debe aceptar el estado %s como filtro (RF-006)',
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

    it('debe rechazar un estado desconocido con BadRequestException (RF-006)', async (): Promise<void> => {
      await expect(
        service.findAll({ status: 'done' }, analyst),
      ).rejects.toThrow(BadRequestException);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('debe retornar [] si el projectId pedido no está asignado al usuario', async (): Promise<void> => {
      const result = await service.findAll({ projectId: 'p9' }, analyst);
      expect(result).toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it('debe filtrar en memoria por severity, dejando solo scans con conteo > 0', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({ severity: 'critical' }, analyst);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('cada scan retornado debe tener su projectId poblado (RF-007)', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({}, analyst);
      result.forEach((scan) => {
        expect(scan.projectId).toBeDefined();
      });
    });

    it('debe filtrar por rango de fechas dateFrom y dateTo y retornar [] cuando no hay proyectos accesibles', async (): Promise<void> => {
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
    it('debe retornar IDs de scans para proyectos dados o [] si la lista está vacía', async (): Promise<void> => {
      expect(await service.findScanIdsForProjects([])).toEqual([]);
      repository.find!.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      expect(await service.findScanIdsForProjects(['p1'])).toEqual([
        's1',
        's2',
      ]);
    });

    it('debe retornar el projectId de un scan o null si no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValueOnce({ id: 's1', projectId: 'p1' });
      expect(await service.findProjectIdForScan('s1')).toBe('p1');

      repository.findOne!.mockResolvedValueOnce(null);
      expect(await service.findProjectIdForScan('missing')).toBeNull();
    });
  });

  describe('scan.entity helpers', (): void => {
    it('debe validar estados, estados de resultado, herramientas y transiciones', (): void => {
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
    it('debe retornar el scan cuando existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockScans[0]);
      const result = await service.findOne('1', analyst);
      expect(result).toEqual(mockScans[0]);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: { findings: true },
      });
    });

    it('debe lanzar NotFoundException cuando el scan no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe', analyst)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar ForbiddenException si el scan es de un proyecto no asignado', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue({
        ...mockScans[0],
        projectId: 'p9',
      });
      await expect(service.findOne('1', analyst)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debe incluir los findings asociados al scan seleccionado (RF-027)', async (): Promise<void> => {
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

    it('debe indicar que el scan no tiene findings cuando el array viene vacío (RF-027)', async (): Promise<void> => {
      const scanWithoutFindings = { ...mockScans[0], findings: [] };
      repository.findOne!.mockResolvedValue(scanWithoutFindings);

      const result = await service.findOne('1', analyst);

      expect(result.findings).toEqual([]);
    });
  });

  describe('computeProjectCountersFromScans (RF-028, RF-029)', (): void => {
    it('debe calcular los contadores del proyecto desde su último scan completado ignorando scans en curso', (): void => {
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

    it('debe retornar estado pending y contadores en 0 si no hay scans cerrados', (): void => {
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

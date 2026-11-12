// apps/backend/src/scans/scans.service.spec.ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { In, ObjectLiteral, Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { RequestingUser } from '../types/requesting-user.type';
import { UserRole } from '../users/entities/user.entity';
import { Scan } from './scan.entity';
import { ScansService } from './scans.service';

const SCAN_REPOSITORY_TOKEN = 'ScanRepository';

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
  };
}

describe('ScansService', () => {
  let service: ScansService;
  let repository: MockRepository<Scan>;
  let projectsService: MockProjectsService;

  const analyst: RequestingUser = { id: 'u1', role: UserRole.ANALYST };

  const mockScans: Partial<Scan>[] = [
    {
      id: '1',
      scanNumber: 1042,
      projectId: 'p1',
      status: 'completed',
      criticalCount: 1,
      highCount: 3,
      mediumCount: 5,
      lowCount: 2,
    },
    {
      id: '2',
      scanNumber: 1038,
      projectId: 'p2',
      status: 'failed',
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
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
        { provide: ProjectsService, useValue: projectsService },
      ],
    }).compile();

    service = module.get<ScansService>(ScansService);
    repository = module.get(SCAN_REPOSITORY_TOKEN);
  });

  afterEach((): void => {
    jest.clearAllMocks();
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
});

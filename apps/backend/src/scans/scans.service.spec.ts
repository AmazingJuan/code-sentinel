// apps/backend/src/scans/scans.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Scan } from './scan.entity';
import { ScansService } from './scans.service';

type MockRepository<T = unknown> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepository<T = unknown>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('ScansService', () => {
  let service: ScansService;
  let repository: MockRepository<Scan>;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScansService,
        { provide: getRepositoryToken(Scan), useValue: createMockRepository<Scan>() },
      ],
    }).compile();

    service = module.get<ScansService>(ScansService);
    repository = module.get(getRepositoryToken(Scan));
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('findAll', (): void => {
    it('debe retornar todos los scans cuando no hay filtros', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);

      const result = await service.findAll({});

      expect(repository.find).toHaveBeenCalledWith({
        where: {},
        order: { scanNumber: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe filtrar por projectId cuando se provee', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockScans[0]]);

      await service.findAll({ projectId: 'p1' });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ projectId: 'p1' }) }),
      );
    });

    it('debe filtrar en memoria por severity, dejando solo scans con conteo > 0', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);

      const result = await service.findAll({ severity: 'critical' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('debe retornar arreglo vacío cuando ningún scan cumple el filtro de severity', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);

      const result = await service.findAll({ severity: 'high' });

      expect(result.every((scan) => (scan.highCount ?? 0) === 0)).toBe(false);
      // El scan #1042 sí tiene highCount > 0, así que debe seguir apareciendo
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', (): void => {
    it('debe retornar el scan cuando existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockScans[0]);

      const result = await service.findOne('1');

      expect(result).toEqual(mockScans[0]);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: { findings: true },
      });
    });

    it('debe lanzar NotFoundException cuando el scan no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
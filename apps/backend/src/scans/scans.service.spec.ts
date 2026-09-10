// apps/backend/src/scans/scans.service.spec.ts
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { Scan } from './scan.entity';
import { ScansService } from './scans.service';

const SCAN_REPOSITORY_TOKEN = 'ScanRepository'; // equivalente a getRepositoryToken(Scan), sin importar @nestjs/typeorm (ESM roto en Jest)

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
    { id: '1', scanNumber: 1042, projectId: 'p1', status: 'completed', criticalCount: 1, highCount: 3, mediumCount: 5, lowCount: 2 },
    { id: '2', scanNumber: 1038, projectId: 'p2', status: 'failed', criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScansService,
        { provide: SCAN_REPOSITORY_TOKEN, useValue: createMockRepository<Scan>() },
      ],
    }).compile();

    service = module.get<ScansService>(ScansService);
    repository = module.get(SCAN_REPOSITORY_TOKEN);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('findAll', (): void => {
    it('debe retornar todos los scans cuando no hay filtros', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockScans);
      const result = await service.findAll({});
      expect(repository.find).toHaveBeenCalledWith({ where: {}, order: { scanNumber: 'DESC' } });
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
  });

  describe('findOne', (): void => {
    it('debe retornar el scan cuando existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockScans[0]);
      const result = await service.findOne('1');
      expect(result).toEqual(mockScans[0]);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: { findings: true } });
    });

    it('debe lanzar NotFoundException cuando el scan no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    describe('findOne — RF-027 (Scan Results)', (): void => {
      it('debe incluir los findings asociados al scan seleccionado', async (): Promise<void> => {
      const scanWithFindings = {
        ...mockScans[0],
      findings: [{ id: 'f1', scanId: '1', type: 'SQL Injection', severity: 'high' }],
    };
    repository.findOne!.mockResolvedValue(scanWithFindings);

    const result = await service.findOne('1');

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].scanId).toBe('1');
  });

    it('debe indicar que el scan no tiene findings cuando el array viene vacío', async (): Promise<void> => {
      const scanWithoutFindings = { ...mockScans[0], findings: [] };
    repository.findOne!.mockResolvedValue(scanWithoutFindings);

    const result = await service.findOne('1');

    expect(result.findings).toEqual([]);
  });
});

describe('findAll — RF-007 (asociación con proyecto)', (): void => {
  it('cada scan retornado debe tener su projectId poblado', async (): Promise<void> => {
    repository.find!.mockResolvedValue(mockScans);

    const result = await service.findAll({});

    result.forEach((scan) => {
      expect(scan.projectId).toBeDefined();
    });
  });
});
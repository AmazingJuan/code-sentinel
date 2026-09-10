// apps/backend/src/findings/findings.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { Finding } from './finding.entity';
import { FindingsService } from './findings.service';

const FINDING_REPOSITORY_TOKEN = 'FindingRepository'; // equivalente a getRepositoryToken(Finding)

type MockRepository<T = unknown> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepository<T = unknown>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('FindingsService', () => {
  let service: FindingsService;
  let repository: MockRepository<Finding>;

  const mockFindings: Partial<Finding>[] = [
    { id: 'f1', scanId: 's1', type: 'Hardcoded Secret', severity: 'critical', sourceTool: 'Secret Scanner' },
    { id: 'f2', scanId: 's1', type: 'SQL Injection', severity: 'high', sourceTool: 'SAST' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindingsService,
        { provide: FINDING_REPOSITORY_TOKEN, useValue: createMockRepository<Finding>() },
      ],
    }).compile();

    service = module.get<FindingsService>(FindingsService);
    repository = module.get(FINDING_REPOSITORY_TOKEN);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('findAll', (): void => {
    it('debe retornar todos los findings cuando no hay filtros', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);
      const result = await service.findAll({});
      expect(repository.find).toHaveBeenCalledWith({ where: {}, order: { severity: 'ASC' } });
      expect(result).toHaveLength(2);
    });

    it('debe filtrar por severity cuando se provee', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockFindings[0]]);
      await service.findAll({ severity: 'critical' });
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ severity: 'critical' }) }),
      );
    });
  });

  describe('findOne', (): void => {
    it('debe lanzar NotFoundException cuando el finding no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);
      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  // apps/backend/src/findings/findings.service.spec.ts
// ... (mantén todo lo que ya tienes, agrega estos describe/it)

describe('findOne — RF-022 (severity opcional tras el fix)', (): void => {
  it('debe retornar el finding aunque no tenga severity provista por la herramienta', async (): Promise<void> => {
    const findingWithoutSeverity = { id: 'f3', scanId: 's1', type: 'Unknown Issue', severity: null };
    repository.findOne!.mockResolvedValue(findingWithoutSeverity);

    const result = await service.findOne('f3');

    expect(result.severity).toBeNull();
  });
});

  describe('findOne — RF-021 (ubicación opcional)', (): void => {
    it('debe retornar el finding sin filePath/line cuando no aplican (ej. Port Scanner)', async (): Promise<void> => {
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

    const result = await service.findOne('f4');

      expect(result.filePath).toBeNull();
      expect(result.line).toBeNull();
    });

    it('debe retornar filePath y line cuando el finding sí tiene ubicación en código', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockFindings[0]);

      const result = await service.findOne('f1');

      expect(result.filePath).toBeDefined();
      expect(result.line).toBeDefined();
    });
  });

  describe('findAll — RF-026 (remover filtros)', (): void => {
    it('sin filtros debe retornar el set completo de findings', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);

      const result = await service.findAll({});

    expect(result).toHaveLength(mockFindings.length);
  });
  });
});

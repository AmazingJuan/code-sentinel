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
});
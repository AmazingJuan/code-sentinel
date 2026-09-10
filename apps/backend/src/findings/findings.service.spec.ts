// apps/backend/src/findings/findings.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Finding } from './finding.entity';
import { FindingsService } from './findings.service';

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
    {
      id: 'f1',
      scanId: 's1',
      type: 'Hardcoded Secret',
      severity: 'critical',
      sourceTool: 'Secret Scanner',
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindingsService,
        { provide: getRepositoryToken(Finding), useValue: createMockRepository<Finding>() },
      ],
    }).compile();

    service = module.get<FindingsService>(FindingsService);
    repository = module.get(getRepositoryToken(Finding));
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  describe('findAll', (): void => {
    it('debe retornar todos los findings cuando no hay filtros', async (): Promise<void> => {
      repository.find!.mockResolvedValue(mockFindings);

      const result = await service.findAll({});

      expect(repository.find).toHaveBeenCalledWith({
        where: {},
        order: { severity: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('debe filtrar por severity cuando se provee', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockFindings[0]]);

      await service.findAll({ severity: 'critical' });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ severity: 'critical' }) }),
      );
    });

    it('debe filtrar por sourceTool cuando se provee', async (): Promise<void> => {
      repository.find!.mockResolvedValue([mockFindings[1]]);

      await service.findAll({ sourceTool: 'SAST' });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sourceTool: 'SAST' }) }),
      );
    });
  });

  describe('findOne', (): void => {
    it('debe retornar el finding cuando existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(mockFindings[0]);

      const result = await service.findOne('f1');

      expect(result).toEqual(mockFindings[0]);
    });

    it('debe lanzar NotFoundException cuando el finding no existe', async (): Promise<void> => {
      repository.findOne!.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
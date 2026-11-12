// apps/backend/src/findings/findings.controller.spec.ts
import { Request } from 'express';
import { User, UserRole } from '../users/entities/user.entity';
import { Finding } from './finding.entity';
import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

describe('FindingsController', (): void => {
  let controller: FindingsController;
  let findingsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
  };

  const request: AuthenticatedRequest = {
    user: {
      id: 'u1',
      email: 'analyst@code-sentinel.local',
      name: 'Analyst',
      role: UserRole.ANALYST,
      createdAt: new Date(),
    },
  } as AuthenticatedRequest;

  const mockFinding: Partial<Finding> = {
    id: 'f1',
    scanId: 's1',
    type: 'SQL Injection',
    severity: 'high',
    toolCategory: 'SAST',
    sourceTool: 'Semgrep',
  };

  beforeEach((): void => {
    findingsService = {
      findAll: jest.fn().mockResolvedValue([mockFinding]),
      findOne: jest.fn().mockResolvedValue(mockFinding),
    };
    controller = new FindingsController(
      findingsService as unknown as FindingsService,
    );
  });

  it('debe delegar findAll con todos los filtros a FindingsService', async (): Promise<void> => {
    const result = await controller.findAll(
      request,
      'SQL Injection',
      'high',
      's1',
      'Semgrep',
      'SAST',
    );
    expect(result).toEqual([mockFinding]);
    expect(findingsService.findAll).toHaveBeenCalledWith(
      {
        type: 'SQL Injection',
        severity: 'high',
        scanId: 's1',
        sourceTool: 'Semgrep',
        toolCategory: 'SAST',
      },
      request.user,
    );
  });

  it('debe delegar findOne a FindingsService', async (): Promise<void> => {
    const result = await controller.findOne('f1', request);
    expect(result).toEqual(mockFinding);
    expect(findingsService.findOne).toHaveBeenCalledWith('f1', request.user);
  });
});


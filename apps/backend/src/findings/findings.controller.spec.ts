import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
import { FindingFiltersDto } from './dto/finding-filters.dto';
import { Finding } from './finding.entity';
import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';

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

  it('delegates findAll with every filter to FindingsService', async (): Promise<void> => {
    const filters: FindingFiltersDto = {
      type: 'SQL Injection',
      severity: 'high',
      scanId: 's1',
      sourceTool: 'Semgrep',
      toolCategory: 'SAST',
    };
    const result = await controller.findAll(request, filters);
    expect(result).toEqual([mockFinding]);
    expect(findingsService.findAll).toHaveBeenCalledWith(filters, request.user);
  });

  it('delegates findOne to FindingsService', async (): Promise<void> => {
    const result = await controller.findOne('f1', request);
    expect(result).toEqual(mockFinding);
    expect(findingsService.findOne).toHaveBeenCalledWith('f1', request.user);
  });
});

import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
import { ScanFiltersDto } from './dto/scan-filters.dto';
import { Scan } from './scan.entity';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

describe('ScansController', (): void => {
  let controller: ScansController;
  let scansService: {
    create: jest.Mock;
    updateStatus: jest.Mock;
    submitResults: jest.Mock;
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

  const mockScan: Partial<Scan> = {
    id: 'scan-1',
    scanNumber: 1045,
    projectId: 'p1',
    status: 'pending',
    tools: ['SAST'],
  };

  beforeEach((): void => {
    scansService = {
      create: jest.fn().mockResolvedValue(mockScan),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockScan, status: 'running' }),
      submitResults: jest
        .fn()
        .mockResolvedValue({ ...mockScan, status: 'completed' }),
      findAll: jest.fn().mockResolvedValue([mockScan]),
      findOne: jest.fn().mockResolvedValue(mockScan),
    };
    controller = new ScansController(scansService as unknown as ScansService);
  });

  it('delegates create to ScansService', async (): Promise<void> => {
    const result = await controller.create(
      { projectId: 'p1', tools: ['SAST'] },
      request,
    );
    expect(result).toEqual(mockScan);
    expect(scansService.create).toHaveBeenCalledWith(
      { projectId: 'p1', tools: ['SAST'] },
      request.user,
    );
  });

  it('delegates updateStatus to ScansService', async (): Promise<void> => {
    const result = await controller.updateStatus(
      'scan-1',
      { status: 'running' },
      request,
    );
    expect(result.status).toBe('running');
    expect(scansService.updateStatus).toHaveBeenCalledWith(
      'scan-1',
      { status: 'running' },
      request.user,
    );
  });

  it('delegates submitResults to ScansService', async (): Promise<void> => {
    const result = await controller.submitResults(
      'scan-1',
      { status: 'completed', findings: [] },
      request,
    );
    expect(result.status).toBe('completed');
    expect(scansService.submitResults).toHaveBeenCalledWith(
      'scan-1',
      { status: 'completed', findings: [] },
      request.user,
    );
  });

  it('delegates findAll with filters to ScansService', async (): Promise<void> => {
    const filters: ScanFiltersDto = {
      projectId: 'p1',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      status: 'completed',
      severity: 'critical',
    };
    const result = await controller.findAll(request, filters);
    expect(result).toEqual([mockScan]);
    expect(scansService.findAll).toHaveBeenCalledWith(filters, request.user);
  });

  it('delegates findOne to ScansService', async (): Promise<void> => {
    const result = await controller.findOne('scan-1', request);
    expect(result).toEqual(mockScan);
    expect(scansService.findOne).toHaveBeenCalledWith('scan-1', request.user);
  });
});

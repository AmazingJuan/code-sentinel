// apps/backend/src/scans/scans.controller.spec.ts
import { Request } from 'express';
import { User, UserRole } from '../users/entities/user.entity';
import { Scan } from './scan.entity';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

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

  it('debe delegar create en ScansService', async (): Promise<void> => {
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

  it('debe delegar updateStatus en ScansService', async (): Promise<void> => {
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

  it('debe delegar submitResults en ScansService', async (): Promise<void> => {
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

  it('debe delegar findAll con filtros en ScansService', async (): Promise<void> => {
    const result = await controller.findAll(
      request,
      'p1',
      '2026-08-01',
      '2026-08-31',
      'completed',
      'critical',
    );
    expect(result).toEqual([mockScan]);
    expect(scansService.findAll).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        status: 'completed',
        severity: 'critical',
      },
      request.user,
    );
  });

  it('debe delegar findOne en ScansService', async (): Promise<void> => {
    const result = await controller.findOne('scan-1', request);
    expect(result).toEqual(mockScan);
    expect(scansService.findOne).toHaveBeenCalledWith('scan-1', request.user);
  });
});


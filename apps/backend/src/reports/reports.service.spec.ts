import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { ProjectsService } from '../projects/projects.service';
import { Scan } from '../scans/scan.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Report } from './entities/report.entity';
import { ReportsService } from './reports.service';

describe('ReportsService', (): void => {
  let service: ReportsService;
  let reportRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let scanRepo: {
    findOne: jest.Mock;
  };
  let projectsService: {
    getAccessibleProjectIds: jest.Mock;
  };

  const analyst: Omit<User, 'passwordHash'> = {
    id: 'user-1',
    email: 'analyst@sentinel.local',
    name: 'Analyst User',
    role: UserRole.ANALYST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleScan: Partial<Scan> = {
    id: 'scan-123',
    projectId: 'proj-1',
    status: 'completed',
    scanNumber: 1,
    tools: ['SAST', 'Secret Scanner'],
    createdAt: new Date(),
    completedAt: new Date(),
    project: {
      id: 'proj-1',
      name: 'Sentinel Core',
      repo: 'git@github.com:org/core.git',
    } as unknown as Scan['project'],
    findings: [
      {
        id: 'find-1',
        type: 'Hardcoded Secret',
        severity: 'critical',
        toolCategory: 'Secret Scanner',
        sourceTool: 'Gitleaks',
        filePath: 'src/config.ts',
        line: 10,
        description: 'Exposed PAT',
        recommendation: 'Rotate secret',
      } as unknown as Scan['findings'][number],
    ],
  };

  beforeEach(async (): Promise<void> => {
    reportRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto: Partial<Report>) => ({
        id: 'rep-1',
        ...dto,
        createdAt: new Date(),
      })),
      save: jest
        .fn()
        .mockImplementation((rep: Report) =>
          Promise.resolve({ id: 'rep-1', ...rep }),
        ),
    };

    scanRepo = {
      findOne: jest.fn(),
    };

    projectsService = {
      getAccessibleProjectIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Report),
          useValue: reportRepo,
        },
        {
          provide: getRepositoryToken(Scan),
          useValue: scanRepo,
        },
        {
          provide: ProjectsService,
          useValue: projectsService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('generateProtectedReport (RF-033)', (): void => {
    it('throws NotFoundException if scan does not exist', async (): Promise<void> => {
      scanRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.generateProtectedReport(
          'non-existent',
          { password: 'secretpassword' },
          analyst,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user is not assigned to the project', async (): Promise<void> => {
      scanRepo.findOne.mockResolvedValueOnce(sampleScan);
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce([
        'other-proj',
      ]);

      await expect(
        service.generateProtectedReport(
          'scan-123',
          { password: 'secretpassword' },
          analyst,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('encrypts data, hashes password, and saves report without exposing password in return', async (): Promise<void> => {
      scanRepo.findOne.mockResolvedValueOnce(sampleScan);
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce(['proj-1']);

      const result = await service.generateProtectedReport(
        'scan-123',
        { password: 'valid-secret-password', format: 'html' },
        analyst,
      );

      expect(result.id).toBe('rep-1');
      expect(result.scanId).toBe('scan-123');
      expect(result.projectId).toBe('proj-1');
      expect((result as Record<string, unknown>).password).toBeUndefined();
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();

      expect(reportRepo.save).toHaveBeenCalled();
      const savedArg = (
        reportRepo.save.mock.calls as unknown as Array<[Report]>
      )[0][0];
      expect(savedArg.passwordHash).toBeDefined();
      expect(
        await bcrypt.compare('valid-secret-password', savedArg.passwordHash),
      ).toBe(true);
      expect(savedArg.encryptedPayload).toBeDefined();
      expect(savedArg.encryptedPayload).not.toContain('valid-secret-password');
    });
  });

  describe('downloadReport (RF-034)', (): void => {
    it('throws NotFoundException if report is not found', async (): Promise<void> => {
      reportRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.downloadReport('rep-999', { password: 'password123' }, analyst),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user lacks access to report project', async (): Promise<void> => {
      const mockReport: Partial<Report> = {
        id: 'rep-1',
        projectId: 'proj-1',
        scanId: 'scan-123',
        passwordHash: await bcrypt.hash('secret123', 4),
      };
      reportRepo.findOne.mockResolvedValueOnce(mockReport);
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce([
        'other-project',
      ]);

      await expect(
        service.downloadReport('rep-1', { password: 'secret123' }, analyst),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException if report password is wrong', async (): Promise<void> => {
      const mockReport: Partial<Report> = {
        id: 'rep-1',
        projectId: 'proj-1',
        scanId: 'scan-123',
        passwordHash: await bcrypt.hash('correct-password', 4),
      };
      reportRepo.findOne.mockResolvedValueOnce(mockReport);
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce(['proj-1']);

      await expect(
        service.downloadReport(
          'rep-1',
          { password: 'wrong-password' },
          analyst,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('decrypts and returns report content when password matches', async (): Promise<void> => {
      const password = 'my-report-password';
      const passwordHash = await bcrypt.hash(password, 4);
      const reportData = { title: 'Test Report', findings: [] };
      const encryptedBundle = service.encryptPayload(reportData, password);

      const mockReport: Partial<Report> = {
        id: 'rep-1',
        projectId: 'proj-1',
        scanId: 'scan-123',
        format: 'json',
        passwordHash,
        encryptedPayload: JSON.stringify(encryptedBundle),
      };
      reportRepo.findOne.mockResolvedValueOnce(mockReport);
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce(['proj-1']);

      const downloaded = await service.downloadReport(
        'rep-1',
        { password },
        analyst,
      );
      expect(downloaded.contentType).toBe('application/json');
      expect(downloaded.filename).toBe('code-sentinel-report-scan-123.json');
      const parsed = JSON.parse(downloaded.content) as { title: string };
      expect(parsed.title).toBe('Test Report');
    });
  });

  describe('exportScanReport (RF-034 direct)', (): void => {
    it('generates self-contained encrypted HTML report bundle', async (): Promise<void> => {
      scanRepo.findOne.mockResolvedValueOnce(sampleScan);
      projectsService.getAccessibleProjectIds.mockResolvedValueOnce(['proj-1']);

      const result = await service.exportScanReport(
        'scan-123',
        { password: 'export-password', format: 'html' },
        analyst,
      );

      expect(result.contentType).toBe('text/html');
      expect(result.filename).toBe('code-sentinel-report-scan-scan-123.html');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('Code Sentinel Security Report');
      expect(result.content).toContain('unlockForm');
      expect(result.content).not.toContain('export-password');
    });
  });
});

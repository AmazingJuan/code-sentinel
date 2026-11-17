import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { DownloadReportDto } from './dto/download-report.dto';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

describe('ReportsController', (): void => {
  let controller: ReportsController;
  let reportsService: {
    generateProtectedReport: jest.Mock;
    downloadReport: jest.Mock;
    exportScanReport: jest.Mock;
  };

  const analyst: Omit<User, 'passwordHash'> = {
    id: 'u-1',
    email: 'analyst@sentinel.local',
    name: 'Analyst',
    role: UserRole.ANALYST,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = { user: analyst } as AuthenticatedRequest;

  beforeEach(async (): Promise<void> => {
    reportsService = {
      generateProtectedReport: jest.fn(),
      downloadReport: jest.fn(),
      exportScanReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: reportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('delegates createReport to service', async (): Promise<void> => {
    const dto: CreateReportDto = { password: 'pass', format: 'html' };
    const mockReportResponse = {
      id: 'rep-1',
      scanId: 's-1',
      projectId: 'p-1',
      format: 'html',
      createdAt: new Date(),
    };
    reportsService.generateProtectedReport.mockResolvedValueOnce(
      mockReportResponse,
    );

    const result = await controller.createReport('s-1', dto, mockRequest);
    expect(reportsService.generateProtectedReport).toHaveBeenCalledWith(
      's-1',
      dto,
      analyst,
    );
    expect(result.id).toBe('rep-1');
  });

  it('delegates downloadReport to service and streams response', async (): Promise<void> => {
    const dto: DownloadReportDto = { password: 'pass' };
    reportsService.downloadReport.mockResolvedValueOnce({
      filename: 'report.html',
      contentType: 'text/html',
      content: '<html></html>',
    });

    const setHeaderMock = jest.fn();
    const sendMock = jest.fn();
    const mockResponse = {
      setHeader: setHeaderMock,
      send: sendMock,
    } as unknown as Response;

    await controller.downloadReport('rep-1', dto, mockRequest, mockResponse);
    expect(reportsService.downloadReport).toHaveBeenCalledWith(
      'rep-1',
      dto,
      analyst,
    );
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="report.html"',
    );
    expect(sendMock).toHaveBeenCalledWith('<html></html>');
  });

  it('delegates exportScanReport and sets headers', async (): Promise<void> => {
    const dto: CreateReportDto = { password: 'pass', format: 'html' };
    reportsService.exportScanReport.mockResolvedValueOnce({
      filename: 'report.html',
      contentType: 'text/html',
      content: '<html></html>',
    });

    const setHeaderMock = jest.fn();
    const sendMock = jest.fn();
    const mockResponse = {
      setHeader: setHeaderMock,
      send: sendMock,
    } as unknown as Response;

    await controller.exportScanReport('s-1', dto, mockRequest, mockResponse);
    expect(reportsService.exportScanReport).toHaveBeenCalledWith(
      's-1',
      dto,
      analyst,
    );
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="report.html"',
    );
    expect(sendMock).toHaveBeenCalledWith('<html></html>');
  });
});

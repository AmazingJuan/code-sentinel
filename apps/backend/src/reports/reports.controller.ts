import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { DownloadReportDto } from './dto/download-report.dto';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * RF-033: Generates and persists a password-protected report for a scan.
   */
  @Post('scans/:scanId/reports')
  async createReport(
    @Param('scanId') scanId: string,
    @Body() createDto: CreateReportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{
    id: string;
    scanId: string;
    projectId: string;
    format: string;
    createdAt: Date;
  }> {
    return this.reportsService.generateProtectedReport(
      scanId,
      createDto,
      request.user,
    );
  }

  /**
   * RF-034: Downloads a previously created protected report verifying the password.
   */
  @Post('reports/:id/download')
  async downloadReport(
    @Param('id') id: string,
    @Body() downloadDto: DownloadReportDto,
    @Req() request: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsService.downloadReport(
      id,
      downloadDto,
      request.user,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }

  /**
   * RF-033 / RF-034: Exports and downloads a protected report for a scan in a single step.
   */
  @Post('scans/:scanId/report/download')
  async exportScanReport(
    @Param('scanId') scanId: string,
    @Body() createDto: CreateReportDto,
    @Req() request: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsService.exportScanReport(
      scanId,
      createDto,
      request.user,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }
}

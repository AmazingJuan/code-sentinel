import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { DownloadReportDto } from './dto/download-report.dto';
import { ReportFile, ReportsService, ReportSummary } from './reports.service';

// RF-032: reports expose security content, so only analysts may use them.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('scans/:scanId/reports')
  createReport(
    @Param('scanId', ParseUUIDPipe) scanId: string,
    @Body() createDto: CreateReportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ReportSummary> {
    return this.reportsService.generateProtectedReport(
      scanId,
      createDto,
      request.user,
    );
  }

  @Post('reports/:id/download')
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() downloadDto: DownloadReportDto,
    @Req() request: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsService.downloadReport(
      id,
      downloadDto,
      request.user,
    );
    this.sendFile(res, file);
  }

  @Post('scans/:scanId/report/download')
  async exportScanReport(
    @Param('scanId', ParseUUIDPipe) scanId: string,
    @Body() createDto: CreateReportDto,
    @Req() request: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsService.exportScanReport(
      scanId,
      createDto,
      request.user,
    );
    this.sendFile(res, file);
  }

  private sendFile(res: Response, file: ReportFile): void {
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(file.content);
  }
}

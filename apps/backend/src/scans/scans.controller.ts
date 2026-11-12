// apps/backend/src/scans/scans.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateScanDto } from './dto/create-scan.dto';
import { SubmitScanResultsDto } from './dto/submit-scan-results.dto';
import { UpdateScanStatusDto } from './dto/update-scan-status.dto';
import { Scan } from './scan.entity';
import { ScansService } from './scans.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('scans')
// RF-032: only analysts may read or create security content; admins get 403.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  create(
    @Body() createScanDto: CreateScanDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Scan> {
    return this.scansService.create(createScanDto, request.user);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateScanStatusDto: UpdateScanStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Scan> {
    return this.scansService.updateStatus(
      id,
      updateScanStatusDto,
      request.user,
    );
  }

  @Post(':id/results')
  @HttpCode(HttpStatus.OK)
  submitResults(
    @Param('id') id: string,
    @Body() submitScanResultsDto: SubmitScanResultsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Scan> {
    return this.scansService.submitResults(
      id,
      submitScanResultsDto,
      request.user,
    );
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<Scan[]> {
    return this.scansService.findAll(
      { projectId, dateFrom, dateTo, status, severity },
      request.user,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Scan> {
    return this.scansService.findOne(id, request.user);
  }
}

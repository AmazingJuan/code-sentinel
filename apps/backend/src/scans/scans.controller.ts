// apps/backend/src/scans/scans.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScansService } from './scans.service';
import { Scan } from './scan.entity';

@Controller('scans')
@UseGuards(JwtAuthGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: 'critical' | 'high' | 'medium' | 'low',
  ): Promise<Scan[]> {
    return this.scansService.findAll({ projectId, dateFrom, dateTo, status, severity });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Scan> {
    return this.scansService.findOne(id);
  }
}
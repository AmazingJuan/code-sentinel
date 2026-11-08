// apps/backend/src/scans/scans.controller.ts
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { ScansService } from './scans.service';
import { Scan } from './scan.entity';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('scans')
// RF-032: only analysts may read security content; admins get 403.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

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

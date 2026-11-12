// apps/backend/src/findings/findings.controller.ts
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { FindingsService } from './findings.service';
import { Finding } from './finding.entity';

type AuthenticatedRequest = Request & { user: Omit<User, 'passwordHash'> };

@Controller('findings')
// RF-032: only analysts may read security content; admins get 403.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST)
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('scanId') scanId?: string,
    @Query('sourceTool') sourceTool?: string,
    @Query('toolCategory') toolCategory?: string,
  ): Promise<Finding[]> {
    return this.findingsService.findAll(
      { type, severity, scanId, sourceTool, toolCategory },
      request.user,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Finding> {
    return this.findingsService.findOne(id, request.user);
  }
}

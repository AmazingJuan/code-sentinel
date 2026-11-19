import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
import { FindingFiltersDto } from './dto/finding-filters.dto';
import { Finding } from './finding.entity';
import { FindingsService } from './findings.service';

// RF-032: only analysts may read security content; admins get 403.
@Controller('findings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ANALYST)
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() filters: FindingFiltersDto,
  ): Promise<Finding[]> {
    return this.findingsService.findAll(filters, request.user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Finding> {
    return this.findingsService.findOne(id, request.user);
  }
}

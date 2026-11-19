import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { UserRole } from '../users/entities/user.entity';
import { CreateScanDto } from './dto/create-scan.dto';
import { ScanFiltersDto } from './dto/scan-filters.dto';
import { SubmitScanResultsDto } from './dto/submit-scan-results.dto';
import { UpdateScanStatusDto } from './dto/update-scan-status.dto';
import { Scan } from './scan.entity';
import { ScansService } from './scans.service';

// RF-032: only analysts may read or create security content; admins get 403.
@Controller('scans')
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
    @Param('id', ParseUUIDPipe) id: string,
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
    @Param('id', ParseUUIDPipe) id: string,
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
    @Query() filters: ScanFiltersDto,
  ): Promise<Scan[]> {
    return this.scansService.findAll(filters, request.user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Scan> {
    return this.scansService.findOne(id, request.user);
  }
}

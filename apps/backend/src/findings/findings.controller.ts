// apps/backend/src/findings/findings.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { FindingsService } from './findings.service';
import { Finding } from './finding.entity';

@Controller('findings')
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('scanId') scanId?: string,
    @Query('sourceTool') sourceTool?: string,
  ): Promise<Finding[]> {
    return this.findingsService.findAll({ type, severity, scanId, sourceTool });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Finding> {
    return this.findingsService.findOne(id);
  }
}
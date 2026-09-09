// apps/backend/src/findings/findings.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Finding } from './finding.entity';

export interface FindingFilters {
  type?: string;
  severity?: string;
  scanId?: string;
  sourceTool?: string;
}

@Injectable()
export class FindingsService {
  constructor(
    @InjectRepository(Finding)
    private readonly findingRepository: Repository<Finding>,
  ) {}

  findAll(filters: FindingFilters): Promise<Finding[]> {
    const where: FindOptionsWhere<Finding> = {};
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity as Finding['severity'];
    if (filters.scanId) where.scanId = filters.scanId;
    if (filters.sourceTool) where.sourceTool = filters.sourceTool;

    return this.findingRepository.find({ where, order: { severity: 'ASC' } });
  }

  async findOne(id: string): Promise<Finding> {
    const finding = await this.findingRepository.findOne({ where: { id } });
    if (!finding) throw new NotFoundException(`Finding ${id} not found`);
    return finding;
  }
}
// apps/backend/src/scans/scans.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { Scan } from './scan.entity';

export interface ScanFilters {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

@Injectable()
export class ScansService {
  constructor(
    @InjectRepository(Scan) private readonly scanRepository: Repository<Scan>,
  ) {}

  async findAll(filters: ScanFilters): Promise<Scan[]> {
    const where: FindOptionsWhere<Scan> = {};

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status as Scan['status'];
    if (filters.dateFrom && filters.dateTo) {
      where.date = Between(new Date(filters.dateFrom), new Date(filters.dateTo));
    }

    const severityColumnMap: Record<string, keyof Scan> = {
      critical: 'criticalCount',
      high: 'highCount',
      medium: 'mediumCount',
      low: 'lowCount',
    };

    let scans = await this.scanRepository.find({
      where,
      order: { scanNumber: 'DESC' },
    });

    if (filters.severity) {
      const column = severityColumnMap[filters.severity];
      scans = scans.filter((scan) => (scan[column] as number) > 0);
    }

    return scans;
  }

  async findOne(id: string): Promise<Scan> {
    const scan = await this.scanRepository.findOne({
      where: { id },
      relations: { findings: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${id} not found`);
    return scan;
  }
}
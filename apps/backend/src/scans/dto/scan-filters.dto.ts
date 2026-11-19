import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { EmptyStringToUndefined } from '../../common/query-transforms';
import {
  FINDING_SEVERITIES,
  type FindingSeverity,
} from '../../findings/finding.entity';
import { SCAN_STATUSES, type ScanStatus } from '../scan.entity';
import type { ScanFilters } from '../scans.service';

export class ScanFiltersDto implements ScanFilters {
  @IsOptional()
  @EmptyStringToUndefined()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsIn(SCAN_STATUSES)
  status?: ScanStatus;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsIn(FINDING_SEVERITIES)
  severity?: FindingSeverity;
}

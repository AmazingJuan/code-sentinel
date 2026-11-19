import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EmptyStringToUndefined } from '../../common/query-transforms';
import { SCAN_TOOLS, type ScanTool } from '../../scans/scan.entity';
import { FINDING_SEVERITIES, type FindingSeverity } from '../finding.entity';
import type { FindingFilters } from '../findings.service';

export class FindingFiltersDto implements FindingFilters {
  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  @MaxLength(255)
  type?: string;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsIn(FINDING_SEVERITIES)
  severity?: FindingSeverity;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsUUID()
  scanId?: string;

  // Accepts either a real tool name (Semgrep, Gitleaks) or, for backwards
  // compatibility, a tool category.
  @IsOptional()
  @EmptyStringToUndefined()
  @IsString()
  @MaxLength(100)
  sourceTool?: string;

  @IsOptional()
  @EmptyStringToUndefined()
  @IsIn(SCAN_TOOLS)
  toolCategory?: ScanTool;
}

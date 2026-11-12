// apps/backend/src/scans/dto/submit-scan-results.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FINDING_SEVERITIES,
  FindingSeverity,
} from '../../findings/finding.entity';
import {
  RESULT_SCAN_STATUSES,
  ResultScanStatus,
  SCAN_TOOLS,
  ScanTool,
} from '../scan.entity';

export class ScanFindingItemDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsIn(FINDING_SEVERITIES)
  severity: FindingSeverity | null;

  @IsIn(SCAN_TOOLS)
  toolCategory: ScanTool;

  @IsString()
  @IsNotEmpty()
  sourceTool: string;

  @IsOptional()
  @IsString()
  filePath?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  line?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  recommendation?: string | null;
}

export class SubmitScanResultsDto {
  @IsIn(RESULT_SCAN_STATUSES)
  status: ResultScanStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanFindingItemDto)
  findings: ScanFindingItemDto[];
}


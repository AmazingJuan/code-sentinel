import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  FINDING_SEVERITIES,
  type FindingSeverity,
} from '../../findings/finding.entity';
import {
  RESULT_SCAN_STATUSES,
  type ResultScanStatus,
  SCAN_TOOLS,
  type ScanTool,
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
  @MaxLength(64)
  commitSha?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cwe?: string | null;

  @IsOptional()
  @IsString()
  codeSnippet?: string | null;

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
  @MaxLength(64)
  commitSha?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string | null;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanFindingItemDto)
  findings: ScanFindingItemDto[];
}

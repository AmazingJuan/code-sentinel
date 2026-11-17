// apps/backend/src/scans/dto/create-scan.dto.ts
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { SCAN_TOOLS, ScanTool } from '../scan.entity';

export class CreateScanDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SCAN_TOOLS, { each: true })
  tools: ScanTool[];

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  branch?: string;
}

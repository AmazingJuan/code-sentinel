import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SCAN_TOOLS, ScanTool } from '../scan.entity';

export class CreateScanDto {
  @IsUUID()
  projectId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SCAN_TOOLS, { each: true })
  tools: ScanTool[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  commitSha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  branch?: string;
}

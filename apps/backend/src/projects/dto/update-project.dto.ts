// apps/backend/src/projects/dto/update-project.dto.ts
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SCAN_TOOLS, ScanTool } from '../../scans/scan.entity';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/\S/, { message: 'repo must contain a non-whitespace character' })
  repo?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(SCAN_TOOLS, { each: true })
  tools?: ScanTool[];
}

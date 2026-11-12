// apps/backend/src/scans/dto/update-scan-status.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';
import { SCAN_STATUSES, ScanStatus } from '../scan.entity';

export class UpdateScanStatusDto {
  @IsIn(SCAN_STATUSES)
  status: ScanStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;
}


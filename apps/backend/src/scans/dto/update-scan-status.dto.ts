import { IsIn, IsOptional, IsString } from 'class-validator';
import { SCAN_STATUSES, type ScanStatus } from '../scan.entity';

export class UpdateScanStatusDto {
  @IsIn(SCAN_STATUSES)
  status: ScanStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;
}

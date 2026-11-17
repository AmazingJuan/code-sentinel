import { IsNotEmpty, IsString } from 'class-validator';

export class DownloadReportDto {
  @IsString()
  @IsNotEmpty({ message: 'Report password is required' })
  password: string;
}

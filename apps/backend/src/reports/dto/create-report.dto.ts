import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4, {
    message: 'Report password must be at least 4 characters long',
  })
  password: string;

  @IsOptional()
  @IsString()
  @IsIn(['html', 'json'])
  format?: 'html' | 'json';
}

// apps/backend/src/projects/dto/create-project.dto.ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/\S/, { message: 'repo must contain a non-whitespace character' })
  repo: string;
}

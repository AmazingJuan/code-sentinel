// apps/backend/src/projects/dto/assign-project.dto.ts
import { IsUUID } from 'class-validator';

export class AssignProjectDto {
  @IsUUID()
  userId: string;
}

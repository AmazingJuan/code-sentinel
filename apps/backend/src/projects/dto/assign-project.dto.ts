import { IsUUID } from 'class-validator';

export class AssignProjectDto {
  @IsUUID()
  userId: string;
}

// apps/backend/src/types/requesting-user.type.ts
import { UserRole } from '../users/entities/user.entity';

export type RequestingUser = {
  id: string;
  role: UserRole;
};

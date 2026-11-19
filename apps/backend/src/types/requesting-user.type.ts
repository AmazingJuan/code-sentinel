import { UserRole } from '../users/entities/user.entity';

export type RequestingUser = {
  id: string;
  role: UserRole;
};

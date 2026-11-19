import type { Request } from 'express';
import type { PublicUser } from '../users/entities/user.entity';

export type AuthenticatedRequest = Request & { user: PublicUser };

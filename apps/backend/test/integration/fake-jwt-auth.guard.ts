// Replaces JwtAuthGuard in integration tests: instead of validating a JWT it
// builds the authenticated user from the `x-test-role` header, so each test
// chooses whether it acts as an analyst (default) or an admin.
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { RequestingUser } from '../../src/types/requesting-user.type';
import { UserRole } from '../../src/users/entities/user.entity';

export const TEST_ROLE_HEADER = 'x-test-role';

export const fakeJwtAuthGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestingUser }>();
    const role =
      request.headers[TEST_ROLE_HEADER] === UserRole.ADMIN
        ? UserRole.ADMIN
        : UserRole.ANALYST;
    request.user = { id: 'u1', role };
    return true;
  },
};

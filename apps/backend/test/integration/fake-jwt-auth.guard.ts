// apps/backend/test/integration/fake-jwt-auth.guard.ts
// Reemplaza al JwtAuthGuard en los tests de integración: en vez de validar un
// JWT, crea el usuario autenticado según el header `x-test-role`. Así cada test
// decide si actúa como analyst (por defecto) o como admin.
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

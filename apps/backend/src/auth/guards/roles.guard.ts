import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestingUser } from '../../types/requesting-user.type';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestingUser }>();
    const user = request.user;

    if (!user || !roles.includes(user.role)) {
      // RF-032: every denied attempt is recorded, not only blocked.
      this.logger.warn(
        `Access denied: user=${user?.id ?? 'anonymous'} role=${user?.role ?? 'none'} ` +
          `${request.method} ${request.originalUrl} requires=[${roles.join(', ')}]`,
      );
      throw new ForbiddenException(
        'Your role is not allowed to access this resource',
      );
    }
    return true;
  }
}

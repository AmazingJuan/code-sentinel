import type { ConfigService } from '@nestjs/config';
import { isProductionEnv } from '../common/runtime-env';

const DEVELOPMENT_JWT_SECRET = 'development-only-secret';
const DEFAULT_JWT_EXPIRES_IN = '7d';

/**
 * Resolves the JWT signing secret. Production refuses to start without an
 * explicit JWT_SECRET so tokens are never signed with the public default.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;
  if (isProductionEnv(config.get<string>('NODE_ENV'))) {
    throw new Error('JWT_SECRET must be set in production');
  }
  return DEVELOPMENT_JWT_SECRET;
}

export function resolveJwtExpiresIn(config: ConfigService): string {
  return config.get<string>('JWT_EXPIRES_IN') || DEFAULT_JWT_EXPIRES_IN;
}

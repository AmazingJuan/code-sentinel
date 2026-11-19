import type { ConfigService } from '@nestjs/config';
import { resolveJwtExpiresIn, resolveJwtSecret } from './jwt-config';

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string): string | undefined => values[key],
  } as unknown as ConfigService;
}

describe('jwt-config', (): void => {
  it('uses JWT_SECRET when it is set', (): void => {
    expect(
      resolveJwtSecret(
        configWith({ JWT_SECRET: 'configured', NODE_ENV: 'production' }),
      ),
    ).toBe('configured');
  });

  it('falls back to the development secret outside production', (): void => {
    expect(resolveJwtSecret(configWith({}))).toBe('development-only-secret');
  });

  it('refuses to run in production without JWT_SECRET', (): void => {
    expect(() =>
      resolveJwtSecret(configWith({ NODE_ENV: 'production' })),
    ).toThrow('JWT_SECRET must be set in production');
  });

  it('defaults the token lifetime to 7d', (): void => {
    expect(resolveJwtExpiresIn(configWith({}))).toBe('7d');
    expect(resolveJwtExpiresIn(configWith({ JWT_EXPIRES_IN: '1h' }))).toBe(
      '1h',
    );
  });
});

import { isProductionEnv, parseBooleanEnv } from './runtime-env';
import { isUniqueViolation } from './postgres-errors';

describe('runtime-env and postgres-errors helpers', (): void => {
  it('parseBooleanEnv honours explicit values and falls back otherwise', (): void => {
    expect(parseBooleanEnv('true', false)).toBe(true);
    expect(parseBooleanEnv(' FALSE ', true)).toBe(false);
    expect(parseBooleanEnv(undefined, true)).toBe(true);
    expect(parseBooleanEnv('yes', false)).toBe(false);
  });

  it('isProductionEnv only matches "production"', (): void => {
    expect(isProductionEnv('production')).toBe(true);
    expect(isProductionEnv('development')).toBe(false);
    expect(isProductionEnv(undefined)).toBe(false);
  });

  it('isUniqueViolation detects PostgreSQL code 23505', (): void => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ driverError: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation({ code: '22P02' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

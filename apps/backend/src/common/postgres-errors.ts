const UNIQUE_VIOLATION = '23505';

/** True when a TypeORM/pg error was raised by a unique constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, driverError } = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  return code === UNIQUE_VIOLATION || driverError?.code === UNIQUE_VIOLATION;
}

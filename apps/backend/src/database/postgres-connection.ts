import type { DataSourceOptions } from 'typeorm';

export type PostgresConnectionOptions = Extract<
  DataSourceOptions,
  { type: 'postgres' }
>;

type EnvReader = (key: string) => string | undefined;

/**
 * Connection settings shared by the Nest app and the standalone database
 * scripts. `DATABASE_URL` (managed hosting) takes precedence over the
 * discrete `DB_*` variables used by Docker Compose.
 */
export function buildPostgresConnectionOptions(
  readEnv: EnvReader,
): PostgresConnectionOptions {
  const databaseUrl = readEnv('DATABASE_URL');
  const useSsl = readEnv('DB_SSL') === 'true' || Boolean(databaseUrl);
  const port = Number(readEnv('DB_PORT'));

  return {
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: readEnv('DB_HOST'),
          port: Number.isInteger(port) && port > 0 ? port : undefined,
          username: readEnv('DB_USERNAME'),
          password: readEnv('DB_PASSWORD'),
          database: readEnv('DB_NAME'),
        }),
    // Managed providers terminate TLS with certificates that are not in the
    // default trust store, so verification is relaxed to keep compatibility.
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

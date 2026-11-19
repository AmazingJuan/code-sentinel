import { createScriptDataSource } from './script-data-source';

async function reset(): Promise<void> {
  const dataSource = createScriptDataSource();
  await dataSource.initialize();

  const queryRunner = dataSource.createQueryRunner();
  try {
    console.log('Resetting schema public...');
    await queryRunner.query('DROP SCHEMA public CASCADE;');
    await queryRunner.query('CREATE SCHEMA public;');
    await queryRunner.query('GRANT ALL ON SCHEMA public TO public;');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  } finally {
    await queryRunner.release();
  }

  try {
    await dataSource.synchronize();
    console.log('Schema synchronized.');
  } finally {
    await dataSource.destroy();
  }
  console.log('Database reset completed successfully.');
}

reset().catch((err: unknown): void => {
  console.error('Database reset failed:', err);
  process.exit(1);
});

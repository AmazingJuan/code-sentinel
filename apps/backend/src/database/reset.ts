// apps/backend/src/database/reset.ts
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/project.entity';
import { ProjectAssignment } from '../projects/project-assignment.entity';
import { Scan } from '../scans/scan.entity';
import { Finding } from '../findings/finding.entity';

const rootEnv = resolve(__dirname, '../../../../.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config();

async function reset(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const isSsl = process.env.DB_SSL === 'true' || Boolean(databaseUrl);

  const dataSource = new DataSource({
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        }),
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    entities: [User, Project, ProjectAssignment, Scan, Finding],
    synchronize: true,
  });

  await dataSource.initialize();
  const queryRunner = dataSource.createQueryRunner();

  console.log('Resetting schema public...');
  await queryRunner.query('DROP SCHEMA public CASCADE;');
  await queryRunner.query('CREATE SCHEMA public;');
  await queryRunner.query('GRANT ALL ON SCHEMA public TO public;');
  await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await queryRunner.release();

  await dataSource.synchronize();
  console.log('Schema synchronized.');

  await dataSource.destroy();
  console.log('Database reset completed successfully.');
}

reset().catch((err: unknown): void => {
  console.error('Database reset failed:', err);
  process.exit(1);
});

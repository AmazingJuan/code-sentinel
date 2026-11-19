import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { Finding } from '../findings/finding.entity';
import { ProjectAssignment } from '../projects/project-assignment.entity';
import { Project } from '../projects/project.entity';
import { Report } from '../reports/entities/report.entity';
import { Scan } from '../scans/scan.entity';
import { User } from '../users/entities/user.entity';
import { buildPostgresConnectionOptions } from './postgres-connection';

/** Loads `.env` from the monorepo root first, then from the backend folder. */
function loadEnvFiles(): void {
  const rootEnv = resolve(__dirname, '../../../../.env');
  if (existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  }
  dotenv.config();
}

/** DataSource for the standalone seed/reset scripts (development tooling). */
export function createScriptDataSource(): DataSource {
  loadEnvFiles();
  return new DataSource({
    ...buildPostgresConnectionOptions((key: string) => process.env[key]),
    entities: [User, Project, ProjectAssignment, Scan, Finding, Report],
    synchronize: true,
  });
}

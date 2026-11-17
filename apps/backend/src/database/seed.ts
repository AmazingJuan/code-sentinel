// apps/backend/src/database/seed.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/project.entity';
import { ProjectAssignment } from '../projects/project-assignment.entity';
import { Scan } from '../scans/scan.entity';
import { Finding } from '../findings/finding.entity';
import { DEFAULT_USERS } from '../users/users.service';

/**
 * Production-ready seeder.
 * Only idempotently provisions the initial default users with deterministic UUIDs.
 * Does NOT generate dummy projects, scans, or sample findings.
 * Does NOT delete or overwrite existing user data or project records.
 */
async function seed(): Promise<void> {
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
  const userRepo = dataSource.getRepository(User);

  for (const def of DEFAULT_USERS) {
    const existing = await userRepo.findOne({
      where: { email: def.email.toLowerCase() },
    });

    if (existing) {
      existing.name = def.name;
      existing.role = def.role;
      existing.passwordHash = await bcrypt.hash(def.password, 12);
      await userRepo.save(existing);
      console.log(`Updated user: ${def.email} (ID: ${existing.id})`);
    } else {
      const newUser = userRepo.create({
        id: def.id,
        email: def.email.toLowerCase(),
        name: def.name,
        passwordHash: await bcrypt.hash(def.password, 12),
        role: def.role,
      });
      await userRepo.save(newUser);
      console.log(`Created user: ${def.email} (ID: ${def.id})`);
    }
  }

  await dataSource.destroy();
  console.log('Seed completed successfully: default users verified.');
}

seed().catch((err: unknown): void => {
  console.error('Seed execution failed:', err);
  process.exit(1);
});

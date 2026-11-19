import { hashPassword } from '../common/password';
import { User } from '../users/entities/user.entity';
import { DEFAULT_USERS } from '../users/users.service';
import { createScriptDataSource } from './script-data-source';

/**
 * Idempotently provisions the default users with deterministic UUIDs. Existing
 * default accounts get their name, role and password reset to the defaults;
 * no other users, projects, scans or findings are touched.
 */
async function seed(): Promise<void> {
  const dataSource = createScriptDataSource();
  await dataSource.initialize();

  try {
    const userRepo = dataSource.getRepository(User);
    for (const def of DEFAULT_USERS) {
      const existing = await userRepo.findOne({
        where: { email: def.email.toLowerCase() },
      });

      if (existing) {
        existing.name = def.name;
        existing.role = def.role;
        existing.passwordHash = await hashPassword(def.password);
        await userRepo.save(existing);
        console.log(`Updated user: ${def.email} (ID: ${existing.id})`);
      } else {
        await userRepo.save(
          userRepo.create({
            id: def.id,
            email: def.email.toLowerCase(),
            name: def.name,
            passwordHash: await hashPassword(def.password),
            role: def.role,
          }),
        );
        console.log(`Created user: ${def.email} (ID: ${def.id})`);
      }
    }
  } finally {
    await dataSource.destroy();
  }
  console.log('Seed completed successfully: default users verified.');
}

seed().catch((err: unknown): void => {
  console.error('Seed execution failed:', err);
  process.exit(1);
});

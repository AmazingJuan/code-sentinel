// apps/backend/src/database/seed.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Project } from '../projects/project.entity';
import { Scan } from '../scans/scan.entity';
import { Finding } from '../findings/finding.entity';
import { User, UserRole } from '../users/entities/user.entity';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Project, Scan, Finding],
    synchronize: true,
  });

  await dataSource.initialize();

  const projectRepo = dataSource.getRepository(Project);
  const scanRepo = dataSource.getRepository(Scan);
  const findingRepo = dataSource.getRepository(Finding);
  const userRepo = dataSource.getRepository(User);

  // Clear data (order matters because of foreign keys)
  await dataSource.createQueryBuilder().delete().from(Finding).execute();
  await dataSource.createQueryBuilder().delete().from(Scan).execute();
  await dataSource.createQueryBuilder().delete().from(Project).execute();
  await dataSource.createQueryBuilder().delete().from(User).execute();

  const demoUser = await userRepo.save(
    userRepo.create({
      email: 'demo@code-sentinel.local',
      name: 'Demo User',
      passwordHash: await bcrypt.hash('Demo1234!', 12),
      role: UserRole.ADMIN,
    }),
  );

  const projectsData: Record<string, string> = {
    'code-sentinel': 'git@github.com:code-sentinel/code-sentinel.git',
    'backend-api': 'git@github.com:code-sentinel/backend-api.git',
    'frontend-app': 'git@github.com:code-sentinel/frontend-app.git',
    'payments-service': 'git@github.com:code-sentinel/payments-service.git',
  };
  const projects: Record<string, Project> = {};
  for (const [name, repo] of Object.entries(projectsData)) {
    projects[name] = await projectRepo.save(projectRepo.create({ name, repo, userId: demoUser.id }));
  }

  const scansData = [
    { scanNumber: 1042, project: 'code-sentinel', date: '2026-08-12', status: 'completed', tools: ['SAST', 'Secret Scanner', 'Port Scanner'], critical: 1, high: 3, medium: 5, low: 2 },
    { scanNumber: 1041, project: 'backend-api', date: '2026-08-11', status: 'completed', tools: ['SAST', 'Secret Scanner', 'Port Scanner'], critical: 2, high: 6, medium: 9, low: 4 },
    { scanNumber: 1040, project: 'frontend-app', date: '2026-08-10', status: 'completed', tools: ['SAST', 'Secret Scanner'], critical: 0, high: 2, medium: 7, low: 6 },
    { scanNumber: 1039, project: 'code-sentinel', date: '2026-08-08', status: 'completed', tools: ['SAST', 'Secret Scanner', 'Port Scanner'], critical: 2, high: 4, medium: 4, low: 3 },
    { scanNumber: 1038, project: 'payments-service', date: '2026-08-09', status: 'failed', tools: ['SAST'], critical: 0, high: 0, medium: 0, low: 0 },
    { scanNumber: 1037, project: 'backend-api', date: '2026-08-06', status: 'completed', tools: ['SAST', 'Secret Scanner', 'Port Scanner'], critical: 1, high: 5, medium: 8, low: 5 },
  ] as const;

  for (const s of scansData) {
    const total = s.critical + s.high + s.medium + s.low;
    const scan = await scanRepo.save(
      scanRepo.create({
        scanNumber: s.scanNumber,
        projectId: projects[s.project].id,
        date: new Date(s.date),
        status: s.status,
        tools: s.tools as unknown as Scan['tools'],
        criticalCount: s.critical,
        highCount: s.high,
        mediumCount: s.medium,
        lowCount: s.low,
        totalCount: total,
      }),
    );

    // Add sample findings to the first completed scan so the Findings view has data
    if (scan.scanNumber === 1042) {
      await findingRepo.save([
        findingRepo.create({
          scanId: scan.id,
          type: 'Hardcoded Secret',
          severity: 'critical',
          filePath: 'src/config.js',
          line: 12,
          sourceTool: 'Secret Scanner',
          description: 'API key exposed in plain text.',
          recommendation: 'Move it to environment variables.',
        }),
        findingRepo.create({
          scanId: scan.id,
          type: 'SQL Injection',
          severity: 'high',
          filePath: 'src/users.js',
          line: 45,
          sourceTool: 'SAST',
          description: 'Direct concatenation of input into an SQL query.',
          recommendation: 'Use parameterized queries.',
        }),
        findingRepo.create({
          scanId: scan.id,
          type: 'Open Port',
          severity: 'medium',
          filePath: null,
          line: null,
          sourceTool: 'Port Scanner',
          description: 'Port 8080 is open without authentication.',
          recommendation: 'Restrict access with a firewall.',
        }),
      ]);
    }
  }

  console.log('Seed completed. Test user: demo@code-sentinel.local / Demo1234!');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
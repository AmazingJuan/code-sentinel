// apps/backend/src/database/seed.ts
// This script runs standalone (outside Nest's bootstrap), so it must load
// `.env` itself; `ConfigModule` only does this once the Nest app starts.
import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Project } from '../projects/project.entity';
import { ProjectAssignment } from '../projects/project-assignment.entity';
import { computeProjectCountersFromScans, Scan } from '../scans/scan.entity';
import { Finding } from '../findings/finding.entity';
import { User, UserRole } from '../users/entities/user.entity';

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

  const projectRepo = dataSource.getRepository(Project);
  const assignmentRepo = dataSource.getRepository(ProjectAssignment);
  const scanRepo = dataSource.getRepository(Scan);
  const findingRepo = dataSource.getRepository(Finding);
  const userRepo = dataSource.getRepository(User);

  // Clear data (order matters because of foreign keys)
  await dataSource.createQueryBuilder().delete().from(Finding).execute();
  await dataSource.createQueryBuilder().delete().from(Scan).execute();
  await dataSource
    .createQueryBuilder()
    .delete()
    .from(ProjectAssignment)
    .execute();
  await dataSource.createQueryBuilder().delete().from(Project).execute();
  await dataSource.createQueryBuilder().delete().from(User).execute();

  // RF-032: the main demo user is an analyst, so the demo shows security
  // content. The administrator only manages users and project assignments.
  const demoUser = await userRepo.save(
    userRepo.create({
      email: 'demo@code-sentinel.local',
      name: 'Demo User',
      passwordHash: await bcrypt.hash('Demo1234!', 12),
      role: UserRole.ANALYST,
    }),
  );

  await userRepo.save(
    userRepo.create({
      email: 'admin@code-sentinel.local',
      name: 'Admin User',
      passwordHash: await bcrypt.hash('Admin1234!', 12),
      role: UserRole.ADMIN,
    }),
  );

  // Non-admin user used to demonstrate RF-035 project assignment: it can
  // only access the projects explicitly assigned to it below.
  const analystUser = await userRepo.save(
    userRepo.create({
      email: 'analyst@code-sentinel.local',
      name: 'Analyst User',
      passwordHash: await bcrypt.hash('Analyst1234!', 12),
      role: UserRole.ANALYST,
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
    projects[name] = await projectRepo.save(
      projectRepo.create({ name, repo, userId: demoUser.id }),
    );
  }

  // The registrant (the demo analyst, here) is assigned to every project it
  // registers, mirroring what ProjectsService.create does at runtime.
  for (const project of Object.values(projects)) {
    await assignmentRepo.save(
      assignmentRepo.create({ projectId: project.id, userId: demoUser.id }),
    );
  }

  // Assign the analyst to only two of the four projects, so logging in as
  // that user demonstrates RF-035's access restriction: it will see
  // "code-sentinel" and "backend-api", but not "frontend-app" or
  // "payments-service".
  for (const name of ['code-sentinel', 'backend-api']) {
    await assignmentRepo.save(
      assignmentRepo.create({
        projectId: projects[name].id,
        userId: analystUser.id,
      }),
    );
  }

  const scansData = [
    // RF-006: one scan per lifecycle state, so the demo shows all four.
    {
      scanNumber: 1044,
      project: 'frontend-app',
      date: '2026-08-13',
      status: 'pending',
      tools: ['SAST', 'Secret Scanner'],
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    {
      scanNumber: 1043,
      project: 'code-sentinel',
      date: '2026-08-13',
      status: 'running',
      tools: ['SAST', 'Secret Scanner'],
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    {
      scanNumber: 1042,
      project: 'code-sentinel',
      date: '2026-08-12',
      status: 'completed',
      tools: ['SAST', 'Secret Scanner', 'Port Scanner'],
      critical: 1,
      high: 3,
      medium: 5,
      low: 2,
    },
    {
      scanNumber: 1041,
      project: 'backend-api',
      date: '2026-08-11',
      status: 'completed',
      tools: ['SAST', 'Secret Scanner', 'Port Scanner'],
      critical: 2,
      high: 6,
      medium: 9,
      low: 4,
    },
    {
      scanNumber: 1040,
      project: 'frontend-app',
      date: '2026-08-10',
      status: 'completed',
      tools: ['SAST', 'Secret Scanner'],
      critical: 0,
      high: 2,
      medium: 7,
      low: 6,
    },
    {
      scanNumber: 1039,
      project: 'code-sentinel',
      date: '2026-08-08',
      status: 'completed',
      tools: ['SAST', 'Secret Scanner', 'Port Scanner'],
      critical: 2,
      high: 4,
      medium: 4,
      low: 3,
    },
    {
      scanNumber: 1038,
      project: 'payments-service',
      date: '2026-08-09',
      status: 'failed',
      tools: ['SAST'],
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    {
      scanNumber: 1037,
      project: 'backend-api',
      date: '2026-08-06',
      status: 'completed',
      tools: ['SAST', 'Secret Scanner', 'Port Scanner'],
      critical: 1,
      high: 5,
      medium: 8,
      low: 5,
    },
  ] as const;

  for (const scanItem of scansData) {
    const total =
      scanItem.critical + scanItem.high + scanItem.medium + scanItem.low;
    const scan = await scanRepo.save(
      scanRepo.create({
        commitSha: '9594a268e15a27027ea2ba2c3a243bcbabd86749',
        branch: 'main',
        scanNumber: scanItem.scanNumber,
        projectId: projects[scanItem.project].id,
        date: new Date(scanItem.date),
        status: scanItem.status,
        errorMessage:
          scanItem.status === 'failed'
            ? 'Repository path could not be accessed by the scanner.'
            : null,
        tools: scanItem.tools as unknown as Scan['tools'],
        criticalCount: scanItem.critical,
        highCount: scanItem.high,
        mediumCount: scanItem.medium,
        lowCount: scanItem.low,
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
          toolCategory: 'Secret Scanner',
          filePath: 'src/config.js',
          line: 12,
          cwe: 'CWE-798',
          commitSha: '9594a268e15a27027ea2ba2c3a243bcbabd86749',
          sourceTool: 'Gitleaks',
          description:
            'A sensitive credential or API token was detected hardcoded directly in source code. Secrets committed to version control can be extracted by attackers and lead to unauthorized access to production resources.',
          recommendation:
            'Remove the secret from version control history, rotate the compromised key immediately, and use environment variables or a vault secrets manager.',
          codeSnippet: JSON.stringify([
            { line: 10, text: "const path = require('path');" },
            { line: 11, text: '' },
            { line: 12, text: "const API_SECRET = 'example-secret-token-placeholder';", highlight: true },
            { line: 13, text: '' },
            { line: 14, text: 'module.exports = { API_SECRET };' },
          ]),
        }),
        findingRepo.create({
          scanId: scan.id,
          type: 'SQL Injection',
          severity: 'high',
          toolCategory: 'SAST',
          filePath: 'src/users.js',
          line: 45,
          cwe: 'CWE-89',
          commitSha: '9594a268e15a27027ea2ba2c3a243bcbabd86749',
          sourceTool: 'Semgrep',
          description:
            'User-controlled input is concatenated directly into a raw SQL query without parameterized binding. This allows an attacker to alter the query logic and bypass authentication or dump database contents.',
          recommendation:
            'Use parameterized queries, prepared statements, or an ORM like TypeORM/Prisma. Never build SQL strings by concatenating untrusted user input.',
          codeSnippet: JSON.stringify([
            { line: 43, text: 'async function getUser(req, res) {' },
            { line: 44, text: '  const userId = req.query.id;' },
            { line: 45, text: "  const query = 'SELECT * FROM users WHERE id = ' + userId;", highlight: true },
            { line: 46, text: '  const user = await db.query(query);' },
            { line: 47, text: '  res.json(user);' },
          ]),
        }),
        findingRepo.create({
          scanId: scan.id,
          type: 'Open Port',
          severity: 'medium',
          toolCategory: 'Port Scanner',
          filePath: null,
          line: null,
          cwe: 'CWE-200',
          commitSha: '9594a268e15a27027ea2ba2c3a243bcbabd86749',
          sourceTool: 'CodeSentinel',
          description:
            'TCP port 8080 was detected open and listening on external interfaces without authentication or encryption.',
          recommendation:
            'Bind the service to 127.0.0.1 if it is internal only, or restrict inbound traffic using firewall rules (iptables/security groups) and require TLS authentication.',
        }),
      ]);
    }
  }

  // RF-028 / RF-029: calculate each project's status, lastScan, and severity
  // counters from its seeded scans.
  for (const project of Object.values(projects)) {
    const projectScans = await scanRepo.find({
      where: { projectId: project.id },
      order: { scanNumber: 'DESC' },
    });
    const counters = computeProjectCountersFromScans(projectScans);
    project.status = counters.status;
    project.lastScan = counters.lastScan;
    project.criticalCount = counters.criticalCount;
    project.highCount = counters.highCount;
    project.mediumCount = counters.mediumCount;
    project.lowCount = counters.lowCount;
    await projectRepo.save(project);
  }

  console.log('Seed completed.');
  console.log(
    'Demo analyst (sees every project): demo@code-sentinel.local / Demo1234!',
  );
  console.log(
    'Admin user (manages users and assignments only): admin@code-sentinel.local / Admin1234!',
  );
  console.log(
    'Analyst user (sees only code-sentinel and backend-api): analyst@code-sentinel.local / Analyst1234!',
  );

  await dataSource.destroy();
}

seed().catch((err: unknown): void => {
  console.error(err);
  process.exit(1);
});

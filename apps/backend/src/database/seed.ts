// apps/backend/src/database/seed.ts
import { DataSource } from 'typeorm';
import { Project } from '../projects/project.entity';
import { Scan } from '../scans/scan.entity';
import { Finding } from '../findings/finding.entity';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [Project, Scan, Finding],
    synchronize: true,
  });

  await dataSource.initialize();

  const projectRepo = dataSource.getRepository(Project);
  const scanRepo = dataSource.getRepository(Scan);
  const findingRepo = dataSource.getRepository(Finding);

  // Limpiar (orden importa por FKs)
  await dataSource.createQueryBuilder().delete().from(Finding).execute();
  await dataSource.createQueryBuilder().delete().from(Scan).execute();
  await dataSource.createQueryBuilder().delete().from(Project).execute();

  const projectNames = ['code-sentinel', 'backend-api', 'frontend-app', 'payments-service'];
  const projects: Record<string, Project> = {};
  for (const name of projectNames) {
    projects[name] = await projectRepo.save(projectRepo.create({ name }));
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

    // Findings de ejemplo solo para el primer scan completado, para tener datos que ver en Findings
    if (scan.scanNumber === 1042) {
      await findingRepo.save([
        findingRepo.create({
          scanId: scan.id,
          type: 'Hardcoded Secret',
          severity: 'critical',
          filePath: 'src/config.js',
          line: 12,
          sourceTool: 'Secret Scanner',
          description: 'API key expuesta en texto plano.',
          recommendation: 'Mover a variables de entorno.',
        }),
        findingRepo.create({
          scanId: scan.id,
          type: 'SQL Injection',
          severity: 'high',
          filePath: 'src/users.js',
          line: 45,
          sourceTool: 'SAST',
          description: 'Concatenación directa de input en query SQL.',
          recommendation: 'Usar consultas parametrizadas.',
        }),
        findingRepo.create({
          scanId: scan.id,
          type: 'Open Port',
          severity: 'medium',
          filePath: null,
          line: null,
          sourceTool: 'Port Scanner',
          description: 'Puerto 8080 abierto sin autenticación.',
          recommendation: 'Restringir acceso por firewall.',
        }),
      ]);
    }
  }

  console.log('Seed completado.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
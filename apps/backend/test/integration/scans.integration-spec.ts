import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { Finding } from '../../src/findings/finding.entity';
import { Project } from '../../src/projects/project.entity';
import { ProjectsService } from '../../src/projects/projects.service';
import { Scan } from '../../src/scans/scan.entity';
import { ScansController } from '../../src/scans/scans.controller';
import { ScansService } from '../../src/scans/scans.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

const SCAN_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const UNASSIGNED_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_SCAN_ID = '44444444-4444-4444-8444-444444444444';

describe('Scans integration (controller + service)', (): void => {
  let app: INestApplication<App>;

  const mockScans: Partial<Scan>[] = [
    {
      id: SCAN_ID,
      scanNumber: 1042,
      projectId: PROJECT_ID,
      status: 'completed',
      errorMessage: null,
      tools: ['SAST', 'Secret Scanner'],
      criticalCount: 1,
      highCount: 3,
      mediumCount: 5,
      lowCount: 2,
      totalCount: 11,
    },
  ];

  const mockRepository = {
    find: jest.fn().mockResolvedValue(mockScans),
    findOne: jest.fn().mockResolvedValue(mockScans[0]),
    create: jest.fn((data: Partial<Scan>): Partial<Scan> => ({ ...data })),
    save: jest.fn((data: Partial<Scan>): Promise<Partial<Scan>> =>
      Promise.resolve({ id: 'scan-created', ...data }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: {
      transaction: jest.fn(
        (work: (manager: TransactionManager) => Promise<unknown>) =>
          work(transactionManager),
      ),
    },
  };

  const mockFindingRepository = {
    create: jest.fn((data: Partial<Finding>): Partial<Finding> => ({
      ...data,
    })),
    save: jest.fn((data: Partial<Finding>[]): Promise<Partial<Finding>[]> =>
      Promise.resolve(data),
    ),
  };

  interface TransactionManager {
    getRepository: (entity: unknown) => unknown;
  }
  const transactionManager: TransactionManager = {
    getRepository: (entity: unknown): unknown =>
      entity === Finding ? mockFindingRepository : mockRepository,
  };

  const mockProjectsService = {
    getAccessibleProjectIds: jest.fn().mockResolvedValue([PROJECT_ID]),
  };

  const mockProjectRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: PROJECT_ID,
      name: 'code-sentinel',
      status: 'pending',
      lastScan: null,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    }),
    save: jest.fn((project: Partial<Project>): Promise<Partial<Project>> =>
      Promise.resolve(project),
    ),
  };

  beforeAll(async (): Promise<void> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ScansController],
      providers: [
        ScansService,
        { provide: getRepositoryToken(Scan), useValue: mockRepository },
        {
          provide: getRepositoryToken(Finding),
          useValue: mockFindingRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  afterEach((): void => {
    mockRepository.find.mockResolvedValue(mockScans);
    mockRepository.findOne.mockResolvedValue(mockScans[0]);
  });

  it('GET /scans returns 200 with the scan list', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/scans');
    const body = response.body as Scan[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].scanNumber).toBe(1042);
  });

  it('GET /scans?status=completed forwards the filter to the query', async (): Promise<void> => {
    await request(app.getHttpServer())
      .get('/scans')
      .query({ status: 'completed' });

    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }) as unknown,
      }),
    );
  });

  it('GET /scans?status=running accepts the running status (RF-006)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/scans')
      .query({ status: 'running' });

    expect(response.status).toBe(200);
  });

  it('GET /scans?status=done returns 400 for an unknown status (RF-006)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/scans')
      .query({ status: 'done' });

    expect(response.status).toBe(400);
  });

  it('GET /scans/:id returns 200 with the requested scan', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get(
      `/scans/${SCAN_ID}`,
    );
    const body = response.body as Scan;

    expect(response.status).toBe(200);
    expect(body.id).toBe(SCAN_ID);
  });

  it('GET /scans/:id returns 404 when the scan does not exist', async (): Promise<void> => {
    mockRepository.findOne.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get(
      `/scans/${MISSING_SCAN_ID}`,
    );

    expect(response.status).toBe(404);
  });

  it('GET /scans/:id returns 400 for a malformed id', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get(
      '/scans/not-a-uuid',
    );
    expect(response.status).toBe(400);
  });

  it('GET /scans returns 400 for a malformed date filter', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/scans')
      .query({ dateFrom: 'yesterday' });
    expect(response.status).toBe(400);
  });

  describe('Ingestion contract (POST /scans, PATCH /scans/:id/status, POST /scans/:id/results)', (): void => {
    it('POST /scans creates a pending scan and returns 201 (RF-005)', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .send({ projectId: PROJECT_ID, tools: ['SAST', 'Secret Scanner'] });
      const body = response.body as Scan;

      expect(response.status).toBe(201);
      expect(body.status).toBe('pending');
      expect(body.scanNumber).toBe(1043);
    });

    it('POST /scans returns 403 when the project is not assigned to the analyst (RF-035)', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .send({ projectId: UNASSIGNED_PROJECT_ID, tools: ['SAST'] });

      expect(response.status).toBe(403);
    });

    it('PATCH /scans/:id/status moves a scan from pending to running and returns 200 (RF-006)', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: SCAN_ID,
        projectId: PROJECT_ID,
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .patch(`/scans/${SCAN_ID}/status`)
        .send({ status: 'running' });
      const body = response.body as Scan;

      expect(response.status).toBe(200);
      expect(body.status).toBe('running');
    });

    it('PATCH /scans/:id/status returns 409 for an invalid transition (RF-006)', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: SCAN_ID,
        projectId: PROJECT_ID,
        status: 'completed',
      });

      const response = await request(app.getHttpServer())
        .patch(`/scans/${SCAN_ID}/status`)
        .send({ status: 'running' });

      expect(response.status).toBe(409);
    });

    it('POST /scans/:id/results closes the scan with computed counters and stored findings (RF-010, RF-019)', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: SCAN_ID,
        projectId: PROJECT_ID,
        status: 'running',
      });

      const response = await request(app.getHttpServer())
        .post(`/scans/${SCAN_ID}/results`)
        .send({
          status: 'completed',
          errorMessage: null,
          findings: [
            {
              type: 'github-pat',
              severity: 'high',
              toolCategory: 'Secret Scanner',
              sourceTool: 'Gitleaks',
              filePath: 'src/config.ts',
              line: 12,
              description: 'GitHub Personal Access Token detected.',
              recommendation:
                'Revoke the token and load it from an environment variable.',
            },
          ],
        });
      const body = response.body as Scan;

      expect(response.status).toBe(200);
      expect(body.status).toBe('completed');
      expect(body.highCount).toBe(1);
      expect(body.totalCount).toBe(1);
    });

    it('POST /scans/:id/results returns 409 when another submission closed the scan first', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: SCAN_ID,
        projectId: PROJECT_ID,
        status: 'running',
      });
      mockRepository.update.mockResolvedValueOnce({ affected: 0 });

      const response = await request(app.getHttpServer())
        .post(`/scans/${SCAN_ID}/results`)
        .send({ status: 'completed', findings: [] });

      expect(response.status).toBe(409);
    });

    it('POST /scans/:id/results returns 409 when the scan is already closed', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: SCAN_ID,
        projectId: PROJECT_ID,
        status: 'failed',
      });

      const response = await request(app.getHttpServer())
        .post(`/scans/${SCAN_ID}/results`)
        .send({
          status: 'completed',
          errorMessage: null,
          findings: [],
        });

      expect(response.status).toBe(409);
    });

    it('POST /scans/:id/results syncs project counters and rejects plaintext secrets with 400 (RF-028, RF-029)', async (): Promise<void> => {
      const forbiddenResponse = await request(app.getHttpServer())
        .post(`/scans/${SCAN_ID}/results`)
        .send({
          status: 'completed',
          findings: [
            {
              type: 'github-pat',
              severity: 'critical',
              toolCategory: 'Secret Scanner',
              sourceTool: 'Gitleaks',
              Secret: 'ghp_raw_secret',
            },
          ],
        });

      expect(forbiddenResponse.status).toBe(400);
      expect(mockProjectRepository.save).toHaveBeenCalled();
    });
  });

  describe('RF-027: findings scoped to the selected scan', (): void => {
    it('GET /scans/:id returns only the findings of that scan', async (): Promise<void> => {
      const scanWithScopedFindings = {
        ...mockScans[0],
        findings: [
          {
            id: 'f1',
            scanId: SCAN_ID,
            type: 'Hardcoded Secret',
            severity: 'critical',
          },
        ],
      };
      mockRepository.findOne.mockResolvedValueOnce(scanWithScopedFindings);

      const response = await request(app.getHttpServer()).get(
        `/scans/${SCAN_ID}`,
      );
      const body = response.body as { findings: { scanId: string }[] };

      expect(body.findings).toHaveLength(1);
      expect(
        body.findings.every((f: { scanId: string }) => f.scanId === SCAN_ID),
      ).toBe(true);
    });

    it('GET /scans/:id returns findings: [] when the scan has no findings', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockScans[0],
        findings: [],
      });

      const response = await request(app.getHttpServer()).get(
        `/scans/${SCAN_ID}`,
      );
      const body = response.body as { findings: unknown[] };

      expect(body.findings).toEqual([]);
    });
  });

  describe('RF-032: administrators cannot access scans', (): void => {
    it('GET /scans as admin returns 403 without querying the database', async (): Promise<void> => {
      mockRepository.find.mockClear();

      const response = await request(app.getHttpServer())
        .get('/scans')
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('GET /scans/:id as admin returns 403', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get(`/scans/${SCAN_ID}`)
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
    });

    it('POST /scans as admin returns 403 (RF-032)', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .set(TEST_ROLE_HEADER, 'admin')
        .send({ projectId: PROJECT_ID, tools: ['SAST'] });

      expect(response.status).toBe(403);
    });
  });
});

// apps/backend/test/integration/scans.integration-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { Finding } from '../../src/findings/finding.entity';
import { ProjectsService } from '../../src/projects/projects.service';
import { Scan } from '../../src/scans/scan.entity';
import { ScansController } from '../../src/scans/scans.controller';
import { ScansService } from '../../src/scans/scans.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

describe('Scans — integración (Controller + Service)', (): void => {
  let app: INestApplication<App>;

  const mockScans: Partial<Scan>[] = [
    {
      id: '1',
      scanNumber: 1042,
      projectId: 'p1',
      status: 'completed',
      errorMessage: null,
      tools: ['SAST', 'Secret Scanner', 'Port Scanner'],
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
  };

  const mockFindingRepository = {
    create: jest.fn((data: Partial<Finding>): Partial<Finding> => ({
      ...data,
    })),
    save: jest.fn((data: Partial<Finding>[]): Promise<Partial<Finding>[]> =>
      Promise.resolve(data),
    ),
  };

  const mockProjectsService = {
    getAccessibleProjectIds: jest.fn().mockResolvedValue(['p1']),
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

  it('GET /scans debe retornar 200 con la lista de scans', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/scans');
    const body = response.body as Scan[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].scanNumber).toBe(1042);
  });

  it('GET /scans?status=completed debe pasar el filtro al service', async (): Promise<void> => {
    await request(app.getHttpServer())
      .get('/scans')
      .query({ status: 'completed' });

    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }) as unknown,
      }),
    );
  });

  it('GET /scans?status=running debe aceptar el nuevo estado (RF-006)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/scans')
      .query({ status: 'running' });

    expect(response.status).toBe(200);
  });

  it('GET /scans?status=done debe retornar 400 por estado desconocido (RF-006)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/scans')
      .query({ status: 'done' });

    expect(response.status).toBe(400);
  });

  it('GET /scans/:id debe retornar 200 con el scan solicitado', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/scans/1');
    const body = response.body as Scan;

    expect(response.status).toBe(200);
    expect(body.id).toBe('1');
  });

  it('GET /scans/:id debe retornar 404 cuando el scan no existe', async (): Promise<void> => {
    mockRepository.findOne.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get('/scans/no-existe');

    expect(response.status).toBe(404);
  });

  describe('Endpoints del contrato de ingesta (POST /scans, PATCH /scans/:id/status, POST /scans/:id/results)', (): void => {
    it('POST /scans debe crear un scan en pending y retornar 201 (RF-005)', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .send({ projectId: 'p1', tools: ['SAST', 'Secret Scanner'] });
      const body = response.body as Scan;

      expect(response.status).toBe(201);
      expect(body.status).toBe('pending');
      expect(body.scanNumber).toBe(1043);
    });

    it('POST /scans debe retornar 403 si el proyecto no está asignado al analista (RF-035)', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .send({ projectId: 'p-unassigned', tools: ['SAST'] });

      expect(response.status).toBe(403);
    });

    it('PATCH /scans/:id/status debe mover un scan de pending a running y retornar 200 (RF-006)', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'scan-pending',
        projectId: 'p1',
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .patch('/scans/scan-pending/status')
        .send({ status: 'running' });
      const body = response.body as Scan;

      expect(response.status).toBe(200);
      expect(body.status).toBe('running');
    });

    it('PATCH /scans/:id/status debe retornar 409 en una transición inválida (RF-006)', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'scan-closed',
        projectId: 'p1',
        status: 'completed',
      });

      const response = await request(app.getHttpServer())
        .patch('/scans/scan-closed/status')
        .send({ status: 'running' });

      expect(response.status).toBe(409);
    });

    it('POST /scans/:id/results debe cerrar el scan en 200 con conteos calculados y findings registrados (RF-010, RF-019)', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'scan-running',
        projectId: 'p1',
        status: 'running',
      });

      const response = await request(app.getHttpServer())
        .post('/scans/scan-running/results')
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

    it('POST /scans/:id/results debe retornar 409 si el scan ya estaba cerrado', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'scan-closed',
        projectId: 'p1',
        status: 'failed',
      });

      const response = await request(app.getHttpServer())
        .post('/scans/scan-closed/results')
        .send({
          status: 'completed',
          errorMessage: null,
          findings: [],
        });

      expect(response.status).toBe(409);
    });
  });

  describe('RF-027 — findings correspondientes solo al scan seleccionado', (): void => {
    it('GET /scans/:id debe retornar únicamente los findings de ese scan, no de otros', async (): Promise<void> => {
      const scanWithScopedFindings = {
        ...mockScans[0],
        findings: [
          {
            id: 'f1',
            scanId: '1',
            type: 'Hardcoded Secret',
            severity: 'critical',
          },
        ],
      };
      mockRepository.findOne.mockResolvedValueOnce(scanWithScopedFindings);

      const response = await request(app.getHttpServer()).get('/scans/1');
      const body = response.body as { findings: { scanId: string }[] };

      expect(body.findings).toHaveLength(1);
      expect(
        body.findings.every((f: { scanId: string }) => f.scanId === '1'),
      ).toBe(true);
    });

    it('GET /scans/:id debe retornar findings: [] cuando el scan no tiene hallazgos', async (): Promise<void> => {
      mockRepository.findOne.mockResolvedValueOnce({
        ...mockScans[0],
        findings: [],
      });

      const response = await request(app.getHttpServer()).get('/scans/1');
      const body = response.body as { findings: unknown[] };

      expect(body.findings).toEqual([]);
    });
  });

  describe('RF-032 — el administrador no accede a los scans', (): void => {
    it('GET /scans como admin debe retornar 403 sin consultar la base de datos', async (): Promise<void> => {
      mockRepository.find.mockClear();

      const response = await request(app.getHttpServer())
        .get('/scans')
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('GET /scans/:id como admin debe retornar 403', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/scans/1')
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
    });

    it('POST /scans como admin debe retornar 403 (RF-032)', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .set(TEST_ROLE_HEADER, 'admin')
        .send({ projectId: 'p1', tools: ['SAST'] });

      expect(response.status).toBe(403);
    });
  });
});

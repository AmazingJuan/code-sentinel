import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { Finding } from '../../src/findings/finding.entity';
import { FindingsController } from '../../src/findings/findings.controller';
import { FindingsService } from '../../src/findings/findings.service';
import { ProjectsService } from '../../src/projects/projects.service';
import { ScansService } from '../../src/scans/scans.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

const FINDING_ID = '55555555-5555-4555-8555-555555555555';
const MISSING_FINDING_ID = '66666666-6666-4666-8666-666666666666';

describe('Findings integration (controller + service)', (): void => {
  let app: INestApplication<App>;

  const mockFindings: Partial<Finding>[] = [
    {
      id: FINDING_ID,
      scanId: 's1',
      type: 'Hardcoded Secret',
      severity: 'critical',
      sourceTool: 'Secret Scanner',
      filePath: 'src/config.js',
      line: 12,
    },
  ];

  const mockRepository = {
    find: jest.fn().mockResolvedValue(mockFindings),
    findOne: jest.fn().mockResolvedValue(mockFindings[0]),
  };

  const mockProjectsService = {
    getAccessibleProjectIds: jest.fn().mockResolvedValue(['p1']),
  };

  const mockScansService = {
    findScanIdsForProjects: jest.fn().mockResolvedValue(['s1']),
    findProjectIdForScan: jest.fn().mockResolvedValue('p1'),
  };

  beforeAll(async (): Promise<void> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [FindingsController],
      providers: [
        FindingsService,
        { provide: getRepositoryToken(Finding), useValue: mockRepository },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: ScansService, useValue: mockScansService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(fakeJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('GET /findings returns 200 with the finding list', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/findings');
    const body = response.body as Finding[];

    expect(response.status).toBe(200);
    expect(body[0].type).toBe('Hardcoded Secret');
  });

  it('GET /findings?severity=critical forwards the filter to the query', async (): Promise<void> => {
    await request(app.getHttpServer())
      .get('/findings')
      .query({ severity: 'critical' });

    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: 'critical' }) as unknown,
      }),
    );
  });

  it('GET /findings/:id returns 404 when the finding does not exist', async (): Promise<void> => {
    mockRepository.findOne.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get(
      `/findings/${MISSING_FINDING_ID}`,
    );

    expect(response.status).toBe(404);
  });

  it('GET /findings/:id returns 200 for an assigned project and 403 otherwise', async (): Promise<void> => {
    const okResponse = await request(app.getHttpServer()).get(
      `/findings/${FINDING_ID}`,
    );
    expect(okResponse.status).toBe(200);

    mockScansService.findProjectIdForScan.mockResolvedValueOnce('p-unassigned');
    const forbiddenResponse = await request(app.getHttpServer()).get(
      `/findings/${FINDING_ID}`,
    );
    expect(forbiddenResponse.status).toBe(403);
  });

  it('GET /findings supports toolCategory and sourceTool filters (RF-019, RF-026)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/findings')
      .query({ toolCategory: 'Secret Scanner', sourceTool: 'Gitleaks' });

    expect(response.status).toBe(200);
    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          toolCategory: 'Secret Scanner',
          sourceTool: 'Gitleaks',
        }) as unknown,
      }),
    );
  });

  it('GET /findings/:id returns 400 for a malformed id', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get(
      '/findings/not-a-uuid',
    );
    expect(response.status).toBe(400);
  });

  it('GET /findings returns 400 for invalid filter values', async (): Promise<void> => {
    const badSeverity = await request(app.getHttpServer())
      .get('/findings')
      .query({ severity: 'urgent' });
    expect(badSeverity.status).toBe(400);

    const badScanId = await request(app.getHttpServer())
      .get('/findings')
      .query({ scanId: 'not-a-uuid' });
    expect(badScanId.status).toBe(400);
  });

  it('GET /findings treats empty filter values as absent', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/findings')
      .query({ type: '', severity: '' });
    expect(response.status).toBe(200);
  });

  describe('RF-032: administrators cannot access findings', (): void => {
    it('GET /findings as admin returns 403 without querying the database', async (): Promise<void> => {
      mockRepository.find.mockClear();

      const response = await request(app.getHttpServer())
        .get('/findings')
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('GET /findings/:id as admin returns 403', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get(`/findings/${FINDING_ID}`)
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
    });
  });
});

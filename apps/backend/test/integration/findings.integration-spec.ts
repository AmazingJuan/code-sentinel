// apps/backend/test/integration/findings.integration-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { Finding } from '../../src/findings/finding.entity';
import { FindingsController } from '../../src/findings/findings.controller';
import { FindingsService } from '../../src/findings/findings.service';
import { ProjectsService } from '../../src/projects/projects.service';
import { ScansService } from '../../src/scans/scans.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

describe('Findings — integración (Controller + Service)', (): void => {
  let app: INestApplication;

  const mockFindings: Partial<Finding>[] = [
    {
      id: 'f1',
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
    await app.init();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('GET /findings debe retornar 200 con la lista de findings', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/findings');

    expect(response.status).toBe(200);
    expect(response.body[0].type).toBe('Hardcoded Secret');
  });

  it('GET /findings?severity=critical debe pasar el filtro al service', async (): Promise<void> => {
    await request(app.getHttpServer())
      .get('/findings')
      .query({ severity: 'critical' });

    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: 'critical' }),
      }),
    );
  });

  it('GET /findings/:id debe retornar 404 cuando el finding no existe', async (): Promise<void> => {
    mockRepository.findOne.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get(
      '/findings/no-existe',
    );

    expect(response.status).toBe(404);
  });

  describe('RF-032 — el administrador no accede a los findings', (): void => {
    it('GET /findings como admin debe retornar 403 sin consultar la base de datos', async (): Promise<void> => {
      mockRepository.find.mockClear();

      const response = await request(app.getHttpServer())
        .get('/findings')
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('GET /findings/:id como admin debe retornar 403', async (): Promise<void> => {
      const response = await request(app.getHttpServer())
        .get('/findings/f1')
        .set(TEST_ROLE_HEADER, 'admin');

      expect(response.status).toBe(403);
    });
  });
});

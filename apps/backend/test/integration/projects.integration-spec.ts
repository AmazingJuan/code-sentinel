// apps/backend/test/integration/projects.integration-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { ProjectsController } from '../../src/projects/projects.controller';
import { ProjectsService } from '../../src/projects/projects.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

describe('Projects — integración RF-032 / RF-035 (Controller + guards)', (): void => {
  let app: INestApplication<App>;

  const mockProjectsService = {
    findDirectory: jest
      .fn()
      .mockResolvedValue([{ id: 'p1', name: 'code-sentinel' }]),
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 'p1' }),
    findAssignments: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async (): Promise<void> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: mockProjectsService }],
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

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('GET /projects como admin debe retornar 403 (RF-032)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(403);
    expect(mockProjectsService.findAll).not.toHaveBeenCalled();
  });

  it('GET /projects/:id como admin debe retornar 403 (RF-032)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/projects/p1')
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(403);
    expect(mockProjectsService.findById).not.toHaveBeenCalled();
  });

  it('GET /projects/directory como admin debe retornar solo id y nombre (RF-035)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/projects/directory')
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'p1', name: 'code-sentinel' }]);
    expect(mockProjectsService.findById).not.toHaveBeenCalled();
  });

  it('GET /projects/directory como analyst debe retornar 403', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get(
      '/projects/directory',
    );

    expect(response.status).toBe(403);
  });

  it('GET /projects/:id/assignments como admin debe seguir permitido (RF-035)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/projects/p1/assignments')
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(200);
  });

  it('GET /projects como analyst debe retornar 200', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/projects');

    expect(response.status).toBe(200);
    expect(mockProjectsService.findAll).toHaveBeenCalled();
  });
});

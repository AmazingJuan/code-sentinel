import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { ProjectsController } from '../../src/projects/projects.controller';
import { ProjectsService } from '../../src/projects/projects.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

describe('Projects integration, RF-032 / RF-035 (controller + guards)', (): void => {
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

  it('GET /projects as admin returns 403 (RF-032)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/projects')
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(403);
    expect(mockProjectsService.findAll).not.toHaveBeenCalled();
  });

  it('GET /projects/:id as admin returns 403 (RF-032)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get(`/projects/${PROJECT_ID}`)
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(403);
    expect(mockProjectsService.findById).not.toHaveBeenCalled();
  });

  it('GET /projects/directory as admin returns only id and name (RF-035)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/projects/directory')
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'p1', name: 'code-sentinel' }]);
    expect(mockProjectsService.findById).not.toHaveBeenCalled();
  });

  it('GET /projects/directory as analyst returns 403', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get(
      '/projects/directory',
    );

    expect(response.status).toBe(403);
  });

  it('GET /projects/:id/assignments is still allowed for admins (RF-035)', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get(`/projects/${PROJECT_ID}/assignments`)
      .set(TEST_ROLE_HEADER, 'admin');

    expect(response.status).toBe(200);
  });

  it('GET /projects as analyst returns 200', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/projects');

    expect(response.status).toBe(200);
    expect(mockProjectsService.findAll).toHaveBeenCalled();
  });
});

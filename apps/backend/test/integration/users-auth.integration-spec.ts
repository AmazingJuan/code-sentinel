// apps/backend/test/integration/users-auth.integration-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';

import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { fakeJwtAuthGuard, TEST_ROLE_HEADER } from './fake-jwt-auth.guard';

describe('Users — integración (Controller + Service + Guards + ValidationPipe)', (): void => {
  let app: INestApplication<App>;

  const sampleUser: User = {
    id: 'u1',
    email: 'analyst@code-sentinel.local',
    name: 'Analyst User',
    passwordHash: '$2b$12$hashed',
    role: UserRole.ANALYST,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const mockUserRepository = {
    find: jest.fn().mockResolvedValue([sampleUser]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data: Partial<User>): Partial<User> => ({ ...data })),
    save: jest.fn((data: Partial<User>): Promise<User> =>
      Promise.resolve({ ...sampleUser, ...data }),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeAll(async (): Promise<void> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
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
    jest.clearAllMocks();
  });

  it('GET /users como analyst debe retornar 403', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/users');
    expect(response.status).toBe(403);
  });

  it('GET /users como admin debe retornar 200 sin passwordHash', async (): Promise<void> => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set(TEST_ROLE_HEADER, 'admin');
    const body = response.body as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty('passwordHash');
  });

  it('POST /users como admin debe validar contraseña mínima y crear usuario', async (): Promise<void> => {
    const badResponse = await request(app.getHttpServer())
      .post('/users')
      .set(TEST_ROLE_HEADER, 'admin')
      .send({
        email: 'short@code-sentinel.local',
        name: 'Short Pw User',
        password: 'short',
      });
    expect(badResponse.status).toBe(400);

    const goodResponse = await request(app.getHttpServer())
      .post('/users')
      .set(TEST_ROLE_HEADER, 'admin')
      .send({
        email: 'new@code-sentinel.local',
        name: 'New User',
        password: 'StrongPassword1!',
        role: UserRole.ANALYST,
      });
    expect(goodResponse.status).toBe(201);
    expect(goodResponse.body).not.toHaveProperty('passwordHash');
  });

  it('PATCH /users/:id y DELETE /users/:id como admin deben actualizar y eliminar', async (): Promise<void> => {
    mockUserRepository.findOne.mockResolvedValueOnce({ ...sampleUser });
    const patchResp = await request(app.getHttpServer())
      .patch('/users/u1')
      .set(TEST_ROLE_HEADER, 'admin')
      .send({ name: 'Updated Name' });
    expect(patchResp.status).toBe(200);

    const deleteResp = await request(app.getHttpServer())
      .delete('/users/u1')
      .set(TEST_ROLE_HEADER, 'admin');
    expect(deleteResp.status).toBe(200);
  });
});

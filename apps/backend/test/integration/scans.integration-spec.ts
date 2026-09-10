// apps/backend/test/integration/scans.integration-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { Scan } from '../../src/scans/scan.entity';
import { ScansController } from '../../src/scans/scans.controller';
import { ScansService } from '../../src/scans/scans.service';

describe('Scans — integración (Controller + Service)', (): void => {
  let app: INestApplication;

  const mockScans: Partial<Scan>[] = [
    {
      id: '1',
      scanNumber: 1042,
      projectId: 'p1',
      status: 'completed',
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
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ScansController],
      providers: [ScansService, { provide: getRepositoryToken(Scan), useValue: mockRepository }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async (): Promise<void> => {
    await app.close();
  });

  it('GET /scans debe retornar 200 con la lista de scans', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/scans');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].scanNumber).toBe(1042);
  });

  it('GET /scans?status=completed debe pasar el filtro al service', async (): Promise<void> => {
    await request(app.getHttpServer()).get('/scans').query({ status: 'completed' });

    expect(mockRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('GET /scans/:id debe retornar 200 con el scan solicitado', async (): Promise<void> => {
    const response = await request(app.getHttpServer()).get('/scans/1');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('1');
  });

  it('GET /scans/:id debe retornar 404 cuando el scan no existe', async (): Promise<void> => {
    mockRepository.findOne.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer()).get('/scans/no-existe');

    expect(response.status).toBe(404);
  });
});
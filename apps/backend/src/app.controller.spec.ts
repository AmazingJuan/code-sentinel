import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root and health endpoints', () => {
    it('should return health status with status ok', () => {
      const response = appController.getRoot();
      expect(response.status).toBe('ok');
      expect(response.service).toBe('code-sentinel-api');
      expect(response.version).toBe('1.0.0');
      expect(typeof response.uptime).toBe('number');
      expect(typeof response.timestamp).toBe('string');
    });

    it('should return the same health status on /health', () => {
      const response = appController.getHealth();
      expect(response.status).toBe('ok');
    });
  });
});

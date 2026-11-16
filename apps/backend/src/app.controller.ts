// apps/backend/src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from './app.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): HealthCheckResponse {
    return this.appService.getHealth();
  }

  @Get('health')
  getHealth(): HealthCheckResponse {
    return this.appService.getHealth();
  }
}

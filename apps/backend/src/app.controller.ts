import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthCheckResponse } from './app.service';

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

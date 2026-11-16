// apps/backend/src/app.service.ts
import { Injectable } from '@nestjs/common';

export interface HealthCheckResponse {
  status: 'ok';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'code-sentinel-api',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}

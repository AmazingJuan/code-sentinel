import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';
import { isProductionEnv } from './common/runtime-env';

const DEFAULT_PORT = 3000;
// Scan result submissions can carry thousands of normalized findings.
const REQUEST_BODY_LIMIT = '50mb';

/**
 * CORS_ORIGINS is a comma-separated allow-list. When unset every origin is
 * reflected, which is only acceptable for local development.
 */
function buildCorsOptions(rawOrigins: string | undefined): CorsOptions {
  const origins = (rawOrigins ?? '')
    .split(',')
    .map((origin: string): string => origin.trim())
    .filter((origin: string): boolean => origin.length > 0);

  return {
    origin: origins.length > 0 ? origins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  };
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: REQUEST_BODY_LIMIT });
  app.useBodyParser('urlencoded', {
    limit: REQUEST_BODY_LIMIT,
    extended: true,
  });
  app.enableShutdownHooks();

  const corsOrigins = config.get<string>('CORS_ORIGINS');
  if (!corsOrigins && isProductionEnv(config.get<string>('NODE_ENV'))) {
    logger.warn('CORS_ORIGINS is not set; every origin is allowed.');
  }
  app.enableCors(buildCorsOptions(corsOrigins));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('PORT')) || DEFAULT_PORT;
  await app.listen(port);
}

void bootstrap();

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { isProductionEnv, parseBooleanEnv } from './common/runtime-env';
import { buildPostgresConnectionOptions } from './database/postgres-connection';
import { FindingsModule } from './findings/findings.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { ScansModule } from './scans/scans.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const readEnv = (key: string): string | undefined =>
          config.get<string>(key);
        return {
          ...buildPostgresConnectionOptions(readEnv),
          autoLoadEntities: true,
          // Schema auto-sync is a development convenience only. It is off by
          // default in production; set DB_SYNCHRONIZE explicitly to override
          // until a migration strategy exists.
          synchronize: parseBooleanEnv(
            readEnv('DB_SYNCHRONIZE'),
            !isProductionEnv(readEnv('NODE_ENV')),
          ),
        };
      },
    }),
    ProjectsModule,
    ScansModule,
    FindingsModule,
    UsersModule,
    AuthModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

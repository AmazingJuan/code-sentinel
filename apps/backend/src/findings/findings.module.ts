// apps/backend/src/findings/findings.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Finding } from './finding.entity';
import { FindingsService } from './findings.service';
import { FindingsController } from './findings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Finding])],
  controllers: [FindingsController],
  providers: [FindingsService],
})
export class FindingsModule {}
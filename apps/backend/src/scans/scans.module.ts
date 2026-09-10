// apps/backend/src/scans/scans.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scan } from './scan.entity';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [TypeOrmModule.forFeature([Scan]), ProjectsModule],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [TypeOrmModule, ScansService],
})
export class ScansModule {}

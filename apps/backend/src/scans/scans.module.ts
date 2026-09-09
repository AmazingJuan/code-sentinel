// apps/backend/src/scans/scans.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scan } from './scan.entity';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Scan])],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [TypeOrmModule],
})
export class ScansModule {}
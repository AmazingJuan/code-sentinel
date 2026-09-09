// apps/backend/src/findings/finding.entity.ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Scan } from '../scans/scan.entity';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

@Entity('findings')
export class Finding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Scan, (scan) => scan.findings, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scanId' })
  scan: Scan;

  @Column()
  scanId: string;

  @Column()
  type: string; // ej. 'SQL Injection', 'Hardcoded Secret', 'Open Port'

  @Column({ type: 'varchar' })
  severity: FindingSeverity;

  @Column({ type: 'varchar', nullable: true })
  filePath: string | null;

  @Column({ type: 'int', nullable: true })
  line: number | null;

  @Column()
  sourceTool: string; // 'SAST' | 'Secret Scanner' | 'Port Scanner'

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  recommendation: string | null;
}
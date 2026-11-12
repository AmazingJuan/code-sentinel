// apps/backend/src/findings/finding.entity.ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Scan, type ScanTool } from '../scans/scan.entity';

export const FINDING_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export function isFindingSeverity(value: string): value is FindingSeverity {
  return (FINDING_SEVERITIES as readonly string[]).includes(value);
}

@Entity('findings')
export class Finding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Scan, (scan) => scan.findings, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'scanId' })
  scan: Scan;

  @Column()
  scanId: string;

  @Column()
  type: string; // e.g. 'github-pat', 'SQL Injection', 'Open Port'

  @Column({ type: 'varchar', nullable: true })
  severity: FindingSeverity | null;

  @Column({ type: 'varchar', default: 'SAST' })
  toolCategory: ScanTool;

  @Column({ type: 'varchar', nullable: true })
  filePath: string | null;

  @Column({ type: 'int', nullable: true })
  line: number | null;

  @Column()
  sourceTool: string; // Real tool name: 'Semgrep', 'Gitleaks', 'CodeSentinel' (RF-018)

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  recommendation: string | null;
}

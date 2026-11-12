// apps/backend/src/scans/scan.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { Finding } from '../findings/finding.entity';

/**
 * RF-006: lifecycle of a scan. The CLI creates it as `pending`, moves it to
 * `running` once the project path is validated, and closes it as `completed`
 * or `failed`.
 */
export const SCAN_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export function isScanStatus(value: string): value is ScanStatus {
  return (SCAN_STATUSES as readonly string[]).includes(value);
}

export const RESULT_SCAN_STATUSES = ['completed', 'failed'] as const;
export type ResultScanStatus = (typeof RESULT_SCAN_STATUSES)[number];

export function isResultScanStatus(value: string): value is ResultScanStatus {
  return (RESULT_SCAN_STATUSES as readonly string[]).includes(value);
}

/**
 * RF-006: allowed lifecycle transitions. Any other transition (such as
 * reopening a closed scan or jumping from pending to completed) is rejected
 * with 409 Conflict.
 */
export const ALLOWED_SCAN_TRANSITIONS: Record<
  ScanStatus,
  readonly ScanStatus[]
> = {
  pending: ['running', 'failed'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export function canTransitionScanStatus(
  from: ScanStatus,
  to: ScanStatus,
): boolean {
  return ALLOWED_SCAN_TRANSITIONS[from].includes(to);
}

export type ScanTool = 'SAST' | 'Secret Scanner' | 'Port Scanner';
export const SCAN_TOOLS: ScanTool[] = [
  'SAST',
  'Secret Scanner',
  'Port Scanner',
];

export function isScanTool(value: string): value is ScanTool {
  return (SCAN_TOOLS as readonly string[]).includes(value);
}

export interface ProjectScanCounters {
  status: 'pending' | 'completed' | 'failed';
  lastScan: Date | null;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * RF-028 / RF-029: calculates a project's status, lastScan timestamp, and
 * severity counters from its historical scans. In-progress (`pending` or
 * `running`) scans do not overwrite the last finished scan's counters.
 */
export function computeProjectCountersFromScans(
  scans: Pick<
    Scan,
    | 'scanNumber'
    | 'date'
    | 'status'
    | 'criticalCount'
    | 'highCount'
    | 'mediumCount'
    | 'lowCount'
  >[],
): ProjectScanCounters {
  const sorted = [...scans].sort((a, b) => b.scanNumber - a.scanNumber);
  const latestFinished = sorted.find(
    (s) => s.status === 'completed' || s.status === 'failed',
  );
  if (!latestFinished) {
    return {
      status: 'pending',
      lastScan: null,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    };
  }

  const latestCompleted = sorted.find((s) => s.status === 'completed');
  return {
    status: latestFinished.status as 'completed' | 'failed',
    lastScan: latestFinished.date,
    criticalCount: latestCompleted?.criticalCount ?? 0,
    highCount: latestCompleted?.highCount ?? 0,
    mediumCount: latestCompleted?.mediumCount ?? 0,
    lowCount: latestCompleted?.lowCount ?? 0,
  };
}

@Entity('scans')
export class Scan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  scanNumber: number;

  @ManyToOne(() => Project, (project) => project.scans, { eager: true })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  date: Date;

  @Column({ type: 'varchar', default: 'pending' })
  status: ScanStatus;

  @Column({ type: 'text', nullable: true, default: null })
  errorMessage: string | null;

  @Column({ type: 'simple-array' })
  tools: ScanTool[];

  @Column({ type: 'int', default: 0 })
  criticalCount: number;

  @Column({ type: 'int', default: 0 })
  highCount: number;

  @Column({ type: 'int', default: 0 })
  mediumCount: number;

  @Column({ type: 'int', default: 0 })
  lowCount: number;

  @Column({ type: 'int', default: 0 })
  totalCount: number;

  @OneToMany(() => Finding, (finding) => finding.scan)
  findings: Finding[];
}

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

export type ScanStatus = 'completed' | 'failed';
export type ScanTool = 'SAST' | 'Secret Scanner' | 'Port Scanner';

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

  @Column({ type: 'varchar' })
  status: ScanStatus;

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
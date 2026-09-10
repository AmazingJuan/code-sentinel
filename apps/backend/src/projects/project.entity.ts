// apps/backend/src/projects/project.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Scan, ScanTool } from '../scans/scan.entity';
import { User } from '../users/entities/user.entity';

export type ProjectStatus = 'pending' | 'completed' | 'failed';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  repo: string;

  @Column({ type: 'simple-array', default: 'SAST,Secret Scanner,Port Scanner' })
  tools: ScanTool[];

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  owner: User;

  @Column()
  userId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: ProjectStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastScan: Date | null;

  @Column({ type: 'int', default: 0 })
  criticalCount: number;

  @Column({ type: 'int', default: 0 })
  highCount: number;

  @Column({ type: 'int', default: 0 })
  mediumCount: number;

  @Column({ type: 'int', default: 0 })
  lowCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Scan, (scan) => scan.project)
  scans: Scan[];
}

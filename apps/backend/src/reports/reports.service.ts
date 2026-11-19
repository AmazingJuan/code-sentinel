import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword, verifyPassword } from '../common/password';
import { Finding } from '../findings/finding.entity';
import { ProjectsService } from '../projects/projects.service';
import { Scan } from '../scans/scan.entity';
import { RequestingUser } from '../types/requesting-user.type';
import { CreateReportDto } from './dto/create-report.dto';
import { DownloadReportDto } from './dto/download-report.dto';
import { Report } from './entities/report.entity';
import {
  decryptReportPayload,
  EncryptedReportBundle,
  encryptReportPayload,
} from './report-crypto';
import { renderProtectedReportHtml } from './report-html.template';

export interface SecurityReportData {
  title: string;
  generatedAt: string;
  project: {
    id: string;
    name: string;
    repo: string;
  };
  scan: {
    id: string;
    status: string;
    scanNumber: number;
    tools: string[];
    date: Date;
  };
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: Array<{
    id: string;
    type: string;
    severity: string | null;
    toolCategory: string;
    sourceTool: string;
    filePath: string | null;
    line: number | null;
    cwe?: string | null;
    description: string | null;
    recommendation: string | null;
  }>;
}

export interface ReportSummary {
  id: string;
  scanId: string;
  projectId: string;
  format: string;
  createdAt: Date;
}

export interface ReportFile {
  filename: string;
  contentType: string;
  content: string;
}

type ReportFormat = NonNullable<CreateReportDto['format']>;

const DEFAULT_REPORT_FORMAT: ReportFormat = 'html';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    private readonly projectsService: ProjectsService,
  ) {}

  /** RF-033: persists a password-protected report for a scan. */
  async generateProtectedReport(
    scanId: string,
    createDto: CreateReportDto,
    requester: RequestingUser,
  ): Promise<ReportSummary> {
    const scan = await this.findAuthorizedScan(scanId, requester);

    const reportData = this.buildReportData(scan);
    const [passwordHash, encryptedBundle] = await Promise.all([
      hashPassword(createDto.password),
      encryptReportPayload(reportData, createDto.password),
    ]);

    const saved = await this.reportRepository.save(
      this.reportRepository.create({
        scanId: scan.id,
        projectId: scan.projectId,
        passwordHash,
        format: createDto.format || DEFAULT_REPORT_FORMAT,
        encryptedPayload: JSON.stringify(encryptedBundle),
        createdBy: requester.id,
      }),
    );

    return {
      id: saved.id,
      scanId: saved.scanId,
      projectId: saved.projectId,
      format: saved.format,
      createdAt: saved.createdAt,
    };
  }

  /** RF-034: verifies the report password and returns the decrypted report. */
  async downloadReport(
    reportId: string,
    downloadDto: DownloadReportDto,
    requester: RequestingUser,
  ): Promise<ReportFile> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException(`Report ${reportId} not found`);

    await this.assertProjectAccess(report.projectId, requester);

    const isMatch = await verifyPassword(
      downloadDto.password,
      report.passwordHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect report password');
    }

    const encryptedBundle = JSON.parse(
      report.encryptedPayload,
    ) as EncryptedReportBundle;
    const reportData = await this.decrypt(
      encryptedBundle,
      downloadDto.password,
    );
    const baseName = `code-sentinel-report-${report.scanId}`;

    if (report.format === 'json') {
      return this.jsonFile(baseName, reportData);
    }
    return this.htmlFile(baseName, reportData.title, encryptedBundle);
  }

  /** RF-034: one-shot export of a scan report without persisting it. */
  async exportScanReport(
    scanId: string,
    createDto: CreateReportDto,
    requester: RequestingUser,
  ): Promise<ReportFile> {
    const scan = await this.findAuthorizedScan(scanId, requester);
    const reportData = this.buildReportData(scan);
    const baseName = `code-sentinel-report-scan-${scan.id}`;

    if (createDto.format === 'json') {
      return this.jsonFile(baseName, reportData);
    }
    const encryptedBundle = await encryptReportPayload(
      reportData,
      createDto.password,
    );
    return this.htmlFile(baseName, reportData.title, encryptedBundle);
  }

  private async findAuthorizedScan(
    scanId: string,
    requester: RequestingUser,
  ): Promise<Scan> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: { findings: true, project: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${scanId} not found`);

    await this.assertProjectAccess(scan.projectId, requester);
    return scan;
  }

  private async assertProjectAccess(
    projectId: string,
    requester: RequestingUser,
  ): Promise<void> {
    const accessibleProjectIds =
      await this.projectsService.getAccessibleProjectIds(requester);
    if (!accessibleProjectIds.includes(projectId)) {
      throw new ForbiddenException('You are not assigned to this project');
    }
  }

  private async decrypt(
    bundle: EncryptedReportBundle,
    password: string,
  ): Promise<SecurityReportData> {
    try {
      const json = await decryptReportPayload(bundle, password);
      return JSON.parse(json) as SecurityReportData;
    } catch {
      throw new UnauthorizedException(
        'Incorrect report password or corrupted report data',
      );
    }
  }

  private jsonFile(baseName: string, data: SecurityReportData): ReportFile {
    return {
      filename: `${baseName}.json`,
      contentType: 'application/json',
      content: JSON.stringify(data, null, 2),
    };
  }

  private htmlFile(
    baseName: string,
    title: string,
    bundle: EncryptedReportBundle,
  ): ReportFile {
    return {
      filename: `${baseName}.html`,
      contentType: 'text/html',
      content: renderProtectedReportHtml(title, bundle),
    };
  }

  private buildReportData(scan: Scan): SecurityReportData {
    const findings = scan.findings ?? [];
    const countSeverity = (severity: string): number =>
      findings.filter(
        (finding: Finding): boolean => finding.severity === severity,
      ).length;

    return {
      title: `Code Sentinel Security Report - ${scan.project?.name || 'Project'}`,
      generatedAt: new Date().toISOString(),
      project: {
        id: scan.projectId,
        name: scan.project?.name || 'Unknown Project',
        repo: scan.project?.repo || 'N/A',
      },
      scan: {
        id: scan.id,
        status: scan.status,
        scanNumber: scan.scanNumber,
        tools: scan.tools ?? [],
        date: scan.date,
      },
      summary: {
        totalFindings: findings.length,
        critical: countSeverity('critical'),
        high: countSeverity('high'),
        medium: countSeverity('medium'),
        low: countSeverity('low'),
      },
      findings: findings.map((finding: Finding) => ({
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        toolCategory: finding.toolCategory,
        sourceTool: finding.sourceTool,
        filePath: finding.filePath,
        line: finding.line,
        cwe: finding.cwe,
        description: finding.description,
        recommendation: finding.recommendation,
      })),
    };
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'node:crypto';
import { Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { Scan } from '../scans/scan.entity';
import { User } from '../users/entities/user.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { DownloadReportDto } from './dto/download-report.dto';
import { Report } from './entities/report.entity';

type RequestingUser = Omit<User, 'passwordHash'>;

export interface EncryptedReportBundle {
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

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

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Scan)
    private readonly scanRepository: Repository<Scan>,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * RF-033 / RF-034: Generates a password-protected report for a scan.
   * Scoped to the user's assigned projects or administrator.
   */
  async generateProtectedReport(
    scanId: string,
    createDto: CreateReportDto,
    requester: RequestingUser,
  ): Promise<{
    id: string;
    scanId: string;
    projectId: string;
    format: string;
    createdAt: Date;
  }> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: { findings: true, project: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${scanId} not found`);

    await this.assertProjectAccess(scan.projectId, requester);

    const reportData = this.buildReportData(scan);
    const passwordHash = await bcrypt.hash(createDto.password, 12);
    const encryptedBundle = this.encryptPayload(reportData, createDto.password);

    const report = this.reportRepository.create({
      scanId: scan.id,
      projectId: scan.projectId,
      passwordHash,
      format: createDto.format || 'html',
      encryptedPayload: JSON.stringify(encryptedBundle),
      createdBy: requester.id,
    });

    const saved = await this.reportRepository.save(report);

    return {
      id: saved.id,
      scanId: saved.scanId,
      projectId: saved.projectId,
      format: saved.format,
      createdAt: saved.createdAt,
    };
  }

  /**
   * RF-033 / RF-034: Validates report password and downloads the protected report.
   */
  async downloadReport(
    reportId: string,
    downloadDto: DownloadReportDto,
    requester: RequestingUser,
  ): Promise<{ filename: string; contentType: string; content: string }> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
      relations: { scan: { project: true, findings: true } },
    });
    if (!report) throw new NotFoundException(`Report ${reportId} not found`);

    await this.assertProjectAccess(report.projectId, requester);

    const isMatch = await bcrypt.compare(
      downloadDto.password,
      report.passwordHash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect report password');
    }

    const encryptedBundle = JSON.parse(
      report.encryptedPayload,
    ) as EncryptedReportBundle;
    const decryptedJson = this.decryptPayload(
      encryptedBundle,
      downloadDto.password,
    );
    const reportData = JSON.parse(decryptedJson) as SecurityReportData;

    if (report.format === 'json') {
      return {
        filename: `code-sentinel-report-${report.scanId}.json`,
        contentType: 'application/json',
        content: JSON.stringify(reportData, null, 2),
      };
    }

    // Default: Protected HTML Document
    const html = this.buildHtmlDocument(reportData, encryptedBundle);
    return {
      filename: `code-sentinel-report-${report.scanId}.html`,
      contentType: 'text/html',
      content: html,
    };
  }

  /**
   * RF-034: Direct one-shot protected export for a scan.
   */
  async exportScanReport(
    scanId: string,
    createDto: CreateReportDto,
    requester: RequestingUser,
  ): Promise<{ filename: string; contentType: string; content: string }> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: { findings: true, project: true },
    });
    if (!scan) throw new NotFoundException(`Scan ${scanId} not found`);

    await this.assertProjectAccess(scan.projectId, requester);

    const reportData = this.buildReportData(scan);
    const encryptedBundle = this.encryptPayload(reportData, createDto.password);

    if (createDto.format === 'json') {
      return {
        filename: `code-sentinel-report-scan-${scan.id}.json`,
        contentType: 'application/json',
        content: JSON.stringify(reportData, null, 2),
      };
    }

    const html = this.buildHtmlDocument(reportData, encryptedBundle);
    return {
      filename: `code-sentinel-report-scan-${scan.id}.html`,
      contentType: 'text/html',
      content: html,
    };
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

  private buildReportData(scan: Scan): SecurityReportData {
    const findings = scan.findings ?? [];
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
        critical: findings.filter((f) => f.severity === 'critical').length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        low: findings.filter((f) => f.severity === 'low').length,
      },
      findings: findings.map((f) => ({
        id: f.id,
        type: f.type,
        severity: f.severity,
        toolCategory: f.toolCategory,
        sourceTool: f.sourceTool,
        filePath: f.filePath,
        line: f.line,
        cwe: f.cwe,
        description: f.description,
        recommendation: f.recommendation,
      })),
    };
  }

  encryptPayload(data: unknown, password: string): EncryptedReportBundle {
    const salt = randomBytes(16);
    const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const json = JSON.stringify(data);
    const updateBuf: Buffer = cipher.update(json, 'utf8');
    const finalBuf: Buffer = cipher.final();
    const ciphertext = Buffer.concat([updateBuf, finalBuf]);
    const authTag = cipher.getAuthTag();

    return {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: ciphertext.toString('hex'),
    };
  }

  decryptPayload(bundle: EncryptedReportBundle, password: string): string {
    try {
      const salt = Buffer.from(bundle.salt, 'hex');
      const iv = Buffer.from(bundle.iv, 'hex');
      const authTag = Buffer.from(bundle.authTag, 'hex');
      const ciphertext = Buffer.from(bundle.ciphertext, 'hex');

      const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const updateBuf: Buffer = decipher.update(ciphertext);
      const finalBuf: Buffer = decipher.final();
      const decrypted = Buffer.concat([updateBuf, finalBuf]);
      return decrypted.toString('utf8');
    } catch {
      throw new UnauthorizedException(
        'Incorrect report password or corrupted report data',
      );
    }
  }

  private buildHtmlDocument(
    data: SecurityReportData,
    bundle: EncryptedReportBundle,
  ): string {
    const bundleJson = JSON.stringify(bundle);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #0f172a;
      --border: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #38bdf8;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #3b82f6;
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 1000px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-critical { background: rgba(239, 68, 68, 0.2); color: var(--critical); border: 1px solid var(--critical); }
    .badge-high { background: rgba(249, 115, 22, 0.2); color: var(--high); border: 1px solid var(--high); }
    .badge-medium { background: rgba(234, 179, 8, 0.2); color: var(--medium); border: 1px solid var(--medium); }
    .badge-low { background: rgba(59, 130, 246, 0.2); color: var(--low); border: 1px solid var(--low); }
    .auth-box {
      max-width: 440px;
      margin: 100px auto;
      text-align: center;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      margin: 16px 0;
      box-sizing: border-box;
      background: #020617;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #fff;
      font-size: 15px;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #0284c7;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
    }
    button:hover { background: #0369a1; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    .stat-card {
      background: #020617;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-val { font-size: 28px; font-weight: 700; margin-top: 8px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    th { color: var(--muted); font-weight: 600; }
    .error { color: var(--critical); font-size: 13px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container" id="authSection">
    <div class="card auth-box">
      <h2 style="margin: 0 0 8px 0;">🛡️ Code Sentinel</h2>
      <p style="color: var(--muted); margin: 0 0 20px 0; font-size: 14px;">Protected Security Report</p>
      <p style="font-size: 13px; color: var(--muted);">This report is encrypted with password protection (RF-033 / RF-034). Enter the report password to view the security findings.</p>
      <form id="unlockForm">
        <input type="password" id="passwordInput" placeholder="Enter report password..." required autofocus />
        <button type="submit" id="unlockBtn">Unlock Security Report</button>
      </form>
      <div id="authError" class="error" style="display: none;">Incorrect password. Access denied.</div>
    </div>
  </div>

  <div class="container" id="reportSection" style="display: none;">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
        <div>
          <h1 style="margin: 0; font-size: 24px;">Code Sentinel Security Report</h1>
          <p id="projInfo" style="margin: 6px 0 0 0; color: var(--muted); font-size: 14px;"></p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 12px; color: var(--muted);">Generated:</span>
          <div id="genDate" style="font-size: 13px; font-weight: 500;"></div>
        </div>
      </div>

      <div class="stats">
        <div class="stat-card" style="border-top: 3px solid var(--critical);"><div style="color: var(--muted); font-size: 12px;">CRITICAL</div><div id="countCritical" class="stat-val" style="color: var(--critical);">0</div></div>
        <div class="stat-card" style="border-top: 3px solid var(--high);"><div style="color: var(--muted); font-size: 12px;">HIGH</div><div id="countHigh" class="stat-val" style="color: var(--high);">0</div></div>
        <div class="stat-card" style="border-top: 3px solid var(--medium);"><div style="color: var(--muted); font-size: 12px;">MEDIUM</div><div id="countMedium" class="stat-val" style="color: var(--medium);">0</div></div>
        <div class="stat-card" style="border-top: 3px solid var(--low);"><div style="color: var(--muted); font-size: 12px;">LOW</div><div id="countLow" class="stat-val" style="color: var(--low);">0</div></div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin: 0 0 16px 0;">Identified Findings</h3>
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Category / Tool</th>
            <th>Location</th>
            <th>CWE</th>
          </tr>
        </thead>
        <tbody id="findingsTableBody"></tbody>
      </table>
    </div>
  </div>

  <script id="encryptedPayload" type="application/json">${bundleJson}</script>
  <script>
    async function deriveKey(password, salt) {
      const enc = new TextEncoder();
      const baseKey = await window.crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
      );
      return window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
    }

    function hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes;
    }

    document.getElementById('unlockForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('passwordInput').value;
      const errorDiv = document.getElementById('authError');
      errorDiv.style.display = 'none';

      try {
        const bundle = JSON.parse(document.getElementById('encryptedPayload').textContent);
        const salt = hexToBytes(bundle.salt);
        const iv = hexToBytes(bundle.iv);
        const authTag = hexToBytes(bundle.authTag);
        const ciphertext = hexToBytes(bundle.ciphertext);

        // WebCrypto AES-GCM expects authTag appended to ciphertext
        const combined = new Uint8Array(ciphertext.length + authTag.length);
        combined.set(ciphertext);
        combined.set(authTag, ciphertext.length);

        const key = await deriveKey(pwd, salt);
        const decrypted = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv, tagLength: 128 },
          key,
          combined
        );

        const dec = new TextDecoder();
        const data = JSON.parse(dec.decode(decrypted));
        renderReport(data);
      } catch (err) {
        errorDiv.style.display = 'block';
      }
    });

    function renderReport(data) {
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('reportSection').style.display = 'block';

      document.getElementById('projInfo').textContent = \`\${data.project.name} (\${data.project.repo})\`;
      document.getElementById('genDate').textContent = new Date(data.generatedAt).toLocaleString();

      document.getElementById('countCritical').textContent = data.summary.critical;
      document.getElementById('countHigh').textContent = data.summary.high;
      document.getElementById('countMedium').textContent = data.summary.medium;
      document.getElementById('countLow').textContent = data.summary.low;

      const tbody = document.getElementById('findingsTableBody');
      tbody.innerHTML = '';

      if (data.findings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 24px;">No vulnerabilities found.</td></tr>';
        return;
      }

      for (const f of data.findings) {
        const tr = document.createElement('tr');
        const sevClass = 'badge-' + (f.severity || 'low');
        const loc = f.filePath ? \`\${f.filePath}\${f.line ? ':' + f.line : ''}\` : 'N/A';
        tr.innerHTML = \`
          <td><span class="badge \${sevClass}">\${f.severity || 'UNKNOWN'}</span></td>
          <td><strong>\${f.type}</strong><br><span style="color: var(--muted); font-size: 12px;">\${f.description || ''}</span></td>
          <td>\${f.sourceTool} (\${f.toolCategory})</td>
          <td><code>\${loc}</code></td>
          <td>\${f.cwe || 'N/A'}</td>
        \`;
        tbody.appendChild(tr);
      }
    }
  </script>
</body>
</html>`;
  }
}

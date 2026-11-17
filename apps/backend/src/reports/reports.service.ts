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
    *, *::before, *::after {
      box-sizing: border-box;
    }
    :root {
      --bg: #090d16;
      --card: #0f172a;
      --card-inner: #020617;
      --border: #1e293b;
      --border-focus: #38bdf8;
      --text: #f8fafc;
      --muted: #94a3b8;
      --primary: #38bdf8;
      --critical: #ef4444;
      --critical-bg: rgba(239, 68, 68, 0.15);
      --high: #f97316;
      --high-bg: rgba(249, 115, 22, 0.15);
      --medium: #eab308;
      --medium-bg: rgba(234, 179, 8, 0.15);
      --low: #3b82f6;
      --low-bg: rgba(59, 130, 246, 0.15);
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .header-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-critical { background: var(--critical-bg); color: var(--critical); border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-high { background: var(--high-bg); color: var(--high); border: 1px solid rgba(249, 115, 22, 0.3); }
    .badge-medium { background: var(--medium-bg); color: var(--medium); border: 1px solid rgba(234, 179, 8, 0.3); }
    .badge-low { background: var(--low-bg); color: var(--low); border: 1px solid rgba(59, 130, 246, 0.3); }

    .auth-box {
      max-width: 440px;
      margin: 100px auto;
      text-align: center;
    }
    input[type="password"], input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: var(--border-focus);
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
      margin-top: 12px;
    }
    button:hover { background: #0369a1; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    .stat-card {
      background: var(--card-inner);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-val { font-size: 28px; font-weight: 700; margin-top: 6px; }

    /* Controls & Search */
    .controls-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .filter-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .filter-pill {
      background: var(--card-inner);
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
    }
    .filter-pill.active {
      background: rgba(56, 189, 248, 0.15);
      border-color: var(--primary);
      color: var(--primary);
    }
    .search-box {
      max-width: 320px;
      width: 100%;
    }

    /* Table Container: Prevents overflow */
    .table-container {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-inner);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      min-width: 800px;
    }
    th {
      background: #090e1a;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 14px 16px;
      font-size: 13px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .col-sev { width: 110px; }
    .col-type { width: 320px; }
    .col-tool { width: 160px; }
    .col-loc { width: 260px; }
    .col-cwe { width: 90px; text-align: center; }

    .code-pill {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      background: #090d16;
      border: 1px solid var(--border);
      padding: 4px 8px;
      border-radius: 6px;
      color: #38bdf8;
      word-break: break-all;
      max-width: 100%;
    }
    .recommendation-box {
      margin-top: 6px;
      padding: 8px 12px;
      background: rgba(56, 189, 248, 0.06);
      border-left: 2px solid var(--primary);
      border-radius: 4px;
      font-size: 12px;
      color: #cbd5e1;
    }
    .error { color: var(--critical); font-size: 13px; margin-top: 8px; }

    @media print {
      body { background: #fff !important; color: #000 !important; }
      .card { background: #fff !important; color: #000 !important; border: 1px solid #ccc !important; box-shadow: none !important; }
      .table-container { border: 1px solid #ccc !important; overflow: visible !important; }
      table { min-width: 100% !important; table-layout: auto !important; }
      #authSection, .controls-row { display: none !important; }
      .code-pill { background: #f1f5f9 !important; color: #000 !important; border-color: #ccc !important; }
    }
  </style>
</head>
<body>
  <div class="container" id="authSection">
    <div class="card auth-box">
      <h2 style="margin: 0 0 8px 0;">🛡️ Code Sentinel</h2>
      <p style="color: var(--muted); margin: 0 0 20px 0; font-size: 14px;">Protected Security Report</p>
      <p style="font-size: 13px; color: var(--muted); margin-bottom: 20px;">
        This report is encrypted with password protection (RF-033 / RF-034). Enter the report password to decrypt and view the findings.
      </p>
      <form id="unlockForm">
        <input type="password" id="passwordInput" placeholder="Enter report password..." required autofocus />
        <button type="submit" id="unlockBtn">Unlock Security Report</button>
      </form>
      <div id="authError" class="error" style="display: none;">Incorrect password. Access denied.</div>
    </div>
  </div>

  <div class="container" id="reportSection" style="display: none;">
    <div class="card">
      <div class="header-bar">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🛡️</span>
            <h1 style="margin: 0; font-size: 22px;">Code Sentinel Security Report</h1>
          </div>
          <p id="projInfo" style="margin: 8px 0 0 0; color: var(--muted); font-size: 14px; word-break: break-all;"></p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em;">Generated</span>
          <div id="genDate" style="font-size: 13px; font-weight: 500;"></div>
        </div>
      </div>

      <div class="stats">
        <div class="stat-card" style="border-top: 3px solid var(--critical);"><div style="color: var(--muted); font-size: 12px; font-weight: 600;">CRITICAL</div><div id="countCritical" class="stat-val" style="color: var(--critical);">0</div></div>
        <div class="stat-card" style="border-top: 3px solid var(--high);"><div style="color: var(--muted); font-size: 12px; font-weight: 600;">HIGH</div><div id="countHigh" class="stat-val" style="color: var(--high);">0</div></div>
        <div class="stat-card" style="border-top: 3px solid var(--medium);"><div style="color: var(--muted); font-size: 12px; font-weight: 600;">MEDIUM</div><div id="countMedium" class="stat-val" style="color: var(--medium);">0</div></div>
        <div class="stat-card" style="border-top: 3px solid var(--low);"><div style="color: var(--muted); font-size: 12px; font-weight: 600;">LOW</div><div id="countLow" class="stat-val" style="color: var(--low);">0</div></div>
      </div>
    </div>

    <div class="card">
      <div class="controls-row">
        <div class="filter-pills">
          <button type="button" class="filter-pill active" data-filter="all">All (<span id="totalFilterCount">0</span>)</button>
          <button type="button" class="filter-pill" data-filter="critical">Critical</button>
          <button type="button" class="filter-pill" data-filter="high">High</button>
          <button type="button" class="filter-pill" data-filter="medium">Medium</button>
          <button type="button" class="filter-pill" data-filter="low">Low</button>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="Search type, tool, location..." />
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="col-sev">Severity</th>
              <th class="col-type">Vulnerability</th>
              <th class="col-tool">Tool / Category</th>
              <th class="col-loc">Location</th>
              <th class="col-cwe">CWE</th>
            </tr>
          </thead>
          <tbody id="findingsTableBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script id="encryptedPayload" type="application/json">${bundleJson}</script>
  <script>
    let reportData = null;
    let currentFilter = 'all';
    let searchQuery = '';

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
        reportData = JSON.parse(dec.decode(decrypted));
        renderReport();
      } catch (err) {
        errorDiv.style.display = 'block';
      }
    });

    function renderReport() {
      if (!reportData) return;
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('reportSection').style.display = 'block';

      document.getElementById('projInfo').textContent = \`\${reportData.project.name} • \${reportData.project.repo}\`;
      document.getElementById('genDate').textContent = new Date(reportData.generatedAt).toLocaleString();

      document.getElementById('countCritical').textContent = reportData.summary.critical;
      document.getElementById('countHigh').textContent = reportData.summary.high;
      document.getElementById('countMedium').textContent = reportData.summary.medium;
      document.getElementById('countLow').textContent = reportData.summary.low;
      document.getElementById('totalFilterCount').textContent = reportData.findings.length;

      filterAndRenderTable();
    }

    function filterAndRenderTable() {
      if (!reportData) return;
      const tbody = document.getElementById('findingsTableBody');
      tbody.innerHTML = '';

      const filtered = reportData.findings.filter((f) => {
        const matchesFilter = currentFilter === 'all' || (f.severity || '').toLowerCase() === currentFilter;
        if (!matchesFilter) return false;

        if (!searchQuery) return true;
        const text = \`\${f.type} \${f.description || ''} \${f.filePath || ''} \${f.sourceTool} \${f.cwe || ''}\`.toLowerCase();
        return text.includes(searchQuery.toLowerCase());
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 32px;">No matching findings found.</td></tr>';
        return;
      }

      for (const f of filtered) {
        const tr = document.createElement('tr');
        const sev = (f.severity || 'low').toLowerCase();
        const sevClass = 'badge-' + (['critical', 'high', 'medium', 'low'].includes(sev) ? sev : 'low');
        const loc = f.filePath ? \`\${f.filePath}\${f.line ? ':' + f.line : ''}\` : 'N/A';
        const rec = f.recommendation ? \`<div class="recommendation-box">💡 <strong>Remediation:</strong> \${escapeHtml(f.recommendation)}</div>\` : '';

        tr.innerHTML = \`
          <td class="col-sev"><span class="badge \${sevClass}">\${escapeHtml(f.severity || 'UNKNOWN')}</span></td>
          <td class="col-type">
            <strong style="color: var(--text); font-size: 14px;">\${escapeHtml(f.type)}</strong>
            <div style="color: var(--muted); font-size: 12px; margin-top: 4px;">\${escapeHtml(f.description || '')}</div>
            \${rec}
          </td>
          <td class="col-tool">
            <span style="font-weight: 500;">\${escapeHtml(f.sourceTool)}</span>
            <div style="font-size: 11px; color: var(--muted);">\${escapeHtml(f.toolCategory)}</div>
          </td>
          <td class="col-loc"><code class="code-pill">\${escapeHtml(loc)}</code></td>
          <td class="col-cwe"><span style="font-family: monospace; font-size: 11px; color: var(--muted);">\${escapeHtml(f.cwe || '-')}</span></td>
        \`;
        tbody.appendChild(tr);
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    document.querySelectorAll('.filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        filterAndRenderTable();
      });
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      filterAndRenderTable();
    });
  </script>
</body>
</html>`;
  }
}

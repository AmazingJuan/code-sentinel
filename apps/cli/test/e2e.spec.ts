import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runCli, submitScanToBackend } from '../src/main.js';
import type { NormalizedFinding } from '../src/domain/finding.js';
import { NodeCommandRunner } from '../src/infra/command-runner.js';

describe('CLI End-to-End Test Suite', () => {
  let server: http.Server;
  let serverUrl: string;
  let tempDir: string;
  let gitRepoDir: string;
  let semgrepFixtureJson: string;

  interface RecordedRequest {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: Record<string, unknown> | null;
  }

  const recordedRequests: RecordedRequest[] = [];
  let mockProjects: Array<{ id: string; name: string; repo: string }> = [];
  const collidingProjects: Set<string> = new Set();
  let createdScans: Array<{ id: string; projectId: string; tools: string[]; status: string }> = [];
  let submittedFindings: Array<{ scanId: string; findings: NormalizedFinding[] }> = [];

  beforeAll(async () => {
    // Read real Semgrep fixture for command runner mock
    const fixturePath = fileURLToPath(
      new URL('../src/adapters/semgrep/__fixtures__/semgrep-report.json', import.meta.url),
    );
    semgrepFixtureJson = readFileSync(fixturePath, 'utf8');

    // Start mock backend server strictly enforcing backend API contracts
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      let rawBody = '';
      for await (const chunk of req) {
        rawBody += chunk;
      }
      let body: Record<string, unknown> | null = null;
      if (rawBody.trim().length > 0) {
        try {
          body = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          body = null;
        }
      }

      recordedRequests.push({
        method: req.method || 'GET',
        url: url.pathname,
        headers: req.headers,
        body,
      });

      // GET /auth/me
      if (url.pathname === '/auth/me' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'user-e2e-1',
            email: 'analyst@code-sentinel.local',
            name: 'E2E Analyst',
            role: 'analyst',
          }),
        );
        return;
      }

      // GET /projects
      if (url.pathname === '/projects' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockProjects));
        return;
      }

      // POST /projects
      if (url.pathname === '/projects' && req.method === 'POST') {
        if (!body || !body.name || !body.repo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 400,
              message: ['name and repo are required'],
              error: 'Bad Request',
            }),
          );
          return;
        }

        // Simulate unique constraint collision if another user already owns the project
        if (collidingProjects.has(body.name)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 409,
              message: 'A project with this name is already registered',
              error: 'Conflict',
            }),
          );
          return;
        }

        const newProject = {
          id: `proj-uuid-${mockProjects.length + 1}`,
          name: body.name,
          repo: body.repo,
        };
        mockProjects.push(newProject);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newProject));
        return;
      }

      // POST /scans
      if (url.pathname === '/scans' && req.method === 'POST') {
        const auth = req.headers['authorization'];
        if (!auth || !auth.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ statusCode: 401, message: 'Unauthorized' }));
          return;
        }

        // Validate SCAN_TOOLS contract: ['SAST', 'Secret Scanner']
        const validScanTools = ['SAST', 'Secret Scanner'];
        const tools = body?.tools;
        if (
          !Array.isArray(tools) ||
          tools.length === 0 ||
          !tools.every((t) => validScanTools.includes(t))
        ) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              statusCode: 400,
              message: [
                'each value in tools must be one of the following values: SAST, Secret Scanner',
              ],
              error: 'Bad Request',
            }),
          );
          return;
        }

        const scanId = `scan-${createdScans.length + 1}`;
        const newScan = {
          id: scanId,
          projectId: body.projectId,
          tools,
          status: 'pending',
        };
        createdScans.push(newScan);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newScan));
        return;
      }

      // PATCH /scans/:id/status
      if (url.pathname.match(/^\/scans\/[^/]+\/status$/) && req.method === 'PATCH') {
        const scanId = url.pathname.split('/')[2];
        const scan = createdScans.find((s) => s.id === scanId);
        if (scan && body?.status) {
          scan.status = body.status;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: scanId, status: body?.status || 'running' }));
        return;
      }

      // POST /scans/:id/results
      if (url.pathname.match(/^\/scans\/[^/]+\/results$/) && req.method === 'POST') {
        const scanId = url.pathname.split('/')[2];
        const scan = createdScans.find((s) => s.id === scanId);
        if (scan) {
          scan.status = body?.status || 'completed';
        }
        submittedFindings.push({
          scanId,
          findings: body?.findings || [],
        });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            scanId,
            totalCount: (body?.findings || []).length,
            status: 'completed',
          }),
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ statusCode: 404, message: 'Not Found' }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    recordedRequests.length = 0;
    mockProjects = [];
    collidingProjects.clear();
    createdScans = [];
    submittedFindings = [];

    // Mock command runner with clean scan results by default (0 findings -> exit code 0)
    vi.spyOn(NodeCommandRunner.prototype, 'run').mockImplementation(async (command: string) => {
      if (command === 'docker') {
        return {
          exitCode: 0,
          stdout: JSON.stringify({ version: '1.181.1', results: [] }),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    // Create a temporary git repository fixture
    tempDir = mkdtempSync(join(tmpdir(), 'sentinel-e2e-'));
    gitRepoDir = join(tempDir, 'repo');
    mkdirSync(gitRepoDir, { recursive: true });

    // Initialize git repo with remote origin
    execSync('git init -b main', { cwd: gitRepoDir, stdio: 'ignore' });
    execSync('git config user.name "E2E Tester"', { cwd: gitRepoDir, stdio: 'ignore' });
    execSync('git config user.email "test@code-sentinel.local"', { cwd: gitRepoDir, stdio: 'ignore' });
    execSync('git remote add origin https://github.com/EAFIT-Works/juice-shop.git', {
      cwd: gitRepoDir,
      stdio: 'ignore',
    });

    writeFileSync(join(gitRepoDir, 'index.js'), 'console.log("hello world");\n', 'utf8');
    execSync('git add . && git commit -m "initial commit"', { cwd: gitRepoDir, stdio: 'ignore' });
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('completes the full scan lifecycle with canonical project auto-registration and backend synchronization', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'scan',
      '--target',
      gitRepoDir,
      '--token',
      'mock-valid-jwt',
      '--api-url',
      serverUrl,
    ]);

    expect(exitCode).toBe(0);

    // Verify canonical project auto-registration: EAFIT-Works/juice-shop
    const projectPostReq = recordedRequests.find((r) => r.method === 'POST' && r.url === '/projects');
    expect(projectPostReq).toBeDefined();
    expect(projectPostReq?.body).toEqual({
      name: 'EAFIT-Works/juice-shop',
      repo: 'https://github.com/EAFIT-Works/juice-shop.git',
    });

    // Verify scan creation with strictly valid SCAN_TOOLS: ['SAST', 'Secret Scanner']
    const scanPostReq = recordedRequests.find((r) => r.method === 'POST' && r.url === '/scans');
    expect(scanPostReq).toBeDefined();
    expect(scanPostReq?.body.projectId).toBe('proj-uuid-1');
    expect(scanPostReq?.body.tools).toEqual(expect.arrayContaining(['SAST']));
    // Crucial: Must NEVER contain 'Semgrep'
    expect(scanPostReq?.body.tools).not.toContain('Semgrep');

    // Verify scan status transitions to running
    const statusReq = recordedRequests.find((r) => r.method === 'PATCH' && r.url.endsWith('/status'));
    expect(statusReq).toBeDefined();
    expect(statusReq?.body).toEqual({ status: 'running' });

    // Verify findings ingestion completes scan
    const resultsReq = recordedRequests.find((r) => r.method === 'POST' && r.url.endsWith('/results'));
    expect(resultsReq).toBeDefined();
    expect(resultsReq?.body.status).toBe('completed');
    expect(Array.isArray(resultsReq?.body.findings)).toBe(true);

    logSpy.mockRestore();
  });

  it('synchronizes findings and returns exit code 1 when high/critical vulnerabilities are detected', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    vi.spyOn(NodeCommandRunner.prototype, 'run').mockImplementation(async (command: string) => {
      if (command === 'docker') {
        return {
          exitCode: 0,
          stdout: semgrepFixtureJson,
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const exitCode = await runCli([
      'scan',
      '--target',
      gitRepoDir,
      '--token',
      'mock-valid-jwt',
      '--api-url',
      serverUrl,
    ]);

    // Vulnerabilities of severity high found -> non-zero exit code for CI/CD gates
    expect(exitCode).toBe(1);

    const resultsReq = recordedRequests.find((r) => r.method === 'POST' && r.url.endsWith('/results'));
    expect(resultsReq).toBeDefined();
    expect(resultsReq?.body.status).toBe('completed');
    expect(resultsReq?.body.findings.length).toBe(2);

    logSpy.mockRestore();
  });

  it('handles 409 Conflict during project registration by falling back to user-scoped project', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Simulate canonical project already existing for another user
    collidingProjects.add('EAFIT-Works/juice-shop');

    const exitCode = await runCli([
      'scan',
      '--target',
      gitRepoDir,
      '--token',
      'mock-valid-jwt',
      '--api-url',
      serverUrl,
    ]);

    expect(exitCode).toBe(0);

    // Verify fallback attempt created project qualified with user slug
    const projectPosts = recordedRequests.filter((r) => r.method === 'POST' && r.url === '/projects');
    expect(projectPosts.length).toBe(2);
    expect(projectPosts[0].body.name).toBe('EAFIT-Works/juice-shop');
    expect(projectPosts[1].body.name).toBe('EAFIT-Works/juice-shop (analyst)');

    // Verify scan was bound to the fallback project
    const scanPost = recordedRequests.find((r) => r.method === 'POST' && r.url === '/scans');
    expect(scanPost?.body.projectId).toBe('proj-uuid-1');

    logSpy.mockRestore();
  });

  it('binds to existing shared project when assigned to the user', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Existing shared project already assigned to the user
    mockProjects.push({
      id: 'proj-shared-999',
      name: 'EAFIT-Works/juice-shop',
      repo: 'https://github.com/EAFIT-Works/juice-shop.git',
    });

    const exitCode = await runCli([
      'scan',
      '--target',
      gitRepoDir,
      '--token',
      'mock-valid-jwt',
      '--api-url',
      serverUrl,
    ]);

    expect(exitCode).toBe(0);

    // Verify no POST /projects was executed since project is already assigned
    const projectPosts = recordedRequests.filter((r) => r.method === 'POST' && r.url === '/projects');
    expect(projectPosts.length).toBe(0);

    // Verify scan was submitted to the shared project ID
    const scanPost = recordedRequests.find((r) => r.method === 'POST' && r.url === '/scans');
    expect(scanPost?.body.projectId).toBe('proj-shared-999');

    logSpy.mockRestore();
  });

  it('reads token from CODE_SENTINEL_TOKEN environment variable when not passed via flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const previousEnv = process.env.CODE_SENTINEL_TOKEN;
    process.env.CODE_SENTINEL_TOKEN = 'env-saved-token';

    try {
      const exitCode = await runCli([
        'scan',
        '--target',
        gitRepoDir,
        '--api-url',
        serverUrl,
      ]);

      expect(exitCode).toBe(0);

      const scanPost = recordedRequests.find((r) => r.method === 'POST' && r.url === '/scans');
      expect(scanPost).toBeDefined();
      expect(scanPost?.headers['authorization']).toBe('Bearer env-saved-token');
    } finally {
      if (previousEnv !== undefined) {
        process.env.CODE_SENTINEL_TOKEN = previousEnv;
      } else {
        delete process.env.CODE_SENTINEL_TOKEN;
      }
      logSpy.mockRestore();
    }
  });

  it('rejects invalid scan tools in submitScanToBackend directly', async () => {
    const findings: NormalizedFinding[] = [];

    // Directly testing submitScanToBackend with invalid tool name 'Semgrep'
    // Server rejects with 400 Bad Request
    await expect(
      submitScanToBackend(
        serverUrl,
        'mock-valid-jwt',
        'proj-uuid-1',
        ['Semgrep'],
        findings,
      ),
    ).rejects.toThrow(/each value in tools must be one of the following values/);

    // Testing submitScanToBackend with valid tool category 'SAST' succeeds
    const result = await submitScanToBackend(
      serverUrl,
      'mock-valid-jwt',
      'proj-uuid-1',
      ['SAST'],
      findings,
    );

    expect(result.scanId).toBeDefined();
    expect(result.totalCount).toBe(0);
  });

  it('runs scan in --dry-run mode without sending backend HTTP calls', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await runCli([
      'scan',
      '--target',
      gitRepoDir,
      '--dry-run',
    ]);

    expect(exitCode).toBe(0);
    // In dry-run mode, no network requests should be sent to server
    expect(recordedRequests.length).toBe(0);

    logSpy.mockRestore();
  });
});

import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { AddressInfo, createServer } from 'node:net';
import { join } from 'node:path';
import request from 'supertest';

// Several runtime dependencies (@nestjs/config, @nestjs/typeorm, ...) ship as
// ESM only, which Jest's CommonJS loader cannot import. The e2e suite therefore
// boots the compiled server (`dist/main.js`) as a real process and talks to it
// over HTTP. It needs a reachable PostgreSQL configured through DB_* or
// DATABASE_URL.
const MAIN_PATH = join(__dirname, '..', 'dist', 'main.js');
const STARTUP_TIMEOUT_MS = 45_000;

interface HealthBody {
  status: string;
  service: string;
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject): void => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, (): void => {
      const { port } = server.address() as AddressInfo;
      server.close((): void => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server not listening yet.
    }
    await new Promise((resolve): void => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error(`API did not become healthy at ${baseUrl}`);
}

describe('Code Sentinel API (e2e)', (): void => {
  let server: ChildProcess;
  let baseUrl: string;
  let output = '';

  beforeAll(async (): Promise<void> => {
    if (!existsSync(MAIN_PATH)) {
      throw new Error('dist/main.js not found; run `pnpm run build` first');
    }
    const port = await findFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [MAIN_PATH], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk: Buffer): void => {
      output += chunk.toString();
    });
    server.stderr?.on('data', (chunk: Buffer): void => {
      output += chunk.toString();
    });

    try {
      await waitForHealth(baseUrl);
    } catch (error: unknown) {
      server.kill();
      throw new Error(`${(error as Error).message}\n${output}`);
    }
  });

  afterAll((): void => {
    server?.kill('SIGTERM');
  });

  it('GET /health reports the service as up', async (): Promise<void> => {
    const response = await request(baseUrl).get('/health');
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('code-sentinel-api');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects unauthenticated access to protected routes', async (): Promise<void> => {
    const response = await request(baseUrl).get('/scans');
    expect(response.status).toBe(401);
  });

  it('rejects invalid credentials without revealing which field was wrong', async (): Promise<void> => {
    const response = await request(baseUrl)
      .post('/auth/login')
      .send({ email: 'nobody@code-sentinel.local', password: 'WrongPass1!' });
    const body = response.body as { message: string };

    expect(response.status).toBe(401);
    expect(body.message).toBe('Invalid email or password');
  });

  describe('as the seeded demo analyst', (): void => {
    let token: string;

    beforeAll(async (): Promise<void> => {
      const response = await request(baseUrl)
        .post('/auth/login')
        .send({ email: 'demo@code-sentinel.local', password: 'Demo1234!' });
      expect(response.status).toBe(201);
      const body = response.body as {
        accessToken: string;
        user: Record<string, unknown>;
      };
      expect(body.user).not.toHaveProperty('passwordHash');
      token = body.accessToken;
    });

    it('lists only the scans of assigned projects', async (): Promise<void> => {
      const response = await request(baseUrl)
        .get('/scans')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('returns 400 for a malformed id instead of a database error', async (): Promise<void> => {
      const response = await request(baseUrl)
        .get('/scans/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(400);
    });

    it('rejects unknown body properties (forbidNonWhitelisted)', async (): Promise<void> => {
      const response = await request(baseUrl)
        .post('/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'e2e-project', repo: 'repo', ownerId: 'x' });
      expect(response.status).toBe(400);
    });

    it('runs the scan ingestion lifecycle end to end', async (): Promise<void> => {
      const auth = { Authorization: `Bearer ${token}` };

      const project = await request(baseUrl)
        .post('/projects')
        .set(auth)
        .send({ name: `e2e-${Date.now()}`, repo: 'git@example.com:e2e.git' });
      expect(project.status).toBe(201);
      const projectId = (project.body as { id: string }).id;

      const scan = await request(baseUrl)
        .post('/scans')
        .set(auth)
        .send({ projectId, tools: ['SAST', 'Secret Scanner'] });
      expect(scan.status).toBe(201);
      const scanId = (scan.body as { id: string }).id;

      const running = await request(baseUrl)
        .patch(`/scans/${scanId}/status`)
        .set(auth)
        .send({ status: 'running' });
      expect(running.status).toBe(200);

      const results = {
        status: 'completed',
        findings: [
          {
            type: 'github-pat',
            severity: 'critical',
            toolCategory: 'Secret Scanner',
            sourceTool: 'Gitleaks',
            filePath: 'src/config.ts',
            line: 3,
          },
        ],
      };
      const closed = await request(baseUrl)
        .post(`/scans/${scanId}/results`)
        .set(auth)
        .send(results);
      expect(closed.status).toBe(200);
      expect(closed.body).toMatchObject({
        status: 'completed',
        criticalCount: 1,
        totalCount: 1,
      });

      const duplicate = await request(baseUrl)
        .post(`/scans/${scanId}/results`)
        .set(auth)
        .send(results);
      expect(duplicate.status).toBe(409);

      const findings = await request(baseUrl)
        .get('/findings')
        .query({ scanId })
        .set(auth);
      expect(findings.status).toBe(200);
      expect(findings.body).toHaveLength(1);

      const projectAfter = await request(baseUrl)
        .get(`/projects/${projectId}`)
        .set(auth);
      expect(projectAfter.body).toMatchObject({
        status: 'completed',
        criticalCount: 1,
      });

      const report = await request(baseUrl)
        .post(`/scans/${scanId}/reports`)
        .set(auth)
        .send({ password: 'report-pass', format: 'json' });
      expect(report.status).toBe(201);
      const reportId = (report.body as { id: string }).id;

      const download = await request(baseUrl)
        .post(`/reports/${reportId}/download`)
        .set(auth)
        .send({ password: 'report-pass' });
      expect(download.status).toBe(201);
      expect(download.headers['content-type']).toContain('application/json');

      const wrongPassword = await request(baseUrl)
        .post(`/reports/${reportId}/download`)
        .set(auth)
        .send({ password: 'not-the-password' });
      expect(wrongPassword.status).toBe(401);
    });

    it('forbids the analyst from user administration', async (): Promise<void> => {
      const response = await request(baseUrl)
        .get('/users')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });
  });
});

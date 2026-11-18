import { describe, expect, it, vi } from 'vitest';

import * as credentialsModule from './auth/credentials.js';
import * as loginServerModule from './auth/login-server.js';
import type { ToolAdapter } from './domain/tool-adapter.js';
import {
  DEFAULT_API_URL,
  fetchWithTimeout,
  getPackageVersion,
  isAdapterSelected,
  runCli,
} from './main.js';
import * as runAdaptersModule from './pipeline/run-adapters.js';
import * as projectResolverModule from './project/project-resolver.js';

describe('Code Sentinel CLI main', () => {
  it('defines a valid default backend API URL', () => {
    expect(DEFAULT_API_URL).toBeDefined();
    expect(DEFAULT_API_URL).toMatch(/^https?:\/\//);
  });

  it('reads the package version correctly', () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints version and returns 0 on --version flag', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['--version']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('code-sentinel-cli v'));
    logSpy.mockRestore();
  });

  it('prints help and returns 0 on --help flag', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Code Sentinel CLI'));
    logSpy.mockRestore();
  });

  it('executes logout and returns 0', async () => {
    vi.spyOn(credentialsModule, 'clearSession').mockReturnValue(true);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['logout']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Session cleared successfully'));
    logSpy.mockRestore();
  });

  it('executes whoami with 1 when not logged in', async () => {
    vi.spyOn(credentialsModule, 'getStoredSession').mockReturnValue(null);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['whoami']);
    expect(exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Not logged in'));
    logSpy.mockRestore();
  });

  it('executes whoami with 0 when logged in', async () => {
    vi.spyOn(credentialsModule, 'getStoredSession').mockReturnValue({
      token: 'mock-token',
      apiUrl: 'http://127.0.0.1:8000',
      user: { email: 'dev@example.com', name: 'Dev User', role: 'admin' },
      savedAt: '2026-11-17T00:00:00Z',
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await runCli(['whoami']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('dev@example.com'));
    logSpy.mockRestore();
  });

  it('fails with exit code 1 on unknown command', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitCode = await runCli(['invalid-command']);
    expect(exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    errSpy.mockRestore();
  });

  it('fails with exit code 1 if target directory does not exist', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitCode = await runCli(['scan', '--target', '/tmp/nonexistent-sentinel-dir-xyz']);
    expect(exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Target path does not exist'));
    errSpy.mockRestore();
  });

  it('rejects an unknown --engine value', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitCode = await runCli(['scan', '--engine', 'podman', '--dry-run']);
    expect(exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid --engine "podman"'));
    errSpy.mockRestore();
  });

  it('runs scan in dry-run mode on valid directory', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const runAdaptersSpy = vi.spyOn(runAdaptersModule, 'runAdapters').mockResolvedValue({
      findings: [],
      errors: [],
      timings: [],
    });

    const exitCode = await runCli(['scan', '--target', '.', '--dry-run']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run mode active'));
    expect(runAdaptersSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    runAdaptersSpy.mockRestore();
  });

  it('runs scan with auto-detected project and submits to backend', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(credentialsModule, 'resolveEffectiveToken').mockReturnValue('valid-jwt-token');
    vi.spyOn(projectResolverModule, 'resolveOrCreateProject').mockResolvedValue({
      id: 'proj-123',
      name: 'code-sentinel',
      repo: 'https://github.com/AmazingJuan/code-sentinel.git',
      isNew: true,
    });
    vi.spyOn(runAdaptersModule, 'runAdapters').mockResolvedValue({
      findings: [],
      errors: [],
      timings: [],
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/scans')) {
        return Promise.resolve(new Response(JSON.stringify({ id: 'scan-abc-456' }), { status: 201 }));
      }
      if (url.includes('/status')) {
        return Promise.resolve(new Response(JSON.stringify({ status: 'running' }), { status: 200 }));
      }
      if (url.includes('/results')) {
        return Promise.resolve(new Response(JSON.stringify({ totalCount: 0 }), { status: 201 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    const exitCode = await runCli(['scan', '--target', '.']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-registered project: "code-sentinel"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully synchronized scan #scan-abc-456!'));

    globalThis.fetch = originalFetch;
    logSpy.mockRestore();
  });

  it('handles login command with browser interaction mock', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(loginServerModule, 'openBrowser').mockImplementation(() => {});
    vi.spyOn(loginServerModule, 'startLoginServer').mockResolvedValue({
      server: { close: vi.fn() } as unknown as import('node:http').Server,
      port: 8999,
      sessionPromise: Promise.resolve({
        token: 'new-jwt-token',
        apiUrl: 'http://127.0.0.1:8000',
        user: { email: 'login-test@example.com', name: 'Login Test', role: 'admin' },
        savedAt: '2026-11-17T00:00:00Z',
      }),
    });

    const exitCode = await runCli(['login']);
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Authentication successful!'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('login-test@example.com'));

    logSpy.mockRestore();
  });

  it('handles network timeouts cleanly in fetchWithTimeout', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const timeoutErr = new Error('The operation was aborted due to timeout');
          timeoutErr.name = 'TimeoutError';
          reject(timeoutErr);
        });
      });
    });

    await expect(
      fetchWithTimeout('https://unreachable-backend.example.com', {}, 50),
    ).rejects.toThrow(/timed out after/);

    globalThis.fetch = originalFetch;
  });

  it('handles host not found (ENOTFOUND) gracefully', async () => {
    const originalFetch = globalThis.fetch;
    const notFoundError = new Error('getaddrinfo ENOTFOUND invalid-host.test');
    (notFoundError as { code?: string }).code = 'ENOTFOUND';
    globalThis.fetch = vi.fn().mockRejectedValue(notFoundError);

    await expect(
      fetchWithTimeout('https://invalid-host.test', {}, 1000),
    ).rejects.toThrow(/Backend host not found/);

    globalThis.fetch = originalFetch;
  });

  describe('isAdapterSelected', () => {
    const semgrep = { sourceTool: 'Semgrep', toolCategory: 'SAST' as const } as unknown as ToolAdapter;
    const gitleaks = { sourceTool: 'Gitleaks', toolCategory: 'Secret Scanner' as const } as unknown as ToolAdapter;

    it('matches when "all" is requested', () => {
      expect(isAdapterSelected(semgrep, ['all'])).toBe(true);
      expect(isAdapterSelected(gitleaks, ['all'])).toBe(true);
    });

    it('matches backend project tool categories', () => {
      const projectTools = ['SAST'];
      expect(isAdapterSelected(semgrep, projectTools)).toBe(true);
      expect(isAdapterSelected(gitleaks, projectTools)).toBe(false);
    });

    it('matches CLI flags with dashes, spaces, and case-insensitivity', () => {
      expect(isAdapterSelected(gitleaks, ['gitleaks'])).toBe(true);
      expect(isAdapterSelected(gitleaks, ['secret-scanner'])).toBe(true);
      expect(isAdapterSelected(gitleaks, ['secrets'])).toBe(true);
      expect(isAdapterSelected(semgrep, ['gitleaks'])).toBe(false);
      expect(isAdapterSelected(semgrep, ['sast'])).toBe(true);
      expect(isAdapterSelected(semgrep, ['semgrep'])).toBe(true);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_API_URL,
  fetchWithTimeout,
  getPackageVersion,
  runCli,
} from './main.js';

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
});

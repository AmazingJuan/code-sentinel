import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_API_URL, getPackageVersion, runCli } from './main.js';

describe('Code Sentinel CLI main', () => {
  it('defines the canonical default backend API URL', () => {
    expect(DEFAULT_API_URL).toBe('https://code-sentinel-api.onrender.com');
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
});


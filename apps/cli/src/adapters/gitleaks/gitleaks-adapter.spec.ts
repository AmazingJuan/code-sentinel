import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ScanTarget } from '../../domain/tool-adapter.js';
import type { CommandResult, CommandRunner } from '../../infra/command-runner.js';
import { GITLEAKS_IMAGE, GitleaksAdapter } from './gitleaks-adapter.js';

class StubRunner implements CommandRunner {
  receivedCommand = '';
  receivedArgs: string[] = [];

  constructor(private readonly result: CommandResult) {}

  async run(command: string, args: string[]): Promise<CommandResult> {
    this.receivedCommand = command;
    this.receivedArgs = args;
    return this.result;
  }
}

class ThrowingRunner implements CommandRunner {
  constructor(private readonly error: Error) {}

  async run(): Promise<CommandResult> {
    throw this.error;
  }
}

const fixtureReport = readFileSync(
  fileURLToPath(new URL('__fixtures__/gitleaks-report.json', import.meta.url)),
  'utf8',
);

const target: ScanTarget = { rootPath: '/projects/my-app' };

function buildAdapter(result: CommandResult): {
  adapter: GitleaksAdapter;
  runner: StubRunner;
} {
  const runner = new StubRunner(result);
  const adapter = new GitleaksAdapter({ runner });
  return { adapter, runner };
}

describe('GitleaksAdapter.buildDockerArgs', (): void => {
  it('mounts rootPath to /path in read-only and runs with network none and redact', (): void => {
    const adapter = new GitleaksAdapter();
    const args = adapter.buildDockerArgs(target);

    expect(args).toContain('run');
    expect(args).toContain('--network');
    expect(args).toContain('none');
    expect(args).toContain('/projects/my-app:/path:ro');
    expect(args).toContain(GITLEAKS_IMAGE);
    expect(args).toContain('dir');
    expect(args).toContain('/path');
    expect(args).toContain('--redact');
  });
});

describe('GitleaksAdapter.run', (): void => {
  it('returns stdout when exit code is 0 (no leaks)', async (): Promise<void> => {
    const { adapter } = buildAdapter({ exitCode: 0, stdout: '[]', stderr: '' });
    const output = await adapter.run(target);
    expect(output).toBe('[]');
  });

  it('returns stdout when exit code is 1 (leaks found)', async (): Promise<void> => {
    const { adapter } = buildAdapter({ exitCode: 1, stdout: fixtureReport, stderr: '' });
    const output = await adapter.run(target);
    expect(output).toBe(fixtureReport);
  });

  it('throws ToolExecutionError when exit code is not 0 or 1', async (): Promise<void> => {
    const { adapter } = buildAdapter({
      exitCode: 2,
      stdout: '',
      stderr: 'fatal: could not scan directory',
    });

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
    await expect(adapter.run(target)).rejects.toThrow('fatal: could not scan directory');
  });

  it('wraps execution failure into ToolExecutionError', async (): Promise<void> => {
    const adapter = new GitleaksAdapter({
      runner: new ThrowingRunner(new Error('docker daemon not running')),
    });

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
    await expect(adapter.run(target)).rejects.toThrow('could not start Docker');
  });
});

describe('GitleaksAdapter.parse', (): void => {
  const adapter = new GitleaksAdapter();

  it('returns empty array on empty report', (): void => {
    expect(adapter.parse('')).toEqual([]);
    expect(adapter.parse('[]')).toEqual([]);
  });

  it('correctly maps Gitleaks findings and strips container prefix', (): void => {
    const findings = adapter.parse(fixtureReport);

    expect(findings).toHaveLength(2);
    expect(findings[0]).toEqual({
      type: 'Hardcoded Secret',
      severity: 'critical',
      filePath: 'src/auth/config.ts',
      line: 12,
      cwe: 'CWE-798',
      description:
        'Uncovered a GitHub Personal Access Token, potentially leading to unauthorized repository access.',
      recommendation:
        'Revoke the exposed secret immediately, rotate credentials, and store secrets using environment variables or a dedicated secret management service.',
    });

    expect(findings[1].severity).toBe('high');
    expect(findings[1].filePath).toBe('src/services/api.ts');
    expect(findings[1].line).toBe(45);
  });

  it('throws ReportParseError on invalid JSON', (): void => {
    expect(() => adapter.parse('not-json')).toThrow(ReportParseError);
  });

  it('throws ReportParseError on non-matching schema', (): void => {
    expect(() => adapter.parse('[{"foo": "bar"}]')).toThrow(ReportParseError);
  });
});

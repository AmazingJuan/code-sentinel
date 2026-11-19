import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ScanTarget } from '../../domain/tool-adapter.js';
import type { CommandResult } from '../../infra/command-runner.js';
import type { ToolExecutor, ToolRunRequest } from '../../infra/tool-executor.js';
import { GitleaksAdapter } from './gitleaks-adapter.js';

class StubExecutor implements ToolExecutor {
  readonly kind = 'native';
  readonly description = 'stub';
  readonly binaryName = 'gitleaks';
  lastRequest: ToolRunRequest | null = null;

  constructor(private readonly resultOrError: CommandResult | Error) {}

  async execute(request: ToolRunRequest): Promise<CommandResult> {
    this.lastRequest = request;
    if (this.resultOrError instanceof Error) throw this.resultOrError;
    return this.resultOrError;
  }
}

const fixtureReport = readFileSync(
  fileURLToPath(new URL('__fixtures__/gitleaks-report.json', import.meta.url)),
  'utf8',
);

const target: ScanTarget = { rootPath: '/tmp/code-sentinel-ws-1' };

function buildAdapter(resultOrError: CommandResult | Error): {
  adapter: GitleaksAdapter;
  executor: StubExecutor;
} {
  const executor = new StubExecutor(resultOrError);
  const adapter = new GitleaksAdapter({
    executor: (): Promise<ToolExecutor> => Promise.resolve(executor),
  });
  return { adapter, executor };
}

describe('GitleaksAdapter.buildArgs', (): void => {
  it('scans the current directory without git history, redacting secrets into the report path', (): void => {
    const adapter = new GitleaksAdapter();
    const args = adapter.buildArgs({ inputs: {}, reportPath: '/tmp/report.json' });

    expect(args).toEqual([
      'detect',
      '--source',
      '.',
      '--report-format',
      'json',
      '--report-path',
      '/tmp/report.json',
      '--redact',
      '--no-git',
      '--no-banner',
    ]);
  });
});

describe('GitleaksAdapter.run', (): void => {
  it('runs the executor on the scan workspace', async (): Promise<void> => {
    const { adapter, executor } = buildAdapter({ exitCode: 0, stdout: '[]', stderr: '' });
    await adapter.run(target);
    expect(executor.lastRequest?.workspace).toBe(target.rootPath);
  });

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

  it('throws ToolExecutionError when exit code is 1 without JSON array in stdout', async (): Promise<void> => {
    const { adapter } = buildAdapter({
      exitCode: 1,
      stdout: '',
      stderr: 'unknown command "dir" for "gitleaks"',
    });

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
    await expect(adapter.run(target)).rejects.toThrow(
      'execution failed: unknown command "dir" for "gitleaks"',
    );
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
    const { adapter } = buildAdapter(new Error('docker daemon not running'));

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
    await expect(adapter.run(target)).rejects.toThrow('could not start stub');
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

  it('normalizes native Windows, relative and /workspace paths to project-relative paths', (): void => {
    const report = (file: string): string =>
      JSON.stringify([{ RuleID: 'generic-api-key', Description: '', StartLine: 1, File: file }]);

    expect(adapter.parse(report('src\\config\\keys.ts'))[0].filePath).toBe('src/config/keys.ts');
    expect(adapter.parse(report('./src/keys.ts'))[0].filePath).toBe('src/keys.ts');
    expect(adapter.parse(report('/workspace/src/keys.ts'))[0].filePath).toBe('src/keys.ts');
  });

  it('throws ReportParseError on invalid JSON', (): void => {
    expect(() => adapter.parse('not-json')).toThrow(ReportParseError);
  });

  it('throws ReportParseError on non-matching schema', (): void => {
    expect(() => adapter.parse('[{"foo": "bar"}]')).toThrow(ReportParseError);
  });
});

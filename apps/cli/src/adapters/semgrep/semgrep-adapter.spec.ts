import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { CommandResult } from '../../infra/command-runner.js';
import type { ToolExecutor, ToolRunRequest } from '../../infra/tool-executor.js';
import { SemgrepAdapter } from './semgrep-adapter.js';

const fixtureReport = readFileSync(
  new URL('./__fixtures__/semgrep-report.json', import.meta.url),
  'utf8',
);

const target = { rootPath: 'C:\\Temp\\code-sentinel-ws-1' };

/** Fake executor: stores the request and returns a predefined response without running tools. */
class FakeExecutor implements ToolExecutor {
  readonly kind = 'container';
  readonly description = 'fake';
  lastRequest: ToolRunRequest | null = null;

  constructor(
    private readonly resultOrError: CommandResult | Error,
    readonly binaryName: string = 'semgrep',
  ) {}

  execute(request: ToolRunRequest): Promise<CommandResult> {
    this.lastRequest = request;
    return this.resultOrError instanceof Error
      ? Promise.reject(this.resultOrError)
      : Promise.resolve(this.resultOrError);
  }
}

function buildAdapter(
  resultOrError: CommandResult | Error,
  options: { binaryName?: string; registry?: string | null } = {},
): { adapter: SemgrepAdapter; executor: FakeExecutor } {
  const executor = new FakeExecutor(resultOrError, options.binaryName);
  const adapter = new SemgrepAdapter({
    executor: (): Promise<ToolExecutor> => Promise.resolve(executor),
    rulesDir: '/rules',
    registryRules: (): Promise<string | null> =>
      Promise.resolve(options.registry === undefined ? '/cache/p-default.yml' : options.registry),
  });
  return { adapter, executor };
}

function argsOf(executor: FakeExecutor): string[] {
  const request = executor.lastRequest as ToolRunRequest;
  return request.buildArgs({
    inputs: Object.fromEntries(
      Object.keys(request.inputs ?? {}).map((name) => [name, `/in/${name}`]),
    ),
    reportPath: '/dev/stdout',
  });
}

describe('SemgrepAdapter.parse', (): void => {
  const { adapter } = buildAdapter({ exitCode: 0, stdout: '', stderr: '' });

  it('converts real spike report into findings (RF-011, RF-016)', (): void => {
    const parsedFindings = adapter.parse(fixtureReport);

    expect(parsedFindings).toEqual([
      {
        type: 'no-v-html',
        severity: 'medium',
        filePath: 'fixtures/UnsafeView.vue',
        line: 2,
        cwe: 'CWE-79',
        description: 'v-html renders unescaped HTML and can lead to XSS vulnerabilities',
        recommendation: null,
      },
      {
        type: 'no-eval',
        severity: 'high',
        filePath: 'fixtures/unsafe.ts',
        line: 2,
        cwe: 'CWE-95',
        description: 'Use of eval() with external data allows arbitrary code execution',
        recommendation: null,
      },
    ]);
  });

  it('uses metadata.recommendation from the rule and strips "./" from the path', (): void => {
    const reportWithRecommendation = JSON.stringify({
      results: [
        {
          check_id: 'rules.no-eval',
          path: './src/unsafe.ts',
          start: { line: 7 },
          extra: {
            severity: 'ERROR',
            message: 'eval',
            metadata: { recommendation: 'Use JSON.parse' },
          },
        },
      ],
    });

    const [parsedFinding] = adapter.parse(reportWithRecommendation);

    expect(parsedFinding.filePath).toBe('src/unsafe.ts');
    expect(parsedFinding.recommendation).toBe('Use JSON.parse');
  });

  it('throws ReportParseError if output is not valid JSON (RF-016)', (): void => {
    expect((): unknown => adapter.parse('Killed')).toThrow(ReportParseError);
  });

  it('throws ReportParseError if "results" is not a valid array (RF-016)', (): void => {
    expect((): unknown => adapter.parse('{"results": 1}')).toThrow(ReportParseError);
    expect((): unknown => adapter.parse('{"results": [{"path": 3}]}')).toThrow(ReportParseError);
  });
});

describe('SemgrepAdapter.run', (): void => {
  it('scans the workspace with cached p/default and bundled rules, metrics disabled', async (): Promise<void> => {
    const { adapter, executor } = buildAdapter({ exitCode: 0, stdout: fixtureReport, stderr: '' });

    const rawReport = await adapter.run(target);

    expect(rawReport).toBe(fixtureReport);
    expect(executor.lastRequest?.workspace).toBe(target.rootPath);
    expect(executor.lastRequest?.inputs).toEqual({
      rules: '/rules',
      registry: '/cache/p-default.yml',
    });
    const args = argsOf(executor);
    expect(args).toEqual([
      'scan',
      '--quiet',
      '--json',
      '--metrics=off',
      '--disable-version-check',
      '--config',
      '/in/registry',
      '--config',
      '/in/rules',
      '.',
    ]);
    // Rules are local, so the registry is never fetched from inside the scan.
    expect(args).not.toContain('p/default');
  });

  it('uses only bundled rules when the registry ruleset is unavailable', async (): Promise<void> => {
    const { adapter, executor } = buildAdapter(
      { exitCode: 0, stdout: fixtureReport, stderr: '' },
      { registry: null },
    );

    await adapter.run(target);

    expect(executor.lastRequest?.inputs).toEqual({ rules: '/rules' });
    expect(argsOf(executor).filter((arg) => arg === '--config')).toHaveLength(1);
  });

  it('omits --metrics for opengrep, which does not support it', async (): Promise<void> => {
    const { adapter, executor } = buildAdapter(
      { exitCode: 0, stdout: fixtureReport, stderr: '' },
      { binaryName: 'opengrep' },
    );

    await adapter.run(target);

    expect(argsOf(executor)).not.toContain('--metrics=off');
  });

  it('throws ToolExecutionError with last line of stderr if exit code is non-zero', async (): Promise<void> => {
    const { adapter } = buildAdapter({
      exitCode: 2,
      stdout: '',
      stderr: 'Scanning...\nInvalid rule schema',
    });

    await expect(adapter.run(target)).rejects.toThrow(
      new ToolExecutionError('Semgrep', 'exit code 2: Invalid rule schema'),
    );
  });

  it('throws ToolExecutionError if the tool cannot be started', async (): Promise<void> => {
    const { adapter } = buildAdapter(new Error('spawn docker ENOENT'));

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
  });

  it('throws ToolExecutionError if no engine is available', async (): Promise<void> => {
    const adapter = new SemgrepAdapter({
      executor: (): Promise<ToolExecutor> => Promise.reject(new Error('docker is not available')),
      registryRules: (): Promise<string | null> => Promise.resolve(null),
    });

    await expect(adapter.run(target)).rejects.toThrow(
      'Semgrep failed to execute: docker is not available',
    );
  });
});

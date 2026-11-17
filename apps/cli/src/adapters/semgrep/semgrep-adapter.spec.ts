import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { CommandResult, CommandRunner } from '../../infra/command-runner.js';
import { SemgrepAdapter } from './semgrep-adapter.js';

const fixtureReport = readFileSync(
  new URL('./__fixtures__/semgrep-report.json', import.meta.url),
  'utf8',
);

const target = { rootPath: 'C:\\projects\\my-app' };

/** Fake runner: stores received arguments and returns a predefined response. */
class FakeCommandRunner implements CommandRunner {
  receivedArgs: readonly string[] = [];

  constructor(private readonly resultOrError: CommandResult | Error) {}

  run(_command: string, args: readonly string[]): Promise<CommandResult> {
    this.receivedArgs = args;
    return this.resultOrError instanceof Error
      ? Promise.reject(this.resultOrError)
      : Promise.resolve(this.resultOrError);
  }
}

function buildAdapter(resultOrError: CommandResult | Error): {
  adapter: SemgrepAdapter;
  runner: FakeCommandRunner;
} {
  const runner = new FakeCommandRunner(resultOrError);
  return { adapter: new SemgrepAdapter({ runner, rulesDir: '/rules' }), runner };
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
  it('runs Docker with network enabled, p/default rules, and disabled metrics', async (): Promise<void> => {
    const { adapter, runner } = buildAdapter({ exitCode: 0, stdout: fixtureReport, stderr: '' });

    const rawReport = await adapter.run(target);

    expect(rawReport).toBe(fixtureReport);
    expect(runner.receivedArgs).toContain('p/default');
    expect(runner.receivedArgs).toContain('/rules');
    expect(runner.receivedArgs).toContain('--metrics=off');
    expect(runner.receivedArgs).toContain('C:\\projects\\my-app:/src:ro');
    expect(runner.receivedArgs.join(' ')).not.toContain('--network none');
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

  it('throws ToolExecutionError if Docker is not available', async (): Promise<void> => {
    const { adapter } = buildAdapter(new Error('spawn docker ENOENT'));

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
  });
});

import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../domain/errors.js';
import type { NormalizedFinding, ParsedFinding, ToolCategory } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';
import { runAdapters } from './run-adapters.js';

/** Fake adapter: returns a fixed report or fails without running real commands. */
class FakeAdapter implements ToolAdapter {
  constructor(
    readonly sourceTool: string,
    readonly toolCategory: ToolCategory,
    private readonly reportOrError: string | Error,
  ) {}

  run(): Promise<string> {
    return this.reportOrError instanceof Error
      ? Promise.reject(this.reportOrError)
      : Promise.resolve(this.reportOrError);
  }

  parse(rawReport: string): ParsedFinding[] {
    const parsedReport: unknown = JSON.parse(rawReport);
    if (!Array.isArray(parsedReport)) {
      throw new ReportParseError(this.sourceTool, 'expected an array');
    }
    return parsedReport as ParsedFinding[];
  }
}

const target = { rootPath: '/project' };

function buildReport(type: string): string {
  return JSON.stringify([
    {
      type,
      severity: 'high',
      filePath: 'src/index.ts',
      line: 1,
      description: null,
      recommendation: null,
    },
  ]);
}

describe('runAdapters', (): void => {
  it('aggregates findings from multiple tools and preserves origin (RF-017, RF-018)', async (): Promise<void> => {
    const result = await runAdapters(
      [
        new FakeAdapter('Semgrep', 'SAST', buildReport('no-eval')),
        new FakeAdapter('Gitleaks', 'Secret Scanner', buildReport('github-pat')),
      ],
      target,
    );

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding: NormalizedFinding): string => finding.sourceTool)).toEqual(
      ['Semgrep', 'Gitleaks'],
    );
  });

  it('records error if a tool fails while allowing others to continue (RF-030)', async (): Promise<void> => {
    const result = await runAdapters(
      [
        new FakeAdapter(
          'Semgrep',
          'SAST',
          new ToolExecutionError('Semgrep', 'docker not responding'),
        ),
        new FakeAdapter('Gitleaks', 'Secret Scanner', buildReport('github-pat')),
      ],
      target,
    );

    expect(result.errors).toEqual(['Semgrep failed to execute: docker not responding']);
    expect(result.findings).toHaveLength(1);
  });

  it('treats malformed reports as processing errors (RF-016)', async (): Promise<void> => {
    const result = await runAdapters(
      [new FakeAdapter('Semgrep', 'SAST', '{"results": 1}')],
      target,
    );

    expect(result.findings).toEqual([]);
    expect(result.errors[0]).toContain('invalid report');
  });

  it('runs tools through the pipeline preserving tool category (RF-030)', async (): Promise<void> => {
    const result = await runAdapters(
      [new FakeAdapter('Gitleaks', 'Secret Scanner', buildReport('exposed-token'))],
      target,
    );

    expect(result.findings[0]).toMatchObject({
      sourceTool: 'Gitleaks',
      toolCategory: 'Secret Scanner',
    });
  });

  it('runs tools in parallel and reports per-tool timings', async (): Promise<void> => {
    class SlowAdapter extends FakeAdapter {
      override run(): Promise<string> {
        return new Promise((resolve): void => {
          setTimeout((): void => resolve('[]'), 150);
        });
      }
    }

    const startedAt = performance.now();
    const result = await runAdapters(
      [
        new SlowAdapter('Semgrep', 'SAST', '[]'),
        new SlowAdapter('Gitleaks', 'Secret Scanner', '[]'),
      ],
      target,
    );
    const elapsed = performance.now() - startedAt;

    // Sequential execution would take at least 300ms.
    expect(elapsed).toBeLessThan(280);
    expect(result.timings.map((timing) => timing.sourceTool)).toEqual(['Semgrep', 'Gitleaks']);
    expect(result.timings.every((timing) => timing.ok && timing.durationMs >= 100)).toBe(true);
  });

  it('marks failed tools in timings', async (): Promise<void> => {
    const result = await runAdapters(
      [new FakeAdapter('Semgrep', 'SAST', new ToolExecutionError('Semgrep', 'boom'))],
      target,
    );

    expect(result.timings[0]).toMatchObject({ sourceTool: 'Semgrep', ok: false });
  });
});

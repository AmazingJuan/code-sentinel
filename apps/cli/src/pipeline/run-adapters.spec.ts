import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../domain/errors.js';
import type { NormalizedFinding, ParsedFinding, ToolCategory } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';
import { runAdapters } from './run-adapters.js';

/** Adaptador de mentira: devuelve un reporte fijo o falla, sin ejecutar nada real. */
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
      throw new ReportParseError(this.sourceTool, 'se esperaba un arreglo');
    }
    return parsedReport as ParsedFinding[];
  }
}

const target = { rootPath: '/proyecto' };

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
  it('junta los findings de varias herramientas y conserva su origen (RF-017, RF-018)', async (): Promise<void> => {
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

  it('si una herramienta falla, anota el error y las demás siguen (RF-030)', async (): Promise<void> => {
    const result = await runAdapters(
      [
        new FakeAdapter('Semgrep', 'SAST', new ToolExecutionError('Semgrep', 'docker no responde')),
        new FakeAdapter('Gitleaks', 'Secret Scanner', buildReport('github-pat')),
      ],
      target,
    );

    expect(result.errors).toEqual(['Semgrep no se pudo ejecutar: docker no responde']);
    expect(result.findings).toHaveLength(1);
  });

  it('un reporte malformado queda como error de procesamiento (RF-016)', async (): Promise<void> => {
    const result = await runAdapters(
      [new FakeAdapter('Semgrep', 'SAST', '{"results": 1}')],
      target,
    );

    expect(result.findings).toEqual([]);
    expect(result.errors[0]).toContain('reporte inválido');
  });

  it('una herramienta nueva funciona sin tocar el pipeline (RF-030)', async (): Promise<void> => {
    const result = await runAdapters(
      [new FakeAdapter('Nmap', 'Port Scanner', buildReport('open-port'))],
      target,
    );

    expect(result.findings[0]).toMatchObject({ sourceTool: 'Nmap', toolCategory: 'Port Scanner' });
  });
});

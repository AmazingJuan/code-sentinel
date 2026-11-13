import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { CommandResult, CommandRunner } from '../../infra/command-runner.js';
import { SemgrepAdapter } from './semgrep-adapter.js';

const fixtureReport = readFileSync(
  new URL('./__fixtures__/semgrep-report.json', import.meta.url),
  'utf8',
);

const target = { rootPath: 'C:\\proyectos\\mi app' };

/** Runner de mentira: guarda los argumentos recibidos y devuelve una respuesta fija. */
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
  return { adapter: new SemgrepAdapter({ runner, rulesDir: '/reglas' }), runner };
}

describe('SemgrepAdapter.parse', (): void => {
  const { adapter } = buildAdapter({ exitCode: 0, stdout: '', stderr: '' });

  it('convierte el reporte real del spike en findings (RF-011, RF-016)', (): void => {
    const parsedFindings = adapter.parse(fixtureReport);

    expect(parsedFindings).toEqual([
      {
        type: 'no-v-html',
        severity: 'medium',
        filePath: 'fixtures/UnsafeView.vue',
        line: 2,
        description: 'v-html renderiza HTML sin escapar y permite XSS',
        recommendation: null,
      },
      {
        type: 'no-eval',
        severity: 'high',
        filePath: 'fixtures/unsafe.ts',
        line: 2,
        description: 'eval() con datos externos permite ejecutar código arbitrario',
        recommendation: null,
      },
    ]);
  });

  it('usa metadata.recommendation de la regla y limpia el "./" de la ruta', (): void => {
    const reportWithRecommendation = JSON.stringify({
      results: [
        {
          check_id: 'rules.no-eval',
          path: './src/unsafe.ts',
          start: { line: 7 },
          extra: {
            severity: 'ERROR',
            message: 'eval',
            metadata: { recommendation: 'Usa JSON.parse' },
          },
        },
      ],
    });

    const [parsedFinding] = adapter.parse(reportWithRecommendation);

    expect(parsedFinding.filePath).toBe('src/unsafe.ts');
    expect(parsedFinding.recommendation).toBe('Usa JSON.parse');
  });

  it('lanza ReportParseError si la salida no es JSON (RF-016)', (): void => {
    expect((): unknown => adapter.parse('Killed')).toThrow(ReportParseError);
  });

  it('lanza ReportParseError si "results" no es un arreglo válido (RF-016)', (): void => {
    expect((): unknown => adapter.parse('{"results": 1}')).toThrow(ReportParseError);
    expect((): unknown => adapter.parse('{"results": [{"path": 3}]}')).toThrow(ReportParseError);
  });
});

describe('SemgrepAdapter.run', (): void => {
  it('corre Docker sin red y sin métricas (NFR-007)', async (): Promise<void> => {
    const { adapter, runner } = buildAdapter({ exitCode: 0, stdout: fixtureReport, stderr: '' });

    const rawReport = await adapter.run(target);

    expect(rawReport).toBe(fixtureReport);
    expect(runner.receivedArgs.join(' ')).toContain('--network none');
    expect(runner.receivedArgs).toContain('--metrics=off');
    expect(runner.receivedArgs).toContain('C:\\proyectos\\mi app:/src:ro');
  });

  it('lanza ToolExecutionError con la última línea de stderr si el código de salida no es 0', async (): Promise<void> => {
    const { adapter } = buildAdapter({
      exitCode: 2,
      stdout: '',
      stderr: 'Scanning...\nInvalid rule schema',
    });

    await expect(adapter.run(target)).rejects.toThrow(
      new ToolExecutionError('Semgrep', 'código de salida 2: Invalid rule schema'),
    );
  });

  it('lanza ToolExecutionError si Docker no está instalado', async (): Promise<void> => {
    const { adapter } = buildAdapter(new Error('spawn docker ENOENT'));

    await expect(adapter.run(target)).rejects.toThrow(ToolExecutionError);
  });
});

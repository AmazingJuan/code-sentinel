import { fileURLToPath } from 'node:url';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ParsedFinding, ToolCategory } from '../../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../../domain/tool-adapter.js';
import {
  type CommandResult,
  type CommandRunner,
  NodeCommandRunner,
} from '../../infra/command-runner.js';
import { isSemgrepReport, type SemgrepResult } from './semgrep-report.js';
import { mapSemgrepSeverity } from './semgrep-severity.js';

/** Versión fija de la imagen: el mismo código siempre da el mismo resultado. */
export const SEMGREP_IMAGE = 'semgrep/semgrep:1.181.1';

/** apps/cli/rules, tanto desde src/ (tests) como desde dist/ (build): ambos están a 3 niveles. */
const DEFAULT_RULES_DIR = fileURLToPath(new URL('../../../rules', import.meta.url));

const CONTAINER_SOURCE_DIR = '/src';
const CONTAINER_RULES_DIR = '/rules';
const EXCLUDED_DIRS = ['node_modules', 'dist', 'coverage'] as const;

export interface SemgrepAdapterOptions {
  runner?: CommandRunner;
  rulesDir?: string;
}

/** RF-011: análisis estático con Semgrep CE, corriendo en Docker sin red (NFR-007). */
export class SemgrepAdapter implements ToolAdapter {
  readonly sourceTool = 'Semgrep';
  readonly toolCategory: ToolCategory = 'SAST';

  private readonly runner: CommandRunner;
  private readonly rulesDir: string;

  constructor(options: SemgrepAdapterOptions = {}) {
    this.runner = options.runner ?? new NodeCommandRunner();
    this.rulesDir = options.rulesDir ?? DEFAULT_RULES_DIR;
  }

  buildDockerArgs(target: ScanTarget): string[] {
    const excludeArgs = EXCLUDED_DIRS.flatMap((dir: string): string[] => ['--exclude', dir]);
    return [
      'run',
      '--rm',
      '--network',
      'none',
      '-v',
      `${target.rootPath}:${CONTAINER_SOURCE_DIR}:ro`,
      '-v',
      `${this.rulesDir}:${CONTAINER_RULES_DIR}:ro`,
      '-w',
      CONTAINER_SOURCE_DIR,
      SEMGREP_IMAGE,
      'semgrep',
      'scan',
      '--config',
      CONTAINER_RULES_DIR,
      '--json',
      '--metrics=off',
      '--disable-version-check',
      '--no-git-ignore',
      ...excludeArgs,
      '.',
    ];
  }

  async run(target: ScanTarget): Promise<string> {
    const result = await this.execute(this.buildDockerArgs(target));

    // Semgrep sale con 0 haya o no hallazgos; cualquier otro código es un fallo real.
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'sin detalle';
      throw new ToolExecutionError(
        this.sourceTool,
        `código de salida ${result.exitCode}: ${detail}`,
      );
    }
    return result.stdout;
  }

  parse(rawReport: string): ParsedFinding[] {
    let report: unknown;
    try {
      report = JSON.parse(rawReport);
    } catch {
      throw new ReportParseError(this.sourceTool, 'la salida no es JSON');
    }
    if (!isSemgrepReport(report)) {
      throw new ReportParseError(
        this.sourceTool,
        'falta el arreglo "results" o tiene elementos inválidos',
      );
    }
    return report.results.map((semgrepResult: SemgrepResult): ParsedFinding =>
      this.toParsedFinding(semgrepResult),
    );
  }

  private async execute(args: string[]): Promise<CommandResult> {
    try {
      return await this.runner.run('docker', args);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(this.sourceTool, `no se pudo iniciar Docker (${detail})`);
    }
  }

  private toParsedFinding(semgrepResult: SemgrepResult): ParsedFinding {
    const recommendation = semgrepResult.extra.metadata?.recommendation;
    return {
      // check_id llega como "rules.no-eval": el prefijo es la carpeta de reglas, no aporta.
      type: semgrepResult.check_id.split('.').at(-1) ?? semgrepResult.check_id,
      severity: mapSemgrepSeverity(semgrepResult.extra.severity),
      filePath: toProjectRelativePath(semgrepResult.path),
      line: semgrepResult.start.line,
      description: semgrepResult.extra.message ?? null,
      recommendation: typeof recommendation === 'string' ? recommendation : null,
    };
  }
}

/** Quita "./" o "/src/" del inicio: el backend espera rutas relativas a la raíz del proyecto. */
function toProjectRelativePath(semgrepPath: string): string {
  return semgrepPath.replace(/^\.\//, '').replace(new RegExp(`^${CONTAINER_SOURCE_DIR}/`), '');
}
